// SweepCheck API — the same read-only wallet/token checks the page runs,
// available as plain JS so any script (or another program, after a quick
// port) can get the result as a plain JSON object instead of a rendered page.
//
// No backend, no build step: this file is loaded with a plain
// <script src="api.js"></script> tag (or `require`d under Node for testing)
// and attaches everything to `window.SweepCheckAPI` in the browser.
//
// See API.md at the repo root for the documented shape of check() results
// and a usage example.
//
// Nothing here ever asks for, stores, or transmits a private key or recovery
// phrase. Every lookup is a read-only JSON-RPC call to a public node.

(function (root) {
  "use strict";

  const CHAINS = {
    bsc:      { name: "BNB Chain", native: "BNB", explorer: "https://bscscan.com",
                rpcs: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"] },
    base:     { name: "Base", native: "ETH", explorer: "https://basescan.org",
                rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"] },
    optimism: { name: "Optimism", native: "ETH", explorer: "https://optimistic.etherscan.io",
                rpcs: ["https://optimism-rpc.publicnode.com"] },
    ethereum: { name: "Ethereum", native: "ETH", explorer: "https://etherscan.io",
                rpcs: ["https://ethereum-rpc.publicnode.com"] },
    arbitrum: { name: "Arbitrum", native: "ETH", explorer: "https://arbiscan.io",
                rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-rpc.publicnode.com"] },
    polygon:  { name: "Polygon", native: "POL", explorer: "https://polygonscan.com",
                rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"] },
    linea:    { name: "Linea", native: "ETH", explorer: "https://lineascan.io",
                rpcs: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"] },
    scroll:   { name: "Scroll", native: "ETH", explorer: "https://scrollscan.com",
                rpcs: ["https://rpc.scroll.io", "https://scroll-rpc.publicnode.com"] },
  };

  // Delegate contracts seen in the wild. "sweeper" entries were verified on-chain
  // during a real incident investigation (Oct 2026). Labels are evidence, not accusations
  // against anyone but the code's observed behavior.
  const KNOWN_DELEGATES = {
    "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b": { kind: "safe",    label: "MetaMask Smart Account (official EIP-7702 Delegator)" },
    "0x9db96924a0b0b9a83fe2368b29539561a9c696d8": { kind: "sweeper", label: "\"Forwarder\" sweeper (BNB Chain)" },
    "0x86e415756170ef48e0e9052b8a8a7bd4783a77ca": { kind: "sweeper", label: "Forwarder-pattern sweeper (BNB Chain)" },
    "0x7c802f062c67058d0dd40b041204b960e8bde26a": { kind: "sweeper", label: "Forwarder-pattern sweeper (Base)" },
    "0xcefd060da801a3f004d6b307f4cab943d1c9b45b": { kind: "sweeper", label: "Forwarder-pattern sweeper (Optimism)" },
    "0xe25db171b622ce6f9e262a0ac84d73790bb54365": { kind: "sweeper", label: "Forwarder-pattern sweeper (BNB Chain)" },
    "0x57678b37823e47b13c17cab41b1e9c264c9d93a3": { kind: "suspicious", label: "Generic executor used by key-testing bots (Base)" },
  };

  // Permit2: one canonical address, deployed to the same address on every chain
  // that has it. Confirmed deployed and source-verified on BNB Chain 2026-11-11.
  //
  // Why this matters: an approval routed through Permit2 is TWO layers deep.
  // The token-level approval points at Permit2 itself, which looks entirely
  // routine because most major routers use it. The address that can actually
  // move the funds sits one layer down, in Permit2's own allowance mapping. A
  // checker that only reads token-level allowances reports nothing at all.
  const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";

  const KNOWN_SPENDERS = {
    "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch router v5 (legitimate swap router)",
    "0xac4c6e212a361c968f1725b4d055b47e63f80b75": "SushiSwap RedSnwapper router (legitimate swap router)",
    "0x8157a9d65807521fbb8db8f37eeecefdd247e9b1": "Contract pre-approved by an attacker in a real incident",
    "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2 (shared approval contract used by most major routers — routine by itself, but it means the real spender is one layer down; see the permit2 section)",
  };

  // ---- Single source: registry/sweepers.json -----------------------------
  // The published registry feed is the PRIMARY source for the two lists
  // above: the first check() merges it in, and the hardcoded entries only
  // survive where the feed is silent (or unreachable). Loading is lazy and
  // cached once, so page load never blocks on it.
  //
  // Two URLs are tried in order, then the hardcoded lists simply stay in
  // force: the relative path works on GitHub Pages / any same-origin host,
  // the absolute URL covers the browser extension (whose own copy of this
  // file has no registry/ directory next to it). If fetch is missing
  // entirely (bare Node require, very old browsers) or the page is opened
  // over file://, both fetches fail fast and the offline fallback holds —
  // which is why this file still works with no network at all.
  const REGISTRY_URLS = [
    "registry/sweepers.json",
    "https://cantstop113.github.io/sweepcheck/registry/sweepers.json",
  ];
  const REGISTRY_SCHEMA = "sweepcheck-registry-2";
  // address -> "attacker" | "router" | "safe", from the feed's spenders list.
  // Used alongside the label text when deciding how scary an approval is.
  const SPENDER_KINDS = {};
  let registryLoad = null;

  function applyRegistry(reg) {
    if (!reg || reg.schema !== REGISTRY_SCHEMA) return false;
    // Single-source the fingerprint: the feed's selector list is what the tool
    // matches against, so updating it there updates every consumer. Only
    // well-formed hex selectors are taken; anything else leaves the current
    // list untouched.
    if (Array.isArray(reg.fingerprint) && reg.fingerprint.length) {
      const sel = reg.fingerprint
        .filter((s) => typeof s === "string" && /^[0-9a-fA-F]{1,8}$/.test(s))
        .map((s) => s.toLowerCase());
      if (sel.length) {
        SWEEPER_FINGERPRINT.length = 0;
        sel.forEach((s) => SWEEPER_FINGERPRINT.push(s));
      }
    }
    // Feed entries win on conflict; hardcoded entries fill any gap the feed
    // doesn't cover. Both maps are mutated in place so anything already
    // holding a reference (window.SweepCheckAPI.KNOWN_DELEGATES) sees the
    // merge. Addresses are deduped by lowercase key.
    (reg.delegates || []).forEach((e) => {
      if (!e || !isAddr(e.address)) return;
      KNOWN_DELEGATES[e.address.toLowerCase()] = { kind: e.kind || "unknown", label: e.label || e.address };
    });
    (reg.spenders || []).forEach((e) => {
      if (!e || !isAddr(e.address)) return;
      const a = e.address.toLowerCase();
      KNOWN_SPENDERS[a] = e.label || a;
      SPENDER_KINDS[a] = e.kind || "unknown";
    });
    return true;
  }

  // Resolves once the feed has been applied (or definitively skipped).
  // Never rejects: a failed feed load is not an error, it's the fallback.
  function loadRegistry() {
    if (registryLoad) return registryLoad;
    registryLoad = (async () => {
      if (typeof fetch !== "function") return null;
      for (const url of REGISTRY_URLS) {
        try {
          const opts = { cache: "no-cache" };
          if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(5000);
          const r = await fetch(url, opts);
          if (!r || !r.ok) continue;
          const reg = await r.json();
          if (applyRegistry(reg)) return reg;
        } catch (e) { /* try the next URL, then fall back to the hardcoded lists */ }
      }
      return null;
    })();
    return registryLoad;
  }

  const SEL = { balanceOf: "0x70a08231", isBlacklisted: "0xfe575a87", allowance: "0xdd62ed3e",
                decimals: "0x313ce567", symbol: "0x95d89b41",
                // Permit2.allowance(owner, token, spender) -> (uint160 amount, uint48 expiration, uint48 nonce)
                permit2Allowance: "0x927da105" };
  // Permit2.lockdown(TokenSpenderPair[]) — one call that batch-revokes Permit2 approvals.
  const PERMIT2_LOCKDOWN_SEL = "0xcc53287f";
  const UINT160_MAX = (2n ** 160n) - 1n;
  const UINT48_MAX = (2n ** 48n) - 1n;
  // Forwarder sweeper fingerprint: initialize(address) + destination() selectors in bytecode.
  const SWEEPER_FINGERPRINT = ["c4d66de8", "b269681d"];

  const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test((a || "").trim());
  const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const hexToBig = (h) => (h && h !== "0x" ? BigInt(h) : 0n);

  async function rpc(chainKey, method, params) {
    const errs = [];
    for (const url of CHAINS[chainKey].rpcs) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        const j = await r.json();
        if (j.error) { errs.push(j.error.message || "rpc error"); continue; }
        return j.result;
      } catch (e) { errs.push(String(e && e.message || e)); }
    }
    const err = new Error("All RPC endpoints failed: " + errs.join(" | "));
    err.rpcFailure = true; throw err;
  }

  async function ethCall(chainKey, to, data) {
    try { return await rpc(chainKey, "eth_call", [{ to, data }, "latest"]); }
    catch (e) { if (e.rpcFailure && /revert|execution/i.test(e.message)) return null; if (e.rpcFailure) return null; throw e; }
  }

  function formatUnits(v, d) {
    const neg = v < 0n; if (neg) v = -v;
    const base = 10n ** BigInt(d); const whole = v / base; let frac = (v % base).toString().padStart(d, "0").replace(/0+$/, "");
    if (frac.length > 6) frac = frac.slice(0, 6);
    return (neg ? "-" : "") + whole.toLocaleString("en-US") + (frac ? "." + frac : "");
  }

  function decodeString(hex) {
    if (!hex || hex === "0x") return null;
    const h = hex.slice(2);
    try {
      if (h.length >= 128) {
        const len = parseInt(h.slice(64, 128), 16);
        const bytes = h.slice(128, 128 + len * 2);
        return decodeURIComponent(bytes.replace(/(..)/g, "%$1"));
      }
      return decodeURIComponent(h.replace(/00+$/, "").replace(/(..)/g, "%$1"));
    } catch { return null; }
  }

  // Checks one wallet address on one chain: delegation (EIP-7702 sweeper),
  // native balance, tx count. Returns a plain, JSON-serializable object.
  async function checkWallet(chainKey, address) {
    if (!isAddr(address)) throw new Error("That doesn't look like a wallet address (0x followed by 40 characters).");
    await loadRegistry();
    const addr = address.trim();
    const [code, bal, nonce] = await Promise.all([
      rpc(chainKey, "eth_getCode", [addr, "latest"]),
      rpc(chainKey, "eth_getBalance", [addr, "latest"]),
      rpc(chainKey, "eth_getTransactionCount", [addr, "latest"]),
    ]);
    const out = { chain: chainKey, address: addr, nativeBalance: formatUnits(hexToBig(bal), 18),
      txCount: Number(hexToBig(nonce)), type: "wallet", delegate: null, findings: [] };
    const c = (code || "0x").toLowerCase();
    if (c === "0x") {
      out.type = "wallet";
      out.findings.push({ level: "ok", evidence: "checked live",
        text: "No delegation or code is attached. This looks like a normal wallet. (This can't prove the key is safe, only that no sweeper code is attached.)" });
    } else if (c.startsWith("0xef0100") && c.length === 48) {
      out.type = "delegated";
      const d = "0x" + c.slice(8);
      const known = KNOWN_DELEGATES[d];
      const dcode = ((await rpc(chainKey, "eth_getCode", [d, "latest"])) || "0x").toLowerCase();
      const fingerprint = SWEEPER_FINGERPRINT.every((s) => dcode.includes(s));
      let dest = null;
      if (fingerprint) {
        const slot0 = (await rpc(chainKey, "eth_getStorageAt", [addr, "0x0", "latest"])) || "0x";
        const s = slot0.replace(/^0x/, "").padStart(64, "0");
        const a = "0x" + s.slice(-40);
        if (!/^0x0{40}$/.test(a)) dest = a;
      }
      out.delegate = { address: d, label: known ? known.label : null, kind: known ? known.kind : (fingerprint ? "sweeper" : "unknown"), fingerprint, forwardsTo: dest };
      if (out.delegate.kind === "sweeper") {
        out.findings.push({ level: "danger", evidence: known ? "checked live + known sweeper" : "checked live + pattern match",
          text: "A SWEEPER is attached to this wallet. Any coins sent to it get forwarded to someone else within seconds. Assume the private key is stolen." + (dest ? " Coins are being forwarded to " + dest + "." : "") });
      } else if (out.delegate.kind === "safe") {
        out.findings.push({ level: "info", evidence: "checked live",
          text: "Upgraded to " + known.label + ". This is normal if YOU turned on MetaMask's smart account. If you didn't, treat it as suspicious." });
      } else if (out.delegate.kind === "suspicious") {
        out.findings.push({ level: "danger", evidence: "checked live + known address",
          text: "Delegated to " + known.label + ". Assume the private key is stolen." });
      } else {
        out.findings.push({ level: "warn", evidence: "checked live",
          text: "This wallet runs code from an unrecognized contract (" + d + "). If you didn't set this up yourself, assume the private key is stolen." });
      }
    } else {
      out.type = "contract";
      out.findings.push({ level: "info", evidence: "checked live", text: "This address is a smart contract, not a personal wallet." });
    }
    return out;
  }

  // Reads Permit2's own allowance for one (owner, token, spender) triple.
  // Returns null if the call fails or returns nothing, otherwise the three
  // unpacked values as BigInts.
  async function readPermit2Allowance(chainKey, owner, token, spender) {
    const h = await ethCall(chainKey, PERMIT2, SEL.permit2Allowance + pad(owner) + pad(token) + pad(spender));
    if (!h || h.length < 2 + 192) return null;
    const word = (i) => BigInt("0x" + h.slice(2 + i * 64, 2 + (i + 1) * 64));
    return { amount: word(0), expiration: word(1), nonce: word(2) };
  }

  // The chain's own clock. Permit2 treats an allowance as dead once
  // block.timestamp > expiration, so "is this still live?" is answered against
  // the chain, not against the viewer's computer clock.
  async function chainNow(chainKey) {
    try {
      const b = await rpc(chainKey, "eth_getBlockByNumber", ["latest", false]);
      if (b && b.timestamp) return BigInt(b.timestamp);
    } catch (e) { /* fall through to local clock */ }
    return BigInt(Math.floor(Date.now() / 1000));
  }

  // Checks one token for one owner on one chain: blacklist status and
  // approvals (allowances) to a fixed set of known spenders plus any extra
  // spender addresses passed in. Returns a plain, JSON-serializable object.
  async function checkToken(chainKey, owner, token, extraSpenders) {
    if (!isAddr(token)) throw new Error("Token address isn't valid.");
    await loadRegistry();
    const [sym, dec, bal, bl] = await Promise.all([
      ethCall(chainKey, token, SEL.symbol),
      ethCall(chainKey, token, SEL.decimals),
      ethCall(chainKey, token, SEL.balanceOf + pad(owner)),
      ethCall(chainKey, token, SEL.isBlacklisted + pad(owner)),
    ]);
    const decimals = dec ? Number(hexToBig(dec)) : 18;
    const res = { token, symbol: decodeString(sym) || "token", balance: bal ? formatUnits(hexToBig(bal), decimals) : "unknown",
      blacklisted: bl == null ? null : hexToBig(bl) === 1n, allowances: [], findings: [] };
    if (res.blacklisted === true) res.findings.push({ level: "warn", evidence: "checked live",
      text: "This wallet is BLACKLISTED on the " + res.symbol + " token. Its " + res.symbol + " can't move until the token's team lifts it. Only that team can do so." });
    const spenders = [...new Set([owner.toLowerCase(), ...Object.keys(KNOWN_SPENDERS), ...(extraSpenders || []).filter(isAddr).map((s) => s.toLowerCase())])];
    for (const s of spenders) {
      const a = await ethCall(chainKey, token, SEL.allowance + pad(owner) + pad(s));
      const v = hexToBig(a);
      if (v > 0n) {
        const unlimited = v > (2n ** 255n);
        const label = s === owner.toLowerCase() ? "the wallet itself (unusual: often set by attackers)" : (KNOWN_SPENDERS[s] || "unrecognized address");
        res.allowances.push({ spender: s, label, amount: unlimited ? "UNLIMITED" : formatUnits(v, decimals) });
        const risky = s === owner.toLowerCase() || !KNOWN_SPENDERS[s] || SPENDER_KINDS[s] === "attacker" || /attacker/.test(KNOWN_SPENDERS[s] || "");
        res.findings.push({ level: risky ? "warn" : "info", evidence: "checked live",
          text: (unlimited ? "Unlimited" : formatUnits(v, decimals)) + " " + res.symbol + " approved to " + label + " (" + s + ")." });
      }
    }

    // Second layer: Permit2. The token-level loop above can only ever see an
    // approval pointing AT Permit2, which looks routine. The address that can
    // actually move the tokens lives in Permit2's own allowance mapping, so it
    // has to be read separately, one spender at a time.
    //
    // Honest limitation: Permit2 allowances cannot be enumerated from a
    // contract read. This covers the addresses SweepCheck knows to ask about.
    // Finding nothing here is NOT proof that no Permit2 approval exists — that
    // needs an event-log scan of Permit2 filtered by this wallet.
    const tokenToPermit2 = res.allowances.find((a) => a.spender === PERMIT2);
    const candidates = [...new Set([
      owner.toLowerCase(),
      ...Object.keys(KNOWN_SPENDERS),
      ...Object.keys(KNOWN_DELEGATES),
      ...(extraSpenders || []).filter(isAddr).map((s) => s.toLowerCase()),
    ])].filter((s) => s !== PERMIT2);
    res.permit2 = {
      contract: PERMIT2,
      approvedToPermit2: !!tokenToPermit2,
      spendersChecked: candidates,
      allowances: [],
      complete: false,
      note: "Permit2 allowances can only be read one spender at a time, so this covers known addresses only. A complete answer needs an event-log scan of Permit2 for this wallet.",
    };
    const now = await chainNow(chainKey);
    const probes = await Promise.all(candidates.map(async (s) => {
      try { return { s, p: await readPermit2Allowance(chainKey, owner, token, s) }; }
      catch (e) { return { s, p: null }; }
    }));
    for (const { s, p } of probes) {
      if (!p || p.amount === 0n) continue;
      const unlimited = p.amount >= UINT160_MAX;
      const neverExpires = p.expiration >= UINT48_MAX;
      const unexpired = p.expiration >= now;
      // An inner Permit2 approval can only actually move tokens while the
      // token-level approval to Permit2 is also in place. Without it the
      // approval is dormant, not harmless: re-approving Permit2 reactivates it.
      const usableNow = unexpired && !!tokenToPermit2;
      const amountText = unlimited ? "unlimited" : formatUnits(p.amount, decimals);
      const expiryText = neverExpires ? "never" : new Date(Number(p.expiration) * 1000).toISOString();
      const label = s === owner.toLowerCase() ? "the wallet itself (unusual: often set by attackers)"
        : (KNOWN_SPENDERS[s] || (KNOWN_DELEGATES[s] && KNOWN_DELEGATES[s].label) || "unrecognized address");
      res.permit2.allowances.push({ spender: s, label, amount: unlimited ? "UNLIMITED" : formatUnits(p.amount, decimals),
        expiration: expiryText, expired: !unexpired, usableNow, nonce: p.nonce.toString() });
      let text;
      if (!unexpired) {
        text = "Expired Permit2 approval (no longer usable): " + amountText + " " + res.symbol + " to " + label + " (" + s + "), expired " + expiryText + ".";
      } else if (usableNow) {
        text = "LIVE Permit2 approval: " + amountText + " " + res.symbol + " to " + label + " (" + s + "), expiry " + expiryText
          + ". This does NOT appear as a token approval to that address — it sits inside Permit2. Revoke it with Permit2's lockdown() call (selector " + PERMIT2_LOCKDOWN_SEL + ").";
      } else {
        text = "Dormant Permit2 approval: " + amountText + " " + res.symbol + " to " + label + " (" + s + "), expiry " + expiryText
          + ". It cannot move tokens right now because this wallet has no token-level approval to Permit2 — but approving Permit2 again would reactivate it. Revoke it with Permit2's lockdown() call (selector " + PERMIT2_LOCKDOWN_SEL + ").";
      }
      res.findings.push({ level: unexpired ? "warn" : "info", evidence: "checked live", text });
    }
    if (tokenToPermit2 && !res.permit2.allowances.length) {
      res.findings.push({ level: "info", evidence: "checked live",
        text: "This wallet has approved Permit2, which is normal on its own. No Permit2 approval was found for any address SweepCheck knows to ask about — but Permit2 can only be read one spender at a time, so that is not proof there is none." });
    }
    return res;
  }

  // The documented, stable entry point: runs checkWallet across the requested
  // chains (and checkToken, if a token address was given) for one address,
  // and returns a single plain JSON-serializable object. See API.md.
  //
  //   window.SweepCheckAPI.check(address, { chains, token, spenders })
  //
  // options.chains   — array of chain keys from CHAINS (default: all of them)
  // options.token    — optional ERC-20 token contract address to also check
  //                    (blacklist status + approvals), run on options.chains[0]
  // options.spenders — optional array of extra addresses to check token
  //                    approvals for, alongside the built-in known spenders
  async function check(address, options) {
    const opts = options || {};
    const chainKeys = (opts.chains && opts.chains.length ? opts.chains : Object.keys(CHAINS))
      .filter((k) => Object.prototype.hasOwnProperty.call(CHAINS, k));
    if (!chainKeys.length) throw new Error("No valid chain names given. Valid chains: " + Object.keys(CHAINS).join(", "));
    if (!isAddr(address)) throw new Error("That doesn't look like a wallet address (0x followed by 40 characters).");
    const addr = address.trim();

    const result = { address: addr, checkedAt: new Date().toISOString(), chains: {}, token: null };

    for (const chainKey of chainKeys) {
      const chainMeta = CHAINS[chainKey];
      try {
        const w = await checkWallet(chainKey, addr);
        const sweeperFinding = w.findings.find((f) => f.level === "danger" && w.delegate);
        result.chains[chainKey] = {
          chain: chainKey,
          chainName: chainMeta.name,
          explorerUrl: chainMeta.explorer + "/address/" + addr,
          nativeBalance: w.nativeBalance,
          nativeSymbol: chainMeta.native,
          txCount: w.txCount,
          addressType: w.type,
          sweeperFound: !!(w.delegate && (w.delegate.kind === "sweeper" || w.delegate.kind === "suspicious")),
          sweeperAddress: w.delegate ? w.delegate.address : null,
          forwardsTo: w.delegate ? w.delegate.forwardsTo : null,
          delegate: w.delegate,
          findings: w.findings,
          error: null,
        };
      } catch (e) {
        result.chains[chainKey] = {
          chain: chainKey,
          chainName: chainMeta.name,
          explorerUrl: chainMeta.explorer + "/address/" + addr,
          nativeBalance: null,
          nativeSymbol: chainMeta.native,
          txCount: null,
          addressType: null,
          sweeperFound: null,
          sweeperAddress: null,
          forwardsTo: null,
          delegate: null,
          findings: [],
          error: String((e && e.message) || e),
        };
      }
    }

    if (opts.token) {
      const tokenChainKey = chainKeys[0];
      try {
        const t = await checkToken(tokenChainKey, addr, opts.token, opts.spenders || []);
        result.token = {
          chain: tokenChainKey,
          token: t.token,
          symbol: t.symbol,
          balance: t.balance,
          blacklisted: t.blacklisted,
          allowances: t.allowances,
          permit2: t.permit2,
          findings: t.findings,
          error: null,
        };
      } catch (e) {
        result.token = {
          chain: tokenChainKey,
          token: opts.token,
          symbol: null,
          balance: null,
          blacklisted: null,
          allowances: [],
          permit2: null,
          findings: [],
          error: String((e && e.message) || e),
        };
      }
    }

    return result;
  }

  const SweepCheckAPI = { check, checkWallet, checkToken, CHAINS, KNOWN_DELEGATES, KNOWN_SPENDERS, isAddr, formatUnits, loadRegistry, applyRegistry, SWEEPER_FINGERPRINT };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SweepCheckAPI;
  }
  if (root) {
    root.SweepCheckAPI = SweepCheckAPI;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
