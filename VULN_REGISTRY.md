# EIP-7702 Sweeper Registry

A public, versioned list of known EIP-7702 **sweeper delegate contracts**: contracts that, when an
externally owned account delegates to them, forward any incoming native coin or token to an attacker.
Wallets, explorers and security tools can read this list to warn a user before they send funds to a
delegated-and-drained address.

This file is the human-readable source of truth. A machine-readable `registry/sweepers.json` is built
from it. Data here is published under **CC BY 4.0**; reuse it, keep the attribution.

## How an entry is verified (evidence tags)

Every row carries one tag. We never raise a tag without doing the check named.

- **checked-live** — we read the contract's code on the named chain and confirmed it is deployed, and
  confirmed the sweeper behavior (code matches the Forwarder pattern below, or a victim wallet delegated
  to it had incoming funds forwarded out). The "Verified" column gives the date.
- **pattern-match** — the bytecode matches a known sweeper fingerprint but we have not yet watched a live
  forward. Strong signal, not proof.
- **reverify-pending** — recorded from earlier work, awaiting a fresh on-chain read. Treat as unconfirmed
  until it moves to checked-live.

The **Forwarder pattern**: a contract exposing `initialize(address)` (selector `0xc4d66de8`) and
`destination()` (selector `0xb269681d`) that forwards native coin to an address held in storage slot 0.

## Scope

This registry covers **Ethereum and its L2s** (Ethereum, Base, Optimism; Arbitrum next). Sweepers seen on
other chains during real cases are listed at the end, outside that scope, because the same bytecode is
redeployed across chains and the record is useful.

## Known sweeper delegates (Ethereum and L2s)

| Address | Chain | Type | Evidence | Verified | Source |
|---|---|---|---|---|---|
| 0xcefd060da801a3f004d6b307f4cab943d1c9b45b | Optimism | Forwarder sweeper | checked-live | 2026-10-18 | Drained-wallet case, code present on-chain (1,042 bytes) |
| 0x7c802f062c67058d0dd40b041204b960e8bde26a | Base | Forwarder-pattern sweeper | reverify-pending | — | SweepCheck build; Base RPC blocked this session |
| 0x57678b37823e47b13c17cab41b1e9c264c9d93a3 | Base | Generic executor used by key-testing bots | reverify-pending | — | SweepCheck build; treat as suspicious, not confirmed sweeper |

## Known-good delegates (do not flag)

Wallets consuming this list must **not** warn on legitimate EIP-7702 delegations. This section exists so
integrators avoid false positives.

| Address | Chain | What it is | Evidence |
|---|---|---|---|
| 0x63c0c19a282a1b52b07dd5a65b58948a07dae32b | Ethereum | MetaMask Smart Account, the official EIP-7702 delegator | reverify-pending (widely documented) |

## Context

Wintermute reported that **over 97% of all EIP-7702 delegations** in the weeks after Pectra ran the same
sweeper code, the most reused of which it named **CrimeEnjoyor**, and noted the destination of stolen funds
can be read from that code (warned 2025-05-30; CoinDesk, 2025-06-02). That heavy code reuse is why a shared
registry works. Mainnet CrimeEnjoyor-family addresses will be added here as each is re-verified on-chain,
rather than copied from reports.

## Other chains (outside grant scope, kept for the record)

These sweepers hit a real victim's wallets on BNB Chain. They are not part of the Ethereum/L2 registry but
are verified and worth recording.

| Address | Chain | Type | Evidence | Verified |
|---|---|---|---|---|
| 0x9db96924a0b0b9a83fe2368b29539561a9c696d8 | BNB Chain | "Forwarder" sweeper | checked-live | 2026-10-18 |
| 0x86e415756170ef48e0e9052b8a8a7bd4783a77ca | BNB Chain | Forwarder-pattern sweeper | checked-live | 2026-10-18 |
| 0xe25db171b622ce6f9e262a0ac84d73790bb54365 | BNB Chain | Forwarder-pattern sweeper | checked-live | 2026-10-18 |

## Submitting an entry

Open an issue with the **Report a sweeper** form, or a pull request that adds a row above. An entry is
merged only with:

1. The delegate contract address and the chain.
2. At least one wallet that delegated to it (its code starts with `0xef0100` + the delegate address).
3. Proof the contract forwards funds: a transaction where coins arrived and left within seconds, or a
   bytecode match to the Forwarder pattern.

Entries start at `pattern-match` or `reverify-pending` and move to `checked-live` once a maintainer reads
the chain. Every change to this file is dated in git history; that is the version record.

---

*Part of [SweepCheck](https://github.com/cantstop113/sweepcheck). We never ask for your recovery phrase or
private key.*
