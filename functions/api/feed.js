// functions/api/feed.js — BUILT 2026-09-29 · feed-3b (+ nomad group)
//
// Every desk, grouped so no single call fetches too much:
//   GET /api/feed                 -> the home page desks
//   GET /api/feed?group=farm      -> farm, 4-H, garden        (also: family, books, college, arts, gambling, dui, nomad)
//   -> { group, sections: { key:[{title,link,source,pubDate,snippet,section,label}] }, updated }
//
// Normal sections take the first feed that returns headlines. `merge` sections take a few from
// EVERY feed so each outlet is credited (tribal nations, 4-H and farm).
//
// EVERYTHING IS ARCHIVED: each group's headlines are added to that day's archive
// (KV arch:YYYY-MM-DD:group, kept forever), read back by /api/archive and /archive.html.
//
// House rules (enforced in _lib/rss.js): no promotion of alcohol, drug use or betting;
// no medical hype. Headlines and links only; everything links out to the publisher.
//
// Diagnostics: /api/feed?group=farm&debug=1

import { gnTopic, gnSearch, bing, firstFeed, fetchFeed, clean, fingerprint, host } from "../_lib/rss.js";

const GN = "hl=en-US&gl=US&ceid=US:en";
const CACHE_SECONDS = 900;

function season() {
  const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric" }).format(new Date()));
  if (m >= 3 && m <= 5) return { name: "Spring", q: "spring planting OR spring festival OR graduation" };
  if (m >= 6 && m <= 8) return { name: "Summer", q: "summer festival OR county fair OR summer camp" };
  if (m >= 9 && m <= 11) return { name: "Fall", q: "fall harvest festival OR fall foliage OR homecoming" };
  return { name: "Winter", q: "winter storm OR holiday OR winter festival" };
}

const GROUPS = {
  home: [
    { key: "top", label: "Top story", take: 8, feeds: ["https://news.google.com/rss?" + GN, "https://feeds.npr.org/1001/rss.xml", "https://feeds.bbci.co.uk/news/rss.xml"] },
    { key: "markets", label: "Markets", take: 6, feeds: ["https://feeds.content.dowjones.io/public/rss/mw_topstories", "https://www.cnbc.com/id/15839069/device/rss/rss.html", gnSearch("stock market today")] },
    { key: "world", label: "World", take: 6, feeds: [gnTopic("WORLD"), "https://feeds.bbci.co.uk/news/world/rss.xml", "https://feeds.npr.org/1004/rss.xml"] },
    { key: "latam", label: "Latin America", take: 4, feeds: [gnSearch("Colombia OR Venezuela OR \"Latin America\" news"), "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml"] },
    { key: "cannabis", label: "Cannabis law", take: 6, feeds: [gnSearch("cannabis legalization OR \"medical marijuana\" law OR court OR legislature"), "https://www.marijuanamoment.net/feed/"] },
    { key: "crime", label: "Crime", take: 5, feeds: [gnSearch("crime arrested charged"), "https://www.cbsnews.com/latest/rss/crime"] },
    { key: "warrants", label: "Warrants", take: 5, feeds: [gnSearch("\"arrest warrant\" issued"), bing("arrest warrant issued")] },
    { key: "medical", label: "Medical", take: 5, medical: true, feeds: ["https://www.sciencedaily.com/rss/health_medicine.xml", gnSearch("clinical trial results published study"), "https://feeds.npr.org/1128/rss.xml"] },
    { key: "wellness", label: "Holistic", take: 3, medical: true, feeds: [gnSearch("study finds meditation OR yoga OR acupuncture OR nutrition OR exercise benefit")] },
    { key: "sports", label: "Sports", take: 5, feeds: [gnTopic("SPORTS"), "https://feeds.bbci.co.uk/sport/rss.xml"] },
    { key: "tribal", label: "Tribal nations", take: 3, merge: true, feeds: ["https://ictnews.org/feed", "https://nativenewsonline.net/feed", "https://www.aptnnews.ca/feed/"] }
  ],
  farm: [
    { key: "farm", label: "Farm news", take: 4, merge: true, feeds: ["https://www.farmprogress.com/rss.xml", "https://modernfarmer.com/feed/", gnSearch("farmers crop harvest USDA")] },
    { key: "fourh", label: "4-H & FFA", take: 5, merge: true, feeds: ["https://4-h.org/feed/", gnSearch("4-H club county fair OR FFA chapter")] },
    { key: "garden", label: "Gardening", take: 4, merge: true, feeds: ["https://www.gardeningknowhow.com/feed", "https://www.gardenersworld.com/feed/"] },
    { key: "rural", label: "Farm communities", take: 6, feeds: [gnSearch("rural community farm family OR farmers market OR agricultural fair"), bing("farm community news")] }
  ],
  family: [
    { key: "kids", label: "Amazing kids", take: 6, feeds: [gnSearch("student OR teen OR kid honored OR hero OR wins OR invents OR saves"), bing("amazing kid local news")] },
    { key: "laxboys", label: "Boys' & men's lacrosse", take: 6, feeds: [gnSearch("boys lacrosse OR men's lacrosse high school OR college"), bing("boys lacrosse high school")] },
    { key: "laxgirls", label: "Girls' & women's lacrosse", take: 6, feeds: [gnSearch("girls lacrosse OR women's lacrosse high school OR college"), bing("girls lacrosse high school")] },
    { key: "youth", label: "Youth sports", take: 6, feeds: [gnSearch("youth sports OR little league OR high school state championship"), bing("youth sports local")] },
    { key: "family", label: "Family", take: 4, feeds: [gnSearch("families parenting children community"), bing("family community news")] }
  ],
  books: [
    { key: "books", label: "Books", take: 4, merge: true, feeds: ["https://feeds.npr.org/1032/rss.xml", "https://lithub.com/feed/", "https://www.publishersweekly.com/pw/feeds/recent/index.xml"] },
    { key: "authors", label: "Local authors", take: 6, feeds: [gnSearch("\"local author\" new book"), bing("local author new book")] },
    { key: "library", label: "Libraries", take: 6, feeds: [gnSearch("public library"), bing("public library news")] }
  ],
  college: [
    { key: "college", label: "Colleges", take: 6, merge: true, feeds: ["https://www.insidehighered.com/rss.xml", "https://hechingerreport.org/feed/"] },
    { key: "schools", label: "Schools", take: 6, feeds: ["https://www.the74million.org/feed/", gnSearch("school district students teachers")] },
    { key: "backtoschool", label: "Back to school", take: 5, feeds: [gnSearch("back to school students welcome"), bing("back to school")] },
    { key: "campus", label: "College sports", take: 5, feeds: [gnSearch("college football OR college basketball OR NCAA"), bing("NCAA")] },
    { key: "season", label: "The season", take: 5, seasonal: true, feeds: [] }
  ],
  arts: [
    { key: "music", label: "Music", take: 6, feeds: ["https://feeds.npr.org/1039/rss.xml", gnSearch("new music album release")] },
    { key: "arts", label: "Arts", take: 5, feeds: ["https://feeds.npr.org/1008/rss.xml", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"] },
    { key: "screen", label: "Film & TV", take: 5, feeds: [gnTopic("ENTERTAINMENT"), gnSearch("film festival OR new movie OR TV series")] },
    { key: "local", label: "Local stages & galleries", take: 5, feeds: [gnSearch("community theater OR art exhibit OR local band OR gallery opening"), bing("community theater art exhibit")] }
  ],
  gambling: [
    { key: "gambling", label: "Gambling", take: 6, feeds: ["https://www.legalsportsreport.com/feed/", "https://www.casino.org/news/feed/", gnSearch("gambling law OR sports betting OR casino")] },
    { key: "problem", label: "Problem gambling", take: 5, feeds: [gnSearch("\"problem gambling\" OR \"gambling addiction\""), bing("gambling addiction")] },
    { key: "crimeg", label: "Gambling & crime", take: 5, feeds: [gnSearch("illegal gambling arrested OR charged OR embezzled gambling"), bing("illegal gambling arrest")] }
  ],
  nomad: [
    { key: "nomad", label: "Nomad life", take: 6, feeds: [gnSearch("full-time RV OR \"van life\" OR \"digital nomad\" OR \"full-time travelers\""), bing("full-time RV living")] },
    { key: "sd", label: "South Dakota & nomads", take: 5, feeds: [gnSearch("South Dakota residency OR domicile RV OR nomads OR \"full-time travelers\""), bing("South Dakota residency full-time travelers")] },
    { key: "road", label: "On the road", take: 5, feeds: [gnSearch("campgrounds OR national parks OR road trip travel news"), bing("campground national park news")] }
  ],
  dui: [
    { key: "dui", label: "DUI crashes", take: 8, feeds: [gnSearch("DUI crash OR \"drunk driver\" killed OR charged"), bing("DUI crash")] },
    { key: "arrests", label: "DUI arrests & sentences", take: 6, feeds: [gnSearch("DUI sentenced OR vehicular homicide OR impaired driving charged"), bing("DUI sentenced")] },
    { key: "madd", label: "Prevention", take: 4, feeds: ["https://www.madd.org/feed/", gnSearch("impaired driving prevention")] }
  ]
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.has("debug");
  const group = GROUPS[url.searchParams.get("group")] ? url.searchParams.get("group") : "home";
  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/api/feed?v=feed-3a&group=" + group);

  if (!debug) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const defs = GROUPS[group].map(s => s.seasonal ? Object.assign({}, s, { label: season().name, feeds: [gnSearch(season().q), bing(season().q.replace(/ OR /g, " "))] }) : s);
  const results = await Promise.allSettled(defs.map(s => fetchSection(s)));
  const sections = {};
  const log = {};
  const seen = new Set();

  results.forEach((r, i) => {
    const s = defs[i];
    const items = r.status === "fulfilled" ? r.value.items : [];
    if (debug) log[s.key] = r.status === "fulfilled" ? r.value.log : "failed: " + String(r.reason);
    sections[s.key] = items.filter(it => {
      const fp = fingerprint(it.title);
      if (!fp || seen.has(fp)) return false;
      seen.add(fp);
      return true;
    }).map(it => Object.assign(it, { section: s.key, label: s.label }));
  });

  const payload = { group, sections, updated: new Date().toISOString(), build: "feed-3a" };
  if (group === "college") payload.season = season().name;
  if (debug) payload.debug = log;

  const res = new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": debug ? "no-store" : "public, max-age=" + CACHE_SECONDS }
  });
  if (!debug) {
    context.waitUntil(cache.put(cacheKey, res.clone()));
    if (context.env.EMAIL_LIST) context.waitUntil(archive(context.env.EMAIL_LIST, group, sections).catch(() => {}));
  }
  return res;
}

async function fetchSection(s) {
  if (!s.merge) {
    const r = await firstFeed(s.feeds);
    return { items: clean(r.items, s).slice(0, s.take), log: r.log };
  }
  const log = [];
  const all = await Promise.all(s.feeds.map(async u => {
    try {
      const items = clean(await fetchFeed(u), s);
      log.push(host(u) + " -> " + items.length);
      return items.slice(0, s.take);
    } catch (e) { log.push(host(u) + " " + e.message); return []; }
  }));
  const out = [].concat.apply([], all);
  out.sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
  return { items: out, log };
}

// Add today's headlines to the day's archive. Kept forever; up to 80 per section per day.
async function archive(kv, group, sections) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const key = "arch:" + day + ":" + group;
  let rec = {};
  try { rec = JSON.parse((await kv.get(key)) || "{}"); } catch (e) { rec = {}; }
  let added = 0;
  for (const k of Object.keys(sections)) {
    const have = rec[k] || [];
    const fps = new Set(have.map(x => fingerprint(x.title)));
    for (const it of sections[k]) {
      if (fps.has(fingerprint(it.title)) || have.length >= 80) continue;
      have.push({ title: it.title, link: it.link, source: it.source, pubDate: it.pubDate, label: it.label });
      fps.add(fingerprint(it.title));
      added++;
    }
    rec[k] = have;
  }
  if (added) await kv.put(key, JSON.stringify(rec));
}
