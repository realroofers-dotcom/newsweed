// functions/api/dispatch.js — BUILT 2026-09-29 · dispatch-1a
//
// The Medellín desk: Luis Orozco's daily dispatches.
//
// GET                    -> { bio, dispatches: [latest 20] }
// GET  ?id=ID            -> { dispatch }
// POST ?key=LUIS_KEY  { title, body, place }          -> file a dispatch
// POST ?key=LUIS_KEY  { action:"edit", id, title, body, place }
// POST ?key=LUIS_KEY  { action:"bio", bio }           -> update his byline line
// POST ?key=LUIS_KEY|TIP_ADMIN_KEY { action:"delete", id }
//
// Nothing is ever published under his name except what he files with his key.
// Posting page: /desk.html
//
// KV binding: EMAIL_LIST   keys: dispatch:<ISO time>:<rand>, desk:bio
// Env vars:   LUIS_KEY (his), TIP_ADMIN_KEY (Mark's, can delete)

const AUTHOR = "Luis Orozco";
const DEFAULT_BIO = "Journalist · Medellín, Colombia";
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max); }

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  const url = new URL(context.request.url);
  if (!kv) return ok({ bio: DEFAULT_BIO, dispatches: [] });
  try {
    const id = url.searchParams.get("id");
    if (id) {
      const raw = id.startsWith("dispatch:") ? await kv.get(id) : null;
      return raw ? ok({ dispatch: { id, ...JSON.parse(raw) } }) : ok({ dispatch: null }, 404);
    }
    const [bio, list] = await Promise.all([kv.get("desk:bio"), kv.list({ prefix: "dispatch:" })]);
    const names = list.keys.map(k => k.name).sort().reverse().slice(0, 20);
    const recs = await Promise.all(names.map(async n => {
      const raw = await kv.get(n);
      try { return raw ? { id: n, ...JSON.parse(raw) } : null; } catch (e) { return null; }
    }));
    return ok({ author: AUTHOR, bio: bio || DEFAULT_BIO, dispatches: recs.filter(Boolean) });
  } catch (err) {
    return ok({ author: AUTHOR, bio: DEFAULT_BIO, dispatches: [] });
  }
}

export async function onRequestPost(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key") || "";
  const isLuis = !!(env.LUIS_KEY && key === env.LUIS_KEY);
  const isAdmin = !!(env.TIP_ADMIN_KEY && key === env.TIP_ADMIN_KEY);
  if (!isLuis && !isAdmin) return ok({ success: false, error: "Not authorized." }, 401);

  try {
    const b = await context.request.json();

    if (b.action === "delete") {
      if (!String(b.id || "").startsWith("dispatch:")) return ok({ success: false, error: "Bad id." });
      await env.EMAIL_LIST.delete(b.id);
      return ok({ success: true });
    }

    // Everything below writes under Luis's name, so only his key can do it.
    if (!isLuis) return ok({ success: false, error: "Only the desk's own key can file under Luis Orozco's name." }, 403);

    if (b.action === "bio") {
      await env.EMAIL_LIST.put("desk:bio", clean(b.bio, 160) || DEFAULT_BIO);
      return ok({ success: true });
    }

    const title = clean(b.title, 160);
    const body = clean(b.body, 8000);
    const place = clean(b.place, 80) || "Medellín";
    if (title.length < 6) return ok({ success: false, error: "Add a headline." });
    if (body.length < 40) return ok({ success: false, error: "Add the dispatch text." });

    if (b.action === "edit") {
      if (!String(b.id || "").startsWith("dispatch:")) return ok({ success: false, error: "Bad id." });
      const raw = await env.EMAIL_LIST.get(b.id);
      if (!raw) return ok({ success: false, error: "Not found." });
      const rec = JSON.parse(raw);
      Object.assign(rec, { title, body, place, edited: new Date().toISOString() });
      await env.EMAIL_LIST.put(b.id, JSON.stringify(rec));
      return ok({ success: true, id: b.id });
    }

    const now = new Date().toISOString();
    const id = "dispatch:" + now + ":" + Math.random().toString(36).slice(2, 7);
    await env.EMAIL_LIST.put(id, JSON.stringify({ author: AUTHOR, title, body, place, published: now }));
    return ok({ success: true, id });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong." });
  }
}
