// functions/api/dating.js — BUILT 2026-09-29 · dating-1a
//
// Dating, by state. Mark, 29 Sep 2026: "voice and rough location only, people introduce themselves and record."
//
// No photos, no phone numbers, no exact addresses: a first name, an age, a state, a rough area, who they
// hope to meet, and a voice introduction up to 60 seconds. Adults only (18+).
// Posting and saying hello need sign-in (Google, same as the chat room): nobody here is anonymous to us,
// even though only a first name is shown. Every recording is heard by the editor before it goes live.
//
//   GET  ?state=NJ                     -> { profiles:[...] }   live, newest first
//   GET  ?audio=ID                     -> the recording (live profiles only; admin key also plays pending)
//   GET  ?mine                         -> { profile, inbox }  (signed in)
//   POST { action:"post", firstName, age, state, area, seeking, audio(base64), mime, agree18, agreeRules }
//   POST { action:"hello", id, text }  -> a short private message to that profile's inbox
//   POST { action:"reply", to, text }  -> answer a message in your inbox
//   POST { action:"delete" }           -> remove your own profile
//   POST { action:"report", id }       -> 2 reports takes a profile down for review
//   GET  ?admin=KEY&pending ; POST ?admin=KEY { action:"approve"|"reject", id }
//
// KV: dt:p:<id> profile · dt:a:<id> audio · dt:live list · dt:own:<email> -> id · dt:in:<email> inbox

import { currentMember } from "../_lib/session.js";
import { isState } from "../_lib/states.js";

const MAX_AUDIO_BYTES = 1500000;   // about 60 seconds of compressed audio
const DAYS_LIVE = 90;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
function isAdmin(env, url) { const k = url.searchParams.get("admin"); return !!(k && env.TIP_ADMIN_KEY && k === env.TIP_ADMIN_KEY); }

// Contact details and sex-work language are not allowed in the written fields.
const NO_CONTACT = /(\d[\s.\-()]*){7,}|@|https?:|www\.|\.com\b|snap(chat)?|insta(gram)?|whats ?app|telegram|kik\b|onlyfans|cash ?app|venmo|\$\d|escort|sugar (daddy|baby)|donation/i;

async function live(kv) { try { return JSON.parse((await kv.get("dt:live")) || "[]"); } catch (e) { return []; } }
function fresh(p) { return Date.now() - Date.parse(p.approved || p.submitted) < DAYS_LIVE * 86400000; }
function shown(p) { return { id: p.id, firstName: p.firstName, age: p.age, state: p.state, area: p.area, seeking: p.seeking, posted: p.approved || p.submitted, seconds: p.seconds || null }; }

export async function onRequestGet(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ profiles: [] });

  const audio = url.searchParams.get("audio");
  if (audio) {
    const id = audio.replace(/[^a-z0-9\-]/gi, "");
    const p = JSON.parse((await kv.get("dt:p:" + id)) || "null");
    if (!p || (p.status !== "live" && !isAdmin(env, url))) return new Response("Not found", { status: 404 });
    const bytes = await kv.get("dt:a:" + id, "arrayBuffer");
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(bytes, { headers: { "Content-Type": p.mime || "audio/webm", "Cache-Control": "private, max-age=3600" } });
  }

  if (url.searchParams.has("pending")) {
    if (!isAdmin(env, url)) return ok({ error: "Not authorized." }, 401);
    const out = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: "dt:p:", cursor });
      for (const k of page.keys) {
        try { const p = JSON.parse(await kv.get(k.name)); if (p && p.status === "pending") out.push(Object.assign(shown(p), { email: p.email, name: p.memberName })); } catch (e) {}
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return ok({ pending: out });
  }

  if (url.searchParams.has("mine")) {
    const m = await currentMember(request, env);
    if (!m) return ok({ signedIn: false });
    const id = await kv.get("dt:own:" + m.email);
    const p = id ? JSON.parse((await kv.get("dt:p:" + id)) || "null") : null;
    const inbox = JSON.parse((await kv.get("dt:in:" + m.email)) || "[]").map(x => ({ id: x.id, fromName: x.fromName, fromState: x.fromState, text: x.text, at: x.at }));
    return ok({ signedIn: true, profile: p ? Object.assign(shown(p), { status: p.status }) : null, inbox });
  }

  const st = (url.searchParams.get("state") || "").toUpperCase();
  const list = (await live(kv)).filter(fresh).filter(p => !st || p.state === st).map(shown);
  return ok({ profiles: list });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Not set up yet." }, 500);
  let b;
  try { b = await request.json(); } catch (e) { return ok({ success: false, error: "Bad request." }, 400); }

  // ---- Editor ----
  if (isAdmin(env, url)) {
    const id = String(b.id || "").replace(/[^a-z0-9\-]/gi, "");
    const p = JSON.parse((await kv.get("dt:p:" + id)) || "null");
    if (!p) return ok({ success: false, error: "Not found." });
    let l = await live(kv);
    if (b.action === "approve") { p.status = "live"; p.approved = new Date().toISOString(); p.reports = 0; l = [p].concat(l.filter(x => x.id !== id)).filter(fresh).slice(0, 2000); }
    else if (b.action === "reject") { p.status = "rejected"; l = l.filter(x => x.id !== id); }
    else return ok({ success: false, error: "Unknown action." });
    await kv.put("dt:p:" + id, JSON.stringify(p));
    await kv.put("dt:live", JSON.stringify(l.map(x => Object.assign({}, x))));
    return ok({ success: true });
  }

  if (b.action === "report") {
    const l = await live(kv);
    const p = l.find(x => x.id === b.id);
    if (p) {
      p.reports = (p.reports || 0) + 1;
      if (p.reports >= 2) {
        const full = JSON.parse((await kv.get("dt:p:" + p.id)) || "null");
        if (full) { full.status = "pending"; await kv.put("dt:p:" + p.id, JSON.stringify(full)); }
        await kv.put("dt:live", JSON.stringify(l.filter(x => x.id !== p.id)));
      } else await kv.put("dt:live", JSON.stringify(l));
    }
    return ok({ success: true });
  }

  const m = await currentMember(request, env);
  if (!m) return ok({ success: false, error: "Please sign in first. Nobody posts or writes here anonymously." }, 401);
  if (m.banned) return ok({ success: false, error: "Your posting privileges have been removed." }, 403);

  if (b.action === "delete") {
    const id = await kv.get("dt:own:" + m.email);
    if (id) {
      await kv.delete("dt:p:" + id); await kv.delete("dt:a:" + id); await kv.delete("dt:own:" + m.email);
      await kv.put("dt:live", JSON.stringify((await live(kv)).filter(x => x.id !== id)));
    }
    return ok({ success: true });
  }

  if (b.action === "hello" || b.action === "reply") {
    const text = clean(b.text, 300);
    if (text.length < 2) return ok({ success: false, error: "Write a few words." });
    if (NO_CONTACT.test(text)) return ok({ success: false, error: "For everyone's safety, no phone numbers, emails, links or social handles in a first message." });
    const gate = "dt:gate:" + m.email;
    if (await kv.get(gate)) return ok({ success: false, error: "One message a minute, please." });
    await kv.put(gate, "1", { expirationTtl: 60 });

    let toEmail = "";
    if (b.action === "hello") {
      const p = (await live(kv)).find(x => x.id === b.id);
      if (!p) return ok({ success: false, error: "That profile is no longer up." });
      toEmail = p.email;
    } else {
      const mine = JSON.parse((await kv.get("dt:in:" + m.email)) || "[]");
      const msg = mine.find(x => x.id === b.to);
      if (!msg) return ok({ success: false, error: "Message not found." });
      toEmail = msg.fromEmail;
    }
    if (toEmail === m.email) return ok({ success: false, error: "That's you." });
    const myId = await kv.get("dt:own:" + m.email);
    const myP = myId ? JSON.parse((await kv.get("dt:p:" + myId)) || "null") : null;
    const inbox = JSON.parse((await kv.get("dt:in:" + toEmail)) || "[]");
    inbox.unshift({ id: Math.random().toString(36).slice(2, 10), fromEmail: m.email, fromName: myP ? myP.firstName : String(m.name || "").split(" ")[0], fromState: myP ? myP.state : "", text, at: new Date().toISOString() });
    await kv.put("dt:in:" + toEmail, JSON.stringify(inbox.slice(0, 100)));
    return ok({ success: true });
  }

  if (b.action !== "post") return ok({ success: false, error: "Unknown action." });

  const firstName = clean(b.firstName, 24).split(" ")[0];
  const age = parseInt(b.age, 10);
  const state = clean(b.state, 2).toUpperCase();
  const area = clean(b.area, 40), seeking = clean(b.seeking, 60);
  if (!firstName) return ok({ success: false, error: "Your first name, please." });
  if (!(age >= 18 && age <= 110) || b.agree18 !== true) return ok({ success: false, error: "Dating is for adults 18 and over." });
  if (!isState(state)) return ok({ success: false, error: "Pick your state." });
  if (b.agreeRules !== true) return ok({ success: false, error: "Please agree to the dating rules." });
  if (NO_CONTACT.test([firstName, area, seeking].join(" "))) return ok({ success: false, error: "No contact details, links or money talk in your profile. Your voice does the talking." });

  const mime = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a)/.test(String(b.mime || "")) ? String(b.mime).split(";")[0] : "";
  if (!mime) return ok({ success: false, error: "Please record your voice introduction." });
  let bytes;
  try {
    const bin = atob(String(b.audio || ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) { return ok({ success: false, error: "The recording didn't come through. Please try again." }); }
  if (bytes.length < 2000) return ok({ success: false, error: "The recording is too short." });
  if (bytes.length > MAX_AUDIO_BYTES) return ok({ success: false, error: "Keep it to about a minute." });

  // One profile per member: a new recording replaces the old one and goes back to review.
  const old = await kv.get("dt:own:" + m.email);
  if (old) {
    await kv.delete("dt:p:" + old); await kv.delete("dt:a:" + old);
    await kv.put("dt:live", JSON.stringify((await live(kv)).filter(x => x.id !== old)));
  }
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const p = { id, status: "pending", firstName, age, state, area, seeking, mime, seconds: Math.min(90, parseInt(b.seconds, 10) || 0) || null,
    email: m.email, memberName: m.name, submitted: new Date().toISOString() };
  await kv.put("dt:a:" + id, bytes);
  await kv.put("dt:p:" + id, JSON.stringify(p));
  await kv.put("dt:own:" + m.email, id);
  return ok({ success: true, status: "pending" });
}
