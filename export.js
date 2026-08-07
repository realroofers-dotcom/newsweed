// functions/api/export.js
// Password-protected CSV export of everything stored in KV.
//
//   /api/export?admin=YOUR_KEY&type=emails       -> email signups + giveaway entries
//   /api/export?admin=YOUR_KEY&type=journalists  -> roster: name, email, beat, location, link
//   /api/export?admin=YOUR_KEY&type=tips         -> submitted tips, approved and pending
//
// Uses the same TIP_ADMIN_KEY you set in Cloudflare, and the same EMAIL_LIST binding.
// Easiest way in: newsweed.com/tips-admin.html — enter your key, click a download button.

function csvCell(v) {
  const s = v === undefined || v === null ? "" : String(v);
  // Quote anything containing a comma, quote, or newline; double up inner quotes.
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvFile(headers, rows, filename) {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // BOM so Excel opens accented characters correctly
  const body = "\uFEFF" + lines.join("\r\n");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "no-store"
    }
  });
}

function deny(msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function readAll(env, prefix) {
  const out = [];
  let cursor = undefined;
  while (true) {
    const page = await env.EMAIL_LIST.list(prefix ? { prefix, cursor } : { cursor });
    for (const k of page.keys) {
      const raw = await env.EMAIL_LIST.get(k.name);
      let parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      }
      out.push({ key: k.name, raw: raw || "", data: parsed });
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return out;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("admin");

  if (!context.env.TIP_ADMIN_KEY) {
    return deny("No admin key is configured on this project.");
  }
  if (!key || key !== context.env.TIP_ADMIN_KEY) {
    return deny("Not authorized.");
  }

  const type = (url.searchParams.get("type") || "emails").toLowerCase();

  try {
    // ---- Journalist roster ----
    if (type === "journalists") {
      const recs = await readAll(context.env, "journalist:");
      const rows = recs
        .map(r => r.data || {})
        .sort((a, b) => (String(a.signedUp) < String(b.signedUp) ? 1 : -1))
        .map(d => [d.name, d.email, d.beat, d.location, d.link, d.country, d.signedUp]);
      return csvFile(
        ["Name", "Email", "Beat", "Location", "Link to work", "Country", "Signed up"],
        rows,
        "newsweed-journalists-" + stamp() + ".csv"
      );
    }

    // ---- Tips ----
    if (type === "tips") {
      const recs = await readAll(context.env, "tip:");
      const rows = recs
        .map(r => r.data || {})
        .sort((a, b) => (String(a.submitted) < String(b.submitted) ? 1 : -1))
        .map(d => [d.submitted, d.status, d.place, d.headline, d.details, d.link, d.name, d.email]);
      return csvFile(
        ["Submitted", "Status", "Region", "Headline", "Details", "Source link", "From", "Email"],
        rows,
        "newsweed-tips-" + stamp() + ".csv"
      );
    }

    // ---- Email list (everything that isn't a journalist, tip, or rate-limit marker) ----
    const recs = await readAll(context.env, null);
    const rows = recs
      .filter(r =>
        !r.key.startsWith("journalist:") &&
        !r.key.startsWith("tip:") &&
        !r.key.startsWith("tipgate:")
      )
      .map(r => {
        const d = r.data || {};
        // subscribe.js may store either a JSON record or a plain string —
        // fall back to the key itself, which is the email address.
        const email = d.email || (r.key.indexOf("@") > -1 ? r.key.replace(/^[^:]*:/, "") : r.key);
        const when = d.subscribed || d.signedUp || d.date || d.timestamp || "";
        const source = d.source || "";
        return [email, source, d.country || "", when];
      })
      .sort((a, b) => (String(a[3]) < String(b[3]) ? 1 : -1));

    return csvFile(
      ["Email", "Source", "Country", "Signed up"],
      rows,
      "newsweed-emails-" + stamp() + ".csv"
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Export failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
