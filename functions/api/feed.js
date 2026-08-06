// functions/api/feed.js
// Fetches the live Newsweed Substack RSS feed and returns parsed JSON
// for the site's ticker, "Today's brief" cards, and "The wire" list.

export async function onRequest(context) {
  const SUBSTACK_FEED_URL = "https://newsweedcom.substack.com/feed";

  try {
    const res = await fetch(SUBSTACK_FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsweedFeedBot/1.0)" }
    });

    if (!res.ok) {
      throw new Error("Substack feed responded with " + res.status);
    }

    const xml = await res.text();
    const items = parseRssItems(xml);

    return new Response(JSON.stringify({ items }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600" // cache 10 min at the edge
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      status: 200, // still 200 so the front-end falls back gracefully
      headers: { "Content-Type": "application/json" }
    });
  }
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.split("<item>").slice(1); // drop content before first <item>

  for (const block of itemBlocks) {
    const chunk = block.split("</item>")[0];

    const title = extractTag(chunk, "title");
    const link = extractTag(chunk, "link");
    const pubDateRaw = extractTag(chunk, "pubDate");
    const description = extractTag(chunk, "description");

    if (!title || !link) continue;

    items.push({
      category: "substack",
      categoryLabel: "Newsweed",
      title: decodeEntities(stripCdata(title)),
      link: stripCdata(link).trim(),
      pubDate: pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString(),
      excerpt: truncate(decodeEntities(stripHtml(stripCdata(description || ""))), 140)
    });
  }

  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
  return match ? match[1].trim() : "";
}

function stripCdata(str) {
  return str.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "…";
}
