// First Seller list + welcome email via Resend (https://resend.com). Secrets live only as Worker secrets
// (RESEND_API_KEY, RESEND_AUDIENCE_ID = First Seller segment id, UNSUB_SECRET); never in git.
// Nothing runs unless FIRST_SELLER_EMAIL === "on".
import { WELCOME_SUBJECT, WELCOME_PREVIEW, WELCOME_TEXT, UNSUB_PLACEHOLDER } from "./first-seller-welcome.js";

const API = "https://api.resend.com";
export const WELCOME_FROM = "Founders Ramp <hello@foundersramp.net>"; // fixed; no env override
export const WELCOME_REPLY_TO = "jw@foundersramp.net";
export const DAILY_SEND_CAP = 90; // Resend free tier is 100/day
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
  if (JSON.stringify(msg).includes("unsubscribe_link")) throw new Error("literal {{unsubscribe_link}} in outgoing email");
}

// Per-day send slot from the FrStore Durable Object (atomic count + insert). Returns true if a send is allowed.
async function takeSlot(env) {
  if (!env.FR_STORE) return false;
  const st = env.FR_STORE.get(env.FR_STORE.idFromName("fr"));
  const r = await st.fetch("https://fr-store/welcome-slot?cap=" + DAILY_SEND_CAP, { method: "POST" });
  const j = r.ok ? await r.json().catch(() => ({})) : {};
  return !!j.ok;
}

// Never throws. Lead storage already happened before this runs.
export async function firstSellerSignup(env, email) {
  if (env.FIRST_SELLER_EMAIL !== "on" || !env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID || !env.UNSUB_SECRET) return { skipped: "off" };
  if (!FROM_OK.test(WELCOME_FROM)) return { skipped: "bad_from" };
  try {
    // Existing contact (subscribed or unsubscribed) = already welcomed or opted out: never send again,
    // and never POST /contacts for it (that could flip unsubscribed back to false).
    const cur = await call(env, `/contacts/${encodeURIComponent(email)}`, undefined, { method: "GET" });
    if (cur.ok) return { skipped: cur.json && cur.json.unsubscribed ? "unsubscribed" : "exists" };
    if (cur.status !== 404) { console.log("first_seller: contact lookup failed", cur.status); return { skipped: "lookup_failed", status: cur.status }; }
    const c = await call(env, "/contacts", { email, unsubscribed: false, segments: [{ id: env.RESEND_AUDIENCE_ID }] });
    if (!c.ok) { console.log("first_seller: contact create failed", c.status); return { contact: { ok: false, status: c.status } }; }
    if (!(await takeSlot(env))) { console.log("first_seller: daily send cap reached, welcome not sent"); return { contact: { ok: true, status: c.status }, skipped: "cap" }; }
    const url = await unsubUrl(env, email);
    const { text, html } = buildWelcome(url);
    const msg = {
      from: WELCOME_FROM, to: [email], reply_to: WELCOME_REPLY_TO, subject: WELCOME_SUBJECT, text, html,
      headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "list", value: "first_seller" }],
    };
    assertNoPlaceholder(msg);
    const idem = "fs-welcome-" + hex(await crypto.subtle.digest("SHA-256", enc(email))).slice(0, 40);
    const r = await call(env, "/emails", msg, { idem });
    if (!r.ok) console.log("first_seller: Resend refused welcome", r.status, r.json && r.json.name);
    return { contact: { ok: true, status: c.status }, welcome: { ok: r.ok, status: r.status, id: r.json && r.json.id } };
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
