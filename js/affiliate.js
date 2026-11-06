/*! Founders Ramp affiliate surfaces. Off until affiliate-config.json has enabled=true and a real link. */
(function () {
  var DISCLOSURE_SHORT =
    "This page includes affiliate links. If you buy through them, Founders Ramp LLC may earn a commission. It does not change the price you pay.";
  var DISCLOSURE_PAGE =
    "Affiliate disclosure. Some links on this page are affiliate links. If you purchase through them, Founders Ramp LLC may earn a commission at no extra cost to you. We only list tools and books we would recommend without a commission.";

  function cfgUrl() {
    var s = document.querySelector('script[src*="affiliate.js"]');
    if (!s) return "/js/affiliate-config.json";
    return "/js/affiliate-config.json?v=" + encodeURIComponent((s.src.split("v=")[1] || "1").split("&")[0]);
  }

  function hasRealHref(h) {
    if (!h || typeof h !== "string") return false;
    h = h.trim();
    if (!h || h === "#" || h.indexOf("{{") === 0) return false;
    return /^https?:\/\//i.test(h);
  }

  function renderOneliner(cfg) {
    var o = (cfg && cfg.oneliner) || {};
    if (!cfg || !cfg.enabled) return;
    if (!o.brand || !o.benefit) return;
    var href = o.href || (o.anchor ? "/tools/" + o.anchor : "");
    if (!hasRealHref(href) && !(o.anchor && String(o.anchor).charAt(0) === "#")) {
      // Prefer /tools/#anchor when href empty but anchor set; that page holds disclosure.
      if (o.anchor) href = "/tools/" + (o.anchor.charAt(0) === "#" ? o.anchor : "#" + o.anchor);
      else return;
    }
    var host = document.querySelector("[data-affiliate-slot]");
    if (!host) {
      host = document.createElement("aside");
      host.setAttribute("data-affiliate-slot", "");
      host.setAttribute("aria-label", "Affiliate recommendation");
      var foot = document.querySelector("footer");
      if (foot && foot.parentNode) foot.parentNode.insertBefore(host, foot);
      else return;
    }
    host.hidden = false;
    host.className = "fr-aff";
    var a = document.createElement("a");
    a.href = href;
    a.rel = "noopener sponsored";
    a.textContent = o.brand;
    host.textContent = "";
    host.appendChild(document.createTextNode("Tool we use: "));
    host.appendChild(a);
    host.appendChild(document.createTextNode(" — " + o.benefit + ". Affiliate link."));
  }

  // Expose disclosure strings for /tools/ (and future pages) without inventing links.
  window.FRAffiliate = {
    disclosureShort: DISCLOSURE_SHORT,
    disclosurePage: DISCLOSURE_PAGE,
    hasRealHref: hasRealHref,
    fillCta: function (el, href, label) {
      if (!el) return;
      if (!hasRealHref(href)) {
        el.hidden = true;
        el.removeAttribute("href");
        return;
      }
      el.hidden = false;
      el.href = href;
      el.rel = "noopener sponsored";
      if (label) el.textContent = label;
    }
  };

  fetch(cfgUrl(), { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return;
      window.FRAffiliate.config = cfg;
      renderOneliner(cfg);
      document.dispatchEvent(new CustomEvent("fr-affiliate-ready", { detail: cfg }));
    })
    .catch(function () { /* stay hidden */ });
})();
