#!/usr/bin/env node
// End-to-end Permit2 discovery test — zero network, zero dependencies.
// A fake local server serves Permit2's Approval event for this wallet with a
// spender SweepCheck has NEVER seen, through BOTH discovery paths:
//   run 1 — explorer logs API path, including its 1000-entry page cap
//           (the fake holds 1500 range-scoped events, so the unsplit query
//           is capped and the scan must block-range-split to recover all)
//           + a forced 429 on the first hit (proves the burst retry)
//   run 2 — raw RPC path (fallback when no logsApi / challenge page)
//   run 3 — explorer path with the live allowance read FAILING: the approval
//           must be reported `unverified` (warn), never silently `revoked`
// Each run must find the unknown spender where applicable and exit 0.
// Run: node test/permit2.js
"use strict";
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const WALLET = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const UNKNOWN_SPENDER = "0xdead00000000000000000000000000000000dead";
const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
// keccak256("Approval(address,address,address,uint160,uint48)") — cross-checked
// against the 4byte.directory registry record (id 153611) in development.
const APPROVAL_TOPIC = "0xda9fa7c1b00402c17d0161b249b1ab8bbec047c5a52207b9c112deffd817036b";
const word = (n) => n.toString(16).padStart(64, "0");
const APPROVAL_LOG = {
  address: PERMIT2,
  topics: [
    APPROVAL_TOPIC,
    "0x" + WALLET.slice(2).padStart(64, "0"),
    "0x" + TOKEN.slice(2).padStart(64, "0"),
    "0x" + UNKNOWN_SPENDER.slice(2).padStart(64, "0"),
  ],
  // Approval carries amount + expiration only (no nonce).
  data: "0x" + word(1000000n) + word(4102444800n), // expires 2100
  blockNumber: "0x1000000",
  transactionHash: "0x" + "ab".repeat(32),
  logIndex: "0x1",
};

// Fake chain history: 1500 Approval events spread across [1, latest], all
// for the same (token, spender) pair. Any range query returns that range's
// events capped at 1000 (the explorer's page limit), so the unsplit
// full-history query gets capped and the scan must range-split to recover
// all 1500 — the halves' union is the assertion ("1500 event(s)").
const TOTAL_EVENTS = 1500;
const EVENTS = Array.from({ length: TOTAL_EVENTS }, (_, i) => ({
  ...APPROVAL_LOG,
  blockNumber: "0x" + (1 + Math.floor(i * (16777215 / TOTAL_EVENTS))).toString(16),
  transactionHash: "0x" + i.toString(16).padStart(64, "0"),
}));

let failP2Read = false; // toggled by run 3: Permit2 allowance() read returns nothing

const server = http.createServer((req, res) => {
  // Explorer logs API path: etherscan/blockscout-compatible shape.
  // First hit returns a burst-quota 429 so the suite proves the retry too —
  // without a working retry the scan falls to RPC and the
  // "via explorer-api" assertion fails.
  if (req.url && req.url.startsWith("/api?module=logs")) {
    res.setHeader("content-type", "application/json");
    if (!server.quotaBurned) {
      server.quotaBurned = true;
      res.statusCode = 429;
      res.end(JSON.stringify({ message: "Too many requests.", result: null, status: "0" }));
      return;
    }
    const u = new URL(req.url, "http://x");
    const topic0 = u.searchParams.get("topic0");
    const from = u.searchParams.get("fromBlock");
    const to = u.searchParams.get("toBlock");
    let result;
    if (topic0 !== APPROVAL_TOPIC) result = []; // no Permit events in this fake chain
    else {
      const fromN = parseInt(from, 10), toN = parseInt(to, 10);
      result = EVENTS.filter((e) => { const b = parseInt(e.blockNumber, 16); return b >= fromN && b <= toN; }).slice(0, 1000);
    }
    if (process.env.FAKE_DEBUG) console.error("[fake-api] from=" + from + " to=" + to + " topic=" + (topic0 === APPROVAL_TOPIC ? "APPROVAL" : String(topic0).slice(0, 12)) + " len=" + result.length);
    res.end(JSON.stringify({ message: "OK", result }));
    return;
  }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    let m = {};
    try { m = JSON.parse(body); } catch (e) {}
    const p = Array.isArray(m.params) ? m.params : [];
    let out = "0x";
    if (m.method === "eth_getBlockByNumber") out = { number: "0x1000001", timestamp: "0x69000000", transactions: [] };
    else if (m.method === "eth_getLogs") out = [APPROVAL_LOG];
    else if (m.method === "eth_getCode") out = p[0] && String(p[0]).toLowerCase() === PERMIT2 ? "0x6080604052" : "0x";
    else if (m.method === "eth_call") {
      const data = String((p[0] && p[0].data) || "");
      if (data.startsWith("0x95d89b41")) out = "0x"; // symbol → null → "token"
      else if (data.startsWith("0x313ce567")) out = "0x" + word(6n); // decimals → 6
      else if (data.startsWith("0xdd62ed3e")) out = "0x" + word(1000000n); // wallet→Permit2 allowance nonzero → usable now
      else if (data.startsWith("0x927da105")) out = failP2Read ? "0x" : "0x" + word(1000000n) + word(4102444800n) + word(1n); // Permit2 packed allowance
      else out = "0x";
    } else if (m.method === "eth_getStorageAt") out = "0x" + "0".repeat(64);
    else if (m.method === "eth_getBalance") out = "0x0";
    else if (m.method === "eth_getTransactionCount") out = "0x1";
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id === undefined ? 1 : m.id, result: out }));
  });
});

function runCli(port, useExplorer) {
  const wrapper = [
    "const api = require('./api.js');",
    "api.CHAINS.base.rpcs = ['http://127.0.0.1:' + process.env.FAKE_RPC_PORT];",
    useExplorer
      ? "api.CHAINS.base.logsApi = 'http://127.0.0.1:' + process.env.FAKE_RPC_PORT;"
      : "delete api.CHAINS.base.logsApi;",
    "process.argv = ['node', 'sweepcheck', process.env.SC_WALLET, '--chains', 'base', '--permit2'];",
    "require('./bin/sweepcheck');",
  ].join("");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", wrapper], {
      cwd: root,
      env: { ...process.env, FAKE_RPC_PORT: String(port), SC_WALLET: WALLET },
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (status) => resolve({ status, out }));
  });
}

function report(label, out, patterns) {
  console.log("--- " + label + " ---");
  console.log(out.trim().split("\n").filter((l) => /permit2|UNVERIFIED|warn|error/i.test(l)).join("\n"));
  return patterns;
}

function judgeDiscovery(label, via, r) {
  const checks = {
    "exit 0": r.status === 0,
    "unknown spender labeled": /does not recognize/.test(r.out) && r.out.includes(UNKNOWN_SPENDER),
    "event-log provenance": /Discovered from Permit2 event logs/.test(r.out),
    ["via " + via]: r.out.includes("via " + via),
  };
  report(label, r.out, checks);
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? "  PASS" : "  FAIL " + JSON.stringify(checks));
  return pass;
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;

  // Run 1: explorer path — the full-history query is capped at 1000 by the
  // fake, so the scan must range-split; recovering all 1500 events proves
  // nothing was lost to the cap (dedupe still yields the one approval).
  const r1 = await runCli(port, true);
  const splitOk = /1500 event\(s\)/.test(r1.out);
  const ok1 = judgeDiscovery("explorer-api path (1000-cap split)", "explorer-api", r1);
  if (!splitOk) { console.log("  FAIL range-splitting: expected '1500 event(s)'"); }
  const pass1 = ok1 && splitOk;

  // Run 2: raw RPC path.
  const r2 = await runCli(port, false);
  const pass2 = judgeDiscovery("rpc path", "rpc", r2);

  // Run 3: explorer path with the live Permit2 read failing → the approval
  // must surface as UNVERIFIED (a warn finding), never as revoked/silent.
  failP2Read = true;
  const r3 = await runCli(port, true);
  failP2Read = false;
  const unverifiedOk = r3.status === 0
    && /UNVERIFIED/.test(r3.out)
    && /Re-run the check/.test(r3.out)
    && !/revoked-or-reset/.test(r3.out)
    && r3.out.includes("via explorer-api");
  report("failed-read path (must be unverified, not revoked)", r3.out, {});
  console.log(unverifiedOk ? "  PASS" : "  FAIL (exit=" + r3.status + ")");

  server.close();
  const pass = pass1 && pass2 && unverifiedOk;
  console.log(pass
    ? "\npermit2 test: PASS (unknown spender discovered on both paths; failed read reported unverified; exit 0)"
    : "\npermit2 test: FAIL");
  process.exit(pass ? 0 : 1);
});
