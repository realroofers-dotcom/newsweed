// functions/api/dispatch.js — BUILT 2026-09-29 · dispatch-2a (every contributor, not just Luis)
//
// Dispatches from Newsweed's contributor journalists (Luis Orozco in Medellín was the first).
//
// GET                         -> { dispatches: [latest 30, everyone] }
// GET  ?by=luis-orozco        -> { contributor, bio, dispatches: [that writer's latest 30] }
// GET  ?id=ID                 -> { dispatch }
// POST ?key=DESK_KEY { title, body, place, video? }         -> file under the key's owner (video = YouTube link)
// POST ?key=DESK_KEY { action:"edit", id, title, body, place, video? }   (own dispatches only)
// POST ?key=DESK_KEY|TIP_ADMIN_KEY { action:"delete", id }                (own, or the editor)
//
// Nothing is ever published under a writer's name except what they file with their own key.
// The editor's key can delete but never write. Desk page: /desk.html. Keys: tips-admin.html → Contributors.
//
// KV: dispatch:<ISO time>:<rand>  { author, by, title, body, place, video, published, edited? }
//     (records from before contributors existed have no "by": they are Luis Orozco's)

import { contributorForKey, getContributor, publicProfile, LUIS } from "../_lib/contrib.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max); }

// Videos: the writer uploads to YouTube from the phone and pastes the share link. We keep only the video id;
// pages play it through youtube-nocookie.com. Accepts youtube.com/watch?v=, youtu.be/, /shorts/, /live/.
function parseVideo(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/) || [])[1] || "";
  }
  id = id.split("/")[0];
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? { kind: "youtube", id, url: "https://www.youtube.com/watch?v=" + id } : null;
}

function norm(id, rec) {
  const by = rec.by || LUIS.slug;
  return Object.assign({ id }, rec, { by, author: rec.author || LUIS.name });
}

async function latest(kv, n) {
  const list = await kv.list({ prefix: "dispatch:" });
  const names = list.keys.map(k => k.name).sort().reverse().slice(0, n);
  const recs = await Promise.all(names.map(async k => {
    try { const raw = await kv.get(k); return raw ? norm(k, JSON.parse(raw)) : null; } catch (e) { return null; }
  }));
  return recs.filter(Boolean);
}

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  const url = new URL(context.request.url);
  if (!kv) return ok({ dispatches: [] });
  try {
    const id = url.searchParams.get("id");
    if (id) {
      const raw = id.startsWith("dispatch:") ? await kv.get(id) : null;
      return raw ? ok({ dispatch: norm(id, JSON.parse(raw)) }) : ok({ dispatch: null }, 404);
    }
    const by = url.searchParams.get("by");
    let list = await latest(kv, by ? 200 : 30);
    if (!by) return ok({ dispatches: list });
    list = list.filter(d => d.by === by).slice(0, 30);
    let c = await getContributor(kv, by);
    if (!c && by === LUIS.slug) c = Object.assign({ bio: "", links: [] }, LUIS);
    const legacyBio = by === LUIS.slug ? await kv.get("desk:bio") : null;
    const bio = c ? [c.beat, c.location].filter(Boolean).join(" · ") : "";
    return ok({ contributor: c ? publicProfile(c) : null, bio: legacyBio || (bio ? "Journalist · " + bio : "Journalist"), author: c ? c.name : "", dispatches: list });
  } catch (err) {
    return ok({ dispatches: [] });
  }
}

export async function onRequestPost(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key") || "";
  const isAdmin = !!(env.TIP_ADMIN_KEY && key === env.TIP_ADMIN_KEY);
  const me = isAdmin ? null : await contributorForKey(env, key);
  if (!me && !isAdmin) return ok({ success: false, error: "That desk key isn't recognized." }, 401);

  try {
    const b = await context.request.json();

    if (b.action === "delete") {
      if (!String(b.id || "").startsWith("dispatch:")) return ok({ success: false, error: "Bad id." });
      const raw = await env.EMAIL_LIST.get(b.id);
      if (!raw) return ok({ success: true });
      if (!isAdmin && norm(b.id, JSON.parse(raw)).by !== me.slug) return ok({ success: false, error: "You can only delete your own dispatches." }, 403);
      await env.EMAIL_LIST.delete(b.id);
      return ok({ success: true });
    }

    // Everything below writes under a writer's name, so only that writer's own key can do it.
    if (!me) return ok({ success: false, error: "Only a writer's own desk key can publish under their name." }, 403);

    if (b.action === "bio" && me.slug === LUIS.slug) {  // Luis's original byline line (kept for his old desk)
      await env.EMAIL_LIST.put("desk:bio", clean(b.bio, 160));
      return ok({ success: true });
    }

    const title = clean(b.title, 160);
    const body = clean(b.body, 8000);
    const place = clean(b.place, 80) || me.location || "";
    const video = parseVideo(b.video);
    if (b.video && String(b.video).trim() && !video) return ok({ success: false, error: "That video link didn't work. Paste the YouTube share link (youtube.com or youtu.be)." });
    if (title.length < 6) return ok({ success: false, error: "Add a headline." });
    if (body.length < (video ? 10 : 40)) return ok({ success: false, error: video ? "Add a line or two about the video." : "Add the dispatch text." });

    if (b.action === "edit") {
      if (!String(b.id || "").startsWith("dispatch:")) return ok({ success: false, error: "Bad id." });
      const raw = await env.EMAIL_LIST.get(b.id);
      if (!raw) return ok({ success: false, error: "Not found." });
      const rec = JSON.parse(raw);
      if (norm(b.id, rec).by !== me.slug) return ok({ success: false, error: "You can only edit your own dispatches." }, 403);
      Object.assign(rec, { title, body, place, video, by: me.slug, author: me.name, edited: new Date().toISOString() });
      await env.EMAIL_LIST.put(b.id, JSON.stringify(rec));
      return ok({ success: true, id: b.id });
    }

    const now = new Date().toISOString();
    const id = "dispatch:" + now + ":" + Math.random().toString(36).slice(2, 7);
    await env.EMAIL_LIST.put(id, JSON.stringify({ author: me.name, by: me.slug, title, body, place, video, published: now }));
    return ok({ success: true, id });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong." });
  }
}
