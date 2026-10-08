(function () {
  var tabs = document.querySelectorAll(".tabs .tab");
  var grid = document.querySelector(".news-grid");
  var cards = grid ? grid.querySelectorAll(".card.news") : document.querySelectorAll(".card.news");
  var input = document.getElementById("news-q");
  var clear = document.querySelector(".news-search-clear");
  var empty = document.querySelector(".news-empty");
  var filter = "all";

  function norm(s) {
    s = (s || "").toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
  }

  // Index every card in the grid: headline, blurb, source/author and date.
  var index = [];
  cards.forEach(function (c) {
    var parts = [];
    ["h3", ".news-body > p", ".news-source", "time"].forEach(function (sel) {
      c.querySelectorAll(sel).forEach(function (el) { parts.push(el.textContent); });
    });
    var t = c.querySelector("time");
    if (t && t.getAttribute("datetime")) parts.push(t.getAttribute("datetime"));
    index.push({ el: c, topic: c.getAttribute("data-topic"), text: norm(parts.join(" ")) });
  });

  // Remember the published tab counts so they come back exactly when the search is cleared.
  var counts = [];
  tabs.forEach(function (tab) {
    var span = tab.querySelector("span");
    counts.push({ tab: tab, span: span, original: span ? span.textContent : "" });
  });

  function apply() {
    var q = input ? norm(input.value) : "";
    var words = q ? q.split(" ") : [];
    var perTopic = {};
    var all = 0;
    var shown = 0;
    index.forEach(function (it) {
      var hit = true;
      for (var i = 0; i < words.length; i++) {
        if (it.text.indexOf(words[i]) === -1) { hit = false; break; }
      }
      if (hit) {
        all++;
        perTopic[it.topic] = (perTopic[it.topic] || 0) + 1;
      }
      var visible = hit && (filter === "all" || it.topic === filter);
      it.el.hidden = !visible;
      if (visible) shown++;
    });
    counts.forEach(function (c) {
      if (!c.span) return;
      if (!words.length) { c.span.textContent = c.original; return; }
      var f = c.tab.getAttribute("data-filter");
      c.span.textContent = String(f === "all" ? all : (perTopic[f] || 0));
    });
    if (empty) empty.hidden = shown > 0;
    if (clear) clear.hidden = !(input && input.value.length);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      filter = tab.getAttribute("data-filter");
      tabs.forEach(function (t) { t.setAttribute("aria-pressed", t === tab ? "true" : "false"); });
      apply();
    });
  });

  if (input) {
    input.addEventListener("input", apply);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { input.value = ""; apply(); }
    });
  }
  if (clear) {
    clear.addEventListener("click", function () {
      input.value = "";
      apply();
      input.focus();
    });
  }
  apply();
})();
