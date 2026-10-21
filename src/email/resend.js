// First Seller list + welcome email via Resend (https://resend.com). Key lives only as the Worker secret
// RESEND_API_KEY (wrangler secret put RESEND_API_KEY); never in git. Nothing runs unless FIRST_SELLER_EMAIL === "on".
import { WELCOME_SUBJECT, WELCOME_PREVIEW, WELCOME_TEXT } from "./first-seller-welcome.js";

const API = "https://api.resend.com";
export const WELCOME_FROM = "Founders Ramp <hello@foundersramp.net>";
export const WELCOME_REPLY_TO = "jw@foundersramp.net";

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// Plain-text copy -> minimal HTML: paragraphs, bare URLs linked, hidden preview line. No tracking pixels.
export function welcomeHtml() {
  const paras = WELCOME_TEXT.trim().split(/\n{2,}/).map((p) =>
    "<p>" + esc(p).replace(/https:\/\/www\.foundersramp\.net\/[^\s<]*/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, "<br>") + "</p>");
  return `<!doctype html><html><body style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111;max-width:600px">` +
    `<div style="display:none;max-height:0;overflow:hidden">${esc(WELCOME_PREVIEW)}</div>${paras.join("")}</body></html>`;
}

async function call(env, path, body, idem) {
  const headers = { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" };
  if (idem) headers["idempotency-key"] = idem;
  const r = await fetch(API + path, { method: "POST", headers, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status };
}

// Returns {contact, welcome} statuses; never throws. Lead storage already happened before this runs.
export async function firstSellerSignup(env, email) {
  if (env.FIRST_SELLER_EMAIL !== "on" || !env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return { skipped: true };
  const out = {};
  try {
    out.contact = await call(env, `/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`, { email, unsubscribed: false });
  } catch { out.contact = { ok: false, status: 0 }; }
  try {
    const day = new Date().toISOString().slice(0, 10);
    out.welcome = await call(env, "/emails", {
      from: env.WELCOME_FROM || WELCOME_FROM,
      to: [email],
      reply_to: WELCOME_REPLY_TO,
      subject: WELCOME_SUBJECT,
      text: WELCOME_TEXT,
      html: welcomeHtml(),
      tags: [{ name: "list", value: "first_seller" }],
    }, `fs-welcome-${email}-${day}`); // same address twice in a day = one email (Resend keeps keys 24h)
  } catch { out.welcome = { ok: false, status: 0 }; }
  return out;
}
