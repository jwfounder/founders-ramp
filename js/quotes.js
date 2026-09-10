(function () {
  var REFS = [
    {
      q: "Justin helped drive the growth that took us past a hundred million in revenue. If someone asked me for help launching a new company or a new product, or standing up a sales motion from scratch, I would not hesitate to call Justin.",
      who: "Co-founder and former CEO of a public, multi-billion-dollar SaaS company"
    },
    {
      q: "There were many times in sales meetings he would come up with a new creative way to attack an issue. This then became part of our sales playbook.",
      who: "Chief Customer and Revenue Officer"
    },
    {
      q: "I have a great deal of respect for Justin and would highly recommend him to any organization looking to strengthen its sales enablement, develop its team, and build a more effective and repeatable sales motion.",
      who: "Partner, financial transformation, global financial services consultancy"
    },
    {
      q: "I've watched Justin develop people from mid-market into enterprise and into leadership, install process under pressure, and keep a team focused when conditions were bad. If you need practical sales help that actually works, work with him.",
      who: "Go-to-market leader, financial services, public SaaS"
    },
    {
      q: "If you are launching a new sales team, building out a fresh vertical, or navigating a market without an established playbook, Justin is exactly who you want in your corner. He leaves teams sharper and far more capable than he found them.",
      who: "Enterprise seller who helped stand up a new vertical at a public SaaS company"
    },
    {
      q: "I would not hesitate to have him in a foxhole with me anytime.",
      who: "SVP, Global Enterprise Sales"
    },
    {
      q: "An outstanding leader of people, dedicated not only to driving the results of the business, but to the constant growth and development of the people around him.",
      who: "Director of Sales Training"
    },
    {
      q: "Very focused on truly understanding the client's environment and making sure the solution is a good fit, rather than the cookie-cutter get-the-contract-signed approach.",
      who: "Principal Consultant"
    }
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fill(box) {
    var html = '<p class="ref-kicker">References</p><div class="ref-track">';
    for (var i = 0; i < REFS.length; i++) {
      html +=
        '<blockquote class="ref-slide' +
        (i === 0 ? " on" : "") +
        '"><p>' +
        esc(REFS[i].q) +
        '</p><div class="who">' +
        esc(REFS[i].who) +
        "</div></blockquote>";
    }
    html += '</div><div class="ref-dots">';
    for (var d = 0; d < REFS.length; d++) {
      html +=
        '<button type="button"' +
        (d === 0 ? ' class="on"' : "") +
        ' data-ref-dot aria-label="Quote ' +
        (d + 1) +
        '"></button>';
    }
    html += "</div>";
    box.classList.add("ref-box");
    box.innerHTML = html;
  }

  function wire(box) {
    var slides = box.querySelectorAll(".ref-slide");
    var dots = box.querySelectorAll("[data-ref-dot]");
    if (!slides.length) return;
    var i = 0;
    var timer = null;
    function show(n) {
      i = (n + slides.length) % slides.length;
      for (var x = 0; x < slides.length; x++) {
        slides[x].classList.toggle("on", x === i);
        if (dots[x]) dots[x].classList.toggle("on", x === i);
      }
    }
    function tick() {
      show(i + 1);
    }
    function start() {
      stop();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer = setInterval(tick, 6500);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    for (var d = 0; d < dots.length; d++) {
      (function (idx) {
        dots[idx].addEventListener("click", function () {
          stop();
          show(idx);
          start();
        });
      })(d);
    }
    box.addEventListener("mouseenter", stop);
    box.addEventListener("mouseleave", start);
    box.addEventListener("focusin", stop);
    box.addEventListener("focusout", start);
    show(0);
    start();
  }

  var boxes = document.querySelectorAll("[data-refs]");
  for (var b = 0; b < boxes.length; b++) {
    fill(boxes[b]);
    wire(boxes[b]);
  }
})();
