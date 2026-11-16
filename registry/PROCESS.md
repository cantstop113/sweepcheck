# Registry entry process — adding, upgrading, removing

Every field in `sweepers.json` is either evidence-backed or explicitly marked unverified. We publish conservative labels before clever ones, and no entry ever claims more than its `evidence` tag says. This is the written process the grant asks for; CI enforces the mechanical half of it.

## Evidence tags

| tag | requires | authorizes integrators to |
|---|---|---|
| `known` | a documented, dated incident tying the address to the behavior | act on it |
| `checked-live` | an on-chain check on the stated date, method recorded in `note`, plus a second independent signal (fingerprint match, storage read, or incident report) | act on it |
| `pattern-match` | bytecode fingerprint match only | treat as advisory — never block on it alone |
| `reverify-pending` | an entry that exists but whose latest check was inconclusive or never done | advisory only — never a block; for `kind: safe` it means *do not warn* |

## Adding an entry

1. **Evidence first**: on-chain proof per chain claimed (code snapshot or tx hash) plus the date. No proof → `reverify-pending`, not `checked-live`.
2. **Format**: lowercase addresses (`^0x[0-9a-f]{40}$`), `chain` from the vocabulary (`ethereum`, `bsc`, `base`, `optimism`, `arbitrum`, `polygon`, `linea`, `scroll`), `kind` from the tag set, label style like `EIP-7702 forwarder sweeper (Chain)`.
3. **Mirror in `spenders`** when the address can receive approvals: attacker-level delegates get an `attacker` spender entry; routers and safe contracts get behavior notes in the label.
4. **`collectors` / `executionRelays`**: `fedBy` is mandatory. New entries start at `reverify-pending` unless balance/activity was independently checked — and that check's date goes in `note`.
5. **`forwardsTo`**: only from a live storage read of the delegate itself (slot 0), with the date in `note`. Never from an explorer guess alone.
6. Bump `updated`, add a `CHANGELOG.md` entry, keep notes free of case detail and PII (the feed is public), run the checks below, self-review.

## Upgrading an entry

`reverify-pending` → `checked-live` only after a fresh RPC confirmation; the `note` records method and date. Precedent: `0x57678b…` was probed on 2026-11-15, returned ordinary contract bytecode with no delegation, and was **kept pending** with the reasoning written down — an inconclusive check never upgrades an entry.

## Downgrading or removing

- False positive → set `kind: safe`, correct the `note`, add a CHANGELOG entry. History is preserved.
- Full removal → CHANGELOG entry carrying the address and the reason. Audit every `fedBy` / `forwardsTo` reference to the address first.
- Never silently delete, never silently weaken an entry.

## Never

- Seed phrases, signing, transfers, or any recovery action — this repo is read-only forensics.
- Guaranteed-recovery or attribution claims.
- `bnb` as a chain value (vocabulary is `bsc`).
- Upgrading an entry on a hunch.
- PII or incident detail that identifies a victim in the public feed.

## Validation

`.github/workflows/validate.yml` runs on every push: registry JSON parses, `node test/smoke.js` (structure, enums, duplicates, address format, feed merge, fingerprint wiring), and `api.js` / `extension/api.js` byte-identical. A change that turns CI red does not land.

## Self-review checklist

- [ ] addresses lowercase and valid; chains/kinds/evidence all from their enums
- [ ] every `checked-live` claim has method + date in its `note`
- [ ] no entry claims more than its evidence tag
- [ ] `forwardsTo`/`fedBy` provenance recorded
- [ ] `updated` bumped + CHANGELOG entry added
- [ ] `node test/smoke.js` passes locally
