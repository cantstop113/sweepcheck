// SweepCheck extension — popup logic.
//
// This is the only place in the extension that ever makes a network call,
// and it only ever calls window.SweepCheckAPI.check() (from the unmodified,
// vendored api.js) — the exact same read-only blockchain checks the main
// SweepCheck site runs. Nothing here asks for, stores, or sends a private
// key, seed phrase, or signature.

const PENDING_KEY = "sweepcheck_pending_selection";

const els = {
  form: document.getElementById("checkForm"),
  addressInput: document.getElementById("addressInput"),
  tokenInput: document.getElementById("tokenInput"),
  advanced: document.getElementById("advanced"),
  checkBtn: document.getElementById("checkBtn"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
};

function setStatus(text, isError) {
  els.status.textContent = text || "";
  els.status.classList.toggle("error", !!isError);
}

function clearResults() {
  els.results.innerHTML = "";
}

function levelLabel(level) {
  if (level === "danger") return "Danger";
  if (level === "warn") return "Warning";
  if (level === "ok") return "Looks clean";
  return "Info";
}

function renderFinding(f) {
  const div = document.createElement("div");
  div.className = "finding " + (f.level || "info");
  div.textContent = f.text;
  return div;
}

function renderChainCard(chainEntry) {
  const card = document.createElement("div");
  card.className = "card";

  const h2 = document.createElement("h2");
  const left = document.createElement("span");
  left.textContent = chainEntry.chainName || chainEntry.chain;
  h2.appendChild(left);

  if (chainEntry.error) {
    const badge = document.createElement("span");
    badge.className = "badge error";
    badge.textContent = "Couldn't check";
    h2.appendChild(badge);
  } else if (chainEntry.sweeperFound) {
    const badge = document.createElement("span");
    badge.className = "badge danger";
    badge.textContent = "Sweeper found";
    h2.appendChild(badge);
  } else {
    const badge = document.createElement("span");
    badge.className = "badge ok";
    badge.textContent = "Looks clean";
    h2.appendChild(badge);
  }
  card.appendChild(h2);

  if (chainEntry.error) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "Could not reach this chain's public nodes right now: " + chainEntry.error;
    card.appendChild(meta);
    return card;
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent =
    (chainEntry.nativeBalance != null ? chainEntry.nativeBalance + " " + chainEntry.nativeSymbol : "balance unknown") +
    " · " + (chainEntry.txCount != null ? chainEntry.txCount + " txns" : "txn count unknown");
  card.appendChild(meta);

  (chainEntry.findings || []).forEach((f) => card.appendChild(renderFinding(f)));

  if (chainEntry.forwardsTo) {
    const fwd = document.createElement("div");
    fwd.className = "forwards-to";
    fwd.textContent = "Stolen funds forwarded to: " + chainEntry.forwardsTo;
    card.appendChild(fwd);
  }

  if (chainEntry.explorerUrl) {
    const a = document.createElement("a");
    a.href = chainEntry.explorerUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "View on block explorer →";
    a.style.display = "inline-block";
    a.style.marginTop = "6px";
    a.style.fontSize = "11.5px";
    card.appendChild(a);
  }

  return card;
}

function renderTokenCard(token) {
  const card = document.createElement("div");
  card.className = "card";

  const h2 = document.createElement("h2");
  const left = document.createElement("span");
  left.textContent = "Token: " + (token.symbol || token.token);
  h2.appendChild(left);
  if (token.blacklisted === true) {
    const badge = document.createElement("span");
    badge.className = "badge danger";
    badge.textContent = "Blacklisted";
    h2.appendChild(badge);
  }
  card.appendChild(h2);

  if (token.error) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "Token check failed: " + token.error;
    card.appendChild(meta);
    return card;
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = "Balance: " + token.balance;
  card.appendChild(meta);

  (token.findings || []).forEach((f) => card.appendChild(renderFinding(f)));

  if (!token.findings || token.findings.length === 0) {
    const ok = document.createElement("div");
    ok.className = "finding ok";
    ok.textContent = "No blacklist flag and no non-zero approvals found for this token.";
    card.appendChild(ok);
  }

  return card;
}

async function runCheck(address, token) {
  clearResults();
  els.checkBtn.disabled = true;
  setStatus("Checking " + address + " … reading public chain data only.");

  try {
    const options = {};
    if (token) options.token = token;
    const result = await window.SweepCheckAPI.check(address, options);

    setStatus("Checked " + result.address + " at " + new Date(result.checkedAt).toLocaleTimeString() + ".");

    const order = ["ethereum", "base", "optimism", "bsc"];
    const keys = Object.keys(result.chains).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    keys.forEach((k) => els.results.appendChild(renderChainCard(result.chains[k])));

    if (result.token) {
      els.results.appendChild(renderTokenCard(result.token));
    }
  } catch (e) {
    setStatus((e && e.message) || String(e), true);
  } finally {
    els.checkBtn.disabled = false;
  }
}

els.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const raw = els.addressInput.value.trim();
  if (!window.SweepCheckAPI.isAddr(raw)) {
    clearResults();
    setStatus("That doesn't look like a wallet address (0x followed by 40 hex characters).", true);
    return;
  }
  const token = els.tokenInput.value.trim();
  runCheck(raw, token && window.SweepCheckAPI.isAddr(token) ? token : undefined);
});

// On open, see if we were launched from the right-click context menu with
// a pending selection to check.
(async function init() {
  let pending = null;
  try {
    const stored = await chrome.storage.local.get(PENDING_KEY);
    pending = stored && stored[PENDING_KEY];
    if (pending) await chrome.storage.local.remove(PENDING_KEY);
  } catch (e) {
    // chrome.storage not available (e.g. opened as a plain file during
    // manual testing) — just fall back to the empty manual-entry form.
  }

  if (!pending) return;

  const found = window.SweepCheckExtract.findAddress(pending.text || "");
  if (!found) {
    setStatus(
      "The text you right-clicked (“" + (pending.text || "").slice(0, 60) +
        (pending.text && pending.text.length > 60 ? "…" : "") +
        "”) doesn't contain what looks like a wallet address. Paste one below instead.",
      true
    );
    return;
  }

  els.addressInput.value = found;
  runCheck(found);
})();
