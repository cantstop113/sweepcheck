#!/usr/bin/env node
// End-to-end verdict test — zero network, zero dependencies.
// A fake local RPC presents a wallet delegated (0xef0100) to the known Base
// sweeper 0x7c802f06…, whose bytecode carries the forwarder fingerprint and
// whose storage slot 0 points at collector 0x70a3df69…. The CLI must report
// SWEEPER ATTACHED and exit 1.
//
// Run: node test/verdict.js
"use strict";
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const VICTIM = "0x1111111111111111111111111111111111111111";
const DELEGATE = "0x7c802f062c67058d0dd40b041204b960e8bde26a";
const COLLECTOR = "0x70a3df699512f39c682f94fad498454c90b8c219";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    let m = {};
    try { m = JSON.parse(body); } catch (e) { /* not json — answered as 0x below */ }
    const p = Array.isArray(m.params) ? m.params : [];
    let out = "0x";
    if (m.method === "eth_getCode") {
      const addr = String(p[0] || "").toLowerCase();
      if (addr === VICTIM) out = "0xef0100" + DELEGATE.slice(2);   // delegated EOA designator (48 chars)
      else if (addr === DELEGATE) out = "0x60806040c4d66de85260206000f3b269681d00"; // fingerprint selectors present
    } else if (m.method === "eth_getStorageAt") {
      out = "0x" + "0".repeat(24) + COLLECTOR.slice(2);            // slot 0 → collector
    } else if (m.method === "eth_getBalance") {
      out = "0x3635c9adc5dea00000";                                 // 100 ETH
    } else if (m.method === "eth_getTransactionCount") {
      out = "0x1";
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id === undefined ? 1 : m.id, result: out }));
  });
});

function runCli(port) {
  // The wrapper mutates CHAINS BEFORE loading the CLI, so the child process's
  // single api.js instance serves both the patched RPC list and the CLI.
  const wrapper = [
    "const api = require('./api.js');",
    "api.CHAINS.base.rpcs = ['http://127.0.0.1:' + process.env.FAKE_RPC_PORT];",
    "process.argv = ['node', 'sweepcheck', process.env.SC_VICTIM, '--chains', 'base'];",
    "require('./bin/sweepcheck');",
  ].join("");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", wrapper], {
      cwd: root,
      env: { ...process.env, FAKE_RPC_PORT: String(port), SC_VICTIM: VICTIM },
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (status) => resolve({ status, out }));
  });
}

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const { status, out } = await runCli(port);
  server.close();
  const pass = status === 1 && /SWEEPER ATTACHED/.test(out) && /forwards to/.test(out) && /exit 1/.test(out);
  console.log(out.trim());
  console.log(pass ? "\nverdict test: PASS (exit 1, sweeper + forwarding destination reported)"
                   : "\nverdict test: FAIL (exit=" + status + ")");
  process.exit(pass ? 0 : 1);
});
