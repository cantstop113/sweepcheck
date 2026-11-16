// Hosted POST check API (Vercel serverless function — zero dependencies).
//
// POST /api/check   { "address": "0x..", "chains": ["base"], "token": "0x..", "spenders": ["0x.."] }
//   -> 200 { "ok": true,  "result": <same shape as SweepCheckAPI.check() — see API.md> }
//   -> 400 { "ok": false, "error": "..." }   bad request
//   -> 405 / 429 / 500 likewise.
// GET  /api/check   -> 200 usage hint.
//
// Read-only: validates and forwards to api.js, which only ever performs
// public JSON-RPC reads. No keys, no signing, no transfers. The rate limit
// is a best-effort per-instance map — documented as such in API.md.
"use strict";
const api = require("../api.js");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function ipOf(req) {
  const fwd = req.headers && req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 10000) hits.clear(); // best-effort bound on the map itself
  return false;
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
    return Promise.resolve(req.body); // host parsed the JSON already
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 8192) { reject(new Error("body too large (8KB max)")); if (req.destroy) req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      info: "SweepCheck hosted check API — POST {\"address\":\"0x...\",\"chains\":[\"base\"]}",
      docs: "https://github.com/cantstop113/sweepcheck/blob/main/API.md",
    });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "use POST" }); return; }
  if (rateLimited(ipOf(req))) {
    res.status(429).json({ ok: false, error: "rate limit: 20 checks per minute per IP (best effort)" });
    return;
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); return; }

  const address = body.address;
  if (!api.isAddr(address)) {
    res.status(400).json({ ok: false, error: "address must be 0x followed by 40 hex characters" });
    return;
  }
  let chains = null;
  if (body.chains !== undefined && body.chains !== null) {
    if (!Array.isArray(body.chains)) { res.status(400).json({ ok: false, error: "chains must be an array" }); return; }
    chains = body.chains.filter((c) => Object.prototype.hasOwnProperty.call(api.CHAINS, c));
    if (!chains.length) {
      res.status(400).json({ ok: false, error: "no valid chains; valid: " + Object.keys(api.CHAINS).join(", ") });
      return;
    }
    chains = chains.slice(0, 8);
  }
  const token = api.isAddr(body.token) ? body.token : null;
  const spenders = Array.isArray(body.spenders) ? body.spenders.filter((s) => api.isAddr(s)).slice(0, 10) : [];

  try {
    const result = await api.check(address, { chains, token, spenders });
    res.status(200).json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
