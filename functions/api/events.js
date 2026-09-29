// functions/api/events.js — BUILT 2026-09-29 · events-1a
// Newsweed events: Mark on the road meeting authors, hikes with TrailShrinks.com, roofing classes with RooferSchool.com.
//
//   GET                         -> { upcoming:[...], past:[...last 20] }
//   POST { action:"rsvp", id, name, email, count, website(honeypot) }   -> save a seat
//   POST ?admin=KEY { action:"save", id?, date, time, title, kind, place, state, link, description }
//   POST ?admin=KEY { action:"delete", id }
//   GET  ?admin=KEY&rsvps=ID    -> the RSVP list for one event
//
// KV: EMAIL_LIST  events:all (the list), rsvp:<eventId>:<email>

const KINDS = { authors: "Meet the authors", hike: "Hike with TrailShrinks", roofing: "Roofing class with RooferSchool", truck: "Newsweed truck stop", other: "Event" };
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj) { return new Response(JSON.stringify(obj), { headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/[ \t]+/g, " ").trim().slice(0, max); }
function isAdmin(env, url) { const k = url.searchParams.get("admin"); return !!(k && env.TIP_ADMIN_KEY && k === env.TIP_ADMIN_KEY); }
function nyDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
async function all(kv) { try { return JSON.parse((await kv.get("events:all")) || "[]"); } catch (e) { return []; } }

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  if (!env.EMAIL_LIST) return ok({ upcoming: [], past: [], kinds: KINDS });
  const list = await all(env.EMAIL_LIST);

  const rs = url.searchParams.get("rsvps");
  if (rs) {
    if (!isAdmin(env, url)) return ok({ error: "Not authorized." });
    const keys = await env.EMAIL_LIST.list({ prefix: "rsvp:" + rs + ":" });
    const out = await Promise.all(keys.keys.map(async k => JSON.parse((await env.EMAIL_LIST.get(k.name)) || "{}")));
    return ok({ rsvps: out });
  }

  const today = nyDate();
  const upcoming = list.filter(e => e.date >= today).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const past = list.filter(e => e.date < today).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  const strip = e => { const { rsvpCount, ...rest } = e; return Object.assign(rest, { kindLabel: KINDS[e.kind] || "Event", going: rsvpCount || 0 }); };
  return ok({ upcoming: upcoming.map(strip), past: past.map(strip), kinds: KINDS });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Not set up yet." });
  const b = await request.json().catch(() => ({}));
  let list = await all(kv);

  if (isAdmin(env, url)) {
    if (b.action === "delete") {
      await kv.put("events:all", JSON.stringify(list.filter(e => e.id !== b.id)));
      return ok({ success: true });
    }
    if (b.action === "save") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return ok({ success: false, error: "Pick a date." });
      const title = clean(b.title, 120);
      if (title.length < 4) return ok({ success: false, error: "Give it a title." });
      let link = clean(b.link, 400);
      if (link && !/^https?:\/\//.test(link)) link = "";
      const ev = {
        id: b.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
        date: b.date, time: clean(b.time, 20), title, kind: KINDS[b.kind] ? b.kind : "other",
        place: clean(b.place, 120), state: clean(b.state, 2).toUpperCase(), link,
        description: clean(b.description, 1000)
      };
      const old = list.find(e => e.id === ev.id);
      if (old) ev.rsvpCount = old.rsvpCount || 0;
      list = list.filter(e => e.id !== ev.id).concat([ev]);
      await kv.put("events:all", JSON.stringify(list));
      return ok({ success: true, event: ev });
    }
    return ok({ success: false, error: "Unknown action." });
  }

  if (b.action === "rsvp") {
    if (clean(b.website, 50)) return ok({ success: true });
    const ev = list.find(e => e.id === b.id);
    if (!ev) return ok({ success: false, error: "That event is no longer listed." });
    const name = clean(b.name, 80), email = clean(b.email, 200).toLowerCase();
    if (!name) return ok({ success: false, error: "Your name, please." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ success: false, error: "A valid email, so we can reach you if plans change." });
    const count = Math.max(1, Math.min(10, parseInt(b.count, 10) || 1));
    const key = "rsvp:" + ev.id + ":" + email;
    const had = await kv.get(key);
    await kv.put(key, JSON.stringify({ name, email, count, at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 400 });
    if (!had) { ev.rsvpCount = (ev.rsvpCount || 0) + count; await kv.put("events:all", JSON.stringify(list)); }
    return ok({ success: true, already: !!had });
  }
  return ok({ success: false, error: "Unknown action." });
}
