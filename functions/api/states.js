// functions/api/states.js — BUILT 2026-09-29 · states-1a · states-1b 2026-11-20 (latest: the state's own headlines, for the tap) · states-1d (the state's own papers via the press list worker, no Wikipedia)
//
// The 50-state desk, and the numbers behind the maps.
//   GET /api/states             -> { states: { NY: {...}, ... }, asOf }
//   GET /api/states?state=NY    -> { state: {...} }   (refreshes that state if it is stale)
//
// For each state:
//   top      the state's top story: headline, link, publisher, and the publisher's own summary (≤ 300 chars)
//   counts   how many of the state's recent headlines (about 3 days) are about crime, DUI, gambling, drugs,
//            and how many local-author/new-book stories ran in 30 days. This is NEWS HEAT, not crime
//            statistics: it measures what is being reported. The pages say so, and link the official data.
//   crime, dui, authors   a few of those headlines, for the panel that opens when a state is clicked.
//
// Refreshing 51 states at once would be ~150 fetches, far over a Worker's limit, so each request refreshes
// the few stalest states (REFRESH_PER_CALL) and everything is kept in KV (states:v1). Every visit keeps the
// map moving; a state is refreshed when its data is older than STALE_HOURS.

import { STATE_NAMES, isState } from "../_lib/states.js";
import { gnSearch, bing, firstFeed, fetchFeed, clean, fingerprint } from "../_lib/rss.js";

const KEY = "states:v1";
const STALE_HOURS = 3;
const REFRESH_PER_CALL = 4;

const QNAME = { WA: "Washington State", DC: "Washington D.C.", GA: "Georgia" };

const RX = {
  crime: /\b(murder\w*|killed|killing|shooting|shot|stabb\w*|robber\w*|assault\w*|arrest\w*|charged|burglar\w*|homicide|indicted|carjack\w*|kidnap\w*|police|sheriff)\b/i,
  dui: /\b(DUI|DWI|OWI|OVI|drunk|impaired driv\w*|intoxicated|under the influence)\b/i,
  gambling: /\b(gambl\w*|casino\w*|betting|sportsbook\w*|lottery|wager\w*|slot machines?|poker)\b/i,
  drugs: /\b(overdos\w*|fentanyl|drugs?|narcotic\w*|opioid\w*|meth\w*|heroin|cocaine|trafficking)\b/i
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj) { return new Response(JSON.stringify(obj), { headers: JSON_HEADERS }); }

async function load(kv) {
  try { return JSON.parse((await kv.get(KEY)) || "{}"); } catch (e) { return {}; }
}

function isStale(rec) {
  return !rec || !rec.updated || Date.now() - Date.parse(rec.updated) > STALE_HOURS * 3600 * 1000;
}

async function refresh(code) {
  const name = QNAME[code] || STATE_NAMES[code];
  const [top, sig, auth] = await Promise.all([
    firstFeed([bing(name + " news"), gnSearch("\"" + name + "\" when:1d")]),
    firstFeed([
      gnSearch("\"" + name + "\" when:3d (crime OR arrested OR shooting OR murder OR DUI OR \"drunk driving\" OR gambling OR casino OR overdose OR fentanyl OR drugs)"),
      bing(name + " crime arrest DUI gambling overdose")
    ]),
    firstFeed([gnSearch("\"" + name + "\" author \"new book\" when:30d"), bing(name + " local author new book")])
  ]);

  const topItems = clean(top.items).filter(it => it.snippet || it.title);
  const t = topItems.find(it => it.snippet) || topItems[0] || null;

  const seen = new Set();
  const sigItems = clean(sig.items).filter(it => { const f = fingerprint(it.title); if (seen.has(f)) return false; seen.add(f); return true; });
  const counts = { crime: 0, dui: 0, gambling: 0, drugs: 0, authors: clean(auth.items).length, sample: sigItems.length };
  const pick = { crime: [], dui: [], gambling: [], drugs: [] };
  for (const it of sigItems) {
    const text = it.title + " " + (it.snippet || "");
    for (const k of Object.keys(RX)) {
      if (RX[k].test(text)) {
        counts[k]++;
        if (pick[k].length < 4) pick[k].push(small(it));
      }
    }
  }

  return {
    code, name: STATE_NAMES[code],
    top: t ? { title: t.title, link: t.link, source: t.source, pubDate: t.pubDate, story: t.snippet || "" } : null,
    counts,
    crime: pick.crime, dui: pick.dui, gambling: pick.gambling, drugs: pick.drugs,
    authors: clean(auth.items).slice(0, 4).map(small),
    /* states-1b (2026-11-20, Mark: 'when i press a state i should get the news for that state'): the state's latest headlines */
    latest: topItems.slice(0, 8).map(it => Object.assign(small(it), { story: String(it.snippet || "").slice(0, 240) })),
    updated: new Date().toISOString()
  };
}

function small(it) { return { title: it.title, link: it.link, source: it.source, pubDate: it.pubDate }; }

/* states-1c (2026-11-20, Mark: 'not just one story all the stories we can aggreagate'): when a state is tapped, every story
   we can gather for it - Bing News and Google News, four searches, newest first, duplicates removed - kept 1 hour per state
   (KV statenews:<code>). Headlines, publisher and link only, as everywhere on Newsweed. */
async function stateNews(kv, code) {
  const key = "statenews:" + code;
  try { const c = JSON.parse((await kv.get(key)) || "null"); if (c && Date.now() - Date.parse(c.at) < 3600 * 1000) return c.items; } catch (e) {}
  const name = QNAME[code] || STATE_NAMES[code];
  const urls = [bing(name + " news"), gnSearch("\"" + name + "\"", 2), bing(name + " local news today"),
    gnSearch("\"" + name + "\" (governor OR county OR city OR police OR school OR court OR legislature)", 3)];
  /* states-1d (2026-11-20, Mark: "why not search asbury park press for nj or the local papers" / "there are many more newspapeers
     nationwide" / "stop using wilipedia"): the state's OWN papers and news sites, from the press list worker (ABYZ News Links +
     Mark's adds, no Wikipedia), searched 10 sites at a time on Google News, up to 60 sites. */
  try {
    const r = await fetch("https://presslist.realroofers.workers.dev/?statesites=" + code, { cf: { cacheTtl: 3600 } });
    const j = r.ok ? await r.json() : null;
    const hosts = ((j && j.list) || []).map(s => s.host).filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h)).slice(0, 60);
    for (let i = 0; i < hosts.length; i += 10) urls.push(gnSearch(hosts.slice(i, i + 10).map(h => "site:" + h).join(" OR "), 3));
  } catch (e) {}
  const got = await Promise.allSettled(urls.map(u => fetchFeed(u)));
  const seen = new Set(), items = [];
  for (const g of got) {
    if (g.status !== "fulfilled") continue;
    for (const it of clean(g.value)) {
      if (/ - USA Today$/i.test(it.title || "")) continue;   /* national wire copies carried by local papers */
      const fp = fingerprint(it.title); if (!it.title || !it.link || seen.has(fp)) continue;
      seen.add(fp); items.push(Object.assign(small(it), { story: String(it.snippet || "").slice(0, 240) }));
    }
  }
  items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  const keep = items.slice(0, 80);
  if (keep.length) await kv.put(key, JSON.stringify({ at: new Date().toISOString(), items: keep }));
  return keep;
}

export async function onRequestGet(context) {  const kv = context.env.EMAIL_LIST;
  const url = new URL(context.request.url);
  if (!kv) return ok({ states: {} });
  const all = await load(kv);
  const one = (url.searchParams.get("state") || "").toUpperCase();

  if (one) {
    if (!isState(one)) return ok({ error: "Unknown state." });
    if (isStale(all[one]) || !all[one].latest) {
      try {
        all[one] = await refresh(one);
        await kv.put(KEY, JSON.stringify(all));
      } catch (e) {}
    }
    let news = [];
    try { news = await stateNews(kv, one); } catch (e) {}
    return ok({ state: all[one] ? Object.assign({}, all[one], { news }) : (news.length ? { code: one, name: STATE_NAMES[one], news, counts: {} } : null) });
  }

  // Refresh the stalest few, oldest first (never-fetched states come first).
  const due = Object.keys(STATE_NAMES)
    .filter(c => isStale(all[c]))
    .sort((a, b) => (Date.parse((all[a] || {}).updated || 0) || 0) - (Date.parse((all[b] || {}).updated || 0) || 0))
    .slice(0, REFRESH_PER_CALL);
  if (due.length) {
    const fresh = await Promise.allSettled(due.map(refresh));
    let changed = false;
    fresh.forEach((r, i) => { if (r.status === "fulfilled") { all[due[i]] = r.value; changed = true; } });
    if (changed) await kv.put(KEY, JSON.stringify(all));
  }

  const staleLeft = Object.keys(STATE_NAMES).filter(c => isStale(all[c])).length;
  return ok({ states: all, staleLeft, asOf: new Date().toISOString(), method: "news-heat-3d" });
}
