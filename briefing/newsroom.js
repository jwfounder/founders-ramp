(function () {
  var tabs = document.querySelectorAll(".tabs .tab");
  var cards = document.querySelectorAll(".card.news");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      tabs.forEach(function (t) { t.setAttribute("aria-pressed", t === tab ? "true" : "false"); });
      cards.forEach(function (c) { c.hidden = f !== "all" && c.getAttribute("data-topic") !== f; });
    });
  });
})();
