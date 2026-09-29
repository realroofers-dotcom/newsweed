/* apps.js — BUILT 2026-09-29 · apps-1e (+ Contests tile; 1c video icon for any contributor who files one; 1b Luis video icon)
   Newsweed on the phone is icon driven (Mark, 29 Sep 2026): "icons for every section: news, then dating,
   then classifieds, then all other sections. When a user scrolls they should get what they want fast.
   Squeeze ads in between on the scroll, in text form, small letters only, so as not to interfere."

   On screens 760px and narrower:
     - an icon grid under the masthead (first 11 + More), replacing the text menu
     - a slim icon bar that sticks to the top once you scroll past the grid
     - one small line of text advertising between sections (never boxes, never images)
     - the big ad boxes are taken off the page, so nobody is counted as seeing an ad they can't see
   Loaded by nw.js. Order of APPS = order on the phone. */

(function () {
  var PHONE = "(max-width: 760px)";

  // 24x24 line icons (stroke = currentColor)
  var I = {
    news: '<path d="M4 5h12v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M16 8h4v8.5a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="M7 8.5h6M7 12h6M7 15.5h4"/>',
    dating: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    classifieds: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
    states: '<path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
    markets: '<path d="M3 17.5l5.5-5.5 4 4L21 7.5"/><path d="M15 7.5h6v6"/>',
    world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z"/>',
    corrupt: '<path d="M12 4v16M8 20h8M5 7.5h14M12 4.5l-7 3M12 4.5l7 3"/><path d="M5 7.5l-2.5 6a2.8 2.8 0 0 0 5 0zM19 7.5l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
    dui: '<path d="M5 15.5l1.6-5a2 2 0 0 1 1.9-1.4h7a2 2 0 0 1 1.9 1.4l1.6 5"/><rect x="3.5" y="15.5" width="17" height="3.5" rx="1.2"/><path d="M6 19v1.5M18 19v1.5M10 4.5l1 2M14 4.5l-1 2M12 3v2.5"/>',
    events: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h3"/>',
    chat: '<path d="M4.5 5h15a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 9.5h8M8 12.5h5"/>',
    travel: '<path d="M2.5 7h11v9.5h-11z"/><path d="M13.5 10.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/><path d="M3 5h10"/>',
    family: '<circle cx="8.5" cy="7.5" r="2.8"/><circle cx="16.5" cy="9" r="2.2"/><path d="M3.5 19.5a5 5 0 0 1 10 0M13 19.5a3.8 3.8 0 0 1 7.5 0"/>',
    farm: '<path d="M12 20.5v-8"/><path d="M12 12.5C12 8 8.8 5.5 4.5 5.5c0 4.3 3 7 7.5 7zM12 14.5c0-4 2.8-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z"/><path d="M6 20.5h12"/>',
    college: '<path d="M2.5 9l9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2V11M21.5 9v5"/>',
    books: '<path d="M12 6.5c-2-1.4-4.8-2-8-1.8v13c3.2-.2 6 .4 8 1.8 2-1.4 4.8-2 8-1.8v-13c-3.2-.2-6 .4-8 1.8zM12 6.5v13"/>',
    arts: '<path d="M9 18V6.5l11-2.5v11.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
    gambling: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/>',
    where: '<circle cx="9" cy="9.5" r="5.5"/><circle cx="15" cy="9.5" r="5.5"/><circle cx="12" cy="14.5" r="5.5"/>',
    luis: '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M8.5 20.5h7"/>',
    tribal: '<path d="M19.5 4.5C12 5 7 10 5.5 18.5l-1 2"/><path d="M19.5 4.5c-.5 6-4 10.5-10.5 12.5M9 12.5l3.5 1M11.5 9l3 .8M14 6.5l2.5.5"/>',
    archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v10.5h14V9M10 12.5h4"/>',
    ai: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/><path d="M10 14.5l2-5 2 5M10.8 12.8h2.4"/>',
    advertise: '<path d="M4 10v4h3l7 4.5v-13L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6M7 14l1.5 5.5h2.5L10 15.5"/>',
    suggestions: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5.9 1.2.9 1.9v1.3h5.4v-1.3c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3.5z"/>',
    about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/>',
    more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
    trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/>'
  };

  // [href, label, icon, tile color]. News, Dating, Classifieds first (Mark's order), then the rest.
  var APPS = [
    ["/", "News", "news", "#1d2470"],
    ["/dating.html", "Dating", "dating", "#c2185b"],
    ["/classifieds.html", "Classifieds", "classifieds", "#058a44"],
    ["/states.html", "50 States", "states", "#2e3192"],
    ["/#markets", "Markets", "markets", "#0b6b3a"],
    ["/corruptmen.html", "CorruptMen", "corrupt", "#b3261e"],
    ["/dui.html", "Crime & DUI", "dui", "#7a1f16"],
    ["/events.html", "Events", "events", "#c77f1c"],
    ["/contests.html", "Contests", "trophy", "#b8860b"],
    ["/chat.html", "Chat", "chat", "#4145b0"],
    ["/travel.html", "Travel", "travel", "#058a44"],
    ["/family.html", "Family", "family", "#2e3192"],
    ["/farm.html", "Farm", "farm", "#3f7d20"],
    ["/college.html", "Schools", "college", "#1d2470"],
    ["/books.html", "Books", "books", "#6b4f2a"],
    ["/arts.html", "Music & Arts", "arts", "#8e24aa"],
    ["/#world", "World", "world", "#00796b"],
    ["/writer.html?w=luis-orozco", "Medellín", "luis", "#c77f1c"],
    ["/writer.html", "Writers", "news", "#4145b0"],
    ["/#tribal", "Tribal", "tribal", "#8d5524"],
    ["/gambling.html", "Gambling", "gambling", "#37474f"],
    ["/where.html", "Where it meets", "where", "#b3261e"],
    ["/archive.html", "Archive", "archive", "#455a64"],
    ["/ai.html", "AI terms", "ai", "#1d2470"],
    ["/advertise.html", "Advertise", "advertise", "#058a44"],
    ["/suggestions.html", "Suggest", "suggestions", "#c77f1c"],
    ["/editor.html", "About", "about", "#455a64"]
  ];
  var FIRST = 11; // shown before "More"

  // Small text ads, in rotation. Honest, labeled, one line each.
  var TEXT_ADS = [
    ["https://wisesleuths.com", "WiseSleuths.com", "Borrow a wise mind. Gigs for deep and complicated thinkers."],
    ["https://wisesleuth.com/excons.html", "WiseSleuths.com", "Ex-cons: use your mind, get paid. Judged on the work, not the past."],
    ["https://achplug.com", "ACHplug.com", "Collect payments straight from the bank. No card fees. $25 once."],
    ["https://adhotbox.com/advertise.html", "AdHotBox.com", "Your one-line ad right here, from $20. Any small business."],
    ["https://warrantwire.com", "Warrant Wire", "Every warrant financing, as it is filed."],
    ["https://8k10q.com", "8K10Q.com", "Company filings in plain English."],
    ["https://rooferschool.com", "RooferSchool.com", "Learn a trade that pays. Roofing classes on the road."],
    ["https://trailshrinks.com", "TrailShrinks.com", "Walk it off, talk it out. Group hikes."],
    ["https://lovappy.news", "Lovappy.news", "Compatibility? Voice introductions by state."],
    ["/classifieds.html#post", "Newsweed Classifieds", "Post a free ad today."],
    ["/newsroom.html#roster", "Report for Newsweed", "Journalists: get known. Your name, your page, our readers. Subject to approval."],
    ["/newsroom.html#roster", "Students: be on video", "Passion for your story? Tell it on camera for Newsweed readers. Subject to approval."],
    ["https://jobcreation.us", "JobCreation.us", "Where federal contract money lands, and the jobs it pays for."]
  ];

  function svg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || "") + "</svg>";
  }
  function tile(a, cls) {
    return '<a class="' + cls + '" href="' + a[0] + '"><span class="ic" style="background:' + a[3] + '">' + svg(a[2]) + '</span><span class="lb">' + a[1] + "</span></a>";
  }

  function render(host) {
    var here = location.pathname.replace(/index\.html$/, "");
    var grid = document.createElement("nav");
    grid.className = "apps";
    grid.setAttribute("aria-label", "Sections");
    grid.innerHTML = '<div class="wrap"><div class="appgrid">'
      + APPS.slice(0, FIRST).map(function (a) { return tile(a, "app" + (a[0] === here ? " on" : "")); }).join("")
      + '<button type="button" class="app more" aria-expanded="false"><span class="ic" style="background:#14150f">' + svg("more") + '</span><span class="lb">More</span></button>'
      + APPS.slice(FIRST).map(function (a) { return tile(a, "app extra" + (a[0] === here ? " on" : "")); }).join("")
      + "</div></div>";
    host.parentNode.insertBefore(grid, host.nextSibling);
    var more = grid.querySelector(".more");
    more.addEventListener("click", function () {
      var open = grid.classList.toggle("open");
      more.setAttribute("aria-expanded", open ? "true" : "false");
      more.querySelector(".lb").textContent = open ? "Less" : "More";
    });

    var bar = document.createElement("nav");
    bar.className = "appbar";
    bar.setAttribute("aria-label", "Sections, quick");
    bar.innerHTML = APPS.map(function (a) { return tile(a, "mini" + (a[0] === here ? " on" : "")); }).join("");
    document.body.appendChild(bar);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { bar.classList.toggle("show", !e[0].isIntersecting); }).observe(grid);
    }
  }

  function sprinkleAds() {
    // Big ad boxes go; the AdHotBox tag never sees them, so no invisible "views" are counted.
    Array.prototype.forEach.call(document.querySelectorAll(".ad"), function (el) { el.parentNode.removeChild(el); });
    var blocks = Array.prototype.filter.call(document.querySelectorAll(".block, .statecard, .prof, .clf, .ev"), function (b) {
      return !b.closest(".appgrid, .appbar, footer, #rail") && !b.querySelector(".block");
    });
    var n = Math.floor(Math.random() * TEXT_ADS.length), every = 3;
    blocks.forEach(function (b, i) {
      if (i % every !== every - 1 || i === blocks.length - 1) return;
      var ad = TEXT_ADS[n++ % TEXT_ADS.length];
      var p = document.createElement("p");
      p.className = "txtad";
      p.innerHTML = '<span>Ad</span> <a href="' + ad[0] + '" rel="noopener sponsored"><b>' + ad[1] + "</b> · " + ad[2] + "</a>";
      b.parentNode.insertBefore(p, b.nextSibling);
    });
  }

  window.NW_APPS = { list: APPS, isPhone: function () { return window.matchMedia && window.matchMedia(PHONE).matches; } };

  // The NEW video icon. It appears ONLY when a contributor (Luis Orozco first) has filed a dispatch with a video,
  // with their own desk key (only their key can publish under their name), within the last VIDEO_DAYS days.
  // Delete the dispatch and it's gone.
  // Phones: a "NEW" tile right after Classifieds, in the grid and the icon bar. Computers: a red link in the menu.
  var VIDEO_DAYS = 7;
  function videoIcon() {
    fetch("/api/dispatch", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
      var v = (d.dispatches || []).filter(function (x) {
        return x.video && x.video.id && x.by && Date.now() - Date.parse(x.published) < VIDEO_DAYS * 86400000;
      })[0];
      if (!v) return;
      var href = "/writer.html?id=" + encodeURIComponent(v.id);
      var first = String(v.author || "New").split(" ")[0].replace(/[<>&"']/g, "").slice(0, 14);
      var a = [href, first + " video", "video", "#b3261e"];
      var badge = '<span class="badge">NEW</span>';
      var grid = document.querySelector(".appgrid"), bar = document.querySelector(".appbar");
      if (grid) {
        var t = document.createElement("div"); t.innerHTML = tile(a, "app vidtile");
        var el = t.firstChild; el.querySelector(".ic").insertAdjacentHTML("beforeend", badge);
        grid.insertBefore(el, grid.children[3] || null);
        // keep 12 tiles above "More": the last visible one moves behind it
        var visible = grid.querySelectorAll(".app:not(.extra):not(.more)");
        if (visible.length > FIRST) visible[visible.length - 1].classList.add("extra");
      }
      if (bar) {
        var m = document.createElement("div"); m.innerHTML = tile(a, "mini");
        var me = m.firstChild; me.querySelector(".ic").insertAdjacentHTML("beforeend", badge);
        bar.insertBefore(me, bar.children[3] || null);
      }
      var nav = document.querySelector("nav.main .wrap");
      if (nav && !grid) nav.insertAdjacentHTML("afterbegin", '<a class="newvid" href="' + href + '">▶ New video: ' + String(v.author || "").replace(/[<>&"]/g, "") + '</a>');
    }).catch(function () {});
  }

  function start() {
    var nav = document.querySelector("nav.main");
    if (!nav) return;
    if (!window.NW_APPS.isPhone()) { videoIcon(); return; }
    render(nav);
    videoIcon();
    // Lists fill in after the news loads; give them a moment, then place the text ads.
    setTimeout(sprinkleAds, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
