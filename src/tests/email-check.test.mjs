// Local test for the /api/lead email check. Run: node src/tests/email-check.test.mjs
// Not deployed: src/ is in .assetsignore and wrangler bundles only src/worker.js and its imports.
// Posts each address through the Worker's real fetch handler with a fake FR_STORE (no network, no secrets)
// and checks the redirect: ?sent=1 (stored) or ?sent=0 (the form's existing "check your email address" note).
import worker from "../worker.js";

const stored = [];
const env = {
  FR_STORE: {
    idFromName: () => "fake",
    get: () => ({
      fetch: async (_u, init) => { stored.push(JSON.parse(init.body).data.email); return new Response(JSON.stringify({ ok: true, seq: stored.length })); },
    }),
  },
};

async function submit(email) {
  const body = new URLSearchParams({ email, motion: "test", website: "" });
  const req = new Request("https://www.foundersramp.net/api/lead", {
    method: "POST",
    headers: { origin: "https://www.foundersramp.net", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const r = await worker.fetch(req, env);
  return { status: r.status, location: r.headers.get("location") };
}

const good = [
  "pat@acme.io",
  "first.last+tag@sub.my-co.io",
  "First.Last@Example.COM",
  "a@b.co",
  "x_y-z@mail.a1-b2.example.org",
  "o.brien-free.local+1@x.io",
  "o'brien@x.io",
  "o'brien@company.com",
  "d'angelo.smith@firm.com",
  "o'neil+test@gmail.com",
  "pat@firm.xn--p1ai",
  "  pat@acme.io  ", // trimmed by clip() before the check (as today)
  "a".repeat(64) + "@" + "b".repeat(60) + ".com",
];
const bad = [
  "a@<!channel>.com",
  "a@<@U1>.com",
  "a b@x.com",
  "a@x",
  "a@x.c",
  "a@x.123",
  "@x.com",
  "a@@x.com",
  "a@b@x.com",
  "a@.com",
  "a@x..com",
  "a@x_y.com",
  "a@<http://evil.example|bank>.com",
  "<a>@x.com",
  "a\"b@x.com",
  "a`b@x.com",
  "a(b)@x.com",
  "a,b@x.com",
  "a;b@x.com",
  "a:b@x.com",
  "a\\b@x.com",
  "a[b]@x.com",
  "a|b@x.com",
  "a\tb@x.com",
  "a\nb@x.com",
  "a\u0001b@x.com",
  "a\u007fb@x.com",
  "a\u00a0b@x.com",
  "a\u200bb@x.com", // zero-width space
  "",
  "a".repeat(200) + "@x.com", // over the 200-char clip: the cut leaves no @ / domain
];

let fail = 0;
for (const [list, want] of [[good, "1"], [bad, "0"]]) {
  for (const e of list) {
    const before = stored.length;
    const { status, location } = await submit(e);
    const sent = /[?&]sent=([01])/.exec(location || "")?.[1];
    const ok = status === 303 && sent === want && (want === "1" ? stored.length === before + 1 : stored.length === before);
    if (!ok) fail++;
    const shown = JSON.stringify(e.length > 70 ? e.slice(0, 30) + "…(" + e.length + " chars)" : e).replace(/[\u007f-\u00a0\u200b-\u200d\u2060\ufeff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
    console.log(`${ok ? "PASS" : "FAIL"}  want sent=${want} got ${status} sent=${sent}  ${shown}`);
  }
}
console.log(`\n${good.length} good, ${bad.length} bad, ${fail} failures`);
process.exit(fail ? 1 : 0);
