import { LIVE_PRICE_MAX_AGE_MS } from '@paperforge/simulation';
import type { Quote, Market } from '../../lib/market-data/markets.ts';
import type { PriceHistory } from './bot-types.ts';
export const SAMPLE_INTERVAL_MS = 2000;
export const MAX_HISTORY_SAMPLES = 120;
export const MAX_HISTORY_MARKETS = 30;
export function freshQuote(quote: Quote | undefined, now: number): quote is Quote {
  return Boolean(quote && Number.isFinite(quote.markPrice || quote.price) && (quote.markPrice || quote.price) > 0 && Number.isFinite(quote.updatedAt) && quote.updatedAt <= now && now - quote.updatedAt <= LIVE_PRICE_MAX_AGE_MS);
}
/** No interpolation or invented candles: at most one current observed quote per two-second bucket. */
export function sampleMarkets(history: PriceHistory, markets: Market[], quotes: Record<string, Quote>, now: number, live: boolean): PriceHistory {
  if (!live || !Number.isFinite(now)) return history;
  let changed = false;
  const next: PriceHistory = {};
  for (const market of markets.slice(0, MAX_HISTORY_MARKETS)) {
    const stored = history[market.pair] || [], old = stored.filter(s => s.at <= now && s.sourceAt <= s.at), last = old.at(-1), q = quotes[market.pair];
    if (old.length !== stored.length) changed = true;
    if (!freshQuote(q, now) || (last && Math.floor(last.at / SAMPLE_INTERVAL_MS) >= Math.floor(now / SAMPLE_INTERVAL_MS))) { next[market.pair] = old; continue; }
    next[market.pair] = [...old.filter(s => now - s.at <= SAMPLE_INTERVAL_MS * MAX_HISTORY_SAMPLES), { at: now, sourceAt: q.updatedAt, price: q.markPrice || q.price }].slice(-MAX_HISTORY_SAMPLES);
    changed = true;
  }
  return changed ? next : history;
}
/** Only a contiguous, already-observed tail may inform an indicator; gaps warm up again. */
export function observedPrices(history: PriceHistory, pair: string, now: number): number[] {
  const rows = (history[pair] || []).filter(s => s.at <= now && s.sourceAt <= s.at && s.price > 0 && Number.isFinite(s.price));
  if (!rows.length || now - rows.at(-1)!.at > SAMPLE_INTERVAL_MS * 3) return [];
  let start = rows.length - 1;
  while (start > 0 && rows[start].at - rows[start - 1].at <= SAMPLE_INTERVAL_MS * 3) start--;
  return rows.slice(start).map(s => s.price);
}
export function restorePriceHistory(value: unknown): PriceHistory {
  const result: PriceHistory = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [pair, rows] of Object.entries(value).slice(0, MAX_HISTORY_MARKETS)) {
    if (!/^[A-Z0-9]{1,24}USDT$/.test(pair) || !Array.isArray(rows)) continue;
    let last = -1;
    result[pair] = rows.slice(-MAX_HISTORY_SAMPLES).filter(row => {
      if (!row || typeof row !== 'object' || !Number.isFinite(row.at) || !Number.isFinite(row.sourceAt) || !Number.isFinite(row.price) || row.price <= 0 || row.at <= last || row.sourceAt > row.at) return false;
      last = row.at; return true;
    }).map(row => ({ at: row.at, sourceAt: row.sourceAt, price: row.price }));
  }
  return result;
}
