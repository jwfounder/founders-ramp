// First Seller list + welcome email via Resend (https://resend.com). Secrets live only as Worker secrets
// (RESEND_API_KEY, RESEND_AUDIENCE_ID = First Seller segment id, UNSUB_SECRET); never in git.
// Nothing runs unless FIRST_SELLER_EMAIL === "on".
import { WELCOME_SUBJECT, WELCOME_PREVIEW, WELCOME_TEXT, UNSUB_PLACEHOLDER } from "./first-seller-welcome.js";

const API = "https://api.resend.com";
export const WELCOME_FROM = "Founders Ramp <hello@foundersramp.net>"; // fixed; no env override
export const WELCOME_REPLY_TO = "jw@foundersramp.net";
export const DAILY_SEND_CAP = 90; // Resend free tier is 100/day
const REQUIRED = ["RESEND_API_KEY", "RESEND_AUDIENCE_ID", "UNSUB_SECRET"];
// Retry backoff for real failures: 30 min * 2^tries, capped at 12 h (tries is the count after this failure).
export function retryDelayMs(tries) { return Math.min(30 * 60000 * 2 ** Math.max(0, tries), 12 * 3600000); }
// True only when switched on AND all three secrets exist. Logs missing secret NAMES (never values) when on.
export function ready(env) {
  if (env.FIRST_SELLER_EMAIL !== "on") return false;
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) { console.log("first_seller: switch is on but missing Worker secret(s):", missing.join(", ")); return false; }
  return true;
}
const FROM_OK = /<[^@<>\s]+@foundersramp\.net>$/;

const enc = (s) => new TextEncoder().encode(s);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function call(env, path, body, opts = {}) {
  const headers = { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" };
  if (opts.idem) headers["idempotency-key"] = opts.idem;
  const r = await fetch(API + path, { method: opts.method || "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, json };
}

// Unsubscribe token: hex HMAC-SHA256(lowercased email) keyed with UNSUB_SECRET.
export async function unsubToken(env, email) {
  const k = await crypto.subtle.importKey("raw", enc(env.UNSUB_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc(email.toLowerCase())));
}
async function unsubTokenOk(env, email, t) {
  if (!env.UNSUB_SECRET || !email || !/^[0-9a-f]{64}$/.test(t || "")) return false;
  const want = enc(await unsubToken(env, email)), got = enc(t);
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(want, got);
  let d = 0; for (let i = 0; i < want.length; i++) d |= want[i] ^ got[i]; return d === 0;
}
export async function unsubUrl(env, email) {
  const base = env.UNSUB_BASE || "https://www.foundersramp.net";
  return `${base}/api/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&t=${await unsubToken(env, email)}`;
}

// Build the passed copy word for word with the placeholder replaced. Throws if the placeholder would survive.
export function buildWelcome(url) {
  if (!/^https?:\/\/\S+$/.test(url || "")) throw new Error("no unsubscribe url");
  const text = WELCOME_TEXT.split(UNSUB_PLACEHOLDER).join(url);
  const link = (u) => `<a href="${u}">${u}</a>`;
  const paras = WELCOME_TEXT.trim().split(/\n{2,}/).map((p) => "<p>" + esc(p)
    .replace(/https:\/\/www\.foundersramp\.net\/[^\s<]*/g, link)
    .split(esc(UNSUB_PLACEHOLDER)).join(link(esc(url)))
    .replace(/\n/g, "<br>") + "</p>");
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111;max-width:600px">` +
    `<div style="display:none;max-height:0;overflow:hidden">${esc(WELCOME_PREVIEW)}</div>${paras.join("")}</body></html>`;
  assertNoPlaceholder({ subject: WELCOME_SUBJECT, text, html });
  return { text, html };
}
export function assertNoPlaceholder(msg) {
  const all = JSON.stringify(msg);
  if (all.includes("{{") || all.includes("unsubscribe_link")) throw new Error("template placeholder in outgoing email");
}

function frStore(env) { return env.FR_STORE ? env.FR_STORE.get(env.FR_STORE.idFromName("fr")) : null; }
async function storeJson(env, path, body) {
  const st = frStore(env);
  if (!st) return {};
  const r = await st.fetch("https://fr-store" + path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  return r.ok ? await r.json().catch(() => ({})) : {};
}
// Per-day send slot (atomic count + insert in FrStore). True if a send is allowed.
async function takeSlot(env) { return !!(await storeJson(env, "/welcome-slot?cap=" + DAILY_SEND_CAP)).ok; }
// Retry queue in FrStore for welcomes skipped at the cap or refused by Resend (429/5xx). Max 5 tries per address.
async function queueRetry(env, email, why) {
  const j = await storeJson(env, "/welcome-retry/add", { email, why });
  console.log("first_seller: welcome queued for retry", why, j.ok ? "queued" : "NOT queued (" + (j.reason || "store error") + ")");
}

// Send the welcome to an existing, subscribed contact. Used by signup and by the retry drain.
export async function sendWelcome(env, email) {
  if (!FROM_OK.test(WELCOME_FROM)) return { skipped: "bad_from" };
  const cur = await call(env, `/contacts/${encodeURIComponent(email)}`, undefined, { method: "GET" });
  if (cur.status === 404) return { skipped: "no_contact" };
  if (!cur.ok) { console.log("first_seller: contact lookup failed", cur.status); await queueRetry(env, email, "lookup_" + cur.status); return { skipped: "lookup_failed", status: cur.status }; }
  if (cur.json && cur.json.unsubscribed) return { skipped: "unsubscribed" };
  const url = await unsubUrl(env, email);
  const { text, html } = buildWelcome(url);
  const msg = {
    from: WELCOME_FROM, to: [email], reply_to: WELCOME_REPLY_TO, subject: WELCOME_SUBJECT, text, html,
    headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "list", value: "first_seller" }],
  };
  assertNoPlaceholder(msg); // throws before any slot is used or /emails is called
  if (!(await takeSlot(env))) { await queueRetry(env, email, "cap"); return { skipped: "cap", queued: true }; }
  const idem = "fs-welcome-" + hex(await crypto.subtle.digest("SHA-256", enc(email))).slice(0, 40);
  const r = await call(env, "/emails", msg, { idem });
  if (!r.ok) {
    console.log("first_seller: Resend refused welcome", r.status, r.json && r.json.name);
    if (r.status === 429 || r.status >= 500 || r.status === 0) await queueRetry(env, email, "http_" + r.status);
    else { console.log("first_seller: permanent refusal, welcome dropped", r.status); return { ok: false, status: r.status, permanent: true }; }
  }
  return { ok: r.ok, status: r.status, id: r.json && r.json.id };
}

// Drain up to n queued retries (each still checks unsubscribe status and takes a cap slot).
export async function drainRetries(env, n = 5) {
  if (!ready(env)) return [];
  const j = await storeJson(env, "/welcome-retry/take?n=" + n);
  const out = [];
  for (const email of j.emails || []) {
    let r;
    try { r = await sendWelcome(env, email); }
    catch (e) { console.log("first_seller: retry error", String(e && e.message)); await queueRetry(env, email, "error"); continue; } // counts as a try
    out.push({ email, r });
    // Sent, or nothing to send any more: drop it. A failed send already re-queued itself (tries + 1).
    if (r.ok || r.permanent || r.skipped === "unsubscribed" || r.skipped === "no_contact" || r.skipped === "bad_from") await storeJson(env, "/welcome-retry/done", { email });
    if (r.skipped === "cap") break; // still capped: stop for now
  }
  return out;
}

// Never throws. Lead storage already happened before this runs.
export async function firstSellerSignup(env, email) {
  if (!ready(env)) return { skipped: "off" };
  if (!FROM_OK.test(WELCOME_FROM)) return { skipped: "bad_from" };
  try {
    // Existing contact (subscribed or unsubscribed) = already welcomed or opted out: never send again,
    // and never POST /contacts for it (that could flip unsubscribed back to false).
    const cur = await call(env, `/contacts/${encodeURIComponent(email)}`, undefined, { method: "GET" });
    if (cur.ok) return { skipped: cur.json && cur.json.unsubscribed ? "unsubscribed" : "exists" };
    if (cur.status !== 404) { console.log("first_seller: contact lookup failed", cur.status); return { skipped: "lookup_failed", status: cur.status }; }
    const c = await call(env, "/contacts", { email, unsubscribed: false, segments: [{ id: env.RESEND_AUDIENCE_ID }] });
    if (!c.ok) { console.log("first_seller: contact create failed", c.status); return { contact: { ok: false, status: c.status } }; }
    const welcome = await sendWelcome(env, email);
    if (welcome.ok) await drainRetries(env, 2); // piggyback: a working send means capacity, so catch up a little
    return { contact: { ok: true, status: c.status }, welcome };
  } catch (e) {
    console.log("first_seller: error", String(e && e.message));
    return { skipped: "error" };
  }
}

const PAGE = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Founders Ramp</title><body style="font-family:Georgia,serif;max-width:560px;margin:4em auto;font-size:18px"><p>${msg}</p><p><a href="https://www.foundersramp.net/">foundersramp.net</a></p>`,
  { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

// GET (link click) or POST (RFC 8058 one-click) /api/unsubscribe?e=&t=  -> PATCH contact unsubscribed:true
export async function handleUnsubscribe(request, env) {
  const u = new URL(request.url);
  const email = (u.searchParams.get("e") || "").trim().toLowerCase();
  if (!(await unsubTokenOk(env, email, u.searchParams.get("t")))) return new Response("Invalid unsubscribe link", { status: 400, headers: { "cache-control": "no-store" } });
  const r = await call(env, `/contacts/${encodeURIComponent(email)}`, { unsubscribed: true }, { method: "PATCH" });
  if (!r.ok && r.status !== 404) { console.log("first_seller: unsubscribe PATCH failed", r.status); return new Response("Something went wrong. Please try again.", { status: 502, headers: { "cache-control": "no-store" } }); }
  if (request.method === "POST") return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
  return PAGE("You're unsubscribed.");
}
