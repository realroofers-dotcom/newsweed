// functions/_lib/rss.js — BUILT 2026-09-29 · rss-lib-1a
// Reads RSS and Atom from publishers, Google News and Bing News into one shape:
//   { title, link, source, pubDate, snippet }
// Headlines, links and the publisher's own short description only — never article text.

export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const GN = "hl=en-US&gl=US&ceid=US:en";

export function gnTopic(t) { return "https://news.google.com/rss/headlines/section/topic/" + t + "?" + GN; }
export function gnSearch(q) { return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&" + GN; }
export function bing(q) { return "https://www.bing.com/news/search?format=rss&q=" + encodeURIComponent(q); }

// Promotion of alcohol or drug use, and deal/product copy. Dropped everywhere.
export const PROMO = /\b(coupons?|promo codes?|discounts?|deals?|on sale|best (strains?|edibles|vapes?|weed|cbd|thc|gummies|bourbons?|beers?|wines?|whiske?ys?|cocktails?)|where to buy|buy (weed|cbd|thc)|happy hour|cocktail recipes?|drinking game|get high|stoner|420 (sale|deals?)|sportsbook promo|bonus code|free bets?|odds boost)\b/i;
// Medical hype.
export const HYPE = /\b(miracle|cures? (cancer|diabetes|everything|all)|doctors (hate|are stunned)|one weird|secret (cure|remedy)|detox cleanse)\b/i;

const NAMES = {
  "ictnews.org": "ICT News", "nativenewsonline.net": "Native News Online", "aptnnews.ca": "APTN News",
  "sciencedaily.com": "ScienceDaily", "marijuanamoment.net": "Marijuana Moment", "cnbc.com": "CNBC",
  "marketwatch.com": "MarketWatch", "dowjones.io": "MarketWatch", "npr.org": "NPR", "bbc.co.uk": "BBC", "bbc.com": "BBC",
  "cbsnews.com": "CBS News", "4-h.org": "4-H", "farmprogress.com": "Farm Progress", "modernfarmer.com": "Modern Farmer",
  "gardeningknowhow.com": "Gardening Know How", "gardenersworld.com": "Gardeners' World", "lithub.com": "Lit Hub",
  "publishersweekly.com": "Publishers Weekly", "bookriot.com": "Book Riot", "insidehighered.com": "Inside Higher Ed",
  "hechingerreport.org": "The Hechinger Report", "the74million.org": "The 74", "legalsportsreport.com": "Legal Sports Report",
  "casino.org": "Casino.org", "madd.org": "MADD"
};

export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
}
function publisherFor(link) {
  const h = host(link);
  const k = Object.keys(NAMES).find(d => h === d || h.endsWith("." + d));
  return k ? NAMES[k] : h;
}

export async function fetchFeed(url, opts) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*" },
    cf: { cacheTtl: (opts && opts.cacheTtl) || 300 }
  });
  if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
  return parseFeed(await res.text());
}

// Try each url in turn; return the first that gives items.
export async function firstFeed(urls, opts) {
  const log = [];
  for (const u of urls) {
    try {
      const items = await fetchFeed(u, opts);
      log.push(host(u) + " -> " + items.length);
      if (items.length) return { items, log };
    } catch (e) { log.push(host(u) + " " + e.message); }
  }
  return { items: [], log };
}

export function parseFeed(xml) {
  xml = String(xml);
  const isAtom = xml.indexOf("<entry") > -1 && xml.indexOf("<item") === -1;
  const openTag = isAtom ? "<entry" : "<item";
  const closeTag = isAtom ? "</entry>" : "</item>";
  const items = [];

  for (const part of xml.split(openTag).slice(1)) {
    const chunk = part.split(closeTag)[0];
    const rawTitle = tag(chunk, "title");
    let link = tag(chunk, "link");
    if (!link) {
      const href = chunk.match(/<link[^>]*href=["']([^"']+)["']/);
      if (href) link = href[1];
    }
    if (!rawTitle || !/^https?:\/\//.test(link)) continue;

    // Bing wraps the publisher's link in a click-tracker; keep the publisher's own link.
    if (/bing\.com\/news\/apiclick/.test(link)) {
      try { link = new URL(link).searchParams.get("url") || link; } catch (e) {}
    }

    let title = rawTitle;
    let source = tag(chunk, "source") || tag(chunk, "News:Source");
    const dashAt = title.lastIndexOf(" - ");
    if (!source && dashAt > 20 && /news\.google\.com/.test(link)) {
      source = title.slice(dashAt + 3).trim();
      title = title.slice(0, dashAt).trim();
    } else if (source && title.endsWith(" - " + source)) {
      title = title.slice(0, title.length - source.length - 3).trim();
    }
    source = (source || publisherFor(link)).replace(/ on MSN$/, "");

    // Google's description is a list of links, not a summary; skip it.
    let snippet = /news\.google\.com/.test(link) ? "" : tag(chunk, "description") || tag(chunk, "summary");
    snippet = cut(snippet, 300);

    items.push({
      title: cut(title, 160),
      link,
      source,
      pubDate: toIso(tag(chunk, "pubDate") || tag(chunk, "published") || tag(chunk, "updated") || tag(chunk, "dc:date")),
      snippet
    });
  }
  return items;
}

export function clean(items, opts) {
  const medical = opts && opts.medical;
  return items.filter(it => !PROMO.test(it.title) && !PROMO.test(it.snippet || "") && !(medical && HYPE.test(it.title)));
}

export function fingerprint(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50); }

function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">"));
  if (!m) return "";
  return decode(String(m[1]).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function decode(s) {
  let out = String(s).replace(/<[^>]+>/g, " ");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
    out = out.replace(/<[^>]+>/g, " ");
  }
  return out.replace(/\s+/g, " ");
}

function toIso(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d) ? "" : d.toISOString();
}

export function cut(str, max) {
  str = String(str || "").trim();
  if (str.length <= max) return str;
  const s = str.slice(0, max - 1);
  const sp = s.lastIndexOf(" ");
  return (sp > max * 0.6 ? s.slice(0, sp) : s).trim() + "…";
}
