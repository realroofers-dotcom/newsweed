/* maps.js — BUILT 2026-09-29 · maps-1b (+ state panel, values)
   The Newsweed tile map: one square per state, one tap to open it.
   Needs states-data.js loaded first.

   NWMap.heat(el, { values:{NY:12,...}, label:"crime headlines", scale:"red", onPick:fn(code) })
   NWMap.cannabis(el, { onPick:fn(code) })
   NWMap.cats(el, { cats:{NY:"adult",...}, colors:{adult:"#..."}, labels:{...}, onPick }) */

(function () {
  var SCALES = {
    red:   ["#f6efe9", "#f3d3c4", "#eaa98f", "#dc7a5c", "#c24a30", "#9b2a17"],
    navy:  ["#eef0f8", "#d3d7ee", "#aab1de", "#7b84c7", "#4e57ad", "#2e3192"],
    green: ["#eef6f0", "#cfe8d6", "#9fd2b0", "#62b684", "#2f955c", "#0b6b3a"],
    amber: ["#fbf4e6", "#f5e0b5", "#edc57c", "#e0a445", "#c77f1c", "#95590b"]
  };
  var CANNABIS_COLORS = { adult: "#0b6b3a", medical: "#62b684", cbd: "#d3d7ee", none: "#c9c7bd" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ink(bg) {
    var h = bg.replace("#", ""), r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#14150f" : "#ffffff";
  }

  function grid(el, colorOf, titleOf, onPick, legendHtml) {
    var S = window.NW_STATES.list;
    var cells = S.map(function (s) {
      var bg = colorOf(s);
      return '<button type="button" class="tile" data-code="' + s.code + '" style="grid-row:' + (s.row + 1) + ';grid-column:' + (s.col + 1)
        + ';background:' + bg + ';color:' + ink(bg) + '" title="' + esc(titleOf(s)) + '" aria-label="' + esc(titleOf(s)) + '">' + s.code + '</button>';
    }).join("");
    el.innerHTML = '<div class="tilemap">' + cells + '</div>' + (legendHtml || "");
    if (onPick) {
      el.querySelector(".tilemap").addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".tile") : null;
        if (!b) return;
        Array.prototype.forEach.call(el.querySelectorAll(".tile"), function (t) { t.classList.toggle("on", t === b); });
        onPick(b.getAttribute("data-code"));
      });
    }
  }

  function heat(el, o) {
    var vals = o.values || {}, scale = SCALES[o.scale || "red"];
    var max = 0;
    Object.keys(vals).forEach(function (k) { if (vals[k] > max) max = vals[k]; });
    function bucket(v) {
      if (v == null) return -1;
      if (!max || v <= 0) return 0;
      return Math.max(1, Math.min(5, Math.ceil((v / max) * 5)));
    }
    var legend = '<div class="maplegend"><span>' + esc(o.lowLabel || "Less") + '</span>'
      + scale.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("")
      + '<span>' + esc(o.highLabel || "More") + '</span>' + (o.note ? '<em>' + esc(o.note) + '</em>' : "") + '</div>';
    grid(el,
      function (s) { var b = bucket(vals[s.code]); return b < 0 ? "#f1f0ea" : scale[b]; },
      function (s) { var v = vals[s.code]; return s.name + (v == null ? ": no data yet" : ": " + (Math.round(v * 10) / 10) + " " + (o.label || "")); },
      o.onPick, legend);
  }

  function cats(el, o) {
    var legend = '<div class="maplegend">' + Object.keys(o.colors).map(function (k) {
      return '<span class="key"><i style="background:' + o.colors[k] + '"></i>' + esc(o.labels[k]) + '</span>';
    }).join("") + (o.note ? '<em>' + esc(o.note) + '</em>' : "") + '</div>';
    grid(el,
      function (s) { return o.colors[o.cats[s.code]] || "#f1f0ea"; },
      function (s) { return s.name + ": " + (o.labels[o.cats[s.code]] || "no data"); },
      o.onPick, legend);
  }

  function cannabis(el, o) {
    var D = window.NW_STATES, c = {};
    D.list.forEach(function (s) { c[s.code] = s.cannabis; });
    cats(el, {
      cats: c, colors: CANNABIS_COLORS, labels: D.CANNABIS_LABELS, onPick: (o || {}).onPick,
      note: "As of " + D.CANNABIS_AS_OF + " · source: " + D.CANNABIS_SOURCE.name
    });
  }

  // The panel under a map when a state is tapped: its top story and the headlines behind the count.
  // kind: "crime" | "dui" | "gambling" | "drugs" | null (top story only)
  function panel(el, rec, code, kind, words) {
    var D = window.NW_STATES, st = D.by[code], safe = function (u) { return /^https?:\/\//i.test(u || "") ? u : "#"; };
    if (!rec) { el.innerHTML = '<h4>' + esc(st.name) + '</h4><p class="note" style="margin:0">Not gathered yet. States refresh through the day; try again shortly.</p>'; return; }
    var h = '<h4>' + esc(st.name) + '</h4><div class="src">Cannabis: ' + esc(D.CANNABIS_LABELS[st.cannabis]) + (st.note ? " (" + esc(st.note) + ")" : "") + '</div>';
    if (kind) {
      var list = rec[kind] || [];
      h += '<p class="story" style="margin-top:8px"><b>' + ((rec.counts || {})[kind] || 0) + '</b> ' + esc(words || kind + " headlines") + ' in the latest ' + ((rec.counts || {}).sample || 0) + ' ' + esc(st.name) + ' stories checked.</p>';
      if (list.length) h += '<ul class="hl small">' + list.map(function (a) { return '<li><a href="' + esc(safe(a.link)) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a><span class="src">' + esc(a.source) + '</span></li>'; }).join("") + '</ul>';
    }
    if (rec.top) h += '<div class="kicker" style="margin-top:10px;border-top-width:1px"><h2>Top story</h2></div><a href="' + esc(safe(rec.top.link)) + '" target="_blank" rel="noopener" style="font:600 15px/1.3 var(--serif)">' + esc(rec.top.title) + '</a>'
      + (rec.top.story ? '<p class="story">' + esc(rec.top.story) + '</p>' : "") + '<div class="src">' + esc(rec.top.source || "") + '</div>';
    h += '<p style="margin:8px 0 0"><a href="/states.html#' + code + '" style="color:var(--navy);font-size:13px">All of ' + esc(st.name) + ' →</a></p>';
    el.innerHTML = h;
  }

  function values(states, kind, perMillion) {
    var v = {};
    Object.keys(states || {}).forEach(function (k) {
      var n = ((states[k] || {}).counts || {})[kind];
      if (n == null) return;
      var pop = (window.NW_STATES.by[k] || {}).pop || 1;
      v[k] = perMillion ? n / pop : n;
    });
    return v;
  }

  window.NWMap = { heat: heat, cats: cats, cannabis: cannabis, panel: panel, values: values, SCALES: SCALES, CANNABIS_COLORS: CANNABIS_COLORS };
})();
