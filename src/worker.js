const REB2B =
  '<script>!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://ddwl4m2hdecbv.cloudfront.net/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("Z6PVLHZZK96R");</script>';

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com https://b-code.liadm.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://9xgnrndqve.execute-api.us-west-2.amazonaws.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://*.rb2b.com https://a.usbrowserspeed.com https://pro.ip-api.com https://alocdn.com https://*.liadm.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com; frame-src 'self' https://challenges.cloudflare.com https://*.liadm.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Assets are served behind the Worker (run_worker_first), so _headers would not apply.
// Every response, including redirects and 404s, gets the security headers here.
function withSecurityHeaders(response) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

// Tracked click links: /go/<slug> 302s to a UTM-tagged URL. Add one line per slug.
const GO_REDIRECTS = {
  "2026-10-20-li-comment": "https://www.foundersramp.net/writings/five-green-fields?utm_source=linkedin&utm_medium=social&utm_campaign=2026-10-20-five-green-fields&utm_content=comment",
  "2026-10-20-x-reply": "https://www.foundersramp.net/writings/five-green-fields?utm_source=x&utm_medium=social&utm_campaign=2026-10-20-five-green-fields&utm_content=reply",
};

// Old top-level article URLs (e.g. /spacex-erp) moved under /writings/.
const WRITINGS = new Set(["agentic-procurement", "equal-commitment", "first-hire-freezes", "five-green-fields", "glengarry-glen-ross", "language-in-business", "no-transition", "one-person-loved-the-demo", "product-distribution", "shiny-object", "spacex-erp", "we-already-use-something", "what-are-you-measuring"]);

// Long cache for fingerprinted or rarely changing static files; CSS and JS revalidate hourly.
function cacheControlFor(path) {
  if (path.startsWith("/fonts/")) return "public, max-age=31536000, immutable";
  if (path.startsWith("/assets/")) return "public, max-age=2592000";
  if (path.startsWith("/css/") || path.startsWith("/js/") || /\.(css|js)$/.test(path)) return "public, max-age=3600";
  return null;
}

class DropScript {
  element(element) {
    element.remove();
  }
}

class HeadInjector {
  element(element) {
    element.append('<link rel="preconnect" href="https://ddwl4m2hdecbv.cloudfront.net">' + REB2B + '<script src="/js/ev.js?v=1" defer></script>', { html: true });
  }
}

// First-party store for home-form leads and site events (calculator runs, tracker views,
// booking clicks, /answers/ views). One SQLite-backed Durable Object, FR account only.
// The box reads it through GET /api/feed with a token whose SHA-256 is below (the token itself
// lives only on the box). No cookies, no IPs stored.
const FEED_TOKEN_SHA256 = "b5b17c27e71dc45793426c7e9b772f772a92c0bd9053731993722adb3dfa6749";
const EVENT_NAMES = new Set(["calc_run", "tracker_view", "book_click", "answers_view"]);
const CAPS_PER_HOUR = { lead: 60, event: 3000 };
const SITE_ORIGIN = "https://www.foundersramp.net";
const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

export class FrStore {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS rows (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS rows_kind_at ON rows (kind, at)");
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/add") {
      const { kind, data } = await request.json();
      const now = Date.now();
      const n = this.sql.exec("SELECT COUNT(*) AS n FROM rows WHERE kind = ? AND at > ?", kind, now - 3600000).one().n;
      if (n >= (CAPS_PER_HOUR[kind] || 0)) return Response.json({ ok: false, capped: true });
      this.sql.exec("INSERT INTO rows (kind, at, data) VALUES (?, ?, ?)", kind, now, JSON.stringify(data));
      if (Math.random() < 0.01) this.sql.exec("DELETE FROM rows WHERE kind = 'event' AND at < ?", now - 180 * 86400000);
      return Response.json({ ok: true });
    }
    if (request.method === "GET" && url.pathname === "/feed") {
      const after = Math.max(0, parseInt(url.searchParams.get("after") || "0", 10) || 0);
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "500", 10) || 500));
      const rows = this.sql.exec("SELECT seq, kind, at, data FROM rows WHERE seq > ? ORDER BY seq LIMIT ?", after, limit).toArray()
        .map((r) => ({ seq: r.seq, kind: r.kind, at: new Date(r.at).toISOString(), data: JSON.parse(r.data) }));
      return Response.json({ ok: true, rows });
    }
    return new Response("Not found", { status: 404 });
  }
}

function store(env) {
  return env.FR_STORE.get(env.FR_STORE.idFromName("fr"));
}

function clip(v, n) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
}

function sameSite(request) {
  const o = request.headers.get("origin") || request.headers.get("referer") || "";
  try { return new URL(o).origin === SITE_ORIGIN; } catch { return false; }
}

function utmFrom(qs) {
  const out = {};
  try {
    const sp = new URLSearchParams(qs || "");
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      if (sp.get(k)) out[k] = clip(sp.get(k), 100);
    }
  } catch {}
  return out;
}

async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleLead(request, env) {
  const back = (ok) => new Response(null, { status: 303, headers: { location: SITE_ORIGIN + "/?sent=" + (ok ? "1" : "0") + "#form-h", ...NO_STORE } });
  if (!sameSite(request)) return back(false);
  let f;
  try { f = await request.formData(); } catch { return back(false); }
  if (clip(f.get("website"), 200)) return back(true); // honeypot: bots fill it, people never see it
  const email = clip(f.get("email"), 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return back(false);
  let ref = "";
  try { ref = new URL(request.headers.get("referer") || "").search; } catch {}
  const data = {
    email,
    motion: clip(f.get("motion"), 2000),
    source: clip(f.get("source"), 40) || "site_form",
    page: clip(f.get("page"), 40),
    utm: utmFrom(ref),
    country: clip(request.cf && request.cf.country, 4),
  };
  try {
    await store(env).fetch("https://fr-store/add", { method: "POST", body: JSON.stringify({ kind: "lead", data }) });
  } catch {
    return back(false);
  }
  return back(true);
}

async function handleEvent(request, env) {
  const done = new Response(null, { status: 204, headers: NO_STORE });
  if (!sameSite(request)) return done;
  let b;
  try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch { return done; }
  if (!b || !EVENT_NAMES.has(b.n)) return done;
  const ua = request.headers.get("user-agent") || "";
  if (/bot|crawl|spider|headless|preview/i.test(ua)) return done;
  const data = {
    name: b.n,
    path: clip(b.p, 200),
    label: clip(b.l, 120),
    referrer_host: clip(b.r, 120),
    utm: utmFrom(b.q),
    country: clip(request.cf && request.cf.country, 4),
  };
  try {
    await store(env).fetch("https://fr-store/add", { method: "POST", body: JSON.stringify({ kind: "event", data }) });
  } catch {}
  return done;
}

async function handleFeed(request, env, url) {
  const tok = request.headers.get("x-fr-feed-token") || "";
  if (!tok || (await sha256Hex(tok)) !== FEED_TOKEN_SHA256) {
    return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }
  const r = await store(env).fetch("https://fr-store/feed" + url.search);
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", ...NO_STORE } });
}

// Retired first-party trackers. They used to write every view and gate submit
// into DNS as TXT records. Answer 204 and write nothing so cached pages don't error.
function retired() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (url.hostname === "foundersramp.net") {
      url.hostname = "www.foundersramp.net";
      return Response.redirect(url.toString(), 301);
    }
    const go = path.match(/^\/go\/([a-z0-9-]+)\/?$/);
    if (go && Object.hasOwn(GO_REDIRECTS, go[1])) {
      return new Response(null, { status: 302, headers: { location: GO_REDIRECTS[go[1]], "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
    }
    const legacy = path.match(/^\/([a-z0-9-]+)(?:\.html|\/)?$/);
    if (legacy && WRITINGS.has(legacy[1])) {
      url.pathname = "/writings/" + legacy[1];
      return Response.redirect(url.toString(), 301);
    }
    if (path === "/newsroom" || path === "/newsroom/") {
      url.pathname = "/briefing/";
      return Response.redirect(url.toString(), 301);
    }
    if (path === "/index.html" || path === "/home" || path === "/home/" || path === "/home/index.html") {
      url.pathname = "/";
      return Response.redirect(url.toString(), 301);
    }
    // Never serve one-off ship helper payloads (base64 chunks left from GHA ships).
    if (path === "/.ship-payload" || path.startsWith("/.ship-payload/")) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    if (path === "/api/lead") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", ...NO_STORE } });
      return handleLead(request, env);
    }
    if (path === "/api/event") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", ...NO_STORE } });
      return handleEvent(request, env);
    }
    if (path === "/api/feed" && request.method === "GET") return handleFeed(request, env, url);
    if (
      path === "/api/hit" ||
      path.startsWith("/api/hit/") ||
      path === "/api/gate" ||
      path.startsWith("/api/gate/")
    ) {
      return retired();
    }
    let response;
    if (path === "/") {
      const homeUrl = new URL("/home/", request.url);
      response = await env.ASSETS.fetch(new Request(homeUrl.toString(), request));
    } else {
      response = await env.ASSETS.fetch(request);
    }
    // Asset routing sends /page.html and /dir to their clean URLs with a 307.
    // Make those redirects permanent so search engines consolidate on the clean URL.
    if (response.status === 307) {
      const loc = response.headers.get("location");
      if (loc) return Response.redirect(new URL(loc, url).toString(), 301);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      const cc = response.status === 200 ? cacheControlFor(path) : null;
      if (cc) {
        response = new Response(response.body, response);
        response.headers.set("Cache-Control", cc);
        if (path.startsWith("/assets/social/")) response.headers.set("X-Robots-Tag", "noindex");
      }
      return response;
    }
    return new HTMLRewriter()
      .on('script[src*="js/gate.js"]', new DropScript())
      .on('script[src*="js/hit.js"]', new DropScript())
      .on("head", new HeadInjector())
      .transform(response);
}

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await handle(request, env));
  },
};
