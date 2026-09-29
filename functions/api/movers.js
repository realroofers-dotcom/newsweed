// functions/api/movers.js — BUILT 2026-09-29 · movers-1a
//
// Top moving stocks, to send readers on to 8K10Q (the room) and Warrant Wire (the filings).
//   GET /api/movers -> { gainers, losers, active, micro, asOf }
//
// active + micro come from 8K10Q's own /api/actives (so both sites show the same lists).
// gainers + losers come from the same stand-in source 8K10Q uses (Yahoo's predefined screens).
// ⚠ Stand-in source: move to a licensed feed before selling anything on it (same note as 8K10Q).

const UA = { headers: { "User-Agent": "Mozilla/5.0 (Newsweed movers)" } };

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cache = caches.default;
  const key = new Request(url.origin + "/api/movers?v=movers-1a");
  const hit = await cache.match(key);
  if (hit) return hit;

  const [act, gain, lose] = await Promise.all([
    fetch("https://8k10q.com/api/actives?n=10", UA).then(r => r.ok ? r.json() : null).catch(() => null),
    screen("day_gainers").catch(() => []),
    screen("day_losers").catch(() => [])
  ]);

  const out = {
    gainers: gain.slice(0, 8),
    losers: lose.slice(0, 8),
    active: act && act.big ? act.big.slice(0, 8).map(slim) : [],
    micro: act && act.micro ? act.micro.slice(0, 8).map(slim) : [],
    asOf: new Date().toISOString()
  };
  const res = new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
  if (out.gainers.length || out.active.length) context.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function screen(id) {
  const r = await fetch("https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=" + id + "&count=15", UA);
  if (!r.ok) return [];
  const j = await r.json();
  const q = (j && j.finance && j.finance.result && j.finance.result[0] && j.finance.result[0].quotes) || [];
  return q.filter(x => x && x.symbol && !/[=^]/.test(x.symbol)).map(x => slim({
    symbol: x.symbol, name: x.shortName || x.longName, price: x.regularMarketPrice, change_pct: x.regularMarketChangePercent
  }));
}

function slim(x) {
  return {
    symbol: String(x.symbol).toUpperCase(),
    name: x.name || "",
    price: x.price != null ? Math.round(x.price * 1000) / 1000 : null,
    pct: x.change_pct != null ? Math.round(x.change_pct * 100) / 100 : null
  };
}
