# SweepCheck Registry Feed — Integration Guide (v1.1)

Updated **2026-11-15** · schema `sweepcheck-registry-2` · license CC-BY-4.0

> This file is the source of truth for the Integration Guide PDF. Regenerate the PDF from this file so the two can never drift.

## Status (read first)

Schema `sweepcheck-registry-2` has been live since 2026-11-15 and this guide matches the feed as served. The v1 layout (top-level `pattern` key, delegates without `kind`/`label`) is retired — if you wrote code against v1, re-read this guide.

## Endpoint

```
https://cantstop113.github.io/sweepcheck/registry/sweepers.json
```

Raw equivalent:

```
https://raw.githubusercontent.com/cantstop113/sweepcheck/main/registry/sweepers.json
```

CORS is open (GitHub Pages) — fetch directly from browsers and tools.

## What's in it

```json
{
  "schema": "sweepcheck-registry-2",
  "updated": "2026-11-15",
  "license": "CC-BY-4.0",
  "fingerprint": ["c4d66de8", "b269681d"],
  "delegates": [
    {
      "address": "0x7c802f062c67058d0dd40b041204b960e8bde26a",
      "chain": "base",
      "kind": "sweeper",
      "label": "EIP-7702 forwarder sweeper (Base)",
      "forwardsTo": "0x70a3df699512f39c682f94fad498454c90b8c219",
      "evidence": "checked-live",
      "verified": "2026-11-03",
      "note": "Identified from live bytecode on 2026-11-03; re-checked 2026-11-15."
    }
  ],
  "spenders": [
    {
      "address": "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b",
      "kind": "safe",
      "label": "MetaMask Smart Account delegate (official EIP-7702 delegator)"
    }
  ],
  "collectors": [
    {
      "address": "0x70a3df699512f39c682f94fad498454c90b8c219",
      "chain": "base",
      "role": "sweeper destination (collector)",
      "fedBy": ["0x7c802f062c67058d0dd40b041204b960e8bde26a"],
      "evidence": "reverify-pending",
      "verified": null,
      "note": "Forwarding destination recorded from the delegate's storage read on 2026-11-03; collector balance and activity not yet independently verified on-chain."
    }
  ],
  "executionRelays": [
    {
      "address": "0x8228e0ea030095c43cfadda5e14b5315368668d9",
      "chain": "bsc",
      "role": "gas-funded sweep-execution relay (not a collector; holds no stolen funds)",
      "fedBy": ["0x091a301419f95eb007a6816220b13f2a6be89883"],
      "evidence": "checked-live",
      "verified": "2026-11-02"
    }
  ],
  "fingerprintNotes": {
    "initialize(address)": "0xc4d66de8",
    "destination()": "0xb269681d",
    "forwards": "native coin from storage slot 0"
  }
}
```

Field notes:

- **`delegates`** — EIP-7702 delegation addresses. `kind` = `sweeper` | `suspicious` | `safe`. `evidence`/`verified` carry the confidence. `forwardsTo` = where the forwarder drains to, recorded only from a live read of the delegate's own storage — never guessed from an explorer alone.
- **`spenders`** — approval/allowance targets: `kind` = `attacker` | `router` | `safe`. This is the list an approval check walks: attacker → warn, router → quiet, safe → never warn. An address can appear as both a delegate (code identity) and a spender (approval identity).
- **`collectors`** — destinations stolen funds land in, with `fedBy` pointing at the delegate feeding them. Labeling for triage — **not a block list**.
- **`executionRelays`** — gas-funded relays that execute the sweep calls. They hold no stolen funds; never treat them as collectors.
- **`fingerprint`** — forwarder bytecode selectors the tool matches on. The tool itself takes this list from the feed, so updating it here updates every consumer.
- **`fingerprintNotes`** — what each selector means and how the forwarder moves value.
- **`updated`** — ISO date of the last feed change. Poll this instead of guessing a cache TTL.

## How to use it

1. `eth_getCode(address, "latest")` on each chain — a delegation starts with `0xef0100`.
2. Match against `delegates` (exact address) or the fingerprint selectors inside the code.
3. Walk `spenders` for approval risk; use `collectors` / `executionRelays` for triage labels only.

The SweepCheck extension and `api.js` read this same feed as their primary source — your copy and the tool never disagree.

## Confidence tiers

| evidence | means | integrator action |
|---|---|---|
| `known` | tied to a documented, dated incident | act on it |
| `checked-live` | SweepCheck confirmed it on-chain on the stated date | act on it |
| `pattern-match` | bytecode fingerprint match only | advisory — never a block on its own |
| `reverify-pending` | the entry exists but the latest check did not confirm it | **advisory only — never a block.** For `kind: safe` it means *do not warn* (e.g. the MetaMask delegate). For suspicious entries it means do not raise severity until it is re-verified. |

## Freshness

The `updated` field and the repo [`CHANGELOG.md`](CHANGELOG.md) track changes. Best-effort, no SLA.

## Coverage

EIP-7702 delegation checks run on **8 chains**: `ethereum`, `bsc`, `base`, `optimism`, `arbitrum`, `polygon`, `linea`, `scroll` — each proven live (a sampled transaction carrying `0xef0100`) before it was listed. Registry *entries* currently cover ethereum, base, optimism and bsc. Grant-funded scope: ethereum, base, optimism.

Chain values use the feed's vocabulary — `bsc`, never `bnb`.

## What this is not

- Not a recovery service. No seed phrases, no signing, no token transfers — ever.
- Not an attribution service — labels describe observed behavior, not identity.
- Not legal advice.

## License

CC-BY-4.0 — reuse with attribution.

## Hosted API

A shared hosted POST API is on the roadmap (Phase 2). Until it ships, run `api.js` client-side or self-host the feed — the endpoint above is static and always free.

## Report a sweeper

Open an issue with: address, chain(s), evidence (tx hash / code snapshot), date. Contact: **manda@empire1.cloud**
