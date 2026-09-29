// functions/api/contributors.js — BUILT 2026-09-29 · contributors-1a
//
// Newsweed's contributor journalists. Mark, 29 Sep 2026: "this will be a procedure we do for a variety of
// journalists. I have to get people to use Newsweed to promote themselves because I cannot afford to pay now."
// So every contributor gets a public profile (bio, beat, city, their own links) next to their work.
//
//   GET                           -> { contributors:[public profiles, newest work first] }
//   GET ?slug=luis-orozco         -> { contributor }
//   POST ?key=DESK_KEY { action:"me" }                                  -> who am I (for the desk page)
//   POST ?key=DESK_KEY { action:"profile", bio, beat, location, links }  -> a contributor edits their own profile
//   POST ?admin=KEY { action:"create", name, beat, location, bio, links } -> { contributor, key }  (key shown ONCE)
//   POST ?admin=KEY { action:"rekey", slug }                              -> { key }  (old key stops working)
//   POST ?admin=KEY { action:"active", slug, active:true|false }
//   POST ?admin=KEY { action:"list" }                                     -> everyone, including inactive
//
// KV: contrib:<slug>, contribkey:<sha256 of key>, contribkeyof:<slug> (the current key's hash, to revoke it)

import { sha256, newKey, slugify, getContributor, contributorForKey, publicProfile, cleanLinks, LUIS } from "../_lib/contrib.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max); }
function isAdmin(env, url) { const k = url.searchParams.get("admin"); return !!(k && env.TIP_ADMIN_KEY && k === env.TIP_ADMIN_KEY); }

async function all(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "contrib:", cursor });
    for (const k of page.keys) { const c = await getContributor(kv, k.name.slice(8)); if (c) out.push(c); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

async function issueKey(kv, slug) {
  const oldHash = await kv.get("contribkeyof:" + slug);
  if (oldHash) await kv.delete("contribkey:" + oldHash);
  const key = newKey();
  const h = await sha256(key);
  await kv.put("contribkey:" + h, slug);
  await kv.put("contribkeyof:" + slug, h);
  return key;
}

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  const url = new URL(context.request.url);
  if (!kv) return ok({ contributors: [] });
  const slug = url.searchParams.get("slug");
  if (slug) {
    let c = await getContributor(kv, slug);
    if (!c && slug === LUIS.slug) c = Object.assign({ bio: "", links: [] }, LUIS);
    return c && c.active !== false ? ok({ contributor: publicProfile(c) }) : ok({ contributor: null }, 404);
  }
  let list = (await all(kv)).filter(c => c.active !== false);
  if (!list.find(c => c.slug === LUIS.slug)) list.unshift(Object.assign({ bio: "", links: [] }, LUIS));
  return ok({ contributors: list.map(publicProfile) });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Not set up yet." }, 500);
  const b = await request.json().catch(() => ({}));

  // ---- The editor ----
  if (url.searchParams.get("admin")) {
    if (!isAdmin(env, url)) return ok({ success: false, error: "Not authorized." }, 401);
    if (b.action === "list") return ok({ success: true, contributors: await all(kv) });
    if (b.action === "create") {
      const name = clean(b.name, 60);
      if (name.length < 3) return ok({ success: false, error: "Their full name, please." });
      let slug = slugify(name) || "writer";
      if (slug !== LUIS.slug) { let n = 2, base = slug; while (await getContributor(kv, slug)) slug = base + "-" + n++; }
      const existing = await getContributor(kv, slug);
      const c = Object.assign(existing || { created: new Date().toISOString() }, {
        slug, name, beat: clean(b.beat, 60), location: clean(b.location, 60), bio: clean(b.bio, 800),
        links: cleanLinks(b.links), active: true
      });
      await kv.put("contrib:" + slug, JSON.stringify(c));
      const key = await issueKey(kv, slug);
      return ok({ success: true, contributor: c, key });
    }
    const c = await getContributor(kv, String(b.slug || ""));
    if (!c) return ok({ success: false, error: "No such contributor." });
    if (b.action === "rekey") return ok({ success: true, key: await issueKey(kv, c.slug) });
    if (b.action === "active") {
      c.active = !!b.active;
      await kv.put("contrib:" + c.slug, JSON.stringify(c));
      return ok({ success: true });
    }
    return ok({ success: false, error: "Unknown action." });
  }

  // ---- A contributor, with their own desk key ----
  const me = await contributorForKey(env, url.searchParams.get("key"));
  if (!me) return ok({ success: false, error: "That desk key isn't recognized." }, 401);
  if (b.action === "me") return ok({ success: true, contributor: publicProfile(me) });
  if (b.action === "profile") {
    const c = (await getContributor(kv, me.slug)) || Object.assign({ created: new Date().toISOString(), active: true }, me);
    Object.assign(c, { bio: clean(b.bio, 800), beat: clean(b.beat, 60), location: clean(b.location, 60), links: cleanLinks(b.links) });
    await kv.put("contrib:" + c.slug, JSON.stringify(c));
    return ok({ success: true, contributor: publicProfile(c) });
  }
  return ok({ success: false, error: "Unknown action." });
}
