// functions/_middleware.js — BUILT 2026-09-29 · middleware-1a
// Lovappy.news is the dating section's own address (Mark, 29 Sep 2026). When someone visits
// lovappy.news (or www.lovappy.news), the home page they get is the Newsweed dating page;
// every other path works as usual, so the rest of Newsweed is one click away.
// Needs: lovappy.news added as a Custom domain on this Pages project (Cloudflare → Pages → newsweed → Custom domains).

const DATING_HOSTS = ["lovappy.news", "www.lovappy.news"];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (DATING_HOSTS.indexOf(url.hostname) > -1 && (url.pathname === "/" || url.pathname === "/index.html")) {
    // Pages serves /dating.html at /dating (it redirects the .html form), so ask for /dating.
    return context.env.ASSETS.fetch(new Request(new URL("/dating", url.origin), context.request));
  }
  return context.next();
}
