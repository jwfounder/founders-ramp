/* Email boxes that post to /api/capture (one shared capture). Sends only the form's own fields: email, source, detail (if any)
   and the empty honeypot. Nothing else from the page. */
(function () {
  var forms = document.querySelectorAll("form.fr-cap-form");
  for (var i = 0; i < forms.length; i++) (function (f) {
    var note = f.parentNode.querySelector(".fr-cap-note"), sending = false;
    function say(t) { note.textContent = t; note.hidden = false; }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var em = f.elements.email;
      if (!em.value || !em.checkValidity()) { say("Please enter a working email address."); em.focus(); return; }
      if (!window.fetch) return;
      sending = true;
      fetch("/api/capture", { method: "POST", body: new FormData(f), credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { f.hidden = true; say("Thanks. Justin will follow up at " + em.value + "."); }
        else { say("That did not go through. Please check your email address and try again, or write to jw@foundersramp.net."); sending = false; }
      }).catch(function () { say("That did not go through. Please try again, or write to jw@foundersramp.net."); sending = false; });
    });
  })(forms[i]);
})();
