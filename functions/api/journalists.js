// functions/api/journalists.js
// GET  -> { count: N }            public roster count
// POST -> { success: true }       adds a journalist to the roster
// Uses the same KV namespace binding as subscribe.js: EMAIL_LIST

const JSON_HEADERS = { "Content-Type": "application/json" };

function ok(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: JSON_HEADERS });
}

function clean(s, max) {
  return String(s || "").trim().slice(0, max || 200);
}

export async function onRequestGet(context) {
  try {
    let count = 0;
    let cursor = undefined;
    // Count keys under the journalist: prefix (paged, 1000 at a time)
    while (true) {
      const list = await context.env.EMAIL_LIST.list({ prefix: "journalist:", cursor });
      count += list.keys.length;
      if (list.list_complete) break;
      cursor = list.cursor;
    }
    return ok({ count });
  } catch (err) {
    return ok({ count: 0 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // Honeypot: bots fill hidden fields, humans don't
    if (clean(body.website)) return ok({ success: true });

    const email = clean(body.email, 200).toLowerCase();
    const name = clean(body.name, 120);

    if (!email || !email.includes("@") || !email.includes(".")) {
      return ok({ success: false, error: "Please enter a valid email address." });
    }
    if (!name) {
      return ok({ success: false, error: "Please enter your name." });
    }

    const key = "journalist:" + email;
    const existing = await context.env.EMAIL_LIST.get(key);
    if (existing) {
      return ok({ success: true, alreadyListed: true });
    }

    const record = {
      name,
      email,
      beat: clean(body.beat, 120),
      location: clean(body.location, 120),
      link: clean(body.link, 300),
      signedUp: new Date().toISOString(),
      ip: context.request.headers.get("CF-Connecting-IP") || "",
      country: context.request.headers.get("CF-IPCountry") || ""
    };

    await context.env.EMAIL_LIST.put(key, JSON.stringify(record));
    return ok({ success: true });
  } catch (err) {
    return ok({ success: false, error: "Something went wrong. Please try again." });
  }
}
