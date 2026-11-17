#!/usr/bin/env node
// End-to-end forensics test — zero network, zero dependencies.
// A fake local server serves the explorer's account-history API (txlist +
// tokentx) for a wallet whose history tells a story: an approval to an
// address SweepCheck has never seen, a reverted approval attempt, an
// outflow to a known-bad address, plus ordinary in/out activity. The CLI
// must rebuild the timeline, correlate approval→use, flag the known-bad
// outflow as danger, exit 1 — and on a chain with no account-history API
// it must say "unavailable" honestly and still exit 0.
// A forced 429 on the first explorer hit proves the burst retry.
//
// Run: node test/forensics.js
"use strict";
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const WALLET = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const SENDER = "0x5555555555555555555555555555555555555555";
const CALLTARGET = "0x6666666666666666666666666666666666666666";
// Not in the registry feed (verified) → must read as unrecognized.
const SPENDER_UNKNOWN = "0xdead00000000000000000000000000000000dead";
// In the feed with kind "attacker" AND hardcoded with an attacker label —
// danger must trigger whether or not the live feed loads.
const SPENDER_BAD = "0x8157a9d65807521fbb8db8f37eeecefdd247e9b1";

const approveInput = "0x095ea7b3"
  + SPENDER_UNKNOWN.slice(2).padStart(64, "0")
  + (1000000n).toString(16).padStart(64, "0");

const TXS = [
  { hash: "0x" + "11".repeat(32), from: SENDER, to: WALLET, value: "0xde0b6b3a7640000", input: "0x",
    isError: "0", blockNumber: "90", timeStamp: "1699999000" },                       // 1 ETH in
  { hash: "0x" + "22".repeat(32), from: WALLET, to: CALLTARGET, value: "0x0",
    input: "0xa9059cbb" + "00".repeat(96), isError: "0", blockNumber: "95", timeStamp: "1699999500" }, // contract call
  { hash: "0x" + "33".repeat(32), from: WALLET, to: TOKEN, value: "0x0", input: approveInput,
    isError: "0", blockNumber: "100", timeStamp: "1700000000" },                      // approve → unknown
  { hash: "0x" + "44".repeat(32), from: WALLET, to: TOKEN, value: "0x0", input: approveInput,
    isError: "1", blockNumber: "101", timeStamp: "1700000100" },                      // reverted approve
  { hash: "0x" + "55".repeat(32), from: WALLET, to: SPENDER_BAD, value: "0x2386f26fc10000", input: "0x",
    isError: "0", blockNumber: "102", timeStamp: "1700000200" },                      // 0.01 ETH → known-bad
];
const TRANSFERS = [
  { hash: "0x" + "66".repeat(32), from: SENDER, to: WALLET, tokenAddress: TOKEN, tokenSymbol: "USDC",
    tokenDecimal: "6", value: "2000000", blockNumber: "95", timeStamp: "1699999600" },  // 2 USDC in
  { hash: "0x" + "77".repeat(32), from: WALLET, to: SPENDER_UNKNOWN, tokenAddress: TOKEN, tokenSymbol: "USDC",
    tokenDecimal: "6", value: "1500000", blockNumber: "105", timeStamp: "1700000500" }, // 1.5 USDC out (after approve)
];

const server = http.createServer((req, res) => {
  // Explorer account-history API: first hit gets a burst-quota 429 so the
  // suite proves the retry; without it the scan errors out.
  if (req.url && req.url.startsWith("/api?module=account")) {
    res.setHeader("content-type", "application/json");
    if (!server.quotaBurned) {
      server.quotaBurned = true;
      res.statusCode = 429;
      res.end(JSON.stringify({ message: "Too many requests.", result: null, status: "0" }));
      return;
    }
    const u = new URL(req.url, "http://x");
    const action = u.searchParams.get("action");
    const result = action === "txlist" ? TXS : action === "tokentx" ? TRANSFERS : [];
    res.end(JSON.stringify({ message: "OK", status: "1", result }));
    return;
  }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    let m = {};
    try { m = JSON.parse(body); } catch (e) {}
    let out = "0x";
    if (m.method === "eth_getBlockByNumber") out = { number: "0x1000001", timestamp: "0x69000000", transactions: [] };
    else if (m.method === "eth_getBalance") out = "0x3635c9adc5dea00000";
    else if (m.method === "eth_getTransactionCount") out = "0x1";
    else if (m.method === "eth_getStorageAt") out = "0x" + "0".repeat(64);
    else if (m.method === "eth_getCode") out = "0x"; // plain wallet, no delegation
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id === undefined ? 1 : m.id, result: out }));
  });
});

function runCli(port, useAccountApi) {
  const wrapper = [
    "const api = require('./api.js');",
    "api.CHAINS.base.rpcs = ['http://127.0.0.1:' + process.env.FAKE_RPC_PORT];",
    useAccountApi
      ? "api.CHAINS.base.logsApi = 'http://127.0.0.1:' + process.env.FAKE_RPC_PORT;"
      : "delete api.CHAINS.base.logsApi;",
    "process.argv = ['node', 'sweepcheck', process.env.SC_WALLET, '--chains', 'base', '--forensics'];",
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

function judge(label, r, checks) {
  console.log("--- " + label + " ---");
  console.log(r.out.trim().split("\n").filter((l) => /forensics|warn|danger|info|VERDICT|11-|approval|token-transfer|transfer|contract-call/.test(l)).join("\n"));
  const pass = r.status !== undefined && Object.values(checks).every(Boolean);
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(pass ? "  PASS" : "  FAIL (exit=" + r.status + ") " + failed.join(", "));
  return pass;
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;

  // Run 1: account API present — timeline built, correlations fired, exit 1.
  const r1 = await runCli(port, true);
  const pass1 = judge("forensics timeline + correlations (danger path)", r1, {
    "exit 1": r1.status === 1,
    "window counts": /5 tx, 2 token transfer\(s\)/.test(r1.out),
    "via explorer-api": /via explorer-api/.test(r1.out),
    "approval→use warn": /Approval was used to move 1\.5 USDC to an address SweepCheck does not recognize/.test(r1.out),
    "known-bad outflow danger": /Funds left this wallet for a known-bad address/.test(r1.out),
    "reverted approval info": /reverted and did not take effect/.test(r1.out),
    "timeline rows": /approval 0x/.test(r1.out) && /token-transfer 0x/.test(r1.out),
    "verdict": /SWEEPER \/ DANGER FOUND/.test(r1.out),
  });

  // Run 2: no account-history API on this chain → honest "unavailable",
  // detection checks still ran, exit 0 (unavailability is not a failure).
  const r2 = await runCli(port, false);
  const pass2 = judge("no account API (honest unavailable, exit 0)", r2, {
    "exit 0": r2.status === 0,
    "unavailable line": /\[forensics\/base\] unavailable/.test(r2.out),
    "honest note": /no keyless transaction-history API/.test(r2.out),
    "detection still ran": /No delegation or code is attached/.test(r2.out),
    "no SCAN ERROR": !/SCAN ERROR/.test(r2.out),
  });

  server.close();
  const pass = pass1 && pass2;
  console.log(pass
    ? "\nforensics test: PASS (timeline rebuilt, approval→use correlated, known-bad outflow = exit 1, unavailable = exit 0)"
    : "\nforensics test: FAIL");
  process.exit(pass ? 0 : 1);
});
