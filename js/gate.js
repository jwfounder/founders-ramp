/* Email gate. After Enter the site. Cookie via /api/gate. Skip is local, one year. Bots pass. Desk is separate. */
(function () {
  if (/\/desk(\/|$)/.test(location.pathname)) return;
  var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/index.html") return;
  if (document.cookie.indexOf("fr_gate_skip=1") !== -1) return;
  var ua = navigator.userAgent || "";
  if (/bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot/i.test(ua)) return;

  function api(method, body) {
    var opt = { method: method, credentials: "include", headers: {} };
    if (body) {
      opt.headers["content-type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    return fetch("/api/gate", opt).then(function (r) {
      return r.json().then(function (j) {
        j._status = r.status;
        return j;
      });
    });
  }

  function skipNow() {
    document.cookie = "fr_gate_skip=1; max-age=31536000; path=/; SameSite=Lax";
  }

  function css() {
    var s = document.createElement("style");
    s.textContent =
      "#fr-gate{position:fixed;inset:0;z-index:80;background:#212127;color:#f5f5f4;display:flex;align-items:center;justify-content:center;padding:24px}" +
      "#fr-gate .fr-gate-box{width:100%;max-width:420px}" +
      "#fr-gate h1{font-family:'Barlow Condensed',sans-serif;font-size:36px;margin:0 0 8px;letter-spacing:.02em}" +
      "#fr-gate .fr-gate-tag{color:#a8a29e;margin:0 0 28px}" +
      "#fr-gate label{display:block;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin:0 0 8px}" +
      "#fr-gate input{width:100%;min-height:48px;font:inherit;font-size:16px;padding:12px;border:1px solid #3f3f46;border-radius:8px;background:#161616;color:#f5f5f4}" +
      "#fr-gate button{width:100%;min-height:48px;margin-top:12px;border:0;border-radius:8px;background:#e10600;color:#fff;font:inherit;font-weight:600;cursor:pointer}" +
      "#fr-gate .fr-gate-fine{color:#a8a29e;font-size:13px;margin:14px 0 0}" +
      "#fr-gate .fr-gate-skip{display:block;width:100%;min-height:44px;margin-top:4px;border:0;background:transparent;color:#a8a29e;font:inherit;font-size:14px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}" +
      "#fr-gate .fr-gate-err{color:#e10600;font-size:14px;margin:10px 0 0;display:none}" +
      "body.fr-gated{overflow:hidden}";
    document.head.appendChild(s);
  }

  function paint() {
    css();
    document.body.classList.add("fr-gated");
    var el = document.createElement("div");
    el.id = "fr-gate";
    el.innerHTML =
      '<form class="fr-gate-box" id="fr-gate-form">' +
      "<h1>Founders Ramp</h1>" +
      '<p class="fr-gate-tag">Accelerate sales before hiring sellers.</p>' +
      '<label for="fr-gate-email">Work email</label>' +
      '<input id="fr-gate-email" type="email" autocomplete="email" required placeholder="you@company.com">' +
      '<button type="submit">Continue</button>' +
      '<p class="fr-gate-err" id="fr-gate-err">Use a real email.</p>' +
      '<p class="fr-gate-fine">Join our mailing list.</p>' +
      '<button type="button" class="fr-gate-skip" id="fr-gate-skip">Skip for now</button>' +
      "</form>";
    document.body.appendChild(el);
    document.getElementById("fr-gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("fr-gate-err");
      var email = (document.getElementById("fr-gate-email").value || "").trim();
      err.style.display = "none";
      api("POST", {
        email: email,
        path: location.pathname + location.search,
        referrer: document.referrer || "",
      }).then(function (j) {
        if (j.ok) {
          el.remove();
          document.body.classList.remove("fr-gated");
          return;
        }
        err.style.display = "block";
      }).catch(function () {
        err.style.display = "block";
      });
    });
    document.getElementById("fr-gate-skip").addEventListener("click", function () {
      skipNow();
      el.remove();
      document.body.classList.remove("fr-gated");
    });
  }

  api("GET")
    .then(function (j) {
      if (j && j.ok) return;
      paint();
    })
    .catch(function () {
      paint();
    });
})();
