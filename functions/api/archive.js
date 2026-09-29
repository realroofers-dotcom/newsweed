// functions/api/archive.js — BUILT 2026-09-29 · archive-1a
//
// Every day's news, kept.
//   GET /api/archive                  -> { days: ["2026-09-29", ...] }   newest first
//   GET /api/archive?date=2026-09-29  -> { date, volume, groups:{home:{top:[...],...}, farm:{...}}, corruptmen }
//
// Written by /api/feed (arch:DATE:GROUP) and /api/corruptmen (cm:DATE). Read-only here.

const FIRST_DAY = "2026-09-29"; // Newsweed relaunched as a news site: Volume 1
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }

function volumeFor(date) {
  return Math.floor((Date.parse(date + "T12:00:00Z") - Date.parse(FIRST_DAY + "T12:00:00Z")) / 86400000) + 1;
}

export async function onRequestGet(context) {
  const kv = context.env.EMAIL_LIST;
  if (!kv) return ok({ days: [] });
  const date = new URL(context.request.url).searchParams.get("date");

  if (!date) {
    const days = new Set();
    let cursor;
    do {
      const page = await kv.list({ prefix: "arch:", cursor });
      page.keys.forEach(k => days.add(k.name.slice(5, 15)));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return ok({ days: Array.from(days).sort().reverse(), firstDay: FIRST_DAY });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ok({ error: "Use a date like 2026-09-29." }, 400);
  const list = await kv.list({ prefix: "arch:" + date + ":" });
  const groups = {};
  await Promise.all(list.keys.map(async k => {
    try { groups[k.name.split(":")[2]] = JSON.parse(await kv.get(k.name)); } catch (e) {}
  }));
  let corruptmen = null;
  try { corruptmen = JSON.parse((await kv.get("cm:" + date)) || "null"); } catch (e) {}
  return ok({ date, volume: volumeFor(date), groups, corruptmen });
}
