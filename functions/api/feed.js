const FEEDS = {
  substack: { label: "Newsweed", url: "https://newsweed.substack.com/feed" },
  politics: { label: "Politics", url: "https://feeds.npr.org/1014/rss.xml" },
  sports: { label: "Sports", url: "https://www.espn.com/espn/rss/news" },
  national: { label: "National", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
  selfhelp: { label: "Self-Help", url: "https://www.psychologytoday.com/us/rss.xml" },
};

const CACHE_SECONDS = 900;

function stripCdata(str) {
  if (!str) return "";
  return str.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}
function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014");
}
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(stripCdata(m[1])) : "";
}
function extractLink(block) {
  const rss = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim()) return decodeEntities(stripCdata(rss[1]));
  const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? atom[1] : "";
}
function parseFeed(xml, key, label) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = itemBlocks.length ? [] : (xml.match(/<entry[\s\S]*?<\/entry>/gi) || []);
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;
  for (const block of blocks.slice(0, 6)) {
    const title = extractTag(block, "title");
    const link = extractLink(block);
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
    const description = extractTag(block, "description") || extractTag(block, "summary");
    if (title) {
      items.push({
        category: key, categoryLabel: label, title, link,
        pubDate: pubDate || null,
        excerpt: description ? description.replace(/<[^>]+>/g, "").slice(0, 180) : "",
      });
    }
  }
  return items;
}
async function fetchAndParse(key, feed) {
  try {
    const res = await fetch(feed.url, {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      headers: { "User-Agent": "NewsweedBot/1.0 (+https://newsweed.com)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, key, feed.label);
  } catch (e) {
    return [];
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(Object.keys(FEEDS).map(k => fetchAndParse(k, FEEDS[k])));
  const allItems = results.flat().sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const body = JSON.stringify({ generatedAt: new Date().toISOString(), items: allItems });
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
