#!/usr/bin/env node
// End-to-end Permit2 discovery test — zero network, zero dependencies.
// A fake local server serves Permit2's Approval event for this wallet with a
// spender SweepCheck has NEVER seen, through BOTH discovery paths:
//   run 1 — the explorer logs API path (the usual one on live chains)
//   run 2 — the raw RPC path (fallback when no logsApi / challenge page)
// Each CLI run with --permit2 must find the unknown spender from the event
// log, label it unrecognized, and exit 0 (warn, not danger).
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

const server = http.createServer((req, res) => {
  // Explorer logs API path: etherscan/blockscout-compatible shape.
  // The FIRST hit returns a burst-quota 429 so the offline suite proves the
  // retry path too — without a working retry the scan falls to RPC and the
  // "via explorer-api" assertion fails.
  if (req.url && req.url.startsWith("/api?module=logs")) {
    res.setHeader("content-type", "application/json");
    if (!server.quotaBurned) {
      server.quotaBurned = true;
      res.statusCode = 429;
      res.end(JSON.stringify({ message: "Too many requests.", result: null, status: "0" }));
      return;
    }
    res.end(JSON.stringify({ message: "OK", result: [APPROVAL_LOG] }));
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
      else if (data.startsWith("0x927da105")) out = "0x" + word(1000000n) + word(4102444800n) + word(1n); // Permit2 packed allowance
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

function judge(label, via, { status, out }) {
  const pass = status === 0
    && /does not recognize/.test(out)
    && out.includes(UNKNOWN_SPENDER)
    && /Discovered from Permit2 event logs/.test(out)
    && out.includes("via " + via);
  console.log("--- " + label + " (expect via " + via + ") ---");
  console.log(out.trim().split("\n").filter((l) => l.includes("permit2/") || l.includes("does not recognize")).join("\n"));
  console.log(pass ? "  PASS" : "  FAIL (exit=" + status + ")");
  return pass;
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const r1 = await runCli(port, true);   // explorer logs API path
  const r2 = await runCli(port, false);  // raw RPC path
  server.close();
  const ok1 = judge("explorer-api path", "explorer-api", r1);
  const ok2 = judge("rpc path", "rpc", r2);
  const pass = ok1 && ok2;
  console.log(pass ? "\npermit2 test: PASS (unknown spender discovered on both paths, exit 0)"
                   : "\npermit2 test: FAIL");
  process.exit(pass ? 0 : 1);
});
