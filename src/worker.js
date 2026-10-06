const REB2B =
  '<script>!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://ddwl4m2hdecbv.cloudfront.net/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("Z6PVLHZZK96R");</script>';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (url.hostname === "foundersramp.net") {
      url.hostname = "www.foundersramp.net";
      return Response.redirect(url.toString(), 301);
    }
    if (path === "/index.html") {
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
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }
    return new HTMLRewriter()
      .on('script[src*="js/gate.js"]', new DropScript())
      .on('script[src*="js/hit.js"]', new DropScript())
      .on("head", new HeadInjector())
      .transform(response);
  },
};
