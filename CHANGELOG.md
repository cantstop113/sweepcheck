# Changelog

Dated changes to `registry/sweepers.json` (and the feed's schema). Newest first. The feed's `updated` field matches the newest entry here.

## 2026-11-16

- **Phase 2 — interfaces:** CLI (`bin/sweepcheck`; exit codes 0/1/2; `--chains/--token/--spenders/--json/--timeout`), MCP server (`bin/sweepcheck-mcp`; stdio newline-delimited JSON-RPC; tools `check_wallet` + `get_registry`), zero-dependency `package.json` — still no build step.
- **Hosted POST API:** `https://sweepcheck-lime.vercel.app/api/check` deployed (Vercel serverless, `api/check.js`, CORS `*`, 20 checks/min/IP best effort, 60s max duration) — production public, previews behind Vercel Authentication.
- **Tests:** `test/verdict.js` — end-to-end danger-path proof with a fake local RPC (zero network): wallet delegated to the known Base sweeper → CLI reports `SWEEPER ATTACHED`, exits 1. MCP fixes: pending-request drain on stdin close, `tools/call` response nesting.
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
