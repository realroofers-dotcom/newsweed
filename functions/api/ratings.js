// functions/api/ratings.js - BUILT 2026-11-27 · ratings-1a
// Mark (2026-11-27): "please start to put ratings from readers on the reviews".
//
//   GET  ?slugs=a,b,c           -> { a:{ avg, count }, ... }   readers' average (1 decimal) and how many rated
//   POST { slug, stars 1-5, website(honeypot) } -> { success, avg, count } ; one rating per reader per review
//        (reader = a one-way hash of the connecting address; the address itself is never stored).
// Every rating is kept whole (Mark's rule: owning the data, never delete):
// KV: EMAIL_LIST   rate:<slug> {sum,count} · ratelog:<slug>:<time>-<rand> {stars, who, made} · ratedone:<slug>:<who> stars

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const SLUG = /^[a-z0-9-]{2,80}$/;

function ok(obj) { return new Response(JSON.stringify(obj), { headers: JSON_HEADERS }); }
async function who(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("newsweed-ratings|" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function agg(kv, slug) {
  const a = JSON.parse((await kv.get("rate:" + slug)) || "null") || { sum: 0, count: 0 };
  return { avg: a.count ? Math.round((a.sum / a.count) * 10) / 10 : null, count: a.count };
}

export async function onRequestGet(context) {
  const { env, request } = context, kv = env.EMAIL_LIST, url = new URL(request.url);
  const slugs = String(url.searchParams.get("slugs") || "").split(",").map(s => s.trim()).filter(s => SLUG.test(s)).slice(0, 50);
  const out = {};
  if (!kv) return ok(out);
  for (const s of slugs) out[s] = await agg(kv, s);
  return ok(out);
}

export async function onRequestPost(context) {
  const { env, request } = context, kv = env.EMAIL_LIST;
  if (!kv) return ok({ success: false, error: "Ratings are not available right now." });
  let b = {}; try { b = await request.json(); } catch (e) {}
  if (b.website) return ok({ success: true });                       // honeypot: bots fill it, people never see it
  const slug = String(b.slug || ""), stars = Math.round(Number(b.stars));
  if (!SLUG.test(slug)) return ok({ success: false, error: "Which review?" });
  if (!(stars >= 1 && stars <= 5)) return ok({ success: false, error: "Pick 1 to 5 stars." });
  const w = await who(request);
  if (await kv.get("ratedone:" + slug + ":" + w)) return ok(Object.assign({ success: false, error: "You already rated this review. Thank you." }, await agg(kv, slug)));
  const a = JSON.parse((await kv.get("rate:" + slug)) || "null") || { sum: 0, count: 0 };
  a.sum += stars; a.count += 1;
  const made = new Date().toISOString();
  await kv.put("rate:" + slug, JSON.stringify(a));
  await kv.put("ratelog:" + slug + ":" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), JSON.stringify({ stars, who: w, made }));
  await kv.put("ratedone:" + slug + ":" + w, String(stars));
  return ok({ success: true, avg: Math.round((a.sum / a.count) * 10) / 10, count: a.count });
}
