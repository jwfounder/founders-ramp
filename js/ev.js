/* Counts five things, no cookies: arrivals from another site or a tagged link (referrer host only), /answers/ views, tracker views, calculator runs, booking clicks. */
(function () {
  if (!navigator.sendBeacon) return;
  var p = location.pathname;
  // Carry only this one-time pilot's existing tags along owned navigation. No storage or cookies.
  try {
    var here = new URL(location.href || ("https://www.foundersramp.net" + p + location.search));
    var campaign = here.searchParams.get("utm_campaign");
    var pilot = ["fr-views-7day", "fr-views-7day-20261107"].indexOf(campaign) !== -1 || (campaign === "borrowed" && ["naval", "horowitz", "thiel"].indexOf(here.searchParams.get("utm_content")) !== -1);
    if (pilot && Date.now() >= Date.parse("2026-11-07T17:48:00Z") && Date.now() < Date.parse("2026-11-15T05:00:00Z") && document.querySelectorAll) {
      document.querySelectorAll("a[href]").forEach(function (a) {
        var to = new URL(a.getAttribute("href"), here);
        if (to.protocol !== "https:" || !/^(www\.)?foundersramp\.net$/.test(to.hostname) || to.pathname.startsWith("/api/")) return;
        if (to.searchParams.has("utm_campaign") && to.searchParams.get("utm_campaign") !== campaign) return;
        ["utm_source","utm_medium","utm_campaign","utm_content"].forEach(function (key) {
          if (here.searchParams.has(key) && !to.searchParams.has(key)) to.searchParams.set(key,here.searchParams.get(key));
        });
        a.setAttribute("href",to.href);
      });
    }
  } catch (e) {}
  var r = "";
  try { r = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
  function send(n, l) {
    try {
      navigator.sendBeacon("/api/event", new Blob([JSON.stringify({ n: n, p: p, l: l || "", r: r, q: location.search })], { type: "text/plain" }));
    } catch (e) {}
  }
  if ((r && !/(^|\.)foundersramp\.net$/i.test(r)) || /[?&](utm_[a-z]+|ref)=/.test(location.search)) send("landing");
  if (/^\/answers\/[a-z0-9-]+\/?$/.test(p)) send("answers_view");
  if (/^\/tracker\/?$/.test(p)) send("tracker_view");
  var calc = document.getElementById("calc");
  if (calc) {
    var ran = false;
    var once = function () { if (!ran) { ran = true; send("calc_run"); } };
    calc.addEventListener("input", once);
    calc.addEventListener("change", once);
  }
  function book(e) {
    if (e.type === "auxclick" && e.button !== 1) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href*="cal.com/"]') : null;
    if (a) send("book_click", (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120));
  }
  document.addEventListener("click", book, true);
  document.addEventListener("auxclick", book, true);
})();
