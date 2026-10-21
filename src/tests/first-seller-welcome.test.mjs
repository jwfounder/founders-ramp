import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstSellerSignup, sendWelcome, drainRetries, retryDelayMs, buildWelcome, assertNoPlaceholder, handleUnsubscribe, unsubUrl, WELCOME_FROM, WELCOME_REPLY_TO, DAILY_SEND_CAP } from "../email/resend.js";
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
// Fake FrStore: send slots + retry queue (same contract as the Durable Object routes).
let clock = 0; const later = () => { clock += 13 * 3600000; }; // jump past any backoff/lease
let queue = new Map(); // email -> {tries, why}
const FR_STORE = { idFromName: () => 1, get: () => ({ fetch: async (u, o = {}) => {
  const p = new URL(u).pathname, b = o.body ? JSON.parse(o.body) : {}, J = (x) => new Response(JSON.stringify(x));
  if (p === "/welcome-slot") return J({ ok: ++slots <= DAILY_SEND_CAP });
  if (p === "/welcome-retry/add") { const q = queue.get(b.email) || { tries: 0 }; q.tries += b.why === "cap" ? 0 : 1; q.why = b.why;
    q.due = b.why === "cap" ? clock : clock + retryDelayMs(q.tries);
    if (q.tries > 5) { queue.delete(b.email); return J({ ok: false, reason: "gave up after 5 tries" }); } queue.set(b.email, q); return J({ ok: true, tries: q.tries }); }
  if (p === "/welcome-retry/take") { const e = [...queue].filter(([, q]) => (q.due || 0) <= clock).map(([k]) => k).slice(0, 5);
    for (const k of e) queue.get(k).due = clock + 1800000; return J({ ok: true, emails: e }); }
  if (p === "/welcome-retry/done") { queue.delete(b.email); return J({ ok: true }); }
  return new Response("{}", { status: 404 });
} }) };
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

// 7. Placeholder guard is generic: any "{{" anywhere throws, and nothing is sent.
for (const k of ["subject", "text", "html"]) assert.throws(() => assertNoPlaceholder({ subject: "s", text: "t", html: "h", [k]: "Hi {{x}}" }));
assert.throws(() => assertNoPlaceholder({ text: "Hi {{first_name}}" }));
assert.doesNotThrow(() => assertNoPlaceholder({ text: "plain { braces } ok" }));
{ // force a {{x}} into the template text at send time: sendWelcome must throw before any slot or /emails call
  const mod = await import("../email/first-seller-welcome.js");
  contacts["g@co.com"] = { unsubscribed: false }; calls = []; const s0 = slots;
  const origSplit = String.prototype.split;
  String.prototype.split = function (sep, ...r) { return origSplit.call(this === mod.WELCOME_TEXT ? this + "Hi {{x}}" : this, sep, ...r); };
  try { await assert.rejects(() => sendWelcome(env, "g@co.com"), /placeholder/); } finally { String.prototype.split = origSplit; }
  assert.equal(sent().length, 0); assert.equal(slots, s0);
  delete contacts["g@co.com"];
}

// 8. Daily cap: contact is added, no email, address queued (cap waits don't count as tries); drain sends it once slots free up.
slots = DAILY_SEND_CAP; calls = [];
const capped = await firstSellerSignup(env, "new@co.com");
assert.equal(capped.welcome.skipped, "cap"); assert.equal(sent().length, 0);
assert.equal(queue.get("new@co.com").tries, 0);
assert.equal((await drainRetries(env))[0].r.skipped, "cap"); assert.equal(sent().length, 0); assert.ok(queue.has("new@co.com"));
slots = 0; later();
const d = await drainRetries(env);
assert.ok(d[0].r.ok); assert.equal(sent().length, 1); assert.ok(!queue.has("new@co.com"));
assert.deepEqual(await drainRetries({ ...env, FIRST_SELLER_EMAIL: "off" }), []);

// 9. Unsubscribed while queued: drain drops it and sends nothing.
queue.set("new@co.com", { tries: 1, due: 0 }); contacts["new@co.com"].unsubscribed = true; calls = [];
assert.equal((await drainRetries(env))[0].r.skipped, "unsubscribed"); assert.equal(sent().length, 0); assert.ok(!queue.has("new@co.com"));

// 10. Resend 429 is reported, never thrown, and queued (tries + 1); gives up after 5 real failures.
slots = 0; const ok = globalThis.fetch;
globalThis.fetch = async (u, o) => u.endsWith("/emails") ? (calls.push({ u, o }), new Response('{"name":"rate_limit_exceeded"}', { status: 429 })) : ok(u, o);
const refused = await firstSellerSignup(env, "third@co.com");
assert.equal(refused.welcome.status, 429); assert.equal(refused.welcome.ok, false);
assert.equal(queue.get("third@co.com").tries, 1);
assert.equal(queue.get("third@co.com").due, clock + 3600000); // backoff 30 min * 2^1
assert.deepEqual(await drainRetries(env), []); // not due yet: no retry seconds later
for (let i = 0; i < 5; i++) { later(); await drainRetries(env); }
assert.ok(!queue.has("third@co.com"));

// 11. Permanent 422: dropped at once (logged), one slot used, never retried.
slots = 0; calls = [];
globalThis.fetch = async (u, o) => u.endsWith("/emails") ? (calls.push({ u, o }), new Response('{"name":"validation_error"}', { status: 422 })) : ok(u, o);
const bad = await firstSellerSignup(env, "fourth@co.com");
assert.equal(bad.welcome.status, 422); assert.equal(bad.welcome.permanent, true); assert.ok(!queue.has("fourth@co.com")); assert.equal(slots, 1);
queue.set("fourth@co.com", { tries: 0, due: 0 }); // a queued row that turns out permanent: dropped on the first drain
assert.equal((await drainRetries(env))[0].r.permanent, true); assert.ok(!queue.has("fourth@co.com"));
const s2 = slots; for (let i = 0; i < 5; i++) { later(); await drainRetries(env); } assert.equal(slots, s2);
globalThis.fetch = ok;

// 12. Contact lookup failure on retry counts as a try (5 then dropped), and takes no slot.
queue.set("fifth@co.com", { tries: 0, due: 0 }); contacts["fifth@co.com"] = { unsubscribed: false }; const s3 = slots;
globalThis.fetch = async (u, o = {}) => /\/contacts\/fifth/.test(u) ? new Response("{}", { status: 503 }) : ok(u, o);
await drainRetries(env); assert.equal(queue.get("fifth@co.com").tries, 1);
for (let i = 0; i < 5; i++) { later(); await drainRetries(env); }
assert.ok(!queue.has("fifth@co.com")); assert.equal(slots, s3);
globalThis.fetch = ok;

// 13. Backoff: 30 min * 2^tries, capped at 12 h.
assert.deepEqual([1, 2, 3, 4, 5, 9].map((n) => retryDelayMs(n) / 60000), [60, 120, 240, 480, 720, 720]);

// 14. Switch on + missing secret: logs the missing NAMES only, sends nothing, drain needs all three.
const logs = []; const cl = console.log; console.log = (...a) => logs.push(a.join(" "));
calls = [];
assert.deepEqual(await firstSellerSignup({ ...env, UNSUB_SECRET: "" }, "x@co.com"), { skipped: "off" });
assert.deepEqual(await drainRetries({ ...env, RESEND_AUDIENCE_ID: undefined }), []);
console.log = cl;
assert.equal(calls.length, 0);
assert.ok(logs.some((l) => l.includes("missing Worker secret(s): UNSUB_SECRET")));
assert.ok(logs.some((l) => l.includes("missing Worker secret(s): RESEND_AUDIENCE_ID")));
assert.ok(!logs.join("").includes("s3cret") && !logs.join("").includes(" k "));
console.log("first-seller-welcome: PASS");
