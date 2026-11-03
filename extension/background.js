// SweepCheck extension — background service worker.
//
// This script only wires up the right-click context menu. It never reads,
// stores, or transmits a private key, seed phrase, or signature. It does
// not reimplement any of the blockchain-checking logic — that lives in
// api.js (unmodified, vendored from the main SweepCheck repo) and is run
// by popup.js inside the extension popup, which is where the actual
// network calls happen.
//
// Flow:
//   1. Person selects text on any page and right-clicks.
//   2. They choose "Check with SweepCheck" from the context menu.
//   3. We stash the selected text in chrome.storage.local and open the
//      extension popup in its own small window.
//   4. popup.js picks up the stashed text, looks for a 0x... address in
//      it, and (if found) runs the exact same api.js check the main site
//      uses, showing the result right there.

const MENU_ID = "sweepcheck-check-selection";
const PENDING_KEY = "sweepcheck_pending_selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Check with SweepCheck",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const selectedText = (info.selectionText || "").trim();

  try {
    await chrome.storage.local.set({
      [PENDING_KEY]: { text: selectedText, at: Date.now() },
    });
  } catch (e) {
    // If storage somehow fails, we still try to open the popup; it will
    // just show its normal "paste an address" screen.
  }

  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 440,
    height: 640,
    focused: true,
  });
});
