// functions/api/classifieds.js — BUILT 2026-09-29 · classifieds-1a
//
// Free classifieds. Mark, 29 Sep 2026: "free to post as long as it's not drugs, prostitution or other."
//
//   GET  ?cat=forsale&state=NJ          -> { ads:[...] }  live ads, newest first (expired ads drop off)
//   POST { cat, title, body, price, state, town, contact, email, agree, website(honeypot) }
//                                       -> goes to the queue; live once approved in tips-admin.html
//   POST { action:"report", id }        -> readers flag an ad; 3 flags takes it down for review
//   GET  ?admin=KEY&pending             -> the queue
//   POST ?admin=KEY { action:"approve"|"reject"|"remove", id }
//
// Not allowed, refused on the spot (and checked again by hand): drugs of any kind, prostitution or
// "adult services", weapons and ammunition, alcohol and tobacco sales, gambling, fake documents,
// get-rich-quick and investment schemes. The poster's email is private; only the contact they type is shown.
//
// KV binding: EMAIL_LIST   clf:<id> (one ad), clf:live (the live list), clfgate:<ip>

const CATS = {
  forsale: "For sale", jobs: "Jobs", services: "Services", housing: "Housing & rentals", autos: "Autos",
  farm: "Farm & garden", pets: "Pets & animals", community: "Community & events", lostfound: "Lost & found", wanted: "Wanted"
};
const DAYS_LIVE = 30;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function ok(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }
function clean(s, max) { return String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max); }

// Each rule: [pattern, what to tell the poster]
const BANNED = [
  // Kept narrow on purpose: "nail gun", "crack in the windshield", "Coke machine", "casino night fundraiser" must pass.
  [/\b(weed for sale|marijuana|cannabis|thc|dispensar\w*|kush|pre-?rolls?|psilocybin|shrooms|magic mushrooms?|kratom|lsd|mdma|molly|ecstasy|cocaine|crack cocaine|meth|methamphetamine|heroin|fentanyl|opioids?|oxycodone|oxycontin|oxys|percocet|xanax|adderall|vicodin|pills? for sale|no prescription|rx without)\b/i, "Drugs of any kind"],
  [/\b(escort\w*|happy ending|full service|gfe|sugar (daddy|baby|mommy)|hook-?ups?|onlyfans|adult (services|entertainment|fun)|body ?rub|erotic|sensual massage|incall|outcall|nsa fun)\b/i, "Prostitution or adult services"],
  [/\b(firearms?|rifles?|pistols?|handguns?|shotguns?|guns? for sale|ammo|ammunition|ar-?15|glock|suppressors?|silencers?|ghost guns?|switchblades?)\b/i, "Weapons and ammunition"],
  [/\b(liquor|vodka|whiske?y|bourbon|beer for sale|wine for sale|moonshine|cigarettes|vapes?|nicotine)\b/i, "Alcohol and tobacco sales"],
  [/\b(betting tips|sure bets?|bookie|sportsbook|online casino)\b/i, "Gambling"],
  [/\b(fake (id|ids|passport|diploma)|counterfeit|replica (rolex|designer)|ssn for sale|cloned cards?)\b/i, "Fake documents or counterfeits"],
  [/\b(get rich|guaranteed (returns?|income)|double your money|crypto (investment|signals)|forex signals|work from home.{0,20}\$\d{3,}|mlm|pyramid scheme)\b/i, "Get-rich-quick or investment schemes"]
];

function banned(text) {
  for (const [rx, why] of BANNED) if (rx.test(text)) return why;
  return "";
}

async function liveList(kv) {
  try { return JSON.parse((await kv.get("clf:live")) || "[]"); } catch (e) { return []; }
}
function notExpired(a) { return Date.now() - Date.parse(a.approved || a.submitted) < DAYS_LIVE * 86400000; }
function shown(a) {
  return { id: a.id, cat: a.cat, catLabel: CATS[a.cat], title: a.title, body: a.body, price: a.price, state: a.state, town: a.town, contact: a.contact, posted: a.approved || a.submitted };
}
function isAdmin(env, url) { const k = url.searchParams.get("admin"); return !!(k && env.TIP_ADMIN_KEY && k === env.TIP_ADMIN_KEY); }

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  if (!env.EMAIL_LIST) return ok({ ads: [], cats: CATS });

  if (url.searchParams.has("pending")) {
    if (!isAdmin(env, url)) return ok({ error: "Not authorized." }, 401);
    const out = [];
    let cursor;
    do {
      const page = await env.EMAIL_LIST.list({ prefix: "clf:ad:", cursor });
      for (const k of page.keys) {
        try { const a = JSON.parse(await env.EMAIL_LIST.get(k.name)); if (a && a.status === "pending") out.push(a); } catch (e) {}
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    out.sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
    return ok({ pending: out });
  }

  const cat = url.searchParams.get("cat");
  const st = (url.searchParams.get("state") || "").toUpperCase();
  const ads = (await liveList(env.EMAIL_LIST)).filter(notExpired)
    .filter(a => !cat || a.cat === cat).filter(a => !st || a.state === st).map(shown);
  return ok({ ads, cats: CATS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.EMAIL_LIST;
  const url = new URL(request.url);
  if (!kv) return ok({ success: false, error: "Classifieds are not set up yet." }, 500);
  let b;
  try { b = await request.json(); } catch (e) { return ok({ success: false, error: "Bad request." }, 400); }

  // ---- Moderation ----
  if (isAdmin(env, url)) {
    const key = "clf:ad:" + String(b.id || "").replace(/[^a-z0-9:.\-TZ]/gi, "");
    const raw = await kv.get(key);
    if (!raw) return ok({ success: false, error: "Not found." });
    const a = JSON.parse(raw);
    let live = await liveList(kv);
    if (b.action === "approve") {
      a.status = "live"; a.approved = new Date().toISOString(); a.reports = 0;
      live = [a].concat(live.filter(x => x.id !== a.id)).filter(notExpired).slice(0, 1000);
    } else if (b.action === "reject" || b.action === "remove") {
      a.status = b.action === "reject" ? "rejected" : "removed";
      live = live.filter(x => x.id !== a.id);
    } else return ok({ success: false, error: "Unknown action." });
    await kv.put(key, JSON.stringify(a), { expirationTtl: 60 * 60 * 24 * 365 });
    await kv.put("clf:live", JSON.stringify(live));
    return ok({ success: true });
  }

  // ---- A reader flags an ad ----
  if (b.action === "report") {
    const live = await liveList(kv);
    const a = live.find(x => x.id === b.id);
    if (!a) return ok({ success: true });
    a.reports = (a.reports || 0) + 1;
    if (a.reports >= 3) {
      a.status = "pending";
      await kv.put("clf:ad:" + a.id, JSON.stringify(a), { expirationTtl: 60 * 60 * 24 * 365 });
      await kv.put("clf:live", JSON.stringify(live.filter(x => x.id !== a.id)));
    } else {
      await kv.put("clf:live", JSON.stringify(live));
    }
    return ok({ success: true });
  }

  // ---- A new ad ----
  if (clean(b.website, 50)) return ok({ success: true }); // honeypot
  const cat = CATS[b.cat] ? b.cat : "";
  const title = clean(b.title, 80), body = clean(b.body, 800), contact = clean(b.contact, 120);
  const state = clean(b.state, 2).toUpperCase(), town = clean(b.town, 60), price = clean(b.price, 30);
  const email = clean(b.email, 200).toLowerCase();
  if (!cat) return ok({ success: false, error: "Pick a category." });
  if (title.length < 5) return ok({ success: false, error: "Give your ad a title." });
  if (body.length < 15) return ok({ success: false, error: "Describe what you're posting." });
  if (!/^[A-Z]{2}$/.test(state)) return ok({ success: false, error: "Pick your state." });
  if (!contact) return ok({ success: false, error: "Say how people can reach you." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ success: false, error: "We need your email (kept private) in case we have to reach you about the ad." });
  if (b.agree !== true) return ok({ success: false, error: "Please agree to the classifieds rules." });
  const why = banned([title, body, contact, price].join(" "));
  if (why) return ok({ success: false, error: "Not allowed in Newsweed classifieds: " + why + "." });

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (ip) {
    if (await kv.get("clfgate:" + ip)) return ok({ success: false, error: "One ad a minute, please." });
    await kv.put("clfgate:" + ip, "1", { expirationTtl: 60 });
  }

  const now = new Date().toISOString();
  const id = now + "-" + Math.random().toString(36).slice(2, 7);
  const ad = { id, status: "pending", cat, title, body, price, state, town, contact, email, submitted: now, ip, country: request.headers.get("CF-IPCountry") || "" };
  await kv.put("clf:ad:" + id, JSON.stringify(ad), { expirationTtl: 60 * 60 * 24 * 365 });
  return ok({ success: true });
}
