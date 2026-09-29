// functions/api/markets.js — BUILT 2026-09-29 · markets-1a
//
// GET /api/markets -> { quotes: [{ symbol, name, price, change, pct }], asOf }
// The big boards for the market strip on the home page. Same stand-in source as
// 8K10Q's /api/quote (Yahoo chart API). Cached 5 minutes. If the source is down
// the page simply hides the strip.

const UA = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36" } };
const BOARD = [
  ["^GSPC", "S&P 500"],
  ["^DJI", "Dow"],
  ["^IXIC", "Nasdaq"],
  ["^RUT", "Russell 2000"],
  ["^TNX", "10-yr yield"],
  ["CL=F", "Oil"],
  ["GC=F", "Gold"],
  ["BTC-USD", "Bitcoin"]
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cache = caches.default;
  const key = new Request(url.origin + "/api/markets?v=markets-1a");
  const hit = await cache.match(key);
  if (hit) return hit;

  const quotes = (await Promise.all(BOARD.map(([s, n]) => one(s, n).catch(() => null)))).filter(Boolean);
  const res = new Response(JSON.stringify({ quotes, asOf: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
  if (quotes.length) context.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function one(symbol, name) {
  const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=5d&interval=1d", UA);
  if (!r.ok) return null;
  const d = await r.json();
  const res = d && d.chart && d.chart.result && d.chart.result[0];
  if (!res || !res.meta) return null;
  const closes = ((res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || []).filter(v => v != null);
  const price = Number(res.meta.regularMarketPrice);
  // yesterday's close is the second-to-last daily close
  const prev = closes.length > 1 ? closes[closes.length - 2] : Number(res.meta.chartPreviousClose);
  if (!isFinite(price) || !isFinite(prev) || !prev) return null;
  const change = price - prev;
  return { symbol, name, price: round(price), change: round(change), pct: round((change / prev) * 100) };
}

function round(n) { return Math.round(n * 100) / 100; }
