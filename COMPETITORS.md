# Competitive intelligence tracker

**Update cadence: weekly; record only verified changes from their repos/READMEs.**

Read-only research. Nothing here is integrated, forked, or copied — we track these five so SweepCheck's
counter-position stays honest and our own roadmap answers real movement instead of guesses. Every
baseline and change-log row must cite a commit, release, or README revision you actually read.

What we check each week (same seven categories for everyone): **releases**, **new chains**, **detection
improvements**, **integrations**, **security features**, **recovery capabilities** (anything that touches
keys or signing — our hard no), and **pricing/licensing changes**.

---

## devx-agent/7702-sweeper-check

Repo snapshot 2026-11-15: created 2026-10-30 · last push 2026-10-30 · MIT · JavaScript · 0★ ·
homepage `sweeper-check.nextill-pos.workers.dev`

| As of | Strongest capability | Our counter-position |
|---|---|---|
| 2026-11-15 | Distribution breadth: free web + `npx` CLI + remote/local MCP server for AI agents + x402-paid full report (0.01 USDC) with a delegate bytecode heuristic and Sourcify/Blockscout source verification, across 8 chains (Ethereum, Base, BNB, Arbitrum, OP, Polygon, Gnosis, Unichain) | Same read-only result with zero dependencies and no build step, but backed by an evidence-tagged registry feed (`sweepcheck-registry-2`, single-sourced into `api.js`), Permit2 second-layer approval reads, storage-slot-0 forwarding destination, blacklist detection and a victim report generator — all free, no paid tier, no key or signature ever involved. Their 8 chains ≠ ours: they have Gnosis + Unichain, we have Linea + Scroll (MetaMask-flush relevance) |

**Watch:** new chains (do they add Linea/Scroll, or us add Gnosis/Unichain?); changes to the paid
report's heuristic or price; MCP tool surface growth; whether the paid tier creeps into the free check.

**Change log**

| Date | Change | Source |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

---

## Alok-mad98/lastseenimd

Repo snapshot 2026-11-15: created 2026-10-14 · last push 2026-10-24 · MIT · Solidity/JS · 0★ ·
homepage `lastseen-4pu.pages.dev` · IMD Hackathon 2026 entry

| As of | Strongest capability | Our counter-position |
|---|---|---|
| 2026-11-15 | Breadth and narrative: wallet forensics across a claimed 28–48 EVM chains plus Solana, fund tracing, drain/path reconstruction and "on-chain verdicts" from an AI agent swarm, wrapped in a horror-game UI | We stay narrow and auditable: every registry row carries an evidence tag and a date, every claim maps to an RPC read anyone can repeat, and no model output stands between the user and the finding. We also do the approval layer (Permit2 + token blacklist), which a "what happened to my wallet" story tool does not |

**Watch:** chain-count claims (28 vs 48 in their own README — resolve or grow?); whether the "signed
verdicts" swarm produces anything citable; any move toward remediation/revocation; hackathon project
staying alive past the event.

**Change log**

| Date | Change | Source |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

---

## dayuwidayadi57/agent-7702

Repo snapshot 2026-11-15: created 2026-10-31 · last push 2026-11-05 · MIT · JavaScript · 1★ ·
npm `agent-7702`

| As of | Strongest capability | Our counter-position |
|---|---|---|
| 2026-11-15 | It acts: CLI diagnosis on 7 chains plus revocation of a hostile delegation via a gas-paying relayer, asset/NFT rescue, atomic rescue and claim-rescue (Sepolia), and mainnet rescue/batch contracts deployed on BSC (2026-11-04/05 via CREATE2) | We are read-only by architectural rule — no signing, no seed phrase, no recovery features, ever — so our counter-position is prevention and evidence, not remediation: catch the delegation and the approvals before funds move, and hand the victim an IC3-ready report. Their recovery path is also the highest-risk surface in this space (a "rescue" tool is one compromised build away from a second drain); ours has no such surface |

**Watch:** mainnet deployments beyond BSC (RescueDelegateV4 / BatchCallDelegationV2 on Ethereum, Base);
atomic rescue leaving Sepolia; any request for keys/seeds ("key files" today — watch for loosening);
npm release cadence; incidents or issue reports about the rescue path.

**Change log**

| Date | Change | Source |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

---

## sreyleak-security/permit2-audit

Repo snapshot 2026-11-15: created 2026-10-20 · last push 2026-10-20 · MIT · Python · 0★ · no homepage

| As of | Strongest capability | Our counter-position |
|---|---|---|
| 2026-11-15 | The cleanest single-idea tool: enumerate Permit2 allowances from `Approval` event logs plus `eth_getCode` 7702 detection, in one dependency-light Python script, with a published Permit2-vs-EIP-7702 comparison article feeding it | Same second-layer coverage without a pip install, an RPC URL, or a terminal: the web page and `api.js` probe Permit2 allowances, token blacklist, known delegates and spenders across 8 chains in one paste — and back it with the evidence-tagged registry. Their log-scan enumeration is the one capability worth studying honestly (our own Permit2 read is spender-by-spender and says so) |

**Watch:** event-log enumeration being adopted anywhere; new scripts/tools in the repo or the companion
site (blog is their distribution channel); any move to JS/wallet integration; licensing changes.

**Change log**

| Date | Change | Source |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

---

## ef0100dev/ef0100

Repo snapshot 2026-11-15: created 2026-10-30 · last push 2026-10-31 · MIT · TypeScript · 0★ ·
npm `ef0100` · homepage `ef0100.xyz`

| As of | Strongest capability | Our counter-position |
|---|---|---|
| 2026-11-15 | Incident-grade depth on the exact attack class we document: offline replay/decode of the 2026-10-29 type-4 drain from raw bytes, 11-chain wallet scanning, and a pre-signature guard that refuses any authorization it cannot decode | We complement rather than duplicate: they sit in front of a signer and refuse, we sit at the victim's address after the fact and explain — evidence-tagged known delegates, forwarding destination from storage slot 0, approvals inside Permit2, and a report the victim can file. Where they publish fixtures of a drain, we publish a registry of live delegate contracts |

**Watch:** guard integrations (wallets/exchanges adopting the refuse path — that shrinks the sweeper
market we detect); chain count past 11; npm release cadience and CHANGELOG; any productization of the
decode API; whether their incident write-ups start naming sweepers we don't have in the registry.

**Change log**

| Date | Change | Source |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
