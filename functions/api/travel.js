// functions/api/travel.js — BUILT 2026-09-29 · travel-1b (+ "Truck is here now, open to all": set by hand, expires itself)
//
// Where the Newsweed truck has been. Mark, 29 Sep 2026: "show where it has been based on my GPS,
// always lagging behind at least a week."
//
// SAFETY, by design:
//   - Nothing newer than LAG_DAYS (7) days is ever returned to the public. Not by the page, not by this API.
//   - Only the town is kept (coordinates rounded to about 1 km on save, about 10 km when shown). No street, no route.
//
// FEEDING IT
//   A phone GPS app: OwnTracks (free, iPhone/Android), mode "HTTP", URL:
//        https://newsweed.com/api/travel?key=YOUR_TRAVEL_KEY
//   It posts {"_type":"location","lat":..,"lon":..,"tst":..}. We keep at most one point every 45 minutes,
//   look up the town once (OpenStreetMap Nominatim), and store only town + state per day.
//   Or by hand in tips-admin.html:  POST ?admin=KEY { action:"stop", date, place, state }
//
//   GET                     -> { stops:[{date, place, state, lat, lon}], states:[...], lastSeen, lagDays }
//   POST ?admin=KEY { action:"delete", date, place }
//
// Env var: TRAVEL_KEY (for the GPS app).  KV: EMAIL_LIST  trk:days (the log), trk:last (throttle)

const LAG_DAYS = 7;
const MIN_GAP_MIN = 45;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
function ok(obj, cache) { return new Response(JSON.stringify(obj), { headers: Object.assign({ "Cache-Control": cache || "no-store" }, JSON_HEADERS) }); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
function round(n, d) { const f = Math.pow(10, d); return Math.round(Number(n) * f) / f; }
function nyDate(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date()); }

const ABBR = { "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY" };

async function readDays(kv) { try { return JSON.parse((await kv.get("trk:days")) || "{}"); } catch (e) { return {}; } }

function addStop(days, date, stop) {
  const list = days[date] || [];
  const same = list.find(s => s.place === stop.place && s.state === stop.state);
  if (!same) list.push(stop);
  days[date] = list;
}

// "Truck is here now" (Mark, 29 Sep 2026: "the site should show where the truck is and say open to all").
// NOT the GPS: a stop Mark switches on by hand, for the hours he chooses; it switches itself off. KV trk:now.
async function readNow(kv) {
  try { const n = JSON.parse((await kv.get("trk:now")) || "null"); return n && Date.parse(n.until) > Date.now() ? n : null; } catch (e) { return null; }
}

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  if (!kv) return ok({ stops: [], states: [], lagDays: LAG_DAYS });
  if (new URL(context.request.url).searchParams.has("now")) return ok({ now: await readNow(kv) }, "public, max-age=60");
  const days = await readDays(kv);
  const cutoff = nyDate(new Date(Date.now() - LAG_DAYS * 86400000));
  const stops = [];
  Object.keys(days).filter(d => d <= cutoff).sort().forEach(d => {
    days[d].forEach(s => stops.push({ date: d, place: s.place, state: s.state, lat: s.lat != null ? round(s.lat, 1) : null, lon: s.lon != null ? round(s.lon, 1) : null }));
  });
  const recent = stops.slice(-400);
  const states = Array.from(new Set(recent.map(s => s.state).filter(Boolean)));
  return ok({ stops: recent, states, lastSeen: recent[recent.length - 1] || null, lagDays: LAG_DAYS, now: await readNow(kv) }, "public, max-age=300");
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  const b = await request.json().catch(() => ({}));

  // ---- Mark, by hand ----
  const admin = url.searchParams.get("admin");
  if (admin) {
    if (!env.TIP_ADMIN_KEY || admin !== env.TIP_ADMIN_KEY) return ok({ success: false, error: "Not authorized." });
    const days = await readDays(kv);
    if (b.action === "delete") {
      if (days[b.date]) { days[b.date] = days[b.date].filter(s => s.place !== b.place); if (!days[b.date].length) delete days[b.date]; }
      await kv.put("trk:days", JSON.stringify(days));
      return ok({ success: true });
    }
    if (b.action === "stop") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return ok({ success: false, error: "Pick a date." });
      const place = clean(b.place, 60), state = clean(b.state, 2).toUpperCase();
      if (!place || !/^[A-Z]{2}$/.test(state)) return ok({ success: false, error: "Town and state, please." });
      let lat = null, lon = null;
      const g = await geocode(place + ", " + state).catch(() => null);
      if (g) { lat = round(g.lat, 2); lon = round(g.lon, 2); }
      addStop(days, b.date, { place, state, lat, lon });
      await kv.put("trk:days", JSON.stringify(days));
      return ok({ success: true });
    }
    if (b.action === "here") {
      const place = clean(b.place, 60), state = clean(b.state, 2).toUpperCase();
      if (!place || !/^[A-Z]{2}$/.test(state)) return ok({ success: false, error: "Town and state, please." });
      const hours = Math.max(1, Math.min(72, parseInt(b.hours, 10) || 8));
      const now = { place, state, spot: clean(b.spot, 100), note: clean(b.note, 160) || "Open to all. Come say hello.",
        since: new Date().toISOString(), until: new Date(Date.now() + hours * 3600000).toISOString() };
      await kv.put("trk:now", JSON.stringify(now), { expirationTtl: hours * 3600 + 60 });
      return ok({ success: true, now });
    }
    if (b.action === "gone") { await kv.delete("trk:now"); return ok({ success: true }); }
    // Admin view of everything, including the last week (never public)
    if (b.action === "list") return ok({ success: true, days });
    return ok({ success: false, error: "Unknown action." });
  }

  // ---- The GPS app ----
  const key = url.searchParams.get("key");
  if (!env.TRAVEL_KEY || key !== env.TRAVEL_KEY) return new Response("[]", { status: 401, headers: JSON_HEADERS });
  if (b._type && b._type !== "location") return new Response("[]", { headers: JSON_HEADERS }); // OwnTracks sends other message types too
  const lat = Number(b.lat), lon = Number(b.lon);
  if (!isFinite(lat) || !isFinite(lon)) return new Response("[]", { headers: JSON_HEADERS });
  const when = b.tst ? new Date(Number(b.tst) * 1000) : (b.time ? new Date(b.time) : new Date());

  const last = JSON.parse((await kv.get("trk:last")) || "null");
  if (last && Date.parse(when.toISOString()) - Date.parse(last.t) < MIN_GAP_MIN * 60000 && Math.abs(last.lat - lat) < 0.05 && Math.abs(last.lon - lon) < 0.05) {
    return new Response("[]", { headers: JSON_HEADERS });
  }
  await kv.put("trk:last", JSON.stringify({ t: when.toISOString(), lat, lon }));

  const town = await reverse(lat, lon).catch(() => null);
  if (town && town.place) {
    const days = await readDays(kv);
    addStop(days, nyDate(when), { place: town.place, state: town.state, lat: round(lat, 2), lon: round(lon, 2) });
    await kv.put("trk:days", JSON.stringify(days));
  }
  return new Response("[]", { headers: JSON_HEADERS });
}

const NOMINATIM_UA = { headers: { "User-Agent": "Newsweed.com travel log (https://newsweed.com/travel.html)", "Accept-Language": "en" } };

async function reverse(lat, lon) {
  const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=" + lat + "&lon=" + lon, NOMINATIM_UA);
  if (!r.ok) return null;
  const j = await r.json();
  const a = j.address || {};
  const place = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || "";
  const state = ABBR[String(a.state || "").toLowerCase()] || "";
  return place ? { place: clean(place, 60), state } : null;
}

async function geocode(q) {
  const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" + encodeURIComponent(q), NOMINATIM_UA);
  if (!r.ok) return null;
  const j = await r.json();
  return j && j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
}
