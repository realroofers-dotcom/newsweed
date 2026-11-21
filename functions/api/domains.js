// functions/api/domains.js - BUILT 2026-11-21 · domains-1a
// Mark (2026-11-21): "i want a domains for sale section with the domains for sale and links to wall st domains and the whole
// sales pitch to list your domains for $15 per month no commission" / Black Friday: list FREE for 6 months, through Jan 2, 2027.
// GET -> { ok, count, domains: [{ name, price, category }] } - every unsold name on Wall St Domains (its own Supabase table,
// read with the PUBLIC anon key the wallstdomains.com site itself ships; no second copy of the list). Developed sites
// ("completed project") and nejmehvstheriva.com (Mark: never list it) are left out. Cached 1 hour.
const SB = "https://kkeoleeuujsvbjhcsyuq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZW9sZWV1dWpzdmJqaGNzeXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTMwNjcsImV4cCI6MjA4NDc2OTA2N30.2QtpbmYIOTIb-PV0KQyUd4DU0dACVi4zT5gsiozs5Og";   // the public, read-only key wallstdomains.com sends to every visitor (role: anon)
export async function onRequestGet(ctx) {
  const cache = caches.default, key = new Request("https://newsweed.com/api/domains?v=1");
  const hit = await cache.match(key); if (hit) return hit;
  let rows = [];
  try {
    const r = await fetch(SB + "/rest/v1/domains?select=name,buy_price,category,section&is_sold=eq.false&order=name.asc&limit=2000",
      { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
    rows = r.ok ? await r.json() : [];
  } catch (e) { rows = []; }
  const domains = (Array.isArray(rows) ? rows : [])
    .filter(x => x && x.name && !/nejmehvstheriva/i.test(x.name) && !/completed project/i.test(String(x.category || "")))
    .map(x => ({ name: String(x.name).toLowerCase(), price: x.buy_price == null ? null : Number(x.buy_price), category: String(x.category || x.section || "").trim() }));
  const res = new Response(JSON.stringify({ ok: domains.length > 0, count: domains.length, domains, at: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
  if (domains.length) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}