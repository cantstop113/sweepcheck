# Security

## Found a bug in SweepCheck?

If SweepCheck gives a **wrong answer** (says a wallet is clean when it has a sweeper, or the other way around), please [open an issue](../../issues/new/choose) with the network and the wallet address. Wallet addresses are already public on the blockchain, so sharing one is safe.

If you find a problem that could **put people at risk** (for example, a way to make the page show false results to other visitors), please don't post it publicly. Use GitHub's private reporting instead: **Security tab → Report a vulnerability**.

## Never share these, with anyone

- Your recovery phrase (the 12 or 24 words)
- Your private key
- Screenshots of either

SweepCheck never asks for them, and neither will anyone working on this project. If someone claiming to be from SweepCheck or the Squad asks for them, or messages you first offering to "recover" your funds, it's a scam.

## How SweepCheck keeps you safe

- It only **reads** public blockchain data. It can't sign, send, or approve anything.
- There's no wallet connection, no login, and no server. It's one HTML file you can read yourself.
- Your address is sent to public RPC providers to look up the chain data. Nothing is stored.
