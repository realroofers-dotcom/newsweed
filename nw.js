/* nw.js — BUILT 2026-09-29 · nw-js-2a
   Shared by every Newsweed page:
     - the masthead, nav and footer (one copy here, so every page matches)
     - small helpers (NW.esc, NW.ago, NW.get)
     - every email opt-in form marked <form data-subscribe="source">
   A page puts <div id="nw-top"></div> at the top and <div id="nw-foot"></div> at the bottom. */

(function () {
  var NAV = [
    ["/", "Home"],
    ["/#markets", "Markets"],
    ["/#world", "World"],
    ["/luis.html", "Medellín desk"],
    ["/#tribal", "Tribal nations"],
    ["/corruptmen.html", "CorruptMen", "cm"],
    ["/chat.html", "Chat room"],
    ["/newsroom.html", "Newsroom"],
    ["/suggestions.html", "Suggestions"]
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : "#"; }
  function ago(iso) {
    if (!iso) return "";
    var t = Date.parse(iso); if (isNaN(t)) return "";
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : d + "d ago";
  }
  function stamp(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function get(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) { return r.json(); });
  }
  function post(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  var LOGO = '<svg viewBox="30 30 260 150" aria-hidden="true"><defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3192"/><stop offset=".55" stop-color="#1a8a6e"/><stop offset="1" stop-color="#00a651"/></linearGradient></defs>'
    + '<path d="M70 170V95a45 45 0 0 1 90 0v75" fill="none" stroke="url(#nwg)" stroke-width="22" stroke-linecap="round"/>'
    + '<path d="M175 90v80a27 27 0 0 0 54 0V90" fill="none" stroke="#00a651" stroke-width="22" stroke-linecap="round"/>'
    + '<path d="M229 90v80a27 27 0 0 0 54 0V90" fill="none" stroke="#00a651" stroke-width="22" stroke-linecap="round"/></svg>';

  function header() {
    var el = document.getElementById("nw-top");
    if (!el) return;
    var here = location.pathname.replace(/index\.html$/, "");
    var today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
    el.innerHTML =
      '<div class="util"><div class="wrap"><span>' + esc(today) + '</span>'
      + '<span class="sale"><b>This brand is for sale</b> · <a href="/#acquire">acquisition details</a></span></div></div>'
      + '<header class="mast"><a class="brand" href="/" aria-label="Newsweed home">' + LOGO
      + '<span class="word">newsweed<span>.com</span></span></a>'
      + '<div class="motto">The news that matters, reported with respect.</div></header>'
      + '<nav class="main" aria-label="Sections"><div class="wrap">'
      + NAV.map(function (n) {
          var cur = n[0] === here ? ' aria-current="page"' : "";
          return '<a href="' + n[0] + '"' + cur + (n[2] ? ' class="' + n[2] + '"' : "") + ">" + n[1] + "</a>";
        }).join("")
      + "</div></nav>";
  }

  function footer() {
    var el = document.getElementById("nw-foot");
    if (!el) return;
    var build = el.getAttribute("data-build") || "";
    el.innerHTML =
      '<footer class="site"><div class="wrap">'
      + '<div class="fnav">' + NAV.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + "</a>"; }).join("") + "</div>"
      + "<p><b>How we report.</b> Newsweed serves the cannabis-aware audience and the general public with respect. "
      + "We do not promote or put down anyone who uses cannabis, and we never promote the use of alcohol or any drug. "
      + "On health we report published results, medical and holistic, not hype. Headlines from other outlets link to "
      + "the original publisher. Nothing here is medical, legal or investment advice.</p>"
      + "<p><b>Disclosure.</b> Newsweed.com is published by Mark Nejmeh, who is the plaintiff in "
      + '<i>Nejmeh v. Theriva Biologics, Inc.</i>, No. 3:26-cv-00705 (D. Nev.) (<a href="https://nejmehvstheriva.com" rel="noopener">the filings</a>), '
      + "and holds shares of Theriva Biologics. He also runs Warrant Wire, JobCreation.us, WiseSleuth, ACHplug and AdHotBox, which are promoted on this site.</p>"
      + '<div class="forsale" id="acquire"><b>Newsweed.com is for sale.</b> The site keeps publishing while it is listed. '
      + 'Serious inquiries: <a href="tel:+17329953914">732-995-3914</a> · '
      + '<a href="mailto:realroofers@gmail.com?subject=Newsweed.com%20acquisition">realroofers@gmail.com</a> · '
      + '<a href="https://wallstdomains.com" rel="noopener">wallstdomains.com</a>. A merger or partnership with an established media company would also be considered.</div>'
      + '<p class="stamp">© ' + new Date().getFullYear() + " Newsweed.com · " + esc(build) + "</p>"
      + "</div></footer>";
  }

  function subscribeForms() {
    var forms = document.querySelectorAll("form[data-subscribe]");
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = form.querySelector("input[type=email]");
        var consent = form.querySelector("input[name=consent]");
        var status = form.querySelector(".status");
        var btn = form.querySelector("button");
        status.className = "status";
        if (consent && !consent.checked) {
          status.textContent = "Please tick the box so we know you want our emails.";
          status.className = "status err";
          return;
        }
        var label = btn.textContent;
        btn.disabled = true; btn.textContent = "Signing up…"; status.textContent = "";
        post("/api/subscribe", { email: email.value.trim(), consent: true, source: form.getAttribute("data-subscribe") })
          .then(function (d) {
            if (d.success) {
              status.textContent = d.alreadySubscribed ? "You're already on the list. Thank you." : "You're in. The next Newsweed email comes to you.";
              form.reset();
            } else {
              status.textContent = d.error || "Something went wrong. Please try again.";
              status.className = "status err";
            }
          })
          .catch(function () { status.textContent = "Something went wrong. Please try again."; status.className = "status err"; })
          .then(function () { btn.disabled = false; btn.textContent = label; });
      });
    });
  }

  window.NW = { esc: esc, safeUrl: safeUrl, ago: ago, stamp: stamp, get: get, post: post };
  header();
  footer();
  subscribeForms();
})();
