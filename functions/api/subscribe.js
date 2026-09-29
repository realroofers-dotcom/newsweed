// functions/api/subscribe.js — BUILT 2026-09-29 · subscribe-2a
// POST { email, consent:true, source } -> stores an opt-in in the EMAIL_LIST KV namespace.
// Opt-in only: without consent:true nothing is stored. The record keeps when and where
// the reader agreed, so every address on the list can show it asked to be emailed.

const SOURCES = ["home-daily", "home-sidebar", "chat", "corruptmen", "hero-giveaway", "footer-signup"];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return json({ success: false, error: "Please enter a valid email address." }, 400);
    }
    if (body.consent !== true) {
      return json({ success: false, error: "Please tick the box to agree to receive our emails." }, 400);
    }
    if (!env.EMAIL_LIST) {
      return json({ success: false, error: "Signup storage is not configured yet." }, 500);
    }

    // Don't overwrite the original signup date on repeat submits
    const existing = await env.EMAIL_LIST.get(email);
    if (existing) {
      return json({ success: true, alreadySubscribed: true });
    }

    const record = {
      email,
      subscribedAt: new Date().toISOString(),
      source: SOURCES.includes(body.source) ? body.source : "newsweed.com",
      consent: "Opted in on newsweed.com to receive the Newsweed daily email",
      country: request.headers.get("CF-IPCountry") || ""
    };

    await env.EMAIL_LIST.put(email, JSON.stringify(record));
    return json({ success: true, alreadySubscribed: false });
  } catch (err) {
    return json({ success: false, error: "Something went wrong. Please try again." }, 500);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
