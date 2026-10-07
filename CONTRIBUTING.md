# Contributing

Thanks for helping. Every verified sweeper added here helps the next victim get a clear answer faster.

## Report a new sweeper

Use the **[Report a sweeper](../../issues/new?template=report-sweeper.yml)** form. We add a sweeper to `KNOWN_DELEGATES` only with on-chain evidence:

1. **The delegate (sweeper) contract address**, and which network it's on.
2. **At least one wallet delegated to it.** Its code starts with `0xef0100` followed by the delegate address.
3. **Proof that coins sent in get forwarded out**: a transaction where native coins (BNB, ETH) arrive and leave within seconds.

Labels must match the evidence: **checked live** for what we verified on-chain, **pattern match** for bytecode fingerprints.

## Change the code

- Everything lives in `index.html`. No build step: open it in a browser to test.
- Keep it **read-only**. Pull requests that add wallet connections, signing, or key input will be closed.
- Keep the language plain. Many people using this are scared, older, or new to crypto.
- Test on a phone-width screen as well as desktop.

## Ground rules

- No victim names or personal details in issues, code, or commits.
- No hack-back tools or anything that touches attacker wallets.
- No paid "recovery" links or referrals.
