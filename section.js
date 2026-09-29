/* section.js — BUILT 2026-09-29 · section-1b (+ Events, The truck)
   Fills a section page. The page says which feed group it reads and where each desk goes:
     <body data-group="farm">
       <ul class="hl" data-s="fourh"></ul>      <- filled with /api/feed?group=farm -> sections.fourh
       <aside id="rail"></aside>                <- filled with the sign-up box, ads and the other sections
   Load after nw.js. */

(function () {
  var E = NW.esc, U = NW.safeUrl;
  var group = document.body.getAttribute("data-group");

  var SECTIONS = [
    ["/events.html", "Events", "Authors, hikes, roofing"],
    ["/travel.html", "The truck", "Where it has been"],
    ["/family.html", "Family & Lacrosse", "Amazing kids, youth sports"],
    ["/farm.html", "Farm & Garden", "4-H, farm news, gardening"],
    ["/college.html", "Schools & Colleges", "Campus, seasons, back to school"],
    ["/books.html", "Books & Libraries", "Where America's authors are"],
    ["/arts.html", "Arts & Music", "With MusicIsNews.com"],
    ["/states.html", "50 States", "Top story from every state"],
    ["/dui.html", "Crime & DUI", "The maps, the headlines"],
    ["/gambling.html", "Gambling", "The industry and its cost"],
    ["/where.html", "Where it meets", "DUI, gambling, drugs, crime"],
    ["/classifieds.html", "Classifieds", "Free to post"],
    ["/dating.html", "Dating", "Voice introductions by state"],
    ["/corruptmen.html", "CorruptMen", "A story a day"]
  ];

  function li(it) {
    return '<li><a href="' + E(U(it.link)) + '" target="_blank" rel="noopener">' + E(it.title) + '</a>'
      + (it.snippet ? '<span class="src" style="font:400 13px var(--sans);color:var(--ink2);margin-top:3px">' + E(it.snippet) + '</span>' : "")
      + '<span class="src">' + E(it.source || "") + (it.pubDate ? " · " + E(NW.ago(it.pubDate)) : "") + '</span></li>';
  }

  function fill(sections) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-s]"), function (el) {
      var items = sections[el.getAttribute("data-s")] || [];
      var max = parseInt(el.getAttribute("data-max"), 10) || 99;
      el.innerHTML = items.length ? items.slice(0, max).map(li).join("") : '<li class="loading">Nothing new right now. Check back shortly.</li>';
    });
  }

  function rail() {
    var el = document.getElementById("rail");
    if (!el) return;
    var here = location.pathname;
    el.innerHTML =
      '<form class="signup" data-subscribe="section-' + E(group || "page") + '" style="padding:14px 16px">'
      + '<h3 style="font-size:19px">The Newsweed Daily</h3><p class="sub">One email a day. Free.</p><div class="form">'
      + '<input type="email" placeholder="you@email.com" aria-label="Email address" required>'
      + '<label class="chk"><input type="checkbox" name="consent" required> Yes, email me the Newsweed Daily. Unsubscribe any time.</label>'
      + '<button class="btn" type="submit">Sign me up</button><div class="status" role="status"></div></div></form>'
      + '<div class="ad"><span class="adlab">Advertisement</span><div data-ad="card"></div>'
      + '<div class="adfall">This space is for your business. <a href="/advertise.html">Advertise from $20 →</a></div></div>'
      + '<div class="kicker"><h2>More sections</h2></div><div class="teasers" style="grid-template-columns:1fr 1fr;margin-bottom:24px">'
      + SECTIONS.filter(function (s) { return s[0] !== here; }).map(function (s) { return '<a href="' + s[0] + '">' + E(s[1]) + '<span>' + E(s[2]) + '</span></a>'; }).join("")
      + '</div>'
      + '<div class="ad"><span class="adlab">Advertisement</span><div data-ad="rail"></div>'
      + '<div class="adfall">Free classifieds: <a href="/classifieds.html">post one →</a></div></div>';
    NW.subscribe();
  }

  rail();
  if (group) {
    NW.get("/api/feed?group=" + encodeURIComponent(group)).then(function (d) {
      fill(d.sections || {});
      if (d.season) Array.prototype.forEach.call(document.querySelectorAll("[data-season]"), function (el) { el.textContent = d.season; });
      document.dispatchEvent(new CustomEvent("nw:feed", { detail: d }));
    }).catch(function () { fill({}); });
  }

  // AdHotBox fills every data-ad slot on the page.
  var ad = document.createElement("script");
  ad.src = "https://adhotbox.com/box.js";
  ad.async = true;
  document.body.appendChild(ad);

  window.NW_SECTIONS = SECTIONS;
})();
