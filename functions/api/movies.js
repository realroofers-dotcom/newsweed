// functions/api/movies.js - BUILT 2026-11-20 · movies-1a
// Mark (2026-11-20): "Please add a section on newsweed.com called movies and entertainement lets goive amc free ads on current
// movies and i will write the reviews".
// GET -> { ok, as_of, now: [...], soon: [...], source }
//   Movies opening in U.S. theaters, from Wikipedia's "List of American films of <year>" (its release tables, each row cited
//   there to the trade press). "now" = opened in the last 35 days; "soon" = opening in the next 21 days. Streaming-only
//   releases (Netflix, Apple TV+, Prime Video, Hulu, Peacock, Paramount+, HBO Max, Disney+) are left out: the page sends
//   readers to AMC Theatres. Cached 6 hours. Nothing is invented: no row = no card.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const UA = "NewsweedBot/1.0 (https://newsweed.com)";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const STREAM = /netflix|apple tv|prime video|amazon mgm studios \/ prime|hulu|peacock|paramount\+|hbo max|disney\+|max original/i;

function ok(obj, cache) { return new Response(JSON.stringify(obj), { headers: Object.assign({ "Cache-Control": cache || "no-store", "Access-Control-Allow-Origin": "*" }, JSON_HEADERS) }); }
function nyToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function linkText(s) {   // [[Target|Text]] -> Text ; [[Text]] -> Text ; strip templates, refs, bold/italic
  return String(s || "")
    .replace(/<ref[^>]*\/>/gi, "").replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function wikiTarget(s) { const m = String(s || "").match(/\[\[([^\]|]+)/); return m ? "https://en.wikipedia.org/wiki/" + encodeURIComponent(m[1].trim().replace(/ /g, "_")) : null; }

async function section(year, idx) {
  const u = "https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&page=List_of_American_films_of_" + year + "&section=" + idx;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) return "";
  const j = await r.json().catch(() => null);
  return (j && j.parse && j.parse.wikitext) || "";
}
function parse(wt, year) {
  const out = [];
  let month = 0, day = 0;
  for (const row of wt.split(/\n\|-/)) {
    const mm = row.match(/data-sort-value="(\d{1,2})"/); if (mm) { month = Number(mm[1]); }
    const am = row.match(/aria-label="([A-Za-z]+)"/); if (am && MONTHS.indexOf(am[1].toLowerCase()) >= 0) month = MONTHS.indexOf(am[1].toLowerCase()) + 1;
    const dm = row.match(/\|\s*'''(\d{1,2})'''/); if (dm) day = Number(dm[1]);
    const tm = row.match(/\|\s*''(\[\[[^\]]+\]\]|[^'|\n]+)''\s*\|\|\s*([^|\n]*?)\s*\|\|/);
    if (!tm || !month || !day) continue;
    const title = linkText(tm[1]), company = linkText(tm[2]);
    if (!title) continue;
    out.push({ title, company, date: year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"), wiki: wikiTarget(tm[1]) });
  }
  return out;
}

export async function onRequestGet(context) {
  const cache = caches.default, key = new Request("https://newsweed.com/api/movies?v=1a");
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit;
  const today = nyToday(), year = Number(today.slice(0, 4)), mon = Number(today.slice(5, 7));
  const q = Math.floor((mon - 1) / 3) + 2;   // sections: 2 = Jan-Mar, 3 = Apr-Jun, 4 = Jul-Sep, 5 = Oct-Dec
  let rows = [];
  try {
    const wanted = [[year, q]];
    if (mon % 3 === 1) wanted.push(q > 2 ? [year, q - 1] : [year - 1, 5]);   // first month of a quarter: also the quarter before
    if (mon % 3 === 0) wanted.push(q < 5 ? [year, q + 1] : [year + 1, 2]);   // last month: also the quarter after
    for (const [y, s] of wanted) rows = rows.concat(parse(await section(y, s), y));
  } catch (e) {}
  const day = d => Date.parse(d + "T12:00:00Z"), t = day(today);
  const seen = new Set(), theatrical = rows.filter(r => !STREAM.test(r.company) && !seen.has(r.title + r.date) && seen.add(r.title + r.date));
  const now = theatrical.filter(r => day(r.date) <= t && t - day(r.date) <= 35 * 864e5).sort((a, b) => b.date.localeCompare(a.date));
  const soon = theatrical.filter(r => day(r.date) > t && day(r.date) - t <= 21 * 864e5).sort((a, b) => a.date.localeCompare(b.date));
  const res = ok({ ok: true, as_of: today, now, soon, source: "Wikipedia, List of American films of " + year + " (release tables, each row cited there)" }, "public, max-age=21600");
  if (now.length || soon.length) await cache.put(key, res.clone()).catch(() => {});
  return res;
}
