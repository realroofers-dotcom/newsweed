// functions/api/talent.js - BUILT 2026-11-20 · talent-1a
// Mark (2026-11-20): "add a section for up and coming actors and directors let people promote themselves and small short films
// pic required and one paragraph plot" / "all actors require head shot and location , character prefeered".
//
//   GET                          -> { actors:[...], directors:[...], films:[...] }  live posts, newest first (no private fields)
//   GET ?img=ID                  -> the picture (JPEG)
//   POST { action:"post", kind:"actor"|"director"|"film", name, location, character?, title?, plot?, text?, link?,
//          image(base64 jpeg, REQUIRED), email, phone, agree, website(honeypot) }
//        actor:    head shot + name + location required; character (the kind of role they play) preferred.
//        director: picture + name + location required; one paragraph about their work.
//        film:     picture (a still or poster) + title + director's name + location + ONE-paragraph plot required; link optional.
//        Email and phone are required and kept private (never sent back), like events and obituaries: nobody anonymous.
//        A post shows at once, marked "Posted by the artist". At most 3 posts per email per day.
//   POST { action:"report", id }  -> 3 reader reports hide a post for review.
//   POST ?admin=KEY { action:"hide"|"show", id }  -> nothing is ever deleted (Mark's rule); hidden posts stay stored.
//   GET  ?admin=KEY&all=1        -> every post with its status (private fields included, for the editor only).
// KV: EMAIL_LIST   tal:<id> one post · talimg:<id> picture · tal:list the list of ids · talgate:<email>:<day> count

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const KINDS = { actor: "Actor", director: "Director", film: "Short film" };
const MAX_IMG = 2500000;
const NOT_ALLOWED = /\b(porn|xxx|escort|onlyfans|nude|naked|sex\s*work|cocaine|meth|fentanyl|buy\s+followers|crypto\s+giveaway)\b/i;

function ok(obj) { return new Response(JSON.stringify(obj), { headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/[ \t]+/g, " ").replace(/\r/g, "").trim().slice(0, max); }
function isAdmin(env, url) { const k = url.searchParams.get("admin"); return !!(k && env.TIP_ADMIN_KEY && k === env.TIP_ADMIN_KEY); }
function nyDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function pub(p) {
  return { id: p.id, kind: p.kind, kindName: KINDS[p.kind], name: p.name, location: p.location, character: p.character || "", title: p.title || "",
    plot: p.plot || "", text: p.text || "", link: p.link || "", created: p.created };
}
async function list(kv) { try { return JSON.parse((await kv.get("tal:list")) || "[]"); } catch (e) { return []; } }

export async function onRequestGet(context) {
  const { env, request } = context, kv = env.EMAIL_LIST, url = new URL(request.url);
  if (!kv) return ok({ actors: [], directors: [], films: [] });
  const img = url.searchParams.get("img");
  if (img) {
    const bytes = await kv.get("talimg:" + img.replace(/[^a-z0-9-]/gi, ""), "arrayBuffer");
    return bytes ? new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } }) : new Response("Not found", { status: 404 });
  }
  const ids = await list(kv), admin = isAdmin(env, url) && url.searchParams.get("all");
  const posts = [];
  for (const id of ids.slice(0, 300)) {
    const p = JSON.parse((await kv.get("tal:" + id)) || "null"); if (!p) continue;
    if (admin) { posts.push(p); continue; }
    if (p.status === "live") posts.push(pub(p));
  }
  if (admin) return ok({ posts });
  return ok({ actors: posts.filter(p => p.kind === "actor"), directors: posts.filter(p => p.kind === "director"), films: posts.filter(p => p.kind === "film") });
}

export async function onRequestPost(context) {
  const { env, request } = context, kv = env.EMAIL_LIST, url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Posting is not available right now." });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const action = String(b.action || "");

  if (isAdmin(env, url) && (action === "hide" || action === "show")) {
    const id = String(b.id || "").replace(/[^a-z0-9-]/gi, ""), p = JSON.parse((await kv.get("tal:" + id)) || "null");
    if (!p) return ok({ success: false, error: "Not found." });
    p.status = action === "hide" ? "hidden" : "live"; p.changed = new Date().toISOString();
    await kv.put("tal:" + id, JSON.stringify(p)); return ok({ success: true, status: p.status });
  }
  if (action === "report") {
    const id = String(b.id || "").replace(/[^a-z0-9-]/gi, ""), p = JSON.parse((await kv.get("tal:" + id)) || "null");
    if (!p) return ok({ success: false });
    p.reports = (p.reports || 0) + 1; if (p.reports >= 3 && p.status === "live") p.status = "review";
    await kv.put("tal:" + id, JSON.stringify(p)); return ok({ success: true });
  }
  if (action !== "post") return ok({ success: false, error: "Unknown request." });
  if (b.website) return ok({ success: true });   // honeypot

  const kind = KINDS[b.kind] ? b.kind : "";
  const p = { kind, name: clean(b.name, 80), location: clean(b.location, 80), character: clean(b.character, 120), title: clean(b.title, 120),
    plot: clean(b.plot, 1200), text: clean(b.text, 1200), link: clean(b.link, 300), email: clean(b.email, 120).toLowerCase(), phone: clean(b.phone, 30) };
  if (!kind) return ok({ success: false, error: "Choose actor, director or short film." });
  if (!p.name) return ok({ success: false, error: kind === "film" ? "The director's name is required." : "Your name is required." });
  if (!p.location) return ok({ success: false, error: "Your location (city and state or country) is required." });
  if (kind === "film" && !p.title) return ok({ success: false, error: "The film's title is required." });
  if (kind === "film" && p.plot.length < 40) return ok({ success: false, error: "Write the plot in one paragraph (at least a few sentences)." });
  if (kind === "film" && /\n\s*\n/.test(p.plot)) return ok({ success: false, error: "The plot must be one paragraph." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return ok({ success: false, error: "A working email is required (kept private)." });
  if (p.phone.replace(/\D/g, "").length < 7) return ok({ success: false, error: "A phone number is required (kept private)." });
  if (!b.agree) return ok({ success: false, error: "Please confirm the picture and words are yours to post." });
  if (p.link && !/^https:\/\//i.test(p.link)) return ok({ success: false, error: "The link must start with https://" });
  if (NOT_ALLOWED.test([p.name, p.character, p.title, p.plot, p.text, p.link].join(" "))) return ok({ success: false, error: "That post is not allowed on Newsweed." });

  let bytes = null;
  try { const bin = atob(String(b.image || "")); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch (e) {}
  if (!bytes || bytes.length < 2000) return ok({ success: false, error: kind === "actor" ? "A head shot is required." : "A picture is required." });
  if (bytes.length > MAX_IMG) return ok({ success: false, error: "That picture is too large." });
  if (!(bytes[0] === 0xFF && bytes[1] === 0xD8)) return ok({ success: false, error: "The picture must be a photo (JPEG)." });

  const gate = "talgate:" + p.email + ":" + nyDate(), n = Number((await kv.get(gate)) || 0);
  if (n >= 3) return ok({ success: false, error: "Three posts a day per email. Please try tomorrow." });
  await kv.put(gate, String(n + 1), { expirationTtl: 172800 });

  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  Object.assign(p, { id, status: "live", reports: 0, created: new Date().toISOString(), ip: request.headers.get("CF-Connecting-IP") || "" });
  await kv.put("talimg:" + id, bytes);
  await kv.put("tal:" + id, JSON.stringify(p));
  const ids = await list(kv); ids.unshift(id); await kv.put("tal:list", JSON.stringify(ids.slice(0, 2000)));
  return ok({ success: true, id });
}
