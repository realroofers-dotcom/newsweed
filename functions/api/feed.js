// functions/api/feed.js
// Fetches published posts from Newsweed's Substack via its public JSON API
// (more reliable than scraping the RSS/XML feed, which Substack was rate-limiting).

export async function onRequest(context) {
  const SUBSTACK_API_URL = "https://newsweedcom.substack.com/api/v1/posts?limit=12";

  try {
    const res = await fetch(SUBSTACK_API_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error("Substack API responded with " + res.status);
    }

    const data = await res.json();
    const items = parsePosts(data);

    return new Response(JSON.stringify({ items }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800" // cache 30 min at the edge
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      status: 200, // still 200 so the front-end falls back gracefully
      headers: { "Content-Type": "application/json" }
    });
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

function stripHtml(str) {
  return String(str).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "…";
}
