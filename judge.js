/* judge.js — BUILT 2026-09-29 · judge-1a
   The contest judging panel. Used on tips-admin.html (the editor) and desk.html (every approved contributor),
   so judging goes on without the editor. Staff can: listen to and ACCEPT Music Is News entries (then they are
   featured on Arts & Music), SCORE any entry 1–10, and (editor only) remove or restore an entry.
   Usage: NWJudge.mount(element, function () { return "admin=KEY" or "key=DESK_KEY"; }) */

(function () {
  var CONTESTS = [["cartoon", "Cartoon & Comic"], ["music", "Music Is News"], ["photo", "Photography"], ["poetry", "Poetry"], ["tattoo", "Tattoo"]];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function yt(link) { var m = String(link).match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,20})/); return m ? m[1] : ""; }

  function mount(el, auth) {
    el.innerHTML = '<p style="font-size:13.5px;color:#45473f;margin:0 0 8px">Score entries 1 to 10 (half of the result; readers\' votes are the other half). '
      + '<b>Music Is News</b> entries appear only after a staff member has listened and pressed <b>Accept</b>: reject anything with violence, the N-word or other slurs. Accepted songs are featured on Arts &amp; Music.</p>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + CONTESTS.map(function (c) {
          return '<button type="button" data-jc="' + c[0] + '" style="border:1px solid #ccc;background:#fff;border-radius:4px;padding:7px 10px;cursor:pointer;font-weight:600">' + c[1] + '</button>';
        }).join("") + '</div><div data-jout></div>';
    var out = el.querySelector("[data-jout]");

    function load(c) {
      out.innerHTML = "Loading…";
      fetch("/api/contests?c=" + c + "&staff=1&" + auth(), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
        var es = d.entries || [];
        if (!es.length) { out.innerHTML = "<p>No entries yet.</p>"; return; }
        out.innerHTML = es.map(function (e) {
          var media = e.hasImage ? '<img src="/api/contests?img=' + encodeURIComponent(e.id) + '" style="max-width:100%;max-height:260px;display:block;margin:6px 0">' : "";
          if (e.link) media = yt(e.link) ? '<iframe width="100%" height="200" src="https://www.youtube-nocookie.com/embed/' + yt(e.link) + '" allowfullscreen style="border:0;margin:6px 0"></iframe>' : '<p><a href="' + esc(e.link) + '" target="_blank" rel="noopener">Listen →</a></p>';
          if (e.text) media = '<div style="white-space:pre-line;background:#fff;border:1px solid #e0e0d6;padding:8px;margin:6px 0;max-height:220px;overflow:auto">' + esc(e.text) + '</div>';
          var scores = Object.keys(e.scores || {}).map(function (k) { return esc(k) + ": " + e.scores[k]; }).join(", ");
          return '<div style="border:1px solid #e0e0d6;border-radius:8px;padding:12px;margin-bottom:10px;background:' + (e.pending ? "#fff7e6" : e.hidden ? "#fdecea" : "#f5f5f0") + '" data-jid="' + esc(e.id) + '">'
            + '<b>' + esc(e.title) + '</b> · by ' + esc(e.name) + (e.credit ? " · " + esc(e.credit) : "") + ' · ' + esc(e.votes) + ' votes'
            + (e.pending ? ' · <b style="color:#95590b">WAITING FOR ACCEPTANCE</b>' : "") + (e.hidden ? ' · <b style="color:#b3261e">HIDDEN (' + esc(e.reports) + ' reports)</b>' : "")
            + media + '<div style="font-size:12px;color:#6b6b5e">Staff scores: ' + (scores || "none yet") + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">'
            + (e.pending ? '<button type="button" data-ja="accept" style="background:#0f9d58;color:#fff;border:0;border-radius:4px;padding:7px 12px;font-weight:600;cursor:pointer">Accept (feature on Arts)</button>' : "")
            + '<select data-js>' + [""].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(function (n) { return '<option value="' + n + '">' + (n ? n + "/10" : "Score…") + '</option>'; }).join("") + '</select>'
            + '<button type="button" data-ja="score" style="border:1px solid #ccc;background:#fff;border-radius:4px;padding:6px 10px;cursor:pointer">Save score</button>'
            + '<button type="button" data-ja="' + (e.hidden ? "restore" : "remove") + '" style="border:1px solid #d9c2c2;background:#fff;color:#9b2226;border-radius:4px;padding:6px 10px;cursor:pointer">' + (e.hidden ? "Restore" : "Remove") + '</button>'
            + '<span data-jst style="font-size:12px"></span></div></div>';
        }).join("");
      }).catch(function () { out.innerHTML = "<p>Couldn't load. Check your key.</p>"; });
    }

    var current = "cartoon";
    el.addEventListener("click", function (ev) {
      var t = ev.target, c = t.getAttribute("data-jc");
      if (c) { current = c; load(c); return; }
      var act = t.getAttribute("data-ja"); if (!act) return;
      var card = t.closest("[data-jid]"), st = card.querySelector("[data-jst]");
      var body = { action: act, c: current, id: card.getAttribute("data-jid") };
      if (act === "score") { body.score = card.querySelector("[data-js]").value; if (!body.score) { st.textContent = "Pick a score."; return; } }
      if (act === "remove" && !confirm("Remove this entry?")) return;
      fetch("/api/contests?" + auth(), { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); }).then(function (r) { st.textContent = r.success ? "Saved." : (r.error || "Failed."); if (r.success && act !== "score") load(current); });
    });
  }
  window.NWJudge = { mount: mount };
})();
