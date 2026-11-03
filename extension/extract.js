// Tiny, standalone helper: given arbitrary text (e.g. whatever the person
// had selected when they right-clicked), find the first thing in it that
// looks like an EVM wallet address (0x + 40 hex chars). Deliberately loose
// and simple — this is a convenience filter, not a validator; the real
// address format check happens again in api.js before any network call.
//
// Exposed the same way api.js is (CommonJS for tests/Node, global for the
// browser) so it can be required directly in a plain Node test script.

(function (root) {
  "use strict";

  const ADDRESS_RE = /0x[0-9a-fA-F]{40}/;

  // Returns the first 0x... address-looking substring found in `text`,
  // or null if none is found.
  function findAddress(text) {
    if (!text) return null;
    const m = ADDRESS_RE.exec(text);
    return m ? m[0] : null;
  }

  const SweepCheckExtract = { findAddress };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SweepCheckExtract;
  }
  if (root) {
    root.SweepCheckExtract = SweepCheckExtract;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
