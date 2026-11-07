// Local tests, no network, no Cloudflare account: node --test src/tests/worker.test.mjs
// Covers /go/ redirects (allowlist, utm_*/ref pass-through, click count) and js/ev.js events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = readFileSync(join(root, "src/worker.js"), "utf8");
// Node reads a .js file without package.json "type" as CommonJS, so copy src/ (the worker imports ./email/*.js)
// into a temp folder marked "type": "module" and load it from there.
const tmp = mkdtempSync(join(tmpdir(), "fr-worker-"));
cpSync(join(root, "src"), tmp, { recursive: true });
writeFileSync(join(tmp, "package.json"), '{"type":"module"}');
const worker = (await import(pathToFileURL(join(tmp, "worker.js")).href)).default;

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
  for (const n of ["calc_run", "tracker_view", "book_click", "answers_view", "landing", "check_start", "check_result"]) {
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

// ---- /check/first-sales-hire/ inline script: the names it sends are the names the Worker keeps ----
test("check page: check_start on first change, check_result on submit; both stored by /api/event with a blank label", async () => {
  const html = readFileSync(join(root, "check/first-sales-hire/index.html"), "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes("chk-form"));
  assert.ok(script, "check page inline script found");
  const sent = [];
  const fl = {};
  const answers = { q1: "y", q2: "y", q3: "a" };
  const form = {
    addEventListener: (t, f) => ((fl[t] = fl[t] || []).push(f)),
    querySelector: (sel) => { const n = /name="(q\d)"/.exec(sel)[1]; return answers[n] ? { value: answers[n] } : null; },
  };
  const out = { hidden: true, focus() {}, querySelectorAll: () => [] };
  const doc = { getElementById: (id) => (id === "chk-form" ? form : id === "chk-out" ? out : { hidden: true }) };
  class FakeBlob { constructor(parts) { this.text = parts.join(""); } }
  vm.runInNewContext(script, {
    document: doc, Blob: FakeBlob, JSON,
    navigator: { sendBeacon: (u, b) => { sent.push({ u, body: JSON.parse(b.text) }); return true; } },
    location: { pathname: "/check/first-sales-hire/", search: "" },
  });
  fl.change.forEach((f) => f({}));
  fl.change.forEach((f) => f({}));
  fl.submit.forEach((f) => f({ preventDefault() {} }));
  assert.deepEqual(sent.map((s) => s.body.n), ["check_start", "check_result"]);
  assert.equal(sent[1].body.l, "hire-ae");
  for (const s of sent) {
    assert.equal(s.u, "/api/event");
    const e = makeEnv();
    const res = await worker.fetch(new Request("https://www.foundersramp.net/api/event", {
      method: "POST", headers: { origin: "https://www.foundersramp.net", "user-agent": BROWSER }, body: JSON.stringify(s.body),
    }), e, {});
    assert.equal(res.status, 204);
    assert.equal(e.added.length, 1, s.body.n);
    assert.equal(e.added[0].data.name, s.body.n);
    assert.equal(e.added[0].data.path, "/check/first-sales-hire/");
    assert.equal(e.added[0].data.label, "", "no result band stored for " + s.body.n);
  }
});

const pilot = await import(pathToFileURL(join(tmp, "pilot-analytics.js")).href);
test("one-time pilot classifier expires; normal browsers are retained", async () => {
  const req = new Request("https://www.foundersramp.net/", {headers:{"user-agent":BROWSER}});
  assert.equal(await pilot.pilotQAReason(req,"",pilot.PILOT_START+1),"");
  const qa = new Request(req,{headers:{"user-agent":BROWSER,"x-fr-qa":"1"}});
  assert.equal(await pilot.pilotQAReason(qa,"",pilot.PILOT_START+1),"explicit-qa");
  assert.equal(await pilot.pilotQAReason(qa,"",pilot.PILOT_END),"");
  assert.equal(await pilot.pilotQAReason(qa,"",pilot.PILOT_START-1),"");
});
test("scripts, gate browsers and QA-tagged events never enter pilot counts", async (t) => {
  t.mock.method(Date, "now", () => pilot.PILOT_START + 1000);
  for (const ua of ["python-requests/2.32","curl/8.0",BROWSER+" sawyer-preship","HeadlessChrome/124","Playwright/1.0"]) {
    const {env,res}=await go('/go/fr7-naval-li',{ua});
    assert.equal(res.status,302);assert.equal(env.added.length,0,ua);
    assert.equal(res.headers.get('x-fr-analytics'),'excluded-qa');
  }
  for (const source of ['qa','test','qa-sawyer','internal']) {
    const env=makeEnv();
    const res=await worker.fetch(new Request('https://www.foundersramp.net/api/event',{method:'POST',headers:{origin:'https://www.foundersramp.net','user-agent':BROWSER},body:JSON.stringify({n:'landing',p:'/answers/founding-ae-salary/',q:'?utm_source='+source})}),env);
    assert.equal(res.status,204);assert.equal(env.added.length,0,source);
  }
  const {env,res}=await go('/go/fr7-naval-li',{headers:{'x-fr-qa':'1'}});
  assert.equal(env.added.length,0);assert.equal(res.headers.get('cache-control'),'private, no-store');
  assert.ok(!res.headers.get('content-security-policy').includes('https://static.cloudflareinsights.com'));
});
test("hashed box-IP comparison works without recording the raw address", async () => {
  const ip='192.0.2.44';const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  const h=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  assert.equal(await pilot.matchesIPHash(ip,[h]),true);assert.equal(await pilot.matchesIPHash('192.0.2.45',[h]),false);
});
test("all site-owned pilot routes carry the same campaign with distinct content", async () => {
  const seen=new Set();
  for (const [slug,t] of Object.entries(GO).filter(([k])=>k.startsWith('fr7-'))) {
    const u=new URL(t);assert.equal(u.searchParams.get('utm_source'),'linkedin');assert.equal(u.searchParams.get('utm_medium'),'social');assert.equal(u.searchParams.get('utm_campaign'),'fr-views-7day-20261107');
    const c=u.searchParams.get('utm_content');assert.ok(c&&!seen.has(c));seen.add(c);
    const {env}=await go('/go/'+slug);assert.equal(env.added.length,1);assert.equal(env.added[0].data.utm.utm_campaign,'fr-views-7day-20261107');
  }
  assert.equal(seen.size,5);
});
test("HTML QA responses omit first-party/reb2b injection while human HTML keeps it", async (t) => {
  t.mock.method(Date, "now", () => pilot.PILOT_START + 1000);
  const original=globalThis.HTMLRewriter;let appended=[];
  globalThis.HTMLRewriter=class { on(sel,h){if(sel==='head')h.element({append:x=>appended.push(x)});return this;} transform(r){return r;} };
  try {
    for (const qa of [false,true]) {
      appended=[];const env=makeEnv();env.ASSETS.fetch=async()=>new Response('<html><head></head><body>Content</body></html>',{headers:{'content-type':'text/html'}});
      const res=await worker.fetch(new Request('https://www.foundersramp.net/',{headers:{'user-agent':BROWSER,...(qa?{'x-fr-qa':'1'}:{})}}),env);
      assert.equal(res.status,200);assert.equal(appended.length,qa?0:1);
      if(!qa)assert.ok(appended[0].includes('/js/ev.js?v=fr7-20261107'));
    }
  } finally {globalThis.HTMLRewriter=original;}
});
test("pilot tags follow owned internal links only, and never overwrite another campaign", () => {
  const mk=href=>({href,getAttribute(){return this.href;},setAttribute(k,v){this.href=v;}});
  const links=[mk('/answers/first-sales-hire-payback/'),mk('https://outside.example/a'),mk('/tracker/?utm_campaign=other')];
  const ctx={Date:class extends Date{static now(){return pilot.PILOT_START+1000;}},navigator:{sendBeacon:()=>true},Blob:class{},URL,location:{pathname:'/answers/founding-ae-salary/',search:'?utm_source=linkedin&utm_medium=social&utm_campaign=fr-views-7day-20261107&utm_content=company-video-thiel'},document:{referrer:'',querySelectorAll:()=>links,getElementById:()=>null,addEventListener(){}}};
  vm.runInNewContext(readFileSync(join(root,'js/ev.js'),'utf8'),ctx);
  assert.equal(new URL(links[0].href).searchParams.get('utm_content'),'company-video-thiel');
  assert.equal(links[1].href,'https://outside.example/a');assert.equal(links[2].href,'/tracker/?utm_campaign=other');
});
