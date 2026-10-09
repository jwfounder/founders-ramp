const REB2B =
  '<script>!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://ddwl4m2hdecbv.cloudfront.net/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("Z6PVLHZZK96R");</script>';

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com https://b-code.liadm.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com https://*.rb2b.com https://a.usbrowserspeed.com https://pro.ip-api.com https://alocdn.com https://*.liadm.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com; frame-src 'self' https://challenges.cloudflare.com https://*.liadm.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests";

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

class DropScript {
  element(element) {
    element.remove();
  }
}

class HeadInjector {
  element(element) {
    element.append(REB2B, { html: true });
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
