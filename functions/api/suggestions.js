// functions/api/suggestions.js — BUILT 2026-09-29 · suggestions-1a
// POST { kind, text, name?, email?, website(honeypot) } -> stores a reader suggestion
// Private: suggestions are read by the editor (CSV export: /api/export?type=suggestions), never posted.
//
// KV binding: EMAIL_LIST   keys: sugg:<ISO time>:<rand> (kept 1 year), sugggate:<ip>

const KINDS = ["story", "coverage", "site", "correction", "other"];
const JSON_HEADERS = { "Content-Type": "application/json" };
function ok(obj) { return new Response(JSON.stringify(obj), { status: 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    if (clean(b.website, 50)) return ok({ success: true }); // honeypot
    const text = clean(b.text, 2000);
    if (text.length < 10) return ok({ success: false, error: "Please write a sentence or two." });
    const email = clean(b.email, 200).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ success: false, error: "That email doesn't look right — or leave it blank." });

    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (ip) {
      if (await env.EMAIL_LIST.get("sugggate:" + ip)) return ok({ success: false, error: "Thanks — give it a minute before sending another." });
      await env.EMAIL_LIST.put("sugggate:" + ip, "1", { expirationTtl: 60 });
    }

    const now = new Date().toISOString();
    const rec = {
      kind: KINDS.includes(b.kind) ? b.kind : "other",
      text,
      name: clean(b.name, 120),
      email,
      submitted: now,
      country: request.headers.get("CF-IPCountry") || ""
    };
    await env.EMAIL_LIST.put("sugg:" + now + ":" + Math.random().toString(36).slice(2, 7), JSON.stringify(rec), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return ok({ success: true });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong. Please try again." });
  }
}
