// functions/api/auth/[[path]].js — BUILT 2026-09-29 · auth-1a
//
// Sign-in for the Newsweed chat room. No anonymous posting: every member is a
// verified Google account, and posts show the member's name.
//
//   GET /api/auth/google?back=/chat.html   -> off to Google
//   GET /api/auth/callback                 <- Google comes back here
//   GET /api/auth/me                       -> { member } or { member:null }
//   GET /api/auth/logout
//
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — an OAuth client of type "Web application"
//   with the authorized redirect URI:  https://newsweed.com/api/auth/callback
//
// KV binding: EMAIL_LIST   keys: sess:<token> (30 days), member:<email>

import { cookie, currentMember } from "../../_lib/session.js";

const SESSION_DAYS = 30;
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const step = (params.path || [])[0] || "";

  if (step === "me") {
    const member = await currentMember(request, env);
    return json({ member: member ? publicMember(member) : null, signInReady: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) });
  }

  if (step === "logout") {
    const token = cookie(request, "nw_s");
    if (token && env.EMAIL_LIST) await env.EMAIL_LIST.delete("sess:" + token);
    return redirect(safeBack(url.searchParams.get("back")), [clearCookie("nw_s")]);
  }

  if (step === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return new Response("Sign-in is not switched on yet.", { status: 503 });
    }
    const state = token(24);
    const back = safeBack(url.searchParams.get("back"));
    const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    g.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: url.origin + "/api/auth/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account"
    }).toString();
    return redirect(g.toString(), [
      setCookie("nw_state", state + "|" + encodeURIComponent(back), 600)
    ]);
  }

  if (step === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const saved = (cookie(request, "nw_state") || "").split("|");
    if (!code || !state || saved[0] !== state) return new Response("Sign-in expired. Please try again.", { status: 400 });
    const back = safeBack(decodeURIComponent(saved[1] || "/chat.html"));

    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: url.origin + "/api/auth/callback", grant_type: "authorization_code"
      })
    });
    const tok = await tr.json().catch(() => ({}));
    if (!tok.id_token) return new Response("Google did not sign you in. Please try again.", { status: 400 });

    const ir = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(tok.id_token));
    const info = await ir.json().catch(() => ({}));
    if (!info.email || info.aud !== env.GOOGLE_CLIENT_ID || String(info.email_verified) !== "true") {
      return new Response("That Google account could not be verified.", { status: 400 });
    }

    const email = String(info.email).toLowerCase();
    const mkey = "member:" + email;
    const existing = JSON.parse((await env.EMAIL_LIST.get(mkey)) || "null");
    const member = existing || { email, joined: new Date().toISOString() };
    member.name = String(info.name || member.name || email.split("@")[0]).slice(0, 80);
    member.picture = String(info.picture || "").slice(0, 400);
    member.lastSeen = new Date().toISOString();
    await env.EMAIL_LIST.put(mkey, JSON.stringify(member));

    const s = token(32);
    await env.EMAIL_LIST.put("sess:" + s, email, { expirationTtl: 60 * 60 * 24 * SESSION_DAYS });
    return redirect(back, [setCookie("nw_s", s, 60 * 60 * 24 * SESSION_DAYS), clearCookie("nw_state")]);
  }

  return json({ error: "Not found." }, 404);
}

function publicMember(m) {
  return { name: m.name, picture: m.picture, joined: m.joined, banned: !!m.banned };
}

function setCookie(name, value, maxAge) {
  return name + "=" + value + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Lax";
}
function clearCookie(name) { return name + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"; }
function safeBack(b) { return typeof b === "string" && /^\/[a-z0-9\-_.\/?=&#]*$/i.test(b) && !b.startsWith("//") ? b : "/chat.html"; }
function token(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, x => x.toString(16).padStart(2, "0")).join("");
}
function redirect(to, cookies) {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  (cookies || []).forEach(c => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
