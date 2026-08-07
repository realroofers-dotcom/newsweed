// functions/api/feed.js
//
// Two sources, merged into one list:
//   1. Newsweed's own Substack posts -> category "substack" (Today's brief)
//   2. Outside news by category      -> The wire
//
// Each wire category lists several feeds in order. The first one that actually
// returns headlines wins; if it's blocked or empty, the next is tried. That way
// no single provider can empty the wire.
//
// Headlines and links only — never article text. Everything links out to the publisher.
//
// Diagnostics:  /api/feed?debug=1   shows what each feed returned.

const SUBSTACK_API_URL = "https://newsweedcom.substack.com/api/v1/posts?limit=12";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PER_CATEGORY = 4;
const GN = "hl=en-US&gl=US&ceid=US:en";

function gnTopic(t) {
  return "https://news.google.com/rss/headlines/section/topic/" + t + "?" + GN;
}
function gnSearch(q) {
  return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&" + GN;
}

const WIRE_SOURCES = [
  {
    category: "politics", categoryLabel: "Politics",
    feeds: [gnTopic("NATION"), "https://feeds.npr.org/1014/rss.xml", "https://feeds.bbci.co.uk/news/politics/rss.xml"]
  },
  {
    category: "crime", categoryLabel: "Crime",
    feeds: [gnSearch("crime"), "https://www.cbsnews.com/latest/rss/crime", "https://feeds.bbci.co.uk/news/uk/rss.xml"]
  },
  {
    category: "weather", categoryLabel: "Weather",
    feeds: [gnSearch("severe weather storm forecast"), "https://www.cbsnews.com/latest/rss/weather"]
  },
  {
    category: "world", categoryLabel: "World",
    feeds: [gnTopic("WORLD"), "https://feeds.bbci.co.uk/news/world/rss.xml", "https://feeds.npr.org/1004/rss.xml"]
  },
  {
    category: "business", categoryLabel: "Business",
    feeds: [gnTopic("BUSINESS"), "https://feeds.bbci.co.uk/news/business/rss.xml", "https://feeds.npr.org/1006/rss.xml"]
  },
  {
    category: "health", categoryLabel: "Health",
    feeds: [gnTopic("HEALTH"), "https://feeds.bbci.co.uk/news/health/rss.xml", "https://feeds.npr.org/1128/rss.xml"]
  },
  {
    category: "sports", categoryLabel: "Sports",
    feeds: [gnTopic("SPORTS"), "https://feeds.bbci.co.uk/sport/rss.xml"]
  },
  {
    category: "culture", categoryLabel: "Culture",
    feeds: [gnTopic("ENTERTAINMENT"), "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "https://feeds.npr.org/1008/rss.xml"]
  },
  {
    category: "cannabis", categoryLabel: "Cannabis",
    feeds: [gnSearch("cannabis legalization industry"), "https://www.marijuanamoment.net/feed/", "https://mjbizdaily.com/feed/"]
  }
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.has("debug");

  const [substack, wire] = await Promise.all([fetchSubstack(), fetchWire(debug)]);

  const payload = {
    items: [...substack.items, ...wire.items],
    counts: { substack: substack.items.length, wire: wire.items.length }
  };
  if (debug) payload.debug = { substack: substack.log, wire: wire.log };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": debug ? "no-store" : "public, max-age=1800"
    }
  });
}

/* ---------------- Substack ---------------- */

async function fetchSubstack() {
  try {
    const res = await fetch(SUBSTACK_API_URL, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    });
    if (!res.ok) return { items: [], log: "HTTP " + res.status };
    const data = await res.json();
    const items = parsePosts(data);
    return { items, log: "ok, " + items.length + " posts" };
  } catch (err) {
    return { items: [], log: String(err) };
  }
}

function parsePosts(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter(post => post && post.title && (post.canonical_url || post.slug))
    .map(post => ({
      category: "substack",
      categoryLabel: "Newsweed",
      title: post.title,
      link: post.canonical_url || ("https://newsweedcom.substack.com/p/" + post.slug),
      pubDate: post.post_date || new Date().toISOString(),
      excerpt: truncate(stripHtml(post.subtitle || post.description || ""), 140)
    }));
}

/* ---------------- The wire ---------------- */

async function fetchWire(debug) {
  const results = await Promise.allSettled(WIRE_SOURCES.map(s => fetchCategory(s)));
  const merged = [];
  const log = {};

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const name = WIRE_SOURCES[i].category;
    if (r.status === "fulfilled") {
      merged.push(...r.value.items);
      if (debug) log[name] = r.value.log;
    } else if (debug) {
      log[name] = "failed: " + String(r.reason);
    }
  }

  const seen = new Set();
  const unique = merged.filter(item => {
    const fp = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (!fp || seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  unique.sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
  return { items: unique, log };
}

// Try each feed for this category until one returns headlines.
async function fetchCategory(source) {
  const log = [];
  for (const feedUrl of source.feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: {
          "User-Agent": UA,
          "Accept": "application/rss+xml, application/xml, text/xml, */*"
        }
      });
      if (!res.ok) { log.push(shortUrl(feedUrl) + " HTTP " + res.status); continue; }
      const xml = await res.text();
      const items = parseFeed(xml, source).slice(0, PER_CATEGORY);
      log.push(shortUrl(feedUrl) + " -> " + items.length);
      if (items.length) return { items, log };
    } catch (err) {
      log.push(shortUrl(feedUrl) + " error");
    }
  }
  return { items: [], log };
}

function shortUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return String(u).slice(0, 30); }
}

// Handles both RSS (<item>) and Atom (<entry>). Workers have no DOM parser.
function parseFeed(xml, source) {
  const isAtom = xml.indexOf("<entry") > -1 && xml.indexOf("<item") === -1;
  const openTag = isAtom ? "<entry" : "<item";
  const closeTag = isAtom ? "</entry>" : "</item>";

  const items = [];
  const parts = String(xml).split(openTag).slice(1);

  for (const part of parts) {
    const chunk = part.split(closeTag)[0];
    const rawTitle = tag(chunk, "title");
    let link = tag(chunk, "link");
    if (!link) {
      const href = chunk.match(/<link[^>]*href=["']([^"']+)["']/);
      if (href) link = href[1];
    }
    if (!rawTitle || !link) continue;

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
    if (!publisher) publisher = shortUrl(link);

    items.push({
      category: source.category,
      categoryLabel: source.categoryLabel,
      title: truncate(title, 130),
      link,
      pubDate: toIso(tag(chunk, "pubDate") || tag(chunk, "published") || tag(chunk, "updated")),
      excerpt: publisher
    });
  }
  return items;
}

function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">"));
  if (!m) return "";
  return decode(stripCdata(m[1])).trim();
}

function stripCdata(s) {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
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
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

function stripHtml(str) {
  return String(str).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(str, maxLen) {
  str = String(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "…";
}
