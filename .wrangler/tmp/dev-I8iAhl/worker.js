var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Y4u49V/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/worker.js
var REB2B = '<script>!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://ddwl4m2hdecbv.cloudfront.net/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("Z6PVLHZZK96R");<\/script>';
var CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com https://b-code.liadm.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://9xgnrndqve.execute-api.us-west-2.amazonaws.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://*.rb2b.com https://a.usbrowserspeed.com https://pro.ip-api.com https://alocdn.com https://*.liadm.com https://ddwl4m2hdecbv.cloudfront.net https://b2bjsstore.s3.us-west-2.amazonaws.com https://s3-us-west-2.amazonaws.com; frame-src 'self' https://challenges.cloudflare.com https://*.liadm.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests";
var SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
function withSecurityHeaders(response) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    out.headers.set(k, v);
  return out;
}
__name(withSecurityHeaders, "withSecurityHeaders");
var WRITINGS = /* @__PURE__ */ new Set(["agentic-procurement", "equal-commitment", "first-hire-freezes", "five-green-fields", "glengarry-glen-ross", "language-in-business", "no-transition", "one-person-loved-the-demo", "product-distribution", "shiny-object", "spacex-erp", "we-already-use-something", "what-are-you-measuring"]);
function cacheControlFor(path) {
  if (path.startsWith("/fonts/"))
    return "public, max-age=31536000, immutable";
  if (path.startsWith("/assets/"))
    return "public, max-age=2592000";
  if (path.startsWith("/css/") || path.startsWith("/js/") || /\.(css|js)$/.test(path))
    return "public, max-age=3600";
  return null;
}
__name(cacheControlFor, "cacheControlFor");
var DropScript = class {
  element(element) {
    element.remove();
  }
};
__name(DropScript, "DropScript");
var HeadInjector = class {
  element(element) {
    element.append('<link rel="preconnect" href="https://ddwl4m2hdecbv.cloudfront.net">' + REB2B, { html: true });
  }
};
__name(HeadInjector, "HeadInjector");
function retired() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
__name(retired, "retired");
async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (url.hostname === "foundersramp.net") {
    url.hostname = "www.foundersramp.net";
    return Response.redirect(url.toString(), 301);
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
  if (path === "/.ship-payload" || path.startsWith("/.ship-payload/")) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  if (path === "/api/hit" || path.startsWith("/api/hit/") || path === "/api/gate" || path.startsWith("/api/gate/")) {
    return retired();
  }
  let response;
  if (path === "/") {
    const homeUrl = new URL("/home/", request.url);
    response = await env.ASSETS.fetch(new Request(homeUrl.toString(), request));
  } else {
    response = await env.ASSETS.fetch(request);
  }
  if (response.status === 307) {
    const loc = response.headers.get("location");
    if (loc)
      return Response.redirect(new URL(loc, url).toString(), 301);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    const cc = response.status === 200 ? cacheControlFor(path) : null;
    if (cc) {
      response = new Response(response.body, response);
      response.headers.set("Cache-Control", cc);
    }
    return response;
  }
  return new HTMLRewriter().on('script[src*="js/gate.js"]', new DropScript()).on('script[src*="js/hit.js"]', new DropScript()).on("head", new HeadInjector()).transform(response);
}
__name(handle, "handle");
var worker_default = {
  async fetch(request, env) {
    return withSecurityHeaders(await handle(request, env));
  }
};

// ../../home/box/.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../home/box/.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Y4u49V/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../home/box/.npm/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Y4u49V/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
