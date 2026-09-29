// functions/api/chat.js — BUILT 2026-09-29 · chat-1a
//
// The Newsweed chat room. Two rooms only, and nothing else:
//   report   — report important news: what happened, where, how you know
//   comment  — comment on the news
//
// No anonymous posting: you must be signed in (see /api/auth), and every post
// shows your name. Email addresses are never shown.
//
// GET  ?room=report                         -> { room, messages: [...latest 100] }
// POST { room, text, link? }                -> post (signed-in members only)
// POST ?admin=KEY { action:"hide", room, id }        -> remove a post
// POST ?admin=KEY { action:"ban", email }            -> stop a member posting
//
// KV binding: EMAIL_LIST
//   room:<room>              rolling list of the latest 100 posts (what the page reads)
//   chat:<room>:<time>:<id>  every post, archived 365 days
//   chatgate:<email>         one post a minute (KV's shortest expiry)

import { currentMember } from "../_lib/session.js";

const ROOMS = { report: "Report the news", comment: "Comment on the news" };
const KEEP = 100;
const MAX_TEXT = 600;
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }

async function readRoom(kv, room) {
  try { return JSON.parse((await kv.get("room:" + room)) || "[]"); } catch (e) { return []; }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get("room");
  if (!ROOMS[room]) return ok({ rooms: ROOMS });
  if (!context.env.EMAIL_LIST) return ok({ room, messages: [] });
  const messages = (await readRoom(context.env.EMAIL_LIST, room)).map(m => ({
    id: m.id, name: m.name, picture: m.picture, text: m.text, link: m.link, at: m.at
  }));
  return ok({ room, title: ROOMS[room], messages });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "The room is not set up yet." }, 500);

  let b;
  try { b = await request.json(); } catch (e) { return ok({ success: false, error: "Bad request." }, 400); }

  // ---- Moderation ----
  const adminKey = url.searchParams.get("admin");
  if (adminKey) {
    if (!env.TIP_ADMIN_KEY || adminKey !== env.TIP_ADMIN_KEY) return ok({ success: false, error: "Not authorized." }, 401);
    if (b.action === "hide" && ROOMS[b.room]) {
      const list = (await readRoom(kv, b.room)).filter(m => m.id !== b.id);
      await kv.put("room:" + b.room, JSON.stringify(list));
      return ok({ success: true });
    }
    if (b.action === "ban" && b.email) {
      const mkey = "member:" + String(b.email).toLowerCase();
      const raw = await kv.get(mkey);
      if (!raw) return ok({ success: false, error: "No such member." });
      const m = JSON.parse(raw);
      m.banned = true;
      await kv.put(mkey, JSON.stringify(m));
      return ok({ success: true });
    }
    return ok({ success: false, error: "Unknown action." });
  }

  // ---- A member posts ----
  const member = await currentMember(request, env);
  if (!member) return ok({ success: false, error: "Please sign in to post. No anonymous posts here." }, 401);
  if (member.banned) return ok({ success: false, error: "Your posting privileges have been removed." }, 403);

  const room = b.room;
  if (!ROOMS[room]) return ok({ success: false, error: "That room does not exist." }, 400);

  const text = clean(b.text, MAX_TEXT);
  let link = clean(b.link, 400);
  if (link && !/^https?:\/\/[^\s]+$/i.test(link)) return ok({ success: false, error: "The link must start with http:// or https://" });
  if (text.length < 8) return ok({ success: false, error: "Say a little more." });
  if (room === "report" && text.length < 30) return ok({ success: false, error: "A report needs what happened, where, and how you know." });

  const gate = "chatgate:" + member.email;
  if (await kv.get(gate)) return ok({ success: false, error: "One post a minute, please." });
  await kv.put(gate, "1", { expirationTtl: 60 });

  const at = new Date().toISOString();
  const id = Math.random().toString(36).slice(2, 10);
  const msg = { id, name: member.name, picture: member.picture || "", text, link, at, email: member.email };

  await kv.put("chat:" + room + ":" + at + ":" + id, JSON.stringify(msg), { expirationTtl: 60 * 60 * 24 * 365 });
  const list = await readRoom(kv, room);
  list.unshift(msg);
  await kv.put("room:" + room, JSON.stringify(list.slice(0, KEEP)));

  const { email, ...shown } = msg;
  return ok({ success: true, message: shown });
}
