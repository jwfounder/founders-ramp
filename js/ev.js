/* Counts five things, no cookies: arrivals from another site or a tagged link (referrer host only), /answers/ views, tracker views, calculator runs, booking clicks. */
(function () {
  if (!navigator.sendBeacon) return;
  var p = location.pathname;
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
