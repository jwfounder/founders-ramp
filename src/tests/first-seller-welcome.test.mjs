import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstSellerSignup, buildWelcome, assertNoPlaceholder, handleUnsubscribe, unsubUrl, WELCOME_FROM, WELCOME_REPLY_TO, DAILY_SEND_CAP } from "../email/resend.js";
import { WELCOME_SUBJECT, WELCOME_PREVIEW, WELCOME_TEXT } from "../email/first-seller-welcome.js";

// Fake Resend + fake FrStore slot counter.
let calls = [], contacts = {}, slots = 0;
globalThis.fetch = async (u, o = {}) => {
  const m = o.method || "GET"; calls.push({ u, o, m });
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
  const one = u.match(/\/contacts\/([^/]+)$/);
  if (one) { const e = decodeURIComponent(one[1]); if (!contacts[e]) return j({ message: "Contact not found" }, 404);
    if (m === "PATCH") Object.assign(contacts[e], JSON.parse(o.body)); return j({ email: e, ...contacts[e] }); }
  if (u.endsWith("/contacts")) { const b = JSON.parse(o.body); contacts[b.email] = { unsubscribed: b.unsubscribed }; return j({ id: "c1" }, 201); }
  if (u.endsWith("/emails")) { assertNoPlaceholder(JSON.parse(o.body)); return j({ id: "e1" }); }
  return j({}, 404);
};
const FR_STORE = { idFromName: () => 1, get: () => ({ fetch: async () => new Response(JSON.stringify({ ok: ++slots <= DAILY_SEND_CAP })) }) };
const env = { FIRST_SELLER_EMAIL: "on", RESEND_API_KEY: "k", RESEND_AUDIENCE_ID: "seg1", UNSUB_SECRET: "s3cret", UNSUB_BASE: "http://x", FR_STORE };
const sent = () => calls.filter((c) => c.u.endsWith("/emails"));

// 1. Off switch: no fetch at all.
assert.deepEqual(await firstSellerSignup({ ...env, FIRST_SELLER_EMAIL: "off" }, "x@y.com"), { skipped: "off" });
assert.equal(calls.length, 0);

// 2. Copy = passed r2 email.txt word for word, placeholder replaced by the signed link.
const src = readFileSync("/home/box/shared/post-qa/passed/2026-10-21-sydney-first-seller-welcome-email-r2/email.txt", "utf8");
assert.ok(src.startsWith(`Subject: ${WELCOME_SUBJECT}\n\nPreview: ${WELCOME_PREVIEW}\n\n`));
assert.equal(src.split("\n").slice(4).join("\n").trim(), WELCOME_TEXT.trim());
assert.ok(!/AE Pay|Thursday/i.test(WELCOME_TEXT));

// 3. First signup: contact created in segment, one email with the right headers.
const E = "o'brien@co.com";
const r = await firstSellerSignup(env, E);
assert.ok(r.contact.ok && r.welcome.ok, JSON.stringify(r));
assert.deepEqual(JSON.parse(calls.find((c) => c.u === "https://api.resend.com/contacts").o.body).segments, [{ id: "seg1" }]);
const call = sent()[0], m = JSON.parse(call.o.body), url = await unsubUrl(env, E);
assert.equal(m.from, "Founders Ramp <hello@foundersramp.net>"); assert.match(WELCOME_FROM, /@foundersramp\.net>$/);
assert.equal(m.reply_to, "jw@foundersramp.net"); assert.equal(WELCOME_REPLY_TO, m.reply_to);
assert.deepEqual(m.to, [E]);
assert.equal(m.headers["List-Unsubscribe"], `<${url}>`);
assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
assert.equal(m.text, WELCOME_TEXT.replace("{{unsubscribe_link}}", url));
assert.ok(m.text.includes("You got this because you signed up at foundersramp.net. Unsubscribe: " + url));
assert.ok(m.html.includes(`<a href="${url.replace(/&/g, "&amp;")}">`));
for (const h of ["/answers/first-sales-hire-payback/", "/tools/first-hire-payback/"]) assert.ok(m.html.includes(`href="https://www.foundersramp.net${h}"`));
assert.match(call.o.headers["idempotency-key"], /^fs-welcome-[0-9a-f]{40}$/);
assert.ok(!call.o.headers["idempotency-key"].includes("brien"));

// 4. Placeholder guard: the literal can never reach a send.
assert.ok(!JSON.stringify(m).includes("{{unsubscribe_link}}"));
assert.throws(() => assertNoPlaceholder({ text: "Unsubscribe: {{unsubscribe_link}}" }));
assert.throws(() => buildWelcome(""));
assert.throws(() => buildWelcome(undefined));

// 5. Same address again (still subscribed): no new contact, no second email.
calls = [];
assert.deepEqual(await firstSellerSignup(env, E), { skipped: "exists" });
assert.equal(sent().length, 0); assert.ok(!calls.some((c) => c.m === "POST"));

// 6. Unsubscribe: bad token 400; GET page; POST one-click; then signup never resends or resubscribes.
assert.equal((await handleUnsubscribe(new Request(url.replace(/t=./, "t=0")), env)).status, 400);
assert.equal(contacts[E].unsubscribed, false);
const g = await handleUnsubscribe(new Request(url), env);
assert.equal(g.status, 200); assert.ok((await g.text()).includes("You're unsubscribed."));
assert.equal(contacts[E].unsubscribed, true);
contacts[E].unsubscribed = false;
assert.equal((await handleUnsubscribe(new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }), env)).status, 200);
assert.equal(contacts[E].unsubscribed, true);
calls = [];
assert.deepEqual(await firstSellerSignup(env, E), { skipped: "unsubscribed" });
assert.equal(sent().length, 0); assert.equal(contacts[E].unsubscribed, true);

// 7. Daily cap: once slots run out, contact is added but no email goes.
slots = DAILY_SEND_CAP; calls = [];
const capped = await firstSellerSignup(env, "new@co.com");
assert.equal(capped.skipped, "cap"); assert.equal(sent().length, 0);

// 8. Resend refusal (429) is reported, never thrown.
slots = 0; globalThis.fetch = ((f) => async (u, o) => u.endsWith("/emails") ? new Response('{"name":"rate_limit_exceeded"}', { status: 429 }) : f(u, o))(globalThis.fetch);
const refused = await firstSellerSignup(env, "third@co.com");
assert.equal(refused.welcome.status, 429); assert.equal(refused.welcome.ok, false);
console.log("first-seller-welcome: PASS");
