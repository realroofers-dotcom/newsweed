// functions/_lib/contrib.js — BUILT 2026-09-29 · contrib-lib-1a
// Newsweed contributors: unpaid journalists who report for Newsweed and get a public profile that promotes them.
// Each has a private desk key. Keys are never stored, only their SHA-256 hash, so a key can't be read back:
// if one is lost, the editor issues a new one (tips-admin.html → Contributors → New key).
//
// KV (EMAIL_LIST):
//   contrib:<slug>        { slug, name, beat, location, bio, links:[{label,url}], active, created }
//   contribkey:<sha256>   <slug>
//
// Luis Orozco is contributor "luis-orozco". His original LUIS_KEY env var (if set) still works.

export const LUIS = { slug: "luis-orozco", name: "Luis Orozco", beat: "World news", location: "Medellín, Colombia" };

export async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

export function newKey() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, x => chars[x % chars.length]).join("");
}

export function slugify(name) {
  return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export async function getContributor(kv, slug) {
  try { return JSON.parse((await kv.get("contrib:" + slug)) || "null"); } catch (e) { return null; }
}

// Which contributor does this desk key belong to? null if none (or deactivated).
export async function contributorForKey(env, key) {
  key = String(key || "");
  if (!key || !env.EMAIL_LIST) return null;
  if (env.LUIS_KEY && key === env.LUIS_KEY) {
    return (await getContributor(env.EMAIL_LIST, LUIS.slug)) || Object.assign({ active: true, bio: "", links: [] }, LUIS);
  }
  const slug = await env.EMAIL_LIST.get("contribkey:" + (await sha256(key)));
  if (!slug) return null;
  const c = await getContributor(env.EMAIL_LIST, slug);
  return c && c.active !== false ? c : null;
}

export function publicProfile(c) {
  return { slug: c.slug, name: c.name, beat: c.beat || "", location: c.location || "", bio: c.bio || "", links: c.links || [], since: c.created || "" };
}

export function cleanLinks(list) {
  return (Array.isArray(list) ? list : []).slice(0, 5).map(l => ({
    label: String((l && l.label) || "").replace(/\s+/g, " ").trim().slice(0, 40),
    url: String((l && l.url) || "").trim().slice(0, 300)
  })).filter(l => /^https:\/\/[^\s]+$/i.test(l.url)).map(l => ({ label: l.label || hostOf(l.url), url: l.url }));
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "Link"; } }
