// functions/api/feed.js
//
// Two sources, merged into one list:
//   1. Newsweed's own Substack posts   -> category "substack"  (Today's brief)
//   2. Google News RSS, by topic       -> politics / business / world / culture / sports / health (The wire)
//
// Headlines and links only — never article text. Each item links out to the original publisher.

const SUBSTACK_API_URL = "https://newsweedcom.substack.com/api/v1/posts?limit=12";

// What the wire covers. Two kinds of source:
//   topic:  Google News section feed (general news, high volume)
//   query:  Google News search (use for anything without its own section)
// Edit, add, or delete lines here to change the mix.
const WIRE_SOURCES = [
  { category: "politics", categoryLabel: "Politics", topic: "NATION" },
  { category: "crime",    categoryLabel: "Crime",    query: "crime" },
  { category: "weather",  categoryLabel: "Weather",  query: "severe weather forecast storm" },
  { category: "world",    categoryLabel: "World",    topic: "WORLD" },
  { category: "business", categoryLabel: "Business", topic: "BUSINESS" },
  { category: "health",   categoryLabel: "Health",   topic: "HEALTH" },
  { category: "sports",   categoryLabel: "Sports",   topic: "SPORTS" },
  { category: "culture",  categoryLabel: "Culture",  topic: "ENTERTAINMENT" },
  { category: "cannabis", categoryLabel: "Cannabis", query: "cannabis legalization industry" }
];

const PER_CATEGORY = 4;      // headlines kept per category (9 categories = up to 36 on the wire)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function onRequest(context) {
  const [substackItems, wireItems] = await Promise.all([
    fetchSubstack(),
    fetchWire()
  ]);

  const items = [...substackItems, ...wireItems];

  return new Response(JSON.stringify({
    items,
    counts: { substack: substackItems.length, wire: wireItems.length }
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800" // cache 30 min at the edge
    }
  });
}

/* ---------------- Substack (unchanged behaviour) ---------------- */

async function fetchSubstack() {
  try {
    const res = await fetch(SUBSTACK_API_URL, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    });
    if (!res.ok) throw new Error("Substack API responded with " + res.status);
    const data = await res.json();
    return parsePosts(data);
  } catch (err) {
    return [];
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

/* ---------------- The wire: Google News RSS ---------------- */

async function fetchWire() {
  const results = await Promise.allSettled(WIRE_SOURCES.map(fetchOneSource));
  const merged = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) merged.push(...r.value);
  }

  // Drop duplicates (the same story often surfaces under two search terms)
  const seen = new Set();
  const unique = merged.filter(item => {
    const fingerprint = item.title.toLowerCase().slice(0, 60);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });

  // Newest first
  unique.sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
  return unique;
}

async function fetchOneSource(source) {
  const region = "hl=en-US&gl=US&ceid=US:en";
  const url = source.topic
    ? "https://news.google.com/rss/headlines/section/topic/" + source.topic + "?" + region
    : "https://news.google.com/rss/search?q=" + encodeURIComponent(source.query) + "&" + region;

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, source).slice(0, PER_CATEGORY);
  } catch (err) {
    return [];
  }
}

// Workers have no DOM parser, so pull the fields out of the XML directly.
function parseRss(xml, source) {
  const items = [];
  const blocks = xml.split("<item>").slice(1);

  for (const block of blocks) {
    const chunk = block.split("</item>")[0];
    const rawTitle = tag(chunk, "title");
    const link = tag(chunk, "link");
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

    items.push({
      category: source.category,
      categoryLabel: source.categoryLabel,
      title: truncate(title, 130),
      link,
      pubDate: toIso(tag(chunk, "pubDate")),
      excerpt: publisher || ""
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
  // Run twice: Google News double-escapes some entities (&amp;#39;)
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
  const d = new Date(dateStr);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

/* ---------------- shared helpers ---------------- */

function stripHtml(str) {
  return String(str).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(str, maxLen) {
  str = String(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "…";
}
