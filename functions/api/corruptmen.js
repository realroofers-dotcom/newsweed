// functions/api/corruptmen.js — BUILT 2026-09-29 · corruptmen-1a
//
// CorruptMen: one story a day on political and business corruption in a US town,
// embezzlement first.
//
// GET                         -> { today, archive: [...last 30 days] }
// POST ?admin=KEY {date?, title, link, source, place, summary}
//                             -> set (or replace) a day's story by hand
//
// How a day gets its story: the first GET of the day (New York time) picks the
// newest matching headline that has not run before, and stores it as that day's
// story. An editor can replace it any time with the POST above, and add a short
// written summary. Automatic picks carry the headline and the publisher only.
//
// KV binding: EMAIL_LIST   keys: cm:YYYY-MM-DD
// Env var:    TIP_ADMIN_KEY

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const GN = "hl=en-US&gl=US&ceid=US:en";
const KEEP_DAYS = 400;

// In order of preference: embezzlement first, then public and business corruption.
const QUERIES = [
  "embezzlement charged town OR city OR county OR treasurer OR clerk",
  "embezzled sentenced OR indicted OR charged",
  "mayor OR councilman OR commissioner indicted bribery OR corruption OR kickbacks",
  "business owner charged fraud embezzlement employees"
];

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }

function nyDate(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
}

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  if (!kv) return ok({ today: null, archive: [] });
  try {
    const today = nyDate();
    const archive = await readArchive(kv);
    let story = archive.find(a => a.date === today) || null;

    if (!story) {
      story = await pick(archive);
      if (story) {
        story.date = today;
        story.auto = true;
        await kv.put("cm:" + today, JSON.stringify(story), { expirationTtl: 60 * 60 * 24 * KEEP_DAYS });
        archive.unshift(story);
      }
    }
    return ok({ today: story, archive: archive.slice(0, 30) });
  } catch (err) {
    return ok({ today: null, archive: [] });
  }
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("admin");
  if (!context.env.TIP_ADMIN_KEY || key !== context.env.TIP_ADMIN_KEY) return ok({ success: false, error: "Not authorized." }, 401);
  try {
    const b = await context.request.json();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : nyDate();
    const title = clean(b.title, 200), link = clean(b.link, 500);
    if (!title || !/^https?:\/\//.test(link)) return ok({ success: false, error: "A title and a link to the reporting are required." });
    const rec = {
      date, title, link,
      source: clean(b.source, 80),
      place: clean(b.place, 80),
      summary: clean(b.summary, 700),
      auto: false
    };
    await context.env.EMAIL_LIST.put("cm:" + date, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * KEEP_DAYS });
    return ok({ success: true, story: rec });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong." });
  }
}

async function readArchive(kv) {
  const list = await kv.list({ prefix: "cm:" });
  const names = list.keys.map(k => k.name).sort().reverse().slice(0, 60);
  const recs = await Promise.all(names.map(n => kv.get(n)));
  return recs.map(r => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
}

async function pick(archive) {
  const used = new Set(archive.map(a => fp(a.title)));
  for (const q of QUERIES) {
    try {
      const res = await fetch("https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:3d") + "&" + GN, {
        headers: { "User-Agent": UA, "Accept": "application/rss+xml, text/xml, */*" }
      });
      if (!res.ok) continue;
      const items = parse(await res.text())
        .filter(it => !used.has(fp(it.title)))
        .sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
      if (items.length) return items[0];
    } catch (e) {}
  }
  return null;
}

function parse(xml) {
  const out = [];
  for (const part of String(xml).split("<item").slice(1)) {
    const chunk = part.split("</item>")[0];
    let title = tag(chunk, "title");
    const link = tag(chunk, "link");
    let source = tag(chunk, "source");
    if (!title || !/^https?:\/\//.test(link)) continue;
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    out.push({ title: title.slice(0, 200), link, source, place: "", summary: "", pubDate: tag(chunk, "pubDate") });
  }
  return out;
}

function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">"));
  if (!m) return "";
  return String(m[1]).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

function fp(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
