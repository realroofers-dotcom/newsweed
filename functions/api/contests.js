// functions/api/contests.js — BUILT 2026-09-29 · contests-1b (music waits for acceptance and is featured on Arts & Music;
//   no violence, no N-word)
// MUSIC IS NEWS entries wait for staff acceptance (POST action "accept"); accepted ones appear in the contest and are
// featured on the Arts & Music page as they come in (GET ?featured=music).
//
// Newsweed contests, the five painted on the truck: Cartoon/Comic, Music Is News, Photography, Poetry, Tattoo.
// Mark, 29 Sep 2026: "the decision will be made by the staff and votes from the Newsweed audience. We can no longer
// give away $, so it is just a status thing, but we will promote the winner. The final will be one year from today,
// each contest one day after the other, and it should be automated in case I drop dead."
//
// FULLY AUTOMATIC — no one has to press anything:
//   - A contest's first final is FIRST_FINAL + its day offset (Cartoon 2027-09-29, Music 09-30, Photo 10-01,
//     Poetry 10-02, Tattoo 10-03), 23:59:59 New York time. After that, a new round opens the same day and closes
//     one year later, forever.
//   - The first request after a round closes computes the winner and stores it permanently (cw:<contest>:<round>).
//   - Winner = 50% audience votes (share of the top entry's votes) + 50% staff score (average 1–10, /10).
//     If no staff member scored anything in that round, the audience alone decides. Ties go to the earlier entry.
//   - Entries go live immediately (so nothing waits on an editor); 3 reader reports hide one for staff review.
//   - Staff = the editor's admin key, or any approved contributor's desk key (judging continues without Mark).
//
// GET                                   -> { contests:[{slug,name,round,final,open,entries,leader,lastWinner}], winners:[...] }
// GET ?c=photo                          -> { contest, entries:[...], myVote }
// GET ?img=ID                           -> the image
// POST { action:"enter", c, title, credit, text?, link?, image?(base64 jpeg), agree, ageOk }   (signed in)
// POST { action:"vote", c, id }         (signed in; one vote per contest per round, can be changed)
// POST { action:"report", c, id }
// POST ?admin=KEY | ?key=DESK_KEY { action:"score", c, id, score:1..10 }   (staff)
// POST ?admin=KEY { action:"remove"|"restore", c, id }                    (editor)
// GET  ?c=photo&staff=1 with ?admin=KEY or ?key=DESK_KEY  -> includes hidden entries and staff scores
//
// KV: ce:<c>:<round>:<id> entry · ceimg:<id> image · cv:<c>:<round>:<email> vote · cw:<c>:<round> winner

import { currentMember } from "../_lib/session.js";
import { contributorForKey } from "../_lib/contrib.js";

const FIRST_FINAL = "2027-09-29";           // one year from the day Mark asked (29 Sep 2026)
const CONTESTS = [
  { slug: "cartoon", name: "Cartoon & Comic Contest", kind: "image", day: 0, blurb: "Draw it. One panel or a strip: funny, sharp, or true." },
  { slug: "music", name: "Music Is News Contest", kind: "link", day: 1, blurb: "Your original song. Post it on YouTube or SoundCloud and enter the link." },
  { slug: "photo", name: "Photography Contest", kind: "image", day: 2, blurb: "One photograph you took. The news, your town, your life." },
  { slug: "poetry", name: "Poetry Contest", kind: "text", day: 3, blurb: "One original poem, up to 3,000 characters." },
  { slug: "tattoo", name: "Tattoo Contest", kind: "image", day: 4, blurb: "A tattoo you designed or wear. Credit the artist." }
];
const REPORTS_TO_HIDE = 3;
// Mark, 29 Sep 2026: "no violence or the N word allowed." The N-word and its spellings are refused automatically in every
// written field. Violence (and anything in a song's lyrics) is judged by people: MUSIC entries wait for staff acceptance,
// and the rules of every contest ban violent entries. Readers can report anything else (3 reports hide an entry).
const SLUR = /\bn+[\W_]*[i1!|líì]+[\W_]*[gq9]+[\W_]*[gq9]+/i;
function slur(...parts) { return parts.some(p => SLUR.test(String(p || ""))); }
const MAX_IMG = 2500000;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max); }
function bySlug(s) { return CONTESTS.find(c => c.slug === s) || null; }

// ---- the calendar (New York time) ----
function nyDate(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date()); }
function addDays(ymd, n) { const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) + n * 86400000; return new Date(t).toISOString().slice(0, 10); }
function addYears(ymd, n) { return (+ymd.slice(0, 4) + n) + ymd.slice(4); }
function finalOf(c, round) { return addYears(addDays(FIRST_FINAL, c.day), round); }
// The open round: the first whose final day hasn't ended yet (today in New York <= final day).
function currentRound(c) { const today = nyDate(); let r = 0; while (finalOf(c, r) < today) r++; return r; }

async function listEntries(kv, c, round) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "ce:" + c.slug + ":" + round + ":", cursor });
    const recs = await Promise.all(page.keys.map(k => kv.get(k.name).then(v => { try { return JSON.parse(v); } catch (e) { return null; } })));
    recs.forEach(r => { if (r) out.push(r); });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.created < b.created ? -1 : 1));
}
function entryKey(c, round, id) { return "ce:" + c + ":" + round + ":" + id; }

function staffAvg(e) { const s = Object.values(e.scores || {}); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; }

function decide(entries) {
  const live = entries.filter(e => !e.hidden && !e.pending);
  if (!live.length) return null;
  const maxVotes = Math.max(1, ...live.map(e => e.votes || 0));
  const anyStaff = live.some(e => staffAvg(e) != null);
  let best = null;
  for (const e of live) {
    const aud = (e.votes || 0) / maxVotes;
    const st = staffAvg(e);
    const score = anyStaff ? 0.5 * aud + 0.5 * ((st == null ? 0 : st) / 10) : aud;
    if (!best || score > best.score) best = { e, score, aud, st };
  }
  return best;
}

// Close any finished rounds that have no winner stored yet, and store it. Runs on every GET: this is the automation.
async function settle(kv, c) {
  const cur = currentRound(c);
  for (let r = Math.max(0, cur - 3); r < cur; r++) {
    const key = "cw:" + c.slug + ":" + r;
    if (await kv.get(key)) continue;
    const entries = await listEntries(kv, c, r);
    const w = decide(entries);
    const rec = w ? {
      contest: c.slug, contestName: c.name, round: r, final: finalOf(c, r), decided: new Date().toISOString(),
      id: w.e.id, title: w.e.title, name: w.e.name, credit: w.e.credit, kind: c.kind, hasImage: !!w.e.hasImage, link: w.e.link || "",
      text: c.kind === "text" ? w.e.text : "", votes: w.e.votes || 0, staff: w.st == null ? null : Math.round(w.st * 10) / 10,
      method: entries.some(e => staffAvg(e) != null) ? "50% audience votes + 50% staff score" : "audience votes (no staff scores)",
      entries: entries.filter(e => !e.hidden && !e.pending).length
    } : { contest: c.slug, contestName: c.name, round: r, final: finalOf(c, r), decided: new Date().toISOString(), none: true };
    await kv.put(key, JSON.stringify(rec));
  }
}

async function winners(kv) {
  const list = await kv.list({ prefix: "cw:" });
  const recs = await Promise.all(list.keys.map(k => kv.get(k.name).then(v => { try { return JSON.parse(v); } catch (e) { return null; } })));
  return recs.filter(r => r && !r.none).sort((a, b) => (a.final < b.final ? 1 : -1));
}

function shown(e, staff) {
  const o = { id: e.id, title: e.title, name: e.name, credit: e.credit, text: e.text || "", link: e.link || "", hasImage: !!e.hasImage, votes: e.votes || 0, created: e.created };
  if (staff) Object.assign(o, { hidden: !!e.hidden, pending: !!e.pending, reports: e.reports || 0, scores: e.scores || {}, email: e.email });
  return o;
}

async function staffOf(env, url) {
  const a = url.searchParams.get("admin");
  if (a && env.TIP_ADMIN_KEY && a === env.TIP_ADMIN_KEY) return { id: "editor", editor: true };
  const c = await contributorForKey(env, url.searchParams.get("key"));
  return c ? { id: c.slug, editor: false } : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ contests: [] });

  const img = url.searchParams.get("img");
  if (img) {
    const bytes = await kv.get("ceimg:" + img.replace(/[^a-z0-9-]/gi, ""), "arrayBuffer");
    return bytes ? new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } }) : new Response("Not found", { status: 404 });
  }

  // The Arts & Music page: accepted Music Is News entries, newest acceptance first.
  if (url.searchParams.get("featured") === "music") {
    const m = bySlug("music");
    const feat = (await listEntries(kv, m, currentRound(m))).filter(e => !e.hidden && !e.pending && e.accepted)
      .sort((a, b) => (a.accepted < b.accepted ? 1 : -1)).slice(0, 12).map(e => shown(e, false));
    return ok({ featured: feat });
  }

  await Promise.all(CONTESTS.map(c => settle(kv, c)));
  const won = await winners(kv);

  const cs = url.searchParams.get("c");
  if (cs) {
    const c = bySlug(cs);
    if (!c) return ok({ error: "No such contest." }, 404);
    const round = currentRound(c);
    const staff = url.searchParams.has("staff") ? await staffOf(env, url) : null;
    const entries = (await listEntries(kv, c, round)).filter(e => staff || (!e.hidden && !e.pending));
    const me = await currentMember(request, env);
    const myVote = me ? await kv.get("cv:" + c.slug + ":" + round + ":" + me.email) : null;
    return ok({ contest: Object.assign({}, c, { round, final: finalOf(c, round) }), entries: entries.map(e => shown(e, !!staff)).sort((a, b) => b.votes - a.votes),
      myVote, signedIn: !!me, winners: won.filter(w => w.contest === c.slug) });
  }

  const out = await Promise.all(CONTESTS.map(async c => {
    const round = currentRound(c);
    const entries = (await listEntries(kv, c, round)).filter(e => !e.hidden && !e.pending);
    const lead = entries.slice().sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
    return Object.assign({}, c, { round, final: finalOf(c, round), entries: entries.length,
      leader: lead && lead.votes ? { title: lead.title, name: lead.name, votes: lead.votes } : null,
      lastWinner: won.find(w => w.contest === c.slug) || null });
  }));
  return ok({ contests: out, winners: won, firstFinal: FIRST_FINAL });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Not set up yet." }, 500);
  const b = await request.json().catch(() => ({}));
  const c = bySlug(b.c);
  if (!c) return ok({ success: false, error: "No such contest." });
  const round = currentRound(c);

  // ---- Staff: score, remove, restore ----
  if (url.searchParams.get("admin") || url.searchParams.get("key")) {
    const staff = await staffOf(env, url);
    if (!staff) return ok({ success: false, error: "Not authorized." }, 401);
    const k = entryKey(c.slug, round, String(b.id || "").replace(/[^a-z0-9-]/gi, ""));
    const e = JSON.parse((await kv.get(k)) || "null");
    if (!e) return ok({ success: false, error: "Entry not found (only the open round can be judged)." });
    if (b.action === "score") {
      const s = parseInt(b.score, 10);
      if (!(s >= 1 && s <= 10)) return ok({ success: false, error: "Score 1 to 10." });
      e.scores = e.scores || {}; e.scores[staff.id] = s;
    } else if (b.action === "accept") {
      e.pending = false; e.accepted = new Date().toISOString(); e.acceptedBy = staff.id;
    } else if ((b.action === "remove" || b.action === "restore") && staff.editor) {
      e.hidden = b.action === "remove"; if (!e.hidden) e.reports = 0;
    } else return ok({ success: false, error: "Not allowed." }, 403);
    await kv.put(k, JSON.stringify(e));
    return ok({ success: true });
  }

  if (b.action === "report") {
    const k = entryKey(c.slug, round, String(b.id || "").replace(/[^a-z0-9-]/gi, ""));
    const e = JSON.parse((await kv.get(k)) || "null");
    if (e) { e.reports = (e.reports || 0) + 1; if (e.reports >= REPORTS_TO_HIDE) e.hidden = true; await kv.put(k, JSON.stringify(e)); }
    return ok({ success: true });
  }

  const me = await currentMember(request, env);
  if (!me) return ok({ success: false, error: "Please sign in first: one person, one vote." }, 401);
  if (me.banned) return ok({ success: false, error: "Your account can't take part." }, 403);

  if (b.action === "vote") {
    const id = String(b.id || "").replace(/[^a-z0-9-]/gi, "");
    const k = entryKey(c.slug, round, id);
    const e = JSON.parse((await kv.get(k)) || "null");
    if (!e || e.hidden || e.pending) return ok({ success: false, error: "That entry isn't open for votes." });
    if (e.email === me.email) return ok({ success: false, error: "You can't vote for your own entry." });
    const vk = "cv:" + c.slug + ":" + round + ":" + me.email;
    const prev = await kv.get(vk);
    if (prev === id) return ok({ success: true, same: true });
    if (prev) {
      const pk = entryKey(c.slug, round, prev);
      const pe = JSON.parse((await kv.get(pk)) || "null");
      if (pe) { pe.votes = Math.max(0, (pe.votes || 0) - 1); await kv.put(pk, JSON.stringify(pe)); }
    }
    e.votes = (e.votes || 0) + 1;
    await kv.put(k, JSON.stringify(e));
    await kv.put(vk, id, { expirationTtl: 60 * 60 * 24 * 400 });
    return ok({ success: true });
  }

  if (b.action === "enter") {
    if (b.agree !== true) return ok({ success: false, error: "Please confirm it's your own original work and follows the rules." });
    if (b.ageOk !== true) return ok({ success: false, error: "Please confirm your age (13+, and a parent's permission if under 18)." });
    const title = clean(b.title, 90), credit = clean(b.credit, 120), name = clean(b.name, 60) || String(me.name || "").slice(0, 60);
    if (title.length < 2) return ok({ success: false, error: "Give your entry a title." });
    const mine = (await listEntries(kv, c, round)).filter(e => e.email === me.email);
    if (mine.length >= 3) return ok({ success: false, error: "Up to 3 entries per person per contest." });
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    if (slur(title, name, credit, b.text)) return ok({ success: false, error: "Not allowed: slurs, including the N-word in any spelling." });
    const e = { id, contest: c.slug, round, title, name, credit, email: me.email, created: new Date().toISOString(), votes: 0, reports: 0, scores: {} };

    if (c.kind === "text") {
      e.text = clean(b.text, 3000);
      if (e.text.length < 20) return ok({ success: false, error: "Paste your poem." });
    } else if (c.kind === "link") {
      const link = clean(b.link, 300);
      if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|soundcloud\.com|musicisnews\.com)\//i.test(link)) return ok({ success: false, error: "Link your song on YouTube, SoundCloud or MusicIsNews.com (https://…)." });
      e.link = link;
      e.pending = true;   // music waits until a staff member has listened and accepted it
    } else {
      let bytes;
      try { const bin = atob(String(b.image || "")); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
      catch (err) { return ok({ success: false, error: "The picture didn't come through. Try again." }); }
      if (bytes.length < 5000) return ok({ success: false, error: "Add your picture." });
      if (bytes.length > MAX_IMG) return ok({ success: false, error: "That picture is too large." });
      if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return ok({ success: false, error: "Picture format not recognized. Try again." });
      await kv.put("ceimg:" + id, bytes);
      e.hasImage = true;
    }
    await kv.put(entryKey(c.slug, round, id), JSON.stringify(e));
    return ok({ success: true, id });
  }
  return ok({ success: false, error: "Unknown action." });
}
