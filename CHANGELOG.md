# Changelog

Dated changes to `registry/sweepers.json` (and the feed's schema). Newest first. The feed's `updated` field matches the newest entry here.

## 2026-11-16

- **Phase 2 — interfaces:** CLI (`bin/sweepcheck`; exit codes 0/1/2; `--chains/--token/--spenders/--json/--timeout`), MCP server (`bin/sweepcheck-mcp`; stdio newline-delimited JSON-RPC; tools `check_wallet` + `get_registry`), zero-dependency `package.json` — still no build step.
- **Hosted POST API:** `https://sweepcheck-lime.vercel.app/api/check` deployed (Vercel serverless, `api/check.js`, CORS `*`, 20 checks/min/IP best effort, 60s max duration) — production public, previews behind Vercel Authentication.
- **Tests:** `test/verdict.js` — end-to-end danger-path proof with a fake local RPC (zero network): wallet delegated to the known Base sweeper → CLI reports `SWEEPER ATTACHED`, exits 1. MCP fixes: pending-request drain on stdin close, `tools/call` response nesting.
- **Permit2 event-log indexer (discovery layer):** `check(..., { permit2Logs: true })` + `--permit2` (CLI) + `permit2Logs` (MCP arg, hosted body) scan Permit2's `Approval`/`Permit` events wallet-filtered across full history — finds approvals to spenders no list has ever seen, then confirms each with a live `allowance()` read (revoked/expired never reports as live). Log source per chain: full-history logs API first (keyless Blockscout-compatible, 6 of 8 chains), raw `eth_getLogs` fallback (deploy-block binary search + adaptive chunks); `logsVia` recorded in results, honest `error` + partial notes when a chain refuses. Zero deps, both `api.js` copies byte-identical; `test/permit2.js` proves unknown-spender discovery on both paths offline (added to CI).
- **Permit2 indexer hardening (post-ship review):** `unverified` allowance state — a failed live read can no longer masquerade as `revoked-or-reset` (zero is only claimed when a read actually confirmed it; unverified approvals carry `null` amounts + a `warn` finding telling the user to re-run); explorer pagination by automatic block-range splitting when the logs API's 1000-entry cap is hit (`page`/`offset` verified ignored on Blockscout's legacy endpoint); CLI surfaces `truncatedNote` as a counted warning. Tests extended: forced 429 retry, 1000-cap split (recovers all 1500 range-scoped events through the halves), failed-read classification.
- Docs: API.md (four-surface contract + hosted endpoint), README (interface list), INTEGRATION.md (hosted endpoint live).

## 2026-11-15

- **Schema**: `sweepcheck-registry-2` goes live — delegates carry `kind`/`label`, top-level `pattern` renamed `fingerprintNotes`.
- **Coverage**: 8 chains proven by real transactions — `ethereum`, `bsc`, `base`, `optimism`, `arbitrum`, `polygon`, `linea`, `scroll`. Avalanche dropped (EIP-7702 still Proposed there, ACP-209); blast dropped (public RPCs dead); polygon-rpc.com swapped for publicnode + drpc.
- **Reconciliation**: `forwardsTo` added to the three forwarder delegates; Base collector `0x70a3df69…` added as `reverify-pending` with provenance; chain vocabulary `bnb` → `bsc` everywhere; Base delegate note reworded to method-only provenance (no case references).
- **Verification**: second Base entry `0x57678b37…` probed live — ordinary contract bytecode, no delegation, no fingerprint selectors → kept `reverify-pending` with reasoning recorded.
- **Intel**: relay selector `0xa516a5bf` identified as `execute(address[],uint256[],bytes[])` (batch executor) via the openchain.xyz directory.
- **Tooling**: single-source loader (feed → hardcoded fallback → offline), guide source added (`INTEGRATION.md`), entry process documented (`registry/PROCESS.md`), CI + smoke tests added.

## 2026-11-03

- Base delegate `0x7c802f06…` identified from live bytecode; forwarding destination `0x70a3df69…` recorded from storage slot 0.

## 2026-11-02

- Collectors re-checked (balances, activity windows); execution relay `0x8228e0ea…` verified.

## 2026-11-01

- `collectors` and `executionRelays` sections introduced to the feed.

## 2026-10-18

- First entries: Optimism and BNB Chain forwarder sweepers checked live.
