/* Founders Ramp inbound. Every visit. RB2B identifies US visitors. */
!function(key) {if (window.reb2b) return;window.reb2b = {loaded: true};var s = document.createElement("script");s.async = true;s.src = "https://ddwl4m2hdecbv.cloudfront.net/b/" + key + "/" + key + ".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s, document.getElementsByTagName("script")[0]);}("Z6PVLHZZK96R");
(function () {
  function send(extra) {
    var payload = {
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      title: document.title || "",
      event: (extra && extra.event) || "view",
    };
    try {
      fetch("/api/hit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
      }).catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      send({ event: "view" });
    });
  } else {
    send({ event: "view" });
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest("a[href^='mailto:']");
    if (a) send({ event: "consult" });
    var cal = t.closest("a[href*='cal.com']");
    if (cal) send({ event: "consult" });
    var skip = t.closest("#fr-gate-skip");
    if (skip) send({ event: "skip" });
  });
})();
