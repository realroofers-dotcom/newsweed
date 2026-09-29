// functions/api/corruptmen.js — BUILT 2026-09-29 · corruptmen-1c (relevance + US-only check; bad auto picks re-picked)
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
  "embezzlement charged treasurer OR clerk OR bookkeeper OR township OR county",
  "embezzled charged OR indicted OR sentenced",
  "official charged bribery OR kickbacks OR corruption",
  "charged embezzling from employer OR nonprofit OR church OR school"
];

// A pick must be about corruption, and about the United States. (29 Sep 2026: the loose search once
// picked "Ex-Hiscox chief executive set for City of London mayoralty". Never again.)
const ON_TOPIC = /\b(embezzl\w*|brib\w*|kickbacks?|corrupt\w*|misappropriat\w*|stole|stealing|theft|fraud\w*|extort\w*|money laundering|misuse of (public )?funds|pleads? guilty|indicted|charged|sentenced|convicted|arrested)\b/i;
const MONEY_CRIME = /\b(embezzl\w*|brib\w*|kickbacks?|corrupt\w*|misappropriat\w*|stole|stealing|theft|fraud\w*|extort\w*|money laundering|misuse of (public )?funds)\b/i;
const FOREIGN = /\b(London|U\.?K\.?|Britain|British|England|Scotland|Wales|Ireland|India|Pakistan|Bangladesh|Nigeria|Kenya|Ghana|South Africa|Australia|New Zealand|Canada|Canadian|Ontario|Philippines|China|Chinese|Malaysia|Singapore|Indonesia|Russia|Ukraine|Israel|Mexico|Brazil|Argentina|EU|European)\b/i;
function relevant(title) { return MONEY_CRIME.test(title) && ON_TOPIC.test(title) && !FOREIGN.test(title); }

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
    // An automatic pick that fails the relevance test is thrown out and picked again. Hand-set stories stay.
    const badAuto = story && story.auto && !relevant(story.title);
    if (badAuto) {
      archive.splice(archive.indexOf(story), 1);
      story = null;
    }
    // Earlier days' bad automatic picks are hidden from the archive list too.
    for (let i = archive.length - 1; i >= 0; i--) if (archive[i].auto && !relevant(archive[i].title)) archive.splice(i, 1);

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

// Google News refuses Cloudflare now and then (HTTP 503), so each query is tried
// on Google, once more on Google, then on Bing News.
function sourcesFor(q) {
  const g = "https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:3d") + "&" + GN;
  const b = "https://www.bing.com/news/search?format=rss&q=" + encodeURIComponent(q.replace(/ OR /g, " "));
  return [g, g, b];
}

async function pick(archive) {
  const used = new Set(archive.map(a => fp(a.title)));
  for (const q of QUERIES) {
    for (const src of sourcesFor(q)) {
      try {
        const res = await fetch(src, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, text/xml, */*" } });
        if (!res.ok) continue;
        const items = parse(await res.text())
          .filter(it => relevant(it.title))
          .filter(it => !used.has(fp(it.title)))
          .sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
        if (items.length) return items[0];
        break; // the source answered; this query simply has nothing new
      } catch (e) {}
    }
  }
  return null;
}

function parse(xml) {
  const out = [];
  for (const part of String(xml).split("<item").slice(1)) {
    const chunk = part.split("</item>")[0];
    let title = tag(chunk, "title");
    let link = tag(chunk, "link");
    let source = tag(chunk, "source") || tag(chunk, "News:Source");
    if (!title || !/^https?:\/\//.test(link)) continue;
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    // Bing wraps the publisher's link in a click-tracker; keep the publisher's own link.
    if (/bing\.com\/news\/apiclick/.test(link)) {
      try { link = new URL(link).searchParams.get("url") || link; } catch (e) {}
    }
    source = source.replace(/ on MSN$/, "");
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
