# SweepCheck browser extension

A small Chrome/Edge extension that adds a right-click option to the free
[SweepCheck](https://cantstop113.github.io/sweepcheck/) wallet-safety tool.

## What it does

Today, checking a wallet means: find the SweepCheck website, go find your
own wallet address somewhere else, come back, and paste it in. This
extension removes that extra trip.

Highlight (select with your mouse) any wallet address on any web page —
an Etherscan page, a Discord message open in your browser, an email, a
chat — right-click it, and choose **"Check with SweepCheck"**. A small
window pops up and runs the same check the main SweepCheck site runs,
right there, without you ever leaving the page or retyping anything.

It checks:
- Whether the wallet has a malicious "sweeper" attached (something that
  automatically forwards any coins sent to it to a thief)
- Where stolen funds are being forwarded to, if a sweeper is found
- Whether a token is blacklisting the wallet (optional, if you also enter
  a token address)
- Whether a token has risky approvals set on it (optional, same as above)

It checks four networks: BNB Chain, Base, Optimism, and Ethereum.

## What it will NEVER do

- It will **never** ask you to connect a wallet.
- It will **never** ask for a signature.
- It will **never** ask for a private key or a seed/recovery phrase.
- It will **never** send a transaction or write anything to the
  blockchain.

It only reads public information that is already visible to anyone on a
block explorer — it just reads it for you automatically and explains what
it means in plain language. Everything it does is read-only.

## How it works, technically (for the curious)

The extension is just three small pieces:

1. **A right-click menu item** that grabs whatever text you had selected.
2. **A tiny popup window** that looks for something that looks like a
   wallet address (`0x` followed by 40 letters/numbers) in that text, and
   if it finds one, runs the check automatically.
3. **The exact same checking code** (`api.js`) that the main SweepCheck
   website uses — copied in as-is, unchanged, from the main repo. The
   extension doesn't reimplement any blockchain logic; it reuses the
   already-reviewed code.

The only network calls this extension makes are plain, read-only
JSON-RPC requests to a short, fixed list of public blockchain nodes (the
same ones the main site uses). You can see the exact list in
`manifest.json` under `host_permissions` and in `api.js`.

### Permissions this extension asks for, and why

| Permission | Why it's needed |
|---|---|
| `contextMenus` | To add the "Check with SweepCheck" option to your right-click menu. |
| `storage` | To briefly pass the text you right-clicked from the right-click handler to the popup window. Nothing is kept — it's cleared the moment the popup reads it. |
| Host access to 6 specific public RPC URLs | So the popup can read public wallet/token data from those nodes. No other websites or servers are contacted, and nothing is sent to SweepCheck's own servers — there isn't one; it's a static site. |

It does **not** ask for access to read or change the pages you're on, your
browsing history, your cookies, or any wallet extension you have
installed.

## How to load it locally for testing

This hasn't been submitted to the Chrome Web Store yet (see note below),
so for now you load it manually, the same way developers test extensions
before publishing them:

1. Download or `git clone` this repository to your computer.
2. Open Chrome (or Edge) and go to `chrome://extensions` (or
   `edge://extensions`).
3. Turn on **Developer mode** (usually a toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select this `extension` folder (the one this README is in) — not the
   whole repository, just this folder.
6. You should see "SweepCheck — Right-Click Wallet Check" appear in your
   extensions list, with a small shield-and-checkmark icon.

To try it:

1. Go to any page with a wallet address written on it (for example, open
   any address page on [Etherscan](https://etherscan.io) or
   [BscScan](https://bscscan.com)).
2. Select/highlight the `0x...` address text with your mouse.
3. Right-click the selection and choose **"Check with SweepCheck"**.
4. A small popup window opens and shows the result.

You can also click the extension's icon in your browser toolbar at any
time to open the same popup and paste in an address manually, without
needing to right-click anything first.

## Not yet on the Chrome Web Store

This extension has **not** been submitted to the Chrome Web Store or the
Edge Add-ons store. That's a manual step the repository owner needs to
do separately (it involves a developer account, a one-time fee for
Chrome, and a review process) — it isn't something that can be done as
part of building the extension itself. Until then, "load unpacked" (above)
is the only way to install it.
