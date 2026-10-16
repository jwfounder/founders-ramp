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
  "2026-10-20-li-comment": "https://www.foundersramp.net/writings/five-green-fields?utm_source=linkedin&utm_medium=social&utm_campaign=2026-10-20-five-green-fields&utm_content=li-comment",
  "2026-10-20-x-reply": "https://www.foundersramp.net/writings/five-green-fields?utm_source=x&utm_medium=social&utm_campaign=2026-10-20-five-green-fields&utm_content=x-reply",
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
    element.append('<link rel="preconnect" href="https://ddwl4m2hdecbv.cloudfront.net">' + REB2B, { html: true });
  }
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
