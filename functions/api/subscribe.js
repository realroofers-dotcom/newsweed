// functions/api/subscribe.js
// Accepts POST requests with { email } and stores them in the EMAIL_LIST KV namespace.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return json({ success: false, error: "Please enter a valid email address." }, 400);
    }

    if (!env.EMAIL_LIST) {
      return json({ success: false, error: "Signup storage is not configured yet." }, 500);
    }

    // Check for an existing entry so we don't overwrite signup date on repeat submits
    const existing = await env.EMAIL_LIST.get(email);
    if (existing) {
      return json({ success: true, alreadySubscribed: true });
    }

    const record = {
      email,
      subscribedAt: new Date().toISOString(),
      source: "newsweed.com future-signup"
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
