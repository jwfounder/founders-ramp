const ORIGIN = "https://foundersramp.pages.dev";

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

function proxy(request, apiPath) {
  const url = new URL(request.url);
  const dest = new URL(apiPath + url.search, ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }
  return fetch(dest, init);
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
    if (path === "/api/hit" || path.startsWith("/api/hit/")) {
      return proxy(request, "/api/hit");
    }
    if (path === "/api/gate" || path.startsWith("/api/gate/")) {
      return proxy(request, "/api/gate");
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
      .on("head", new HeadInjector())
      .transform(response);
  },
};
