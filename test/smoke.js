#!/usr/bin/env node
// SweepCheck zero-dependency smoke test: registry integrity + api.js load/merge.
// Run: node test/smoke.js   (wired into .github/workflows/validate.yml)
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log("ok   " + msg);
  else { failures++; console.error("FAIL " + msg); }
};
const isAddr = (a) => typeof a === "string" && /^0x[0-9a-f]{40}$/.test(a);
const isSelector = (s) => typeof s === "string" && /^[0-9a-f]{1,8}$/.test(s);

const CHAINS = ["ethereum", "bsc", "base", "optimism", "arbitrum", "polygon", "linea", "scroll"];
const DELEGATE_KINDS = ["sweeper", "suspicious", "safe"];
const SPENDER_KINDS = ["attacker", "router", "safe"];
const EVIDENCE = ["known", "checked-live", "pattern-match", "reverify-pending"];

// ---- registry integrity ----
let reg = null;
try {
  reg = JSON.parse(fs.readFileSync(path.join(root, "registry", "sweepers.json"), "utf8"));
  ok(true, "registry/sweepers.json parses");
} catch (e) {
  ok(false, "registry/sweepers.json parses: " + e.message);
}

if (reg) {
  ok(reg.schema === "sweepcheck-registry-2", "schema is sweepcheck-registry-2 (got " + reg.schema + ")");
  const upd = Date.parse(reg.updated);
  ok(!isNaN(upd), "updated is an ISO date (got " + reg.updated + ")");
  const ageDays = (Date.now() - upd) / 86400000;
  ok(ageDays <= 180, "updated within 180 days (age " + Math.round(ageDays) + "d) — re-verify feed and bump 'updated'");
  ok(Array.isArray(reg.fingerprint) && reg.fingerprint.length > 0 && reg.fingerprint.every(isSelector),
    "fingerprint is a non-empty hex-selector array");

  ok(Array.isArray(reg.delegates) && reg.delegates.length > 0, "delegates non-empty");
  const seenD = new Set();
  for (const d of reg.delegates || []) {
    const t = "delegate " + d.address;
    ok(isAddr(d.address), t + ": lowercase address");
    ok(CHAINS.includes(d.chain), t + ": chain in vocabulary (got " + d.chain + ")");
    ok(DELEGATE_KINDS.includes(d.kind), t + ": kind valid (got " + d.kind + ")");
    ok(typeof d.label === "string" && d.label.length > 0, t + ": label present");
    ok(EVIDENCE.includes(d.evidence), t + ": evidence tag valid (got " + d.evidence + ")");
    if (d.forwardsTo !== undefined) ok(isAddr(d.forwardsTo), t + ": forwardsTo is a lowercase address");
    const key = d.address + "|" + d.chain;
    ok(!seenD.has(key), t + ": no duplicate address+chain");
    seenD.add(key);
  }

  ok(Array.isArray(reg.spenders) && reg.spenders.length > 0, "spenders non-empty");
  const seenS = new Set();
  for (const s of reg.spenders || []) {
    const t = "spender " + s.address;
    ok(isAddr(s.address), t + ": lowercase address");
    ok(SPENDER_KINDS.includes(s.kind), t + ": kind valid (got " + s.kind + ")");
    ok(!seenS.has(s.address), t + ": no duplicate");
    seenS.add(s.address);
  }

  for (const [name, list] of [["collectors", reg.collectors], ["executionRelays", reg.executionRelays]]) {
    for (const e of list || []) {
      const t = name + " " + e.address;
      ok(isAddr(e.address), t + ": lowercase address");
      ok(CHAINS.includes(e.chain), t + ": chain in vocabulary (got " + e.chain + ")");
      ok(EVIDENCE.includes(e.evidence), t + ": evidence tag valid (got " + e.evidence + ")");
      ok(Array.isArray(e.fedBy) && e.fedBy.length > 0 && e.fedBy.every(isAddr),
        t + ": fedBy lists lowercase addresses");
    }
  }
}

// ---- api.js: loads bare in Node, merge works, single-source fingerprint ----
let api = null;
try {
  api = require(path.join(root, "api.js"));
  ok(true, "api.js requires cleanly in Node");
} catch (e) {
  ok(false, "api.js requires cleanly in Node: " + e.message);
}

if (api) {
  ok(typeof api.applyRegistry === "function", "applyRegistry exported");
  ok(api.applyRegistry({ schema: "bogus" }) === false, "applyRegistry rejects wrong schema");

  if (reg) {
    ok(api.applyRegistry(reg) === true, "applyRegistry accepts the live feed");
    const d = api.KNOWN_DELEGATES["0x7c802f062c67058d0dd40b041204b960e8bde26a"];
    ok(!!d && d.kind === "sweeper" && typeof d.label === "string",
      "feed delegate merged into KNOWN_DELEGATES with kind+label");

    // fingerprint must be single-sourced FROM THE FEED: swap in a sentinel,
    // apply, expect it adopted; feed invalid selectors, expect list untouched.
    const reg2 = JSON.parse(JSON.stringify(reg));
    reg2.fingerprint = ["deadbeef"];
    api.applyRegistry(reg2);
    ok(Array.isArray(api.SWEEPER_FINGERPRINT) && api.SWEEPER_FINGERPRINT.join(",") === "deadbeef",
      "fingerprint adopted from feed");
    const reg3 = JSON.parse(JSON.stringify(reg));
    reg3.fingerprint = ["NOT-HEX!!", ""];
    api.applyRegistry(reg3);
    ok(api.SWEEPER_FINGERPRINT.join(",") === "deadbeef", "invalid feed fingerprint leaves list untouched");
    api.applyRegistry(reg); // restore live values before exit
  }
}

// ---- the two api.js copies must never drift ----
const a = fs.readFileSync(path.join(root, "api.js"));
const b = fs.readFileSync(path.join(root, "extension", "api.js"));
ok(Buffer.compare(a, b) === 0, "api.js and extension/api.js byte-identical");

console.log(failures === 0 ? "\nsmoke: all checks passed" : "\nsmoke: " + failures + " check(s) FAILED");
process.exit(failures === 0 ? 0 : 1);
