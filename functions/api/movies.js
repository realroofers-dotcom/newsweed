// functions/api/movies.js - BUILT 2026-11-20 · movies-1b (Box Office Mojo; movies-1a used Wikipedia - Mark 2026-11-20: "stop using
// wilipedia its controlled and limits the truth")
// Mark (2026-11-20): "Please add a section on newsweed.com called movies and entertainement lets goive amc free ads on current movies".
// GET -> { ok, as_of, weekend, now: [...], soon: [...], source }
//   now  = every film on the latest completed weekend chart at Box Office Mojo (rank, theaters, weeks in release, distributor).
//   soon = films opening in the next 21 days from Box Office Mojo's release calendar (date, distributor, Wide/Limited, genres).
//   Cached 6 hours. Nothing is invented: no row = no card.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const BOM = "https://www.boxofficemojo.com";
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function ok(obj, cache) { return new Response(JSON.stringify(obj), { headers: Object.assign({ "Cache-Control": cache || "no-store", "Access-Control-Allow-Origin": "*" }, JSON_HEADERS) }); }
function nyToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function txt(h) { return String(h || "").replace(/<[^>]+>/g, "|").replace(/&middot;/g, "·").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").split("|").map(s => s.trim()).filter(Boolean); }
async function page(path) {
  const r = await fetch(BOM + path, { headers: { "User-Agent": UA, "Accept": "text/html" }, cf: { cacheTtl: 3600 } });
  return r.ok ? await r.text() : "";
}
function iso(y, m, d) { return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }

async function weekend(today) {
  const list = await page("/weekend/");
  const y = Number(today.slice(0, 4)), seen = new Set(), weeks = [];
  for (const m of list.matchAll(/href="(\/weekend\/(\d{4})W(\d+)\/)[^"]*"[^>]*>\s*([A-Z][a-z]{2}) (\d{1,2})-(?:([A-Z][a-z]{2}) )?(\d{1,2})\s*</g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const endMon = MON[(m[6] || m[4]).toLowerCase()], end = iso(Number(m[2]), endMon, Number(m[7]));
    if (end < today) weeks.push({ path: m[1], end, label: m[4] + " " + m[5] + "-" + (m[6] ? m[6] + " " : "") + m[7] + ", " + m[2] });
  }
  weeks.sort((a, b) => b.end.localeCompare(a.end));
  for (const w of weeks.slice(0, 3)) {
    const html = await page(w.path), films = [];
    for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]);
      if (cells.length < 11) continue;
      const rel = (cells[2].match(/href="(\/release\/rl\d+\/)/) || [])[1];
      const t = txt(cells[2])[0]; if (!t) continue;
      films.push({ rank: Number(txt(cells[0])[0]) || films.length + 1, title: t, theaters: txt(cells[5])[0] || "", weeks: Number(txt(cells[9])[0]) || null,
        distributor: txt(cells[10])[0] || "", link: rel ? BOM + rel : null });
    }
    if (films.length) return { label: w.label, films };
  }
  return { label: "", films: [] };
}
async function calendar(today) {
  const html = await page("/calendar/"), out = [], t = Date.parse(today + "T12:00:00Z");
  let date = "";
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => c[1]);
    if (cells.length === 1) {
      const m = txt(cells[0])[0] && txt(cells[0])[0].match(/^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
      if (m) date = iso(Number(m[3]), MON[m[1].toLowerCase()], Number(m[2]));
      continue;
    }
    if (!date || cells.length < 3) continue;
    const parts = txt(cells[0]); if (!parts.length) continue;
    const d = Date.parse(date + "T12:00:00Z"); if (d <= t || d - t > 21 * 864e5) continue;
    const rel = (cells[0].match(/href="(\/release\/rl\d+\/)/) || [])[1];
    out.push({ title: parts[0], date, genres: parts[1] && !/^With:/.test(parts[1]) ? parts[1] : "", distributor: txt(cells[1])[0] || "", scale: txt(cells[2])[0] || "", link: rel ? BOM + rel : null });
  }
  return out;
}

export async function onRequestGet(context) {
  const cache = caches.default, key = new Request("https://newsweed.com/api/movies?v=1b");
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit;
  const today = nyToday();
  let w = { label: "", films: [] }, soon = [];
  try { [w, soon] = await Promise.all([weekend(today), calendar(today)]); } catch (e) {}
  const res = ok({ ok: true, as_of: today, weekend: w.label, now: w.films, soon, source: "Box Office Mojo: the weekend chart (" + (w.label || "latest") + ") and the release calendar" }, "public, max-age=21600");
  if (w.films.length || soon.length) await cache.put(key, res.clone()).catch(() => {});
  return res;
}
