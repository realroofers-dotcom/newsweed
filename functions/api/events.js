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

/* events-2a (15 Nov 2026, Mark: "let people list event free please"): anyone can list an event, free.
   POST { action:"list", title, date, time, place, city, state, kind, link, description, name, email, phone, website(honeypot) }
   Name, email and phone are required and kept private (never sent back by GET), like the obituaries: nobody anonymous.
   It shows at once, marked "Listed by a reader". At most 3 listings per email per day. The admin can hide one
   (status 'hidden') - nothing is ever deleted (Mark's rule). */
const KINDS = { authors: "Meet the authors", hike: "Hike with TrailShrinks", roofing: "Roofing class with RooferSchool", truck: "Newsweed truck stop",
  concert: "Concert", flea: "Flea market", tradeshow: "Trade show", festival: "Fair or festival", meeting: "Stockholder meeting", community: "Community event", meetup: "Meetup", other: "Event" };
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
  const shown = list.filter(e => e.status !== "hidden");
  const upcoming = shown.filter(e => e.date >= today).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const past = shown.filter(e => e.date < today).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  /* the lister's name, email and phone never leave the server */
  const strip = e => { const { rsvpCount, contact, ...rest } = e; return Object.assign(rest, { kindLabel: KINDS[e.kind] || "Event", going: rsvpCount || 0 }); };
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
    if (b.action === "delete" || b.action === "hide") {
      /* events-2a: hidden, never deleted (Mark: "never delete records") */
      const ev = list.find(e => e.id === b.id);
      if (ev) { ev.status = "hidden"; ev.hidden_at = new Date().toISOString(); await kv.put("events:all", JSON.stringify(list)); }
      return ok({ success: true, hidden: !!ev });
    }
    if (b.action === "unhide") {
      const ev = list.find(e => e.id === b.id);
      if (ev) { delete ev.status; await kv.put("events:all", JSON.stringify(list)); }
      return ok({ success: true });
    }
    if (b.action === "contacts") {
      return ok({ success: true, listings: list.filter(e => e.contact).map(e => ({ id: e.id, title: e.title, date: e.date, status: e.status || "live", contact: e.contact })) });
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
      if (old) { ev.rsvpCount = old.rsvpCount || 0; if (old.contact) ev.contact = old.contact; if (old.by_reader) ev.by_reader = true; if (old.status) ev.status = old.status; }
      list = list.filter(e => e.id !== ev.id).concat([ev]);
      await kv.put("events:all", JSON.stringify(list));
      return ok({ success: true, event: ev });
    }
    return ok({ success: false, error: "Unknown action." });
  }

  if (b.action === "list") {
    if (clean(b.website, 50)) return ok({ success: true });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return ok({ success: false, error: "Pick the date." });
    if (b.date < nyDate()) return ok({ success: false, error: "That date has passed." });
    const title = clean(b.title, 120);
    if (title.length < 4) return ok({ success: false, error: "Give the event a name." });
    const place = clean(b.place, 120), city = clean(b.city, 60), state = clean(b.state, 2).toUpperCase();
    if (!place && !city) return ok({ success: false, error: "Where is it? A place or a town." });
    const name = clean(b.name, 80), email = clean(b.email, 200).toLowerCase(), phone = clean(b.phone, 30);
    if (name.split(" ").filter(Boolean).length < 2) return ok({ success: false, error: "Your full name, please (kept private)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ success: false, error: "A real email, please (kept private)." });
    if (phone.replace(/\D/g, "").length < 7) return ok({ success: false, error: "A phone number, please (kept private)." });
    const capKey = "evcap:" + nyDate() + ":" + email;
    const used = parseInt((await kv.get(capKey)) || "0", 10);
    if (used >= 3) return ok({ success: false, error: "Three listings a day per person. Thank you - come back tomorrow." });
    let link = clean(b.link, 400);
    if (link && !/^https?:\/\//.test(link)) link = "";
    const ev = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      date: b.date, time: clean(b.time, 20), title, kind: KINDS[b.kind] ? b.kind : "community",
      place: [place, city].filter(Boolean).join(", "), state, link,
      description: clean(b.description, 600), by_reader: true,
      contact: { name, email, phone, at: new Date().toISOString(), ip_country: (context.request.cf && context.request.cf.country) || "" }
    };
    list.push(ev);
    await kv.put("events:all", JSON.stringify(list));
    await kv.put(capKey, String(used + 1), { expirationTtl: 60 * 60 * 30 });
    return ok({ success: true, id: ev.id });
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
