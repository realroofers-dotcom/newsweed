/* nw.js — BUILT 2026-09-29 · nw-js-4a (truck ear → travel page; Volume + live clock in the edition bar; special-announcement bar; Events)
   was nw-js-3a (dramatic masthead: Volume, live clock, AI term ear; 2-row nav)
   Shared by every Newsweed page:
     - the masthead, nav and footer (one copy here, so every page matches)
     - small helpers (NW.esc, NW.ago, NW.get)
     - every email opt-in form marked <form data-subscribe="source">
   A page puts <div id="nw-top"></div> at the top and <div id="nw-foot"></div> at the bottom. */

(function () {
  // Row 1: the big desks. Row 2: every section (the more pages, the more room for advertisers).
  var NAV = [
    ["/", "Home"],
    ["/states.html", "50 States"],
    ["/#markets", "Markets"],
    ["/#world", "World"],
    ["/corruptmen.html", "CorruptMen", "cm"],
    ["/dui.html", "Crime & DUI"],
    ["/classifieds.html", "Classifieds"],
    ["/events.html", "Events"],
    ["/chat.html", "Chat room"]
  ];
  var NAV2 = [
    ["/travel.html", "The truck"],
    ["/family.html", "Family & Lacrosse"],
    ["/farm.html", "Farm & Garden"],
    ["/college.html", "Schools & Colleges"],
    ["/books.html", "Books & Libraries"],
    ["/arts.html", "Arts & Music"],
    ["/gambling.html", "Gambling"],
    ["/where.html", "Where it meets"],
    ["/dating.html", "Dating"],
    ["/luis.html", "Medellín desk"],
    ["/#tribal", "Tribal nations"],
    ["/archive.html", "Archive"],
    ["/advertise.html", "Advertise"],
    ["/suggestions.html", "Suggestions"]
  ];
  var FIRST_DAY = Date.UTC(2026, 8, 29); // Newsweed relaunched as a news site: Volume 1

  function nyNow() { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); }
  function volume() {
    var n = nyNow();
    return Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - FIRST_DAY) / 86400000) + 1;
  }

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

  var LOGO = '<svg viewBox="48 28 258 192" aria-hidden="true"><defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3192"/><stop offset=".55" stop-color="#1a8a6e"/><stop offset="1" stop-color="#00a651"/></linearGradient></defs>'
    + '<path d="M70 170V95a45 45 0 0 1 90 0v75" fill="none" stroke="url(#nwg)" stroke-width="22" stroke-linecap="round"/>'
    + '<path d="M175 90v80a27 27 0 0 0 54 0V90" fill="none" stroke="#00a651" stroke-width="22" stroke-linecap="round"/>'
    + '<path d="M229 90v80a27 27 0 0 0 54 0V90" fill="none" stroke="#00a651" stroke-width="22" stroke-linecap="round"/></svg>';

  function header() {
    var el = document.getElementById("nw-top");
    if (!el) return;
    var here = location.pathname.replace(/index\.html$/, "");
    var today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
    var vol = volume();
    function links(list) {
      return list.map(function (n) {
        var cur = n[0] === here ? ' aria-current="page"' : "";
        return '<a href="' + n[0] + '"' + cur + (n[2] ? ' class="' + n[2] + '"' : "") + ">" + n[1] + "</a>";
      }).join("");
    }
    el.innerHTML =
      '<div class="util"><div class="wrap"><span>Newsweed · Est. 2012 · New York · Medellín</span>'
      + '<span class="sale"><b>This brand is for sale</b> · <a href="/#acquire">acquisition details</a></span></div></div>'
      + '<div class="wrap"><header class="mast">'
      +   '<a class="ear ai" href="/ai.html" id="aiEar"><span class="k">AI term of the day</span><b id="aiTerm">…</b><span class="def" id="aiDef"></span></a>'
      +   '<div class="center"><a class="brand" href="/" aria-label="Newsweed home">' + LOGO
      +     '<span class="word">newsweed<span>.com</span></span></a>'
      +     '<div class="motto">The news that matters, reported with respect.</div></div>'
      +   '<a class="ear truck" href="/travel.html" aria-label="The Newsweed truck: where it has been">'
      +     '<img src="/truck-side.jpg?v=1" alt="The green Newsweed truck" width="640" height="360">'
      +     '<span class="k">The Newsweed truck</span><span class="seen" id="truckSeen">On the road across America →</span></a>'
      + '</header></div>'
      + '<div class="edition"><div class="wrap"><span>' + esc(today) + '</span>'
      +   '<span class="big"><span class="red">Volume ' + vol + '</span> · <span id="nwClock">&nbsp;</span></span>'
      +   '<span>Every edition archived · <a href="/archive.html">past editions</a></span></div></div>'
      + '<div id="nwAnnounce"></div>'
      + '<nav class="main" aria-label="Sections"><div class="wrap">' + links(NAV) + '</div><div class="wrap navrow2">' + links(NAV2) + "</div></nav>";

    // The special announcement, set from tips-admin.html. Hidden when there is none.
    get("/api/announce").then(function (d) {
      var a = d && d.announcement;
      if (!a) return;
      var link = a.link && /^(https?:\/\/|\/)/.test(a.link) ? a.link : "";
      document.getElementById("nwAnnounce").innerHTML = '<div class="announce" role="status"><div class="wrap"><b>Special announcement</b><span>' + esc(a.text) + '</span>'
        + (link ? '<a href="' + esc(link) + '">Details →</a>' : "") + '</div></div>';
    }).catch(function () {});

    // Where the truck was last seen (always at least a week old, town only).
    get("/api/travel").then(function (d) {
      var s = d && d.lastSeen;
      if (s && s.place) document.getElementById("truckSeen").textContent = "Last seen: " + s.place + (s.state ? ", " + s.state : "") + " →";
    }).catch(function () {});

    function tick() {
      var c = document.getElementById("nwClock");
      if (c) c.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }) + " ET";
    }
    tick(); setInterval(tick, 1000);

    function showTerm() {
      var t = window.NW_AI.today();
      document.getElementById("aiTerm").textContent = t.term;
      document.getElementById("aiDef").textContent = t.short;
      document.getElementById("aiEar").href = "/ai.html#" + t.slug;
    }
    if (window.NW_AI) showTerm();
    else {
      var s = document.createElement("script");
      s.src = "/ai-terms.js?v=1a";
      s.onload = showTerm;
      document.head.appendChild(s);
    }
  }

  function footer() {
    var el = document.getElementById("nw-foot");
    if (!el) return;
    var build = el.getAttribute("data-build") || "";
    el.innerHTML =
      '<footer class="site"><div class="wrap">'
      + '<div class="fnav">' + NAV.concat(NAV2).map(function (n) { return '<a href="' + n[0] + '">' + n[1] + "</a>"; }).join("")
      + '<a href="/newsroom.html">Newsroom &amp; tips</a><a href="/ai.html">AI glossary</a>'
      + '<a href="/editor.html">About the editor</a></div>'
      + "<p><b>How we report.</b> Newsweed serves the cannabis-aware audience and the general public with respect. "
      + "We do not promote or put down anyone who uses cannabis, and we never promote the use of alcohol or any drug. "
      + "On health we report published results, medical and holistic, not hype. Headlines from other outlets link to "
      + "the original publisher. Nothing here is medical, legal or investment advice.</p>"
      + '<p><b>Disclosure.</b> Newsweed.com is published by <a href="/editor.html">Mark Nejmeh</a>, who is the plaintiff in '
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
      if (form.getAttribute("data-bound")) return;
      form.setAttribute("data-bound", "1");
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

  window.NW = { esc: esc, safeUrl: safeUrl, ago: ago, stamp: stamp, get: get, post: post, subscribe: subscribeForms, volume: volume };
  header();
  footer();
  subscribeForms();
})();
