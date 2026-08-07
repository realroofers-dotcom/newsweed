// functions/api/tips.js
// POST                    -> submit a tip (goes to the pending queue)
// GET                     -> { tips: [...] } approved tips from the last FRESH_HOURS
// GET  ?admin=KEY&pending -> pending queue (for tips-admin.html)
// POST ?admin=KEY {action:"approve"|"reject", key:"tip:..."} -> moderate
//
// KV binding: EMAIL_LIST (same namespace as subscribe.js)
// Env var:    TIP_ADMIN_KEY  — set this in Cloudflare Pages → Settings → Environment variables

const JSON_HEADERS = { "Content-Type": "application/json" };

const MAX_HEADLINE = 120;   // the one line that gets published
const MAX_DETAILS  = 500;   // private context for you, never published
const FRESH_HOURS  = 24;    // tips drop off the public wall after this
const ARCHIVE_DAYS = 30;    // how long a record survives in KV

function ok(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: JSON_HEADERS });
}

function clean(s, max) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isAdmin(context, url) {
  const key = url.searchParams.get("admin");
  return key && context.env.TIP_ADMIN_KEY && key === context.env.TIP_ADMIN_KEY;
}

async function listTips(env, prefix) {
  const out = [];
  let cursor = undefined;
  while (true) {
    const page = await env.EMAIL_LIST.list({ prefix, cursor });
    for (const k of page.keys) {
      const raw = await env.EMAIL_LIST.get(k.name);
      if (raw) {
        try { out.push({ key: k.name, ...JSON.parse(raw) }); } catch (e) {}
      }
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return out;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  try {
    const all = await listTips(context.env, "tip:");

    // Admin view: everything still waiting on you
    if (url.searchParams.has("pending")) {
      if (!isAdmin(context, url)) return ok({ error: "Not authorized." });
      const pending = all
        .filter(t => t.status === "pending")
        .sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
      return ok({ pending });
    }

    // Public wall: approved and still fresh
    const cutoff = Date.now() - FRESH_HOURS * 60 * 60 * 1000;
    const tips = all
      .filter(t => t.status === "approved" && Date.parse(t.submitted) >= cutoff)
      .sort((a, b) => (a.submitted < b.submitted ? 1 : -1))
      .slice(0, 40)
      .map(t => ({
        headline: t.headline,
        place: t.place,
        submitted: t.submitted,
        link: t.link || ""
      }));

    return ok({ tips, freshHours: FRESH_HOURS });
  } catch (err) {
    return ok({ tips: [] });
  }
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);

  try {
    const body = await context.request.json();

    // ---- Moderation actions ----
    if (body.action === "approve" || body.action === "reject") {
      if (!isAdmin(context, url)) return ok({ success: false, error: "Not authorized." });
      const key = String(body.key || "");
      if (!key.startsWith("tip:")) return ok({ success: false, error: "Bad key." });

      if (body.action === "reject") {
        await context.env.EMAIL_LIST.delete(key);
        return ok({ success: true });
      }

      const raw = await context.env.EMAIL_LIST.get(key);
      if (!raw) return ok({ success: false, error: "Not found." });
      const rec = JSON.parse(raw);
      rec.status = "approved";
      rec.approved = new Date().toISOString();
      if (body.headline) rec.headline = clean(body.headline, MAX_HEADLINE); // let you tighten the line
      await context.env.EMAIL_LIST.put(key, JSON.stringify(rec), {
        expirationTtl: 60 * 60 * 24 * ARCHIVE_DAYS
      });
      return ok({ success: true });
    }

    // ---- Public submission ----

    // Honeypot: bots fill hidden fields, humans don't
    if (clean(body.website, 50)) return ok({ success: true });

    const headline = clean(body.headline, MAX_HEADLINE);
    const details = clean(body.details, MAX_DETAILS);

    if (!headline) return ok({ success: false, error: "Please add your one-line tip." });
    if (headline.length < 12) return ok({ success: false, error: "Give us a little more than that." });
    if (!details || details.length < 20) return ok({ success: false, error: "Please add a few words of detail." });

    const ip = context.request.headers.get("CF-Connecting-IP") || "";

    // Light rate limit: one submission per IP per 60 seconds
    if (ip) {
      const gate = "tipgate:" + ip;
      if (await context.env.EMAIL_LIST.get(gate)) {
        return ok({ success: false, error: "Thanks — give it a minute before sending another." });
      }
      await context.env.EMAIL_LIST.put(gate, "1", { expirationTtl: 60 });
    }

    // Where it came from, region level only (city + a tip can identify a person)
    const cf = context.request.cf || {};
    const region = cf.region || "";
    const country = cf.country || context.request.headers.get("CF-IPCountry") || "";
    const place = [region, country].filter(Boolean).join(", ") || "Unknown";

    const now = new Date().toISOString();
    const key = "tip:" + now + ":" + Math.random().toString(36).slice(2, 8);

    const record = {
      status: "pending",
      headline,
      details,
      link: clean(body.link, 300),
      name: clean(body.name, 120),
      email: clean(body.email, 200).toLowerCase(),
      place,
      submitted: now,
      ip,
      country
    };

    await context.env.EMAIL_LIST.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * ARCHIVE_DAYS
    });

    return ok({ success: true });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong. Please try again." });
  }
}
