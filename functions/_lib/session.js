// functions/_lib/session.js — BUILT 2026-09-29 · session-1a
// Who is signed in. Shared by auth and chat. Not a route (no onRequest export).

export function cookie(request, name) {
  const all = request.headers.get("Cookie") || "";
  const m = all.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
}

export async function currentMember(request, env) {
  if (!env.EMAIL_LIST) return null;
  const t = cookie(request, "nw_s");
  if (!t) return null;
  const email = await env.EMAIL_LIST.get("sess:" + t);
  if (!email) return null;
  const raw = await env.EMAIL_LIST.get("member:" + email);
  return raw ? JSON.parse(raw) : null;
}
