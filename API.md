# SweepCheck API

SweepCheck is a static, client-side page at heart — `api.js` runs the exact
same read-only blockchain checks the page itself uses and hands you back the
result as a plain JSON object instead of rendered HTML. This document is the
contract for that result shape.

The same checks ship in four places, all with **identical result shapes**:

| Surface | Entry point | Notes |
|---|---|---|
| Browser | `SweepCheckAPI.check()` via `api.js` | no server, no build step |
| CLI | [`bin/sweepcheck`](bin/sweepcheck) | exit 0 = clean, 1 = sweeper, 2 = usage/network failure |
| MCP server | [`bin/sweepcheck-mcp`](bin/sweepcheck-mcp) | tools: `check_wallet`, `get_registry` |
| Hosted API | `POST https://sweepcheck-lime.vercel.app/api/check` | see [Hosted POST API](#hosted-post-api) below |

If you're integrating SweepCheck into your own site, wallet, or exchange
tooling, `api.js` is the file to use. You never need to touch `index.html`
or any DOM code.

## How it works

`api.js` has no dependencies and makes no network calls of its own except
plain, read-only JSON-RPC requests to public blockchain nodes (the same
public RPC endpoints SweepCheck's page uses — see `CHAINS` inside `api.js`
for the exact list per network) plus one read-only GET of SweepCheck's own
[`registry/sweepers.json`](registry/sweepers.json) feed, which is the
primary source for its known-delegate and known-spender lists (the
hardcoded copies in `api.js` are the offline fallback; the feed is merged
in by lowercase address on the first check). It never asks for, reads, or
transmits a private key or recovery phrase; it only reads public on-chain
data such as `eth_getCode`, balances, and ERC-20 `allowance`/`isBlacklisted`
calls.

Include it with a plain script tag:

```html
<script src="https://cantstop113.github.io/sweepcheck/api.js"></script>
```

or, if you've cloned/vendored the repo, just:

```html
<script src="api.js"></script>
```

This attaches a single global, `window.SweepCheckAPI`, with a `check()`
function as its main entry point.

## Usage

```js
const result = await window.SweepCheckAPI.check(
  "0x1234567890123456789012345678901234567890",
  {
    chains: ["bsc", "base", "ethereum"], // optional, default: all 8 supported chains
    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // optional ERC-20 token to also check
    spenders: ["0xSomeOtherAddressToCheckApprovalsFor"],  // optional, extra approval spenders to check
    permit2Logs: true, // optional: full-history Permit2 event-log scan (finds unknown spenders)
  }
);

console.log(JSON.stringify(result, null, 2));
```

`check(address, options)` returns a `Promise` that resolves to a plain,
JSON-serializable object (no DOM elements, no functions — safe to
`JSON.stringify`, log, or send to your own backend).

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | The wallet address to check. Must be a `0x`-prefixed, 40-hex-character EVM address. |
| `options.chains` | string[] | no | Which networks to check. Valid values: `"bsc"`, `"base"`, `"optimism"`, `"ethereum"`, `"arbitrum"`, `"polygon"`, `"linea"`, `"scroll"`. Defaults to all eight. |
| `options.token` | string | no | An ERC-20 token contract address to also check for this wallet: blacklist status and token approvals. If omitted, no token check is run. |
| `options.spenders` | string[] | no | Extra spender addresses to check token approvals for, in addition to a small built-in list of known routers. Only used when `options.token` is given. |
| `options.permit2Logs` | boolean | no | Set `true` to also scan Permit2's `Approval`/`Permit` event logs for this wallet on **every** checked chain — the discovery layer that finds approvals to spenders this tool has never heard of. Adds a few requests per chain (usually one full-history request to the chain's logs API). Results land in `result.permit2Logs`. |

If `address` isn't a valid `0x...` address, or none of the given `chains`
are recognized, the returned promise rejects with an `Error`.

## Response shape

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "checkedAt": "2026-11-02T22:14:03.511Z",
  "chains": {
    "bsc": {
      "chain": "bsc",
      "chainName": "BNB Chain",
      "explorerUrl": "https://bscscan.com/address/0x1234567890123456789012345678901234567890",
      "nativeBalance": "0.0412",
      "nativeSymbol": "BNB",
      "txCount": 14,
      "addressType": "delegated",
      "sweeperFound": true,
      "sweeperAddress": "0x9db96924a0b0b9a83fe2368b29539561a9c696d8",
      "forwardsTo": "0xccccccccccccccccccccccccccccccccccccccc0",
      "delegate": {
        "address": "0x9db96924a0b0b9a83fe2368b29539561a9c696d8",
        "label": "\"Forwarder\" sweeper (BNB Chain)",
        "kind": "sweeper",
        "fingerprint": true,
        "forwardsTo": "0xccccccccccccccccccccccccccccccccccccccc0"
      },
      "findings": [
        {
          "level": "danger",
          "evidence": "checked live + known sweeper",
          "text": "A SWEEPER is attached to this wallet. Any coins sent to it get forwarded to someone else within seconds. Assume the private key is stolen. Coins are being forwarded to 0xccccccccccccccccccccccccccccccccccccccc0."
        }
      ],
      "error": null
    },
    "base": {
      "chain": "base",
      "chainName": "Base",
      "explorerUrl": "https://basescan.org/address/0x1234567890123456789012345678901234567890",
      "nativeBalance": "0",
      "nativeSymbol": "ETH",
      "txCount": 0,
      "addressType": "wallet",
      "sweeperFound": false,
      "sweeperAddress": null,
      "forwardsTo": null,
      "delegate": null,
      "findings": [
        {
          "level": "ok",
          "evidence": "checked live",
          "text": "No delegation or code is attached. This looks like a normal wallet. (This can't prove the key is safe, only that no sweeper code is attached.)"
        }
      ],
      "error": null
    }
  },
  "token": {
    "chain": "bsc",
    "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDT",
    "balance": "0",
    "blacklisted": false,
    "allowances": [],
    "findings": [],
    "error": null
  }
}
```

### Field reference

**Top level**

- `address` — the wallet address that was checked, as given.
- `checkedAt` — ISO 8601 timestamp of when the check ran.
- `chains` — an object keyed by chain name (e.g. `"bsc"`, `"ethereum"`), one entry per chain requested. See below.
- `token` — the token-check result, or `null` if no `options.token` was given. See below.
- `permit2Logs` — present only when `options.permit2Logs` was `true`: one entry per checked chain with the event-log scan results. See below.

**Each entry in `chains`**

- `chain` — the chain key (`"bsc"`, `"base"`, `"optimism"`, `"ethereum"`, `"arbitrum"`, `"polygon"`, `"linea"`, or `"scroll"`).
- `chainName` — human-readable chain name (e.g. `"BNB Chain"`).
- `explorerUrl` — a link to this address on that chain's block explorer.
- `nativeBalance` — the wallet's native-coin balance (BNB/ETH), as a decimal string. `null` if the check failed.
- `nativeSymbol` — the native coin's ticker (`"BNB"` or `"ETH"`).
- `txCount` — number of transactions sent from this address (its nonce). `null` if the check failed.
- `addressType` — one of `"wallet"` (plain EOA, no code), `"delegated"` (has an EIP-7702 delegation attached), or `"contract"` (has ordinary contract bytecode). `null` if the check failed.
- `sweeperFound` — `true` if a known or pattern-matched sweeper/suspicious delegate is attached, `false` if not, `null` if the check for this chain failed.
- `sweeperAddress` — the delegate contract's address, if `addressType` is `"delegated"`; otherwise `null`.
- `forwardsTo` — the address stolen funds are being forwarded to, if SweepCheck could read it from the sweeper's storage; otherwise `null`.
- `delegate` — the full delegate detail object (`address`, `label`, `kind`, `fingerprint`, `forwardsTo`), or `null` if this wallet has no delegation attached. `kind` is one of `"safe"` (a known legitimate smart-account upgrade), `"sweeper"`, `"suspicious"`, or `"unknown"`.
- `findings` — a list of human-readable findings for this chain, each `{ level, evidence, text }`. `level` is one of `"danger"`, `"warn"`, `"ok"`, or `"info"`.
- `error` — an error message string if the RPC check for this chain failed (e.g. all public nodes were unreachable), otherwise `null`.

**`token` (present only if `options.token` was given)**

- `chain` — which chain the token check ran on (always the first entry in `options.chains`, matching the main SweepCheck page's behavior).
- `token` — the token contract address that was checked.
- `symbol` — the token's ticker symbol, if it could be read.
- `balance` — the wallet's balance of this token, as a decimal string.
- `blacklisted` — `true`/`false` if the token has a blacklist and this wallet's status could be read, or `null` if the token has no blacklist function (most tokens) or the check failed.
- `allowances` — a list of non-zero approvals found, each `{ spender, label, amount }`. `amount` is a decimal string or the literal `"UNLIMITED"`.
- `permit2` — the second approval layer (see below), or `null` if the token check failed.
- `findings` — human-readable findings for the token check, same shape as above.
- `error` — an error message string if the token check failed, otherwise `null`.

**`token.permit2`**

Approvals routed through [Permit2](https://github.com/Uniswap/permit2) are two layers deep. The token-level
approval points at the Permit2 contract itself, which looks routine because most major routers use it. The
address that can actually move the tokens is stored in Permit2's own allowance mapping, so a check that only
reads token-level allowances will report nothing at all. SweepCheck reads both layers.

- `contract` — the Permit2 address that was read (`0x000000000022d473030f116ddee9f6b43ac78ba3`, the same on every chain that has it).
- `approvedToPermit2` — `true` if the wallet has a non-zero token-level approval to Permit2. On its own this is normal.
- `spendersChecked` — the list of addresses Permit2 was queried about.
- `allowances` — non-zero Permit2 approvals found, each `{ spender, label, amount, expiration, expired, usableNow, nonce }`:
  - `amount` — decimal string, or `"UNLIMITED"` for `type(uint160).max`.
  - `expiration` — ISO 8601 timestamp, or the literal `"never"`.
  - `expired` — `true` once the chain's clock has passed `expiration`. Permit2 rejects an expired allowance, so these cannot move anything.
  - `usableNow` — `true` only if the approval is unexpired **and** the wallet still has a token-level approval to Permit2. An unexpired approval with no token-level approval is dormant: harmless right now, but approving Permit2 again reactivates it.
- `complete` — always `false`. See the limitation below.
- `note` — a plain-language statement of that limitation.

> **Limitation of the contract read, stated plainly:** Permit2 allowances cannot be enumerated from a
> contract read — they can only be looked up one spender at a time. SweepCheck asks about the addresses it
> knows. An empty `allowances` list on this layer therefore means "nothing found among the addresses
> checked", **not** "this wallet has no Permit2 approvals". For the complete answer, run the event-log scan
> below (`permit2Logs: true`).

To revoke, Permit2 exposes `lockdown(TokenSpenderPair[])` (selector `0xcc53287f`), which batch-revokes approvals in one call.

**`result.permit2Logs` (present only if `options.permit2Logs` was `true`)**

The discovery layer: instead of asking about spenders it already knows, it reads Permit2's own `Approval` and
`Permit` events filtered to this wallet — full history, every chain requested. This is how an approval to an
address SweepCheck has never seen gets found with no manual input. Events say what was set; a live
`allowance()` read then confirms current state, so a revoked or expired approval never reports as live.

- `chain`, `address`, `permit2` — which chain and wallet was scanned, and the Permit2 address involved.
- `permit2Present` — `false` if Permit2 isn't deployed on that chain (scan skipped, honestly).
- `logsVia` — where the logs came from: `"explorer-api"` (the chain's full-history logs API, the usual path) or `"rpc"` (raw `eth_getLogs` walking, the fallback).
- `fromBlock`, `toBlock`, `logCount` — coverage: blocks scanned and how many matching events were returned.
- `approvals` — every standing approval ever set by this wallet, each `{ token, symbol, spender, spenderLabel, spenderKind, amount, unlimited, expired, usableNow, state, expiration, nonce, lastSeen, source }`:
  - `state` — `"live"` (usable now), `"dormant"` (unexpired but no token-level approval to Permit2), `"expired"`, `"revoked-or-reset"` (a successful live read confirmed zero), or `"unverified"` (the live read failed — the approval provably existed, its current state is unknown; `amount`, `unlimited`, `expired`, `usableNow`, `nonce` are `null`, and a `warn` finding says so. Never read `unverified` as safe, and never as revoked).
  - `lastSeen` — `{ block, txHash, event }`: when and where the approval was last set, straight from the chain.
  - `source` — always `"permit2-event-log"`.
- `unknownLive` — addresses of unexpired approvals SweepCheck does not recognize. The headline finding.
- `findings` — same `{ level, evidence, text }` shape as everywhere else; an unknown unexpired approval gets `"warn"` (`"danger"` if the spender is a known-bad kind); an approval whose live read failed gets a `"warn"` (`UNVERIFIED`) finding; expired approvals are listed without findings.
- `truncatedNote` — present only if even a single block held a full 1000-entry page after automatic range-splitting (the logs API caps responses at 1000 entries and ignores `page`/`offset`, so SweepCheck re-queries in block-range halves instead). Rare for a single wallet.
- `error` — set instead of the fields above if the scan itself failed on that chain; the rest of the check still returns.

## Error handling

- If `address` is invalid, or no valid chain names were given, `check()`
  rejects with an `Error` — wrap the call in `try`/`catch` or use
  `.catch()`.
- If one particular chain's RPC nodes are unreachable, that chain's entry
  in `chains` still appears, with `error` set to a message and its other
  fields set to `null` — the whole call does not fail just because one
  chain had trouble.
- The same applies to the `token` result if a token check was requested
  but failed.

## Hosted POST API

```
POST https://sweepcheck-lime.vercel.app/api/check
```

The hosted endpoint is `api.js` behind a thin, zero-dependency serverless
wrapper ([`api/check.js`](api/check.js)) — same code, same result shape,
read-only, CORS open.

```bash
curl -X POST https://sweepcheck-lime.vercel.app/api/check \
  -H 'content-type: application/json' \
  -d '{"address":"0x1234567890123456789012345678901234567890","chains":["base","ethereum"]}'
```

Request body (only `address` is required):

| Field | Type | Description |
|---|---|---|
| `address` | string | `0x` + 40 hex characters |
| `chains` | string[] | subset of the eight chain keys; default all |
| `token` | string | ERC-20 to check on `chains[0]` |
| `spenders` | string[] | extra addresses for the approval scan (max 10) |
| `permit2Logs` | boolean | `true` runs the Permit2 event-log discovery scan on every requested chain |

The scan adds a handful of requests per chain. On the hosted endpoint (60s cap) pair it with a `chains`
subset when checking several networks — e.g. `{"address":"0x..","chains":["base"],"permit2Logs":true}`.

Responses:

- `200` → `{ "ok": true, "result": <same shape as check() above> }`
- `400` → `{ "ok": false, "error": "..." }` — bad address, bad chains, or bad body
- `405` → wrong method; `429` → rate limit (`20` checks per minute per IP,
  best-effort per instance — a courtesy limit, not a guarantee)
- `GET /api/check` returns a usage hint; `OPTIONS` returns CORS preflight
  (`access-control-allow-origin: *`).

Production deploys are public; preview deploys stay behind Vercel
Authentication (Standard Protection). There are no accounts, no API keys,
and nothing to sign — if you need more control or higher volume, run
`api.js` yourself or use the CLI; the code is the same.

## What this is not

- The hosted endpoint and `api.js` are the same read-only code: there is no
  separate backend, no database, and no account system behind either.
- It does not sign, send, or ever need a private key or recovery phrase.
- It is read-only: it never writes to the chain.
