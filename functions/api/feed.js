// functions/api/feed.js — BUILT 2026-09-29 · feed-2a
//
// Every desk on the home page, in one call:  GET /api/feed
//   -> { sections: { top:[...], markets:[...], cannabis:[...], ... }, updated }
//
// Each section lists feeds in order. Normal sections take the first feed that
// returns headlines. Sections marked `merge` (tribal news) take a few from EVERY
// feed, so each outlet is credited on the page.
//
// Headlines and links only — never article text. Everything links out to the publisher.
//
// House rules, enforced here and not just hoped for:
//   - No promotion of alcohol or drug use: product, deal and "best strain" items are dropped.
//   - No medical hype: "miracle cure" style headlines are dropped.
//
// Diagnostics:  /api/feed?debug=1   shows what each feed returned (not cached).

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const GN = "hl=en-US&gl=US&ceid=US:en";
const CACHE_SECONDS = 600;

function gnTopic(t) { return "https://news.google.com/rss/headlines/section/topic/" + t + "?" + GN; }
function gnSearch(q) { return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&" + GN; }

const SECTIONS = [
  { key: "top", label: "Top story", take: 8,
    feeds: ["https://news.google.com/rss?" + GN, "https://feeds.npr.org/1001/rss.xml", "https://feeds.bbci.co.uk/news/rss.xml"] },
  { key: "markets", label: "Markets", take: 6,
    feeds: ["https://feeds.content.dowjones.io/public/rss/mw_topstories", "https://www.cnbc.com/id/15839069/device/rss/rss.html", gnSearch("stock market today")] },
  { key: "world", label: "World", take: 6,
    feeds: [gnTopic("WORLD"), "https://feeds.bbci.co.uk/news/world/rss.xml", "https://feeds.npr.org/1004/rss.xml"] },
  { key: "latam", label: "Latin America", take: 4,
    feeds: [gnSearch("Colombia OR Venezuela OR \"Latin America\" news"), "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml"] },
  { key: "cannabis", label: "Cannabis law", take: 6,
    feeds: [gnSearch("cannabis legalization OR \"medical marijuana\" law OR court OR legislature"), "https://www.marijuanamoment.net/feed/"] },
  { key: "crime", label: "Crime", take: 5,
    feeds: [gnSearch("crime arrested charged"), "https://www.cbsnews.com/latest/rss/crime"] },
  { key: "warrants", label: "Warrants", take: 5,
    feeds: [gnSearch("\"arrest warrant\" issued"), gnSearch("warrant arrest police")] },
  { key: "medical", label: "Medical", take: 5,
    feeds: ["https://www.sciencedaily.com/rss/health_medicine.xml", gnSearch("clinical trial results published study"), "https://feeds.npr.org/1128/rss.xml"] },
  { key: "wellness", label: "Holistic", take: 3,
    feeds: [gnSearch("study finds meditation OR yoga OR acupuncture OR nutrition OR exercise benefit")] },
  { key: "sports", label: "Sports", take: 5,
    feeds: [gnTopic("SPORTS"), "https://feeds.bbci.co.uk/sport/rss.xml"] },
  { key: "tribal", label: "Tribal nations", take: 3, merge: true,
    feeds: ["https://ictnews.org/feed", "https://nativenewsonline.net/feed", "https://www.aptnnews.ca/feed/"] }
];

// Promotion of alcohol or drug use, and deal/product copy. Dropped from every section.
const PROMO = /\b(coupons?|promo codes?|discounts?|deals?|on sale|best (strains?|edibles|vapes?|weed|cbd|thc|gummies|bourbons?|beers?|wines?|whiskeys?|cocktails?)|where to buy|buy (weed|cbd|thc)|happy hour|cocktail recipes?|drinking game|get high|stoner|420 (sale|deals?))\b/i;
// Medical hype. Dropped from medical and holistic.
const HYPE = /\b(miracle|cures? (cancer|diabetes|everything|all)|doctors (hate|are stunned)|one weird|secret (cure|remedy)|detox cleanse)\b/i;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.has("debug");
  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/api/feed?v=feed-2a");

  if (!debug) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const results = await Promise.allSettled(SECTIONS.map(s => fetchSection(s)));
  const sections = {};
  const log = {};
  const seen = new Set();

  results.forEach((r, i) => {
    const s = SECTIONS[i];
    const items = r.status === "fulfilled" ? r.value.items : [];
    if (debug) log[s.key] = r.status === "fulfilled" ? r.value.log : "failed: " + String(r.reason);
    // A headline appears in one section only.
    sections[s.key] = items.filter(it => {
      const fp = it.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
      if (!fp || seen.has(fp)) return false;
      seen.add(fp);
      return true;
    });
  });

  const payload = { sections, updated: new Date().toISOString(), build: "feed-2a" };
  if (debug) payload.debug = log;

  const res = new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": debug ? "no-store" : "public, max-age=" + CACHE_SECONDS
    }
  });
  if (!debug) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function fetchSection(s) {
  const log = [];
  const out = [];
  for (const feedUrl of s.feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*" },
        cf: { cacheTtl: 300 }
      });
      if (!res.ok) { log.push(host(feedUrl) + " HTTP " + res.status); continue; }
      const items = parseFeed(await res.text(), s)
        .filter(it => !PROMO.test(it.title))
        .filter(it => !((s.key === "medical" || s.key === "wellness") && HYPE.test(it.title)));
      log.push(host(feedUrl) + " -> " + items.length);
      if (s.merge) {
        out.push(...items.slice(0, s.take));
        continue;
      }
      if (items.length) return { items: items.slice(0, s.take), log };
    } catch (err) {
      log.push(host(feedUrl) + " error");
    }
  }
  out.sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
  return { items: out, log };
}

function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return String(u).slice(0, 30); }
}

const PUBLISHER_NAMES = {
  "ictnews.org": "ICT News",
  "nativenewsonline.net": "Native News Online",
  "aptnnews.ca": "APTN News",
  "sciencedaily.com": "ScienceDaily",
  "marijuanamoment.net": "Marijuana Moment",
  "cnbc.com": "CNBC",
  "marketwatch.com": "MarketWatch",
  "npr.org": "NPR",
  "bbc.co.uk": "BBC", "bbc.com": "BBC",
  "cbsnews.com": "CBS News"
};

// Handles both RSS (<item>) and Atom (<entry>). Workers have no DOM parser.
function parseFeed(xml, s) {
  const isAtom = xml.indexOf("<entry") > -1 && xml.indexOf("<item") === -1;
  const openTag = isAtom ? "<entry" : "<item";
  const closeTag = isAtom ? "</entry>" : "</item>";
  const items = [];

  for (const part of String(xml).split(openTag).slice(1)) {
    const chunk = part.split(closeTag)[0];
    const rawTitle = tag(chunk, "title");
    let link = tag(chunk, "link");
    if (!link) {
      const href = chunk.match(/<link[^>]*href=["']([^"']+)["']/);
      if (href) link = href[1];
    }
    if (!rawTitle || !link || !/^https?:\/\//.test(link)) continue;

    // Google News formats titles as "Headline - Publisher"
    let title = rawTitle;
    let publisher = tag(chunk, "source");
    const dashAt = title.lastIndexOf(" - ");
    if (!publisher && dashAt > 20) {
      publisher = title.slice(dashAt + 3).trim();
      title = title.slice(0, dashAt).trim();
    } else if (publisher && title.endsWith(" - " + publisher)) {
      title = title.slice(0, title.length - publisher.length - 3).trim();
    }
    if (!publisher) {
      const h = host(link);
      const k = Object.keys(PUBLISHER_NAMES).find(d => h === d || h.endsWith("." + d));
      publisher = k ? PUBLISHER_NAMES[k] : h;
    }

    items.push({
      section: s.key,
      label: s.label,
      title: truncate(title, 140),
      link,
      pubDate: toIso(tag(chunk, "pubDate") || tag(chunk, "published") || tag(chunk, "updated") || tag(chunk, "dc:date")),
      source: publisher
    });
  }
  return items;
}

function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">"));
  if (!m) return "";
  return decode(String(m[1]).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function decode(s) {
  let out = String(s).replace(/<[^>]+>/g, "");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
  }
  return out.replace(/\s+/g, " ");
}

function toIso(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d) ? "" : d.toISOString();
}

function truncate(str, maxLen) {
  str = String(str);
  return str.length <= maxLen ? str : str.slice(0, maxLen).trim() + "…";
}
