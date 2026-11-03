# SweepCheck API

SweepCheck is a static, client-side page — there is no server and no backend
API endpoint. This document describes `api.js`: a plain JavaScript file,
loaded in the browser, that runs the exact same read-only blockchain checks
the page itself uses and hands you back the result as a plain JSON object
instead of rendered HTML.

If you're integrating SweepCheck into your own site, wallet, or exchange
tooling, this is the file to use. You never need to touch `index.html` or
any DOM code.

## How it works

`api.js` has no dependencies and makes no network calls of its own except
plain, read-only JSON-RPC requests to public blockchain nodes (the same
public RPC endpoints SweepCheck's page uses — see `CHAINS` inside `api.js`
for the exact list per network). It never asks for, reads, or transmits a
private key or recovery phrase; it only reads public on-chain data such as
`eth_getCode`, balances, and ERC-20 `allowance`/`isBlacklisted` calls.

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
    chains: ["bsc", "base", "ethereum"], // optional, default: all 4 supported chains
    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // optional ERC-20 token to also check
    spenders: ["0xSomeOtherAddressToCheckApprovalsFor"],  // optional, extra approval spenders to check
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
| `options.chains` | string[] | no | Which networks to check. Valid values: `"bsc"`, `"base"`, `"optimism"`, `"ethereum"`. Defaults to all four. |
| `options.token` | string | no | An ERC-20 token contract address to also check for this wallet: blacklist status and token approvals. If omitted, no token check is run. |
| `options.spenders` | string[] | no | Extra spender addresses to check token approvals for, in addition to a small built-in list of known routers. Only used when `options.token` is given. |

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

**Each entry in `chains`**

- `chain` — the chain key (`"bsc"`, `"base"`, `"optimism"`, or `"ethereum"`).
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
- `findings` — human-readable findings for the token check, same shape as above.
- `error` — an error message string if the token check failed, otherwise `null`.

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

## What this is not

- There is no hosted HTTP endpoint for this — `api.js` runs entirely in
  whichever browser (or browser-like JS environment) loads it. To offer
  this as a hosted web service, you would host `api.js` yourself and call
  `window.SweepCheckAPI.check()` from your own page or server-side browser
  environment.
- It does not sign, send, or ever need a private key or recovery phrase.
- It is read-only: it never writes to the chain.
