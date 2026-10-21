import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstSellerSignup, welcomeHtml, WELCOME_REPLY_TO } from "../email/resend.js";
import { WELCOME_SUBJECT, WELCOME_TEXT } from "../email/first-seller-welcome.js";
const calls = [];
globalThis.fetch = async (u, o) => { calls.push({ u, o }); return new Response("{}", { status: 200 }); };
// off by default: no calls
assert.deepEqual(await firstSellerSignup({ FIRST_SELLER_EMAIL: "off", RESEND_API_KEY: "k", RESEND_AUDIENCE_ID: "a" }, "x@y.com"), { skipped: true });
assert.equal(calls.length, 0);
const r = await firstSellerSignup({ FIRST_SELLER_EMAIL: "on", RESEND_API_KEY: "k", RESEND_AUDIENCE_ID: "aud1" }, "o'brien@co.com");
assert.equal(calls.length, 2); assert.ok(r.contact.ok && r.welcome.ok);
assert.equal(calls[0].u, "https://api.resend.com/contacts");
assert.deepEqual(JSON.parse(calls[0].o.body).segments, [{ id: "aud1" }]);
const m = JSON.parse(calls[1].o.body);
assert.equal(m.reply_to, "jw@foundersramp.net"); assert.equal(WELCOME_REPLY_TO, "jw@foundersramp.net");
assert.deepEqual(m.to, ["o'brien@co.com"]);
// copy is word for word the passed email.txt
const src = readFileSync("/home/box/shared/post-qa/passed/2026-10-21-sydney-first-seller-welcome-email/email.txt", "utf8");
assert.ok(src.startsWith("Subject: " + WELCOME_SUBJECT + "\n"));
assert.ok(src.replace(/\s+$/, "").endsWith(WELCOME_TEXT.replace(/\s+$/, "")));
assert.equal(m.text, WELCOME_TEXT);
assert.ok(welcomeHtml().includes('href="https://www.foundersramp.net/answers/first-sales-hire-payback/"'));
assert.ok(welcomeHtml().includes('href="https://www.foundersramp.net/tools/first-hire-payback/"'));
assert.ok(!/AE Pay|Thursday/i.test(WELCOME_TEXT));
console.log("first-seller-welcome: PASS");
