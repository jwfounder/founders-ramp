const ORIGIN = "https://foundersramp.pages.dev";

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
    const path = new URL(request.url).pathname;
    if (path === "/api/hit" || path.startsWith("/api/hit/")) {
      return proxy(request, "/api/hit");
    }
    if (path === "/api/gate" || path.startsWith("/api/gate/")) {
      return proxy(request, "/api/gate");
    }
    return env.ASSETS.fetch(request);
  },
};
