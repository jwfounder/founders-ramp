// Local tests, no network, no Cloudflare account: node --test tests/
// Covers /go/ redirects (allowlist, utm_*/ref pass-through, click count) and js/ev.js events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/worker.js"), "utf8");
// Node 20 reads a .js file without package.json "type" as CommonJS, so load a .mjs copy of the worker.
const tmp = mkdtempSync(join(tmpdir(), "fr-worker-"));
writeFileSync(join(tmp, "worker.mjs"), src);
const worker = (await import(pathToFileURL(join(tmp, "worker.mjs")).href)).default;

// Pull the GO_REDIRECTS and GO_ALLOWED_PREFIXES literals out of the source to check every entry.
const GO = vm.runInNewContext("(" + /const GO_REDIRECTS = (\{[\s\S]*?\n\});/.exec(src)[1] + ")");
const PREFIXES = vm.runInNewContext(/const GO_ALLOWED_PREFIXES = (\[[^\]]*\]);/.exec(src)[1]);

function makeEnv() {
  const added = [];
  const stub = {
    fetch: async (u, init) => {
      if (String(u) === "https://fr-store/add") { added.push(JSON.parse(init.body)); return Response.json({ ok: true }); }
      return new Response("nf", { status: 404 });
    },
  };
  return {
    added,
    FR_STORE: { idFromName: () => "id", get: () => stub },
    ASSETS: { fetch: async () => new Response("Not found page", { status: 404, headers: { "content-type": "text/plain" } }) },
  };
}
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
async function go(path, { ua = BROWSER, method = "GET", headers = {}, ctx } = {}) {
  const env = makeEnv();
  const waits = [];
  const c = ctx === null ? undefined : { waitUntil: (p) => waits.push(p) };
  const res = await worker.fetch(new Request("https://www.foundersramp.net" + path, { method, headers: { "user-agent": ua, ...headers } }), env, c);
  await Promise.all(waits);
  return { res, env, loc: res.headers.get("location") };
}

test("allowlist: every /go/ destination is https on an allowed prefix", () => {
  assert.deepEqual([...PREFIXES], ["https://www.foundersramp.net/", "https://cal.com/justin-weller-nsrjlg/"]);
  for (const [slug, t] of Object.entries(GO)) {
    assert.match(slug, /^[a-z0-9-]+$/, slug);
    assert.ok(PREFIXES.some((p) => t.startsWith(p)), slug + " -> " + t);
    assert.doesNotThrow(() => new URL(t));
  }
  assert.equal(GO.book, "https://cal.com/justin-weller-nsrjlg/30min");
  assert.equal(GO.calculator, "https://www.foundersramp.net/tools/first-hire-payback/");
});

test("existing slugs: Location byte-identical when no query is sent", async () => {
  for (const slug of ["2026-10-20-li-comment", "2026-10-20-x-reply", "2026-10-22-li-jobs", "2026-10-22-x-jobs", "book", "calculator"]) {
    const { res, loc } = await go("/go/" + slug);
    assert.equal(res.status, 302, slug);
    assert.equal(loc, GO[slug], slug);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.ok(res.headers.get("content-security-policy"), "security headers still applied");
  }
  const { loc } = await go("/go/book/");
  assert.equal(loc, GO.book, "trailing slash");
});

test("utm_* and ref are passed on; other params are dropped", async () => {
  const { loc } = await go("/go/book?utm_source=partner&utm_campaign=acme-cfo&ref=Acme-CFO&email=a%40b.com&next=https://evil.com&utm_foo=x");
  assert.equal(loc, "https://cal.com/justin-weller-nsrjlg/30min?utm_source=partner&utm_campaign=acme-cfo&ref=acme-cfo");
  const u = new URL(loc);
  assert.equal(u.origin, "https://cal.com");
  assert.equal(u.searchParams.get("email"), null);
  assert.equal(u.searchParams.get("next"), null);
});

test("destination's own utm values win; incoming ones fill only missing keys", async () => {
  const { loc } = await go("/go/2026-10-20-li-comment?utm_source=evil&utm_term=t1&ref=acme");
  assert.equal(loc, GO["2026-10-20-li-comment"] + "&utm_term=t1&ref=acme");
});

test("bad ref is dropped; long and control-char utm values are clipped and encoded", async () => {
  const { loc } = await go("/go/calculator?ref=bad%20ref!%3Cx%3E&utm_source=" + "a".repeat(150) + "&utm_medium=x%0D%0ALocation:%20https://evil.com");
  const u = new URL(loc);
  assert.equal(u.origin + u.pathname, "https://www.foundersramp.net/tools/first-hire-payback/");
  assert.equal(u.searchParams.get("ref"), null);
  assert.equal(u.searchParams.get("utm_source"), "a".repeat(100));
  assert.equal(u.searchParams.get("utm_medium"), "x  Location: https://evil.com");
  assert.ok(!/[\r\n]/.test(loc));
});

test("no open redirect: unknown slugs, encoded paths and absolute URLs are not redirected", async () => {
  for (const p of ["/go/nope", "/go/https://evil.com", "/go//evil.com", "/go/%2F%2Fevil.com", "/go/BOOK", "/go/book/extra", "/go/__proto__", "/go/constructor", "/go/hasOwnProperty"]) {
    const { res, env } = await go(p);
    assert.notEqual(res.status, 302, p);
    assert.equal(res.headers.get("location"), null, p);
    assert.equal(env.added.length, 0, p);
  }
});

test("a click is counted as one go_click event, host-only referrer, no personal data", async () => {
  const { env } = await go("/go/book?utm_source=partner&ref=acme-cfo", { headers: { referer: "https://www.linkedin.com/feed/update/xyz?trk=1" } });
  assert.equal(env.added.length, 1);
  assert.deepEqual(env.added[0], {
    kind: "event",
    data: { name: "go_click", path: "/go/book", label: "book", referrer_host: "www.linkedin.com", utm: { utm_source: "partner" }, ref: "acme-cfo", country: "" },
  });
  const { env: e2 } = await go("/go/2026-10-22-x-jobs");
  assert.deepEqual(e2.added[0].data.utm, { utm_source: "x", utm_medium: "social", utm_campaign: "2026-10-22-jobs", utm_content: "reply" });
  assert.equal(e2.added[0].data.referrer_host, "");
  const { env: e3 } = await go("/go/calculator", { headers: { referer: "https://www.foundersramp.net/answers/x/" } });
  assert.equal(e3.added[0].data.referrer_host, "", "own site counts as no referrer");
});

test("works without ctx.waitUntil (count awaited inline)", async () => {
  const { res, env } = await go("/go/book", { ctx: null });
  assert.equal(res.status, 302);
  assert.equal(env.added.length, 1);
});

test("not counted: HEAD, prefetch, empty UA, bots, unfurlers, scripts (still redirected)", async () => {
  const cases = [
    { method: "HEAD" },
    { headers: { "sec-purpose": "prefetch;prerender" } },
    { headers: { purpose: "prefetch" } },
    { ua: "" },
    { ua: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
    { ua: "facebookexternalhit/1.1" },
    { ua: "LinkedInBot/1.0" },
    { ua: "Twitterbot/1.0" },
    { ua: "WhatsApp/2.23" },
    { ua: "curl/8.5.0" },
    { ua: "python-requests/2.31" },
    { ua: "Mozilla/5.0 HeadlessChrome/120" },
  ];
  for (const c of cases) {
    const { res, env } = await go("/go/book", c);
    assert.equal(res.status, 302, JSON.stringify(c));
    assert.equal(env.added.length, 0, JSON.stringify(c));
  }
});

test("store failure never breaks the redirect", async () => {
  const env = makeEnv();
  env.FR_STORE.get = () => ({ fetch: async () => { throw new Error("down"); } });
  const waits = [];
  const res = await worker.fetch(new Request("https://www.foundersramp.net/go/book", { headers: { "user-agent": BROWSER } }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(res.status, 302);
});

test("/api/event still refuses go_click from the browser (server-side only)", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://www.foundersramp.net/api/event", {
    method: "POST", headers: { origin: "https://www.foundersramp.net", "user-agent": BROWSER }, body: JSON.stringify({ n: "go_click", p: "/go/book" }),
  }), env, {});
  assert.equal(res.status, 204);
  assert.equal(env.added.length, 0);
  for (const n of ["calc_run", "tracker_view", "book_click", "answers_view", "landing"]) {
    const e = makeEnv();
    await worker.fetch(new Request("https://www.foundersramp.net/api/event", {
      method: "POST", headers: { origin: "https://www.foundersramp.net", "user-agent": BROWSER }, body: JSON.stringify({ n, p: "/x/", r: "", q: "" }),
    }), e, {});
    assert.equal(e.added.length, 1, n);
    assert.equal(e.added[0].data.name, n);
  }
});

// ---- js/ev.js in a tiny fake page ----
function runEv(pathname, { search = "", referrer = "", calc = false } = {}) {
  const sent = [];
  const listeners = {};
  const calcListeners = {};
  const doc = {
    referrer,
    getElementById: (id) => (calc && id === "calc" ? { addEventListener: (t, f) => (calcListeners[t] = f) } : null),
    addEventListener: (t, f) => ((listeners[t] = listeners[t] || []).push(f)),
  };
  class FakeBlob { constructor(parts) { this.text = parts.join(""); } }
  const ctx = {
    navigator: { sendBeacon: (u, b) => { sent.push({ u, body: JSON.parse(b.text) }); return true; } },
    location: { pathname, search },
    document: doc, Blob: FakeBlob, URL,
  };
  vm.runInNewContext(readFileSync(join(root, "js/ev.js"), "utf8"), ctx);
  const link = (href, text) => ({ target: { closest: (sel) => (sel === 'a[href*="cal.com/"]' && href.includes("cal.com/") ? { textContent: text } : null) } });
  const fire = (type, ev) => (listeners[type] || []).forEach((f) => f({ type, ...ev }));
  return { sent, fire, link, calcListeners };
}

test("ev.js: answers, tracker views; not the /answers/ index", () => {
  assert.deepEqual([...runEv("/answers/sdr-or-ae-first/").sent.map((s) => s.body.n)], ["answers_view"]);
  assert.deepEqual([...runEv("/tracker/").sent.map((s) => s.body.n)], ["tracker_view"]);
  assert.deepEqual([...runEv("/answers/").sent.map((s) => s.body.n)], []);
});

test("ev.js: calculator run counted once per page view", () => {
  const p = runEv("/tools/first-hire-payback/", { calc: true });
  p.calcListeners.input(); p.calcListeners.change(); p.calcListeners.input();
  assert.deepEqual(p.sent.map((s) => s.body.n), ["calc_run"]);
});

test("ev.js: booking link clicks (left click and middle click), not right click or other links", () => {
  const p = runEv("/home/");
  const cal = p.link("https://cal.com/justin-weller-nsrjlg/30min", "  Get a 20 minute\n look ");
  p.fire("click", { ...cal, button: 0 });
  p.fire("auxclick", { ...cal, button: 1 });
  p.fire("auxclick", { ...cal, button: 2 });
  p.fire("click", { ...p.link("/approach/", "Approach"), button: 0 });
  assert.deepEqual(p.sent.map((s) => [s.body.n, s.body.l]), [["book_click", "Get a 20 minute look"], ["book_click", "Get a 20 minute look"]]);
});
