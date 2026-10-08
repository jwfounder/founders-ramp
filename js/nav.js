(function () {
  var desktop = window.matchMedia("(min-width: 861px)");
  document.querySelectorAll(".nav-group").forEach(function (group) {
    var btn = group.querySelector(".nav-toggle");
    var links = group.querySelectorAll(".nav-sub a");
    if (!btn) return;
    function set(open) {
      group.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      set(!group.classList.contains("open"));
    });
    group.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && group.classList.contains("open")) {
        set(false); btn.focus();
      } else if (e.key === "ArrowDown" && (e.target === btn || e.target === group.querySelector(".nav-top a"))) {
        e.preventDefault(); set(true); if (links[0]) links[0].focus();
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.closest(".nav-sub")) {
        e.preventDefault();
        var i = Array.prototype.indexOf.call(links, e.target) + (e.key === "ArrowDown" ? 1 : -1);
        if (i < 0) { btn.focus(); } else if (links[i]) { links[i].focus(); }
      }
    });
    // Desktop: keep aria-expanded in step with hover.
    group.addEventListener("mouseenter", function () { if (desktop.matches) btn.setAttribute("aria-expanded", "true"); });
    group.addEventListener("mouseleave", function () {
      if (desktop.matches && !group.classList.contains("open")) btn.setAttribute("aria-expanded", "false");
    });
    // Close when focus or a click moves elsewhere.
    group.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !group.contains(e.relatedTarget)) set(false);
    });
    document.addEventListener("click", function (e) { if (!group.contains(e.target)) set(false); });
  });
})();
