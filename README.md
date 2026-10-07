# SweepCheck

**Is someone sweeping your wallet?** Paste a wallet address and get a plain-language answer: is an EIP-7702 "sweeper" attached that steals every coin sent in, is the wallet blacklisted on a token, and which approvals are set.

Built while helping a real victim, a retired veteran whose wallets were swept, after we had to do all of this by hand on block explorers.

**Companion guide:** [Wallet Drained? Your First 24 Hours](#wallet-drained-your-first-24-hours), what to do, where to report, and the scams that follow.

**The Squad:** [who we are and our promises](SQUAD.md). Free help for victims, and we never ask for your keys.

## Use it
- **Live page:** https://cantstop113.github.io/sweepcheck/ · **Printable first-hour checklist:** [first-hour.html](https://cantstop113.github.io/sweepcheck/first-hour.html)
- Open `index.html` in any browser, or host it free on GitHub Pages (Settings → Pages → deploy from branch).
- One file, no build step, no backend.

## What it checks (read-only)
| Check | How |
|---|---|
| Sweeper / delegation | `eth_getCode`; EIP-7702 delegations start with `0xef0100` |
| Known sweepers | Delegate address matched against a list verified on-chain |
| Unknown sweepers | Bytecode fingerprint of the "Forwarder" pattern (`initialize(address)` + `destination()`) |
| Where stolen coins go | Reads the forwarding address from the wallet's storage slot 0 |
| Token blacklist | `isBlacklisted(address)` on the token, when the token has one |
| Approvals | `allowance()` for the wallet itself, known routers, known attacker contracts, and any address you add |

Networks: BNB Chain, Base, Optimism, Ethereum (public RPCs).

## Safety & privacy
- **Never asks for a recovery phrase or private key.** Nothing to sign, nothing to connect.
- Your address is sent to public RPC providers to read chain data. Nothing is stored.
- Results are labeled **checked live** or **pattern match**. A clean result means no sweeper is attached; it cannot prove a key is safe.
- For a *complete* approvals list, also use your explorer's Token Approval Checker.

## What it can't do
It can't remove a sweeper, revoke approvals, lift a blacklist, or recover funds. Tokens left in a swept wallet can sometimes be recovered with a private bundle transaction; use only reputable help, and never pay upfront fees. Recovery-for-a-fee offers are the most common follow-up scam.

## Contributing
Add a sweeper to `KNOWN_DELEGATES` only with on-chain evidence: the delegate address, a victim wallet delegated to it, and proof that incoming native coins are forwarded. See [CONTRIBUTING.md](CONTRIBUTING.md), or use the **Report a sweeper** form under Issues. Found a safety problem? See [SECURITY.md](SECURITY.md).

## License
MIT. See `LICENSE`.

---

## Wallet Drained? Your First 24 Hours

This guide is for anyone whose crypto wallet was drained, or who keeps watching coins vanish the moment they arrive. It was written while helping a real victim, using what actually worked.

**The one rule: never give anyone your recovery phrase or private key.** Not support, not a "recovery expert," not someone reading it to you over the phone. No legitimate person or company will ever ask for it.

### The first hour: stop the bleeding

1. **Stop sending coins to the affected wallet.** If a sweeper is attached, anything you send, including gas money to "fix" things, is taken within seconds.
2. **Don't try to revoke approvals from the hacked wallet.** It costs gas, which gets stolen, and whoever has the key can re-approve for free.
3. **Don't connect the hacked wallet to any website.** That includes sites promising to "rescue" or "unlock" it.
4. **If you still control another wallet or exchange account created from the same recovery phrase, move funds out of it now,** to a wallet with a brand-new phrase.
5. **Write down what you know:** your wallet addresses, roughly when things went wrong, and any sites, apps, or people you dealt with in the weeks before.

### Find out what happened

You don't need technical skills for this. Everything below uses public data and never asks for your key.

- **Run SweepCheck** (free, open-source, read-only): paste your address. It checks BNB Chain, Base, Optimism, and Ethereum for an attached sweeper, shows where stolen coins are being sent, and can check a token for blacklisting and approvals.
- **Open your address on a block explorer** (bscscan.com, basescan.org, etherscan.io). If the page says "Delegated to" a contract you don't recognize, someone has attached code to your wallet using your key.
- **Check approvals with the explorer's Token Approval Checker.** Look for unlimited approvals you don't remember giving, especially approvals to your own address or to unfamiliar contracts. Just look; don't click Revoke from a hacked wallet.
- **Look for outgoing transactions you didn't make.** For each one, note the date, the amount, and the transaction hash (the long ID at the top of its page). You'll need these for reports.

Read results honestly. "Checked live" means it was read from the blockchain. A clean result means no sweeper is attached; it can't prove your key is safe.

### Secure: start a new wallet the right way

- **New wallet, new recovery phrase.** Adding a new account inside your old wallet doesn't help: every account in it comes from the same stolen phrase. Thieves often take over the same address on several networks at once.
- **Set it up on a device you trust,** after updating it and running a malware scan. If you're not sure how the key leaked, that device may be the cause.
- **Write the phrase on paper only.** No photos, screenshots, notes apps, email, or cloud backups. Store it somewhere safe.
- **A hardware wallet** (bought directly from the maker, never secondhand) is the strongest protection if you can afford one.
- **Never reuse the old addresses.** Treat them as burned, on every network, forever.

### Report: where, and in what order

File the law enforcement report first. The others can cite its number.

| Order | Where | What it does |
|-------|-------|--------------|
| 1 | FBI IC3 (ic3.gov), US | Official crime report. Investigators can ask exchanges who owns an account. Save the confirmation number. |
| 2 | Chainabuse (chainabuse.com) | Scam database that exchanges and investigators check. Report wallets and websites. |
| 3 | Block explorer "Report / Flag Address" | Warns others away from the attacker's addresses. |
| 4 | Your wallet's official support (in-app or its official website only) | Records the incident; can escalate attacker addresses to their security team. |
| 5 | The token's project team, if your tokens are frozen or blacklisted | Only they can unfreeze tokens their contract controls. Use contacts from their official website. |
| 6 | Security Alliance (SEAL), securityalliance.org | Volunteer responders for active attacks. Use only links from their own site. |

**Tips that make reports work:**

- **Stick to what you can prove.** Every claim with an address or transaction hash. Mark anything you're unsure of as unconfirmed.
- **Look up who funded the attacker.** On the attacker's explorer page, "Funded By" often shows an exchange. That one withdrawal is the best lead investigators can get, because exchanges verify identity.
- **Never contact the attacker,** and don't contact exchanges about them yourself. Let investigators do it.

### Recover: what's realistically possible

**Gone for good:** anything already transferred out. Blockchain transactions can't be reversed, and no company can undo them.

**Possibly recoverable:** tokens still sitting in the swept wallet. Thieves often leave tokens they can't easily sell, or that are frozen.

- **How it's done:** a private "bundle" sends a sponsor-paid transaction that moves the tokens out in the same block, before the sweeper's bots can react. With EIP-7702, the same transaction can also replace the sweeper's code with rescue code.
- **Frozen or blacklisted tokens need the token team's cooperation:** their unfreeze and your rescue must go in the same private bundle, or the thief's pre-set approvals fire first.
- **Who can help:** reputable teams such as Flashbots' whitehat recovery service (it takes a percentage of what's recovered, not an upfront fee), and open-source rescue tools.
- **Keep control of your key.** A good rescue lets you sign on your own device. Be very cautious with anyone who wants your phrase or key itself.

**Recovery isn't guaranteed. Don't spend money you can't afford chasing it.**

### Templates

More fill-in-the-blank templates (evidence log, IC3 walkthrough, Chainabuse, SEAL 911, payment app disputes, CFPB, helper consent form, case receipt) are in the **[templates folder](templates/)**. A large-print, printable **[first-hour checklist](https://cantstop113.github.io/sweepcheck/first-hour.html)** is also available.

#### 1. Report description (IC3, Chainabuse)

> I own the wallet(s) [ADDRESSES] on [NETWORKS]. Unknown attackers obtained my wallet key(s). Starting around [DATE], [describe: funds were transferred out / a sweeper delegation was attached that redirects incoming funds]. None of the outgoing transactions after [DATE] were made by me.
>
> Attacker addresses: [ADDRESS: what it did, with transaction hash].
>
> The attacker address [ADDRESS] was first funded on [DATE] by [EXCHANGE] in transaction [HASH]. I request that investigators obtain the identity of the account behind that withdrawal.
>
> Confirmed loss: [AMOUNT, with hashes]. Additionally inaccessible: [TOKENS AND VALUE].

#### 2. Email to a token's project team (frozen tokens)

> My wallet [ADDRESS] holds [AMOUNT TOKEN] and is [blacklisted / frozen]. Its key has been compromised: [explain]. I'd like to recover the tokens to a new wallet I control, [NEW ADDRESS]. Because the attacker also holds the key, the unfreeze and the transfer must happen together in one private transaction bundle. Please don't unfreeze the wallet on its own: the attacker is ready to drain it. Can you help, and can you tell me why the wallet was frozen?

#### 3. Support chat: getting a real escalation

> To be clear, I'm not asking you to reverse anything. I'm asking you to escalate [ADDRESSES / my case] to [your security team / your dispute team]. Please give me the ticket number, the team it went to, and when I'll hear back. If you can't escalate it, please tell me why in writing.

### If a payment app took the money (Cash App, Venmo, etc.)

App balances work differently from crypto wallets. In the US, unauthorized electronic transfers from consumer accounts are covered by the Electronic Fund Transfer Act and Regulation E, which generally give you:

- A required investigation within set deadlines, and a written result.
- The right to request the documents the company relied on if it denies your claim.

**What works:**

- **Put everything in writing,** inside the app's support chat, so it attaches to your case. Phone calls leave no record.
- **Ask for the records:** for each transaction, the device, IP address, location, authentication method, and any account-security changes around that time. Ask them to preserve those records.
- **If they deny it,** request the documents they relied on, then appeal with anything that contradicts them, such as a device or location you don't recognize.
- **File a CFPB complaint** (consumerfinance.gov/complaint) if phone support goes in circles. Companies must respond in writing.
- **Report disputes quickly.** Liability limits depend on how fast you report.

*This is general information, not legal advice.*

### The scams that follow victims

Once you post about a hack, scammers find you. Watch for:

- **"Recovery experts" who DM you,** especially after you post publicly. Upfront fees, "tracing fees," or "unlock fees" mean scam, every time. The FBI warns about this specifically.
- **Fake support on Discord, Telegram, X, or by phone.** Real support doesn't DM first, and never asks for your phrase or key.
- **Junk tokens and NFTs appearing in your wallet,** often named after real projects or companies. Don't visit the websites in their names, and don't try to sell them.
- **Look-alike addresses planted in your transaction history.** Never copy an address from your activity list; copy it from the source.
- **Signature traps:** anything asking you to sign "delegate," "upgrade account," or "set code" that you didn't start yourself.

---

**You are not the problem here.** These operations are automated and target thousands of people. Being careful from here on, and reporting what happened, is what protects you and the next person.
