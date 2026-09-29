// functions/api/announce.js — BUILT 2026-09-29 · announce-1a
// The special-announcement bar in every page's header.
//   GET                          -> { announcement: { text, link, until, set } | null }
//   POST ?admin=KEY { text, link, until }   -> set it (until = YYYY-MM-DD, optional; it disappears after that day)
//   POST ?admin=KEY { clear:true }          -> take it down
// KV: EMAIL_LIST  key announce:current

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
function ok(obj, cache) { return new Response(JSON.stringify(obj), { headers: Object.assign({ "Cache-Control": cache || "no-store" }, JSON_HEADERS) }); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
function nyDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  if (!kv) return ok({ announcement: null });
  let a = null;
  try { a = JSON.parse((await kv.get("announce:current")) || "null"); } catch (e) {}
  if (a && a.until && a.until < nyDate()) a = null;
  return ok({ announcement: a }, "public, max-age=60");
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const key = new URL(request.url).searchParams.get("admin");
  if (!env.TIP_ADMIN_KEY || key !== env.TIP_ADMIN_KEY) return ok({ success: false, error: "Not authorized." });
  const b = await request.json().catch(() => ({}));
  if (b.clear) { await env.EMAIL_LIST.delete("announce:current"); return ok({ success: true }); }
  const text = clean(b.text, 220);
  let link = clean(b.link, 400);
  if (text.length < 4) return ok({ success: false, error: "Write the announcement." });
  if (link && !/^(https?:\/\/|\/)/.test(link)) return ok({ success: false, error: "The link must start with https:// or /" });
  const until = /^\d{4}-\d{2}-\d{2}$/.test(b.until || "") ? b.until : "";
  const a = { text, link, until, set: new Date().toISOString() };
  await env.EMAIL_LIST.put("announce:current", JSON.stringify(a));
  return ok({ success: true, announcement: a });
}
