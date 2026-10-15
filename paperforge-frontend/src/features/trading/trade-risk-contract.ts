import { LIVE_PRICE_MAX_AGE_MS } from '@paperforge/simulation';
export type RiskSnapshot = { pair: string; side: 'Long' | 'Short'; margin: number; leverage: number; price: number; priceTimestamp: number };
export type RiskScenario = { id: string; movePercent: number; hypotheticalPrice: number; executionPrice: number; liquidated: boolean; priceMovePnl: number; grossPnl: number; closingFee: number; totalFees: number; netPnl: number };
export type RiskFacts = { snapshot: RiskSnapshot; notional: number; openingFee: number; liquidationPrice: number; liquidationDistancePercent: number; scenarios: RiskScenario[]; facts: { id: string; label: string; value: string }[]; limitations: string[] };
export type RiskResponse = { facts: RiskFacts; review: { summary: string; observations: { text: string; evidenceIds: string[] }[]; lesson: string; question: string }; metadata: { model: string; promptVersion: string; generatedAt: string; generationMs: number; requestMs: number; cached: boolean } };
export function riskSnapshot(input: RiskSnapshot): RiskSnapshot {
  return { pair: input.pair, side: input.side, margin: input.margin, leverage: input.leverage, price: input.price, priceTimestamp: input.priceTimestamp };
}
export function riskSnapshotOutdated(snapshot: RiskSnapshot, current: RiskSnapshot, live: boolean, now = Date.now()): boolean {
  return !live || now - snapshot.priceTimestamp > LIVE_PRICE_MAX_AGE_MS || snapshot.pair !== current.pair || snapshot.side !== current.side || snapshot.margin !== current.margin || snapshot.leverage !== current.leverage || snapshot.price !== current.price;
}
const fail = (): never => { throw new Error('The risk-check response was incomplete. Please try again.'); };
function record(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)); }
function text(v: unknown, max = 500): v is string { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function finite(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
function matches(v: Record<string, unknown>, s: RiskSnapshot): boolean { return Object.entries(s).every(([k, value]) => v[k] === value); }
export function validateRiskFacts(value: unknown, requested: RiskSnapshot): RiskFacts {
  if (!record(value) || !record(value.snapshot) || !matches(value.snapshot, { ...requested, margin: Math.round((requested.margin + Number.EPSILON) * 100) / 100 })) return fail();
  if (['notional', 'openingFee', 'liquidationPrice', 'liquidationDistancePercent'].some(k => !finite(value[k]) || Number(value[k]) < 0) || !Array.isArray(value.scenarios) || value.scenarios.length !== 6 ||
    value.scenarios.some(s => !record(s) || !text(s.id, 40) || typeof s.liquidated !== 'boolean' || ['movePercent', 'hypotheticalPrice', 'executionPrice', 'priceMovePnl', 'grossPnl', 'closingFee', 'totalFees', 'netPnl'].some(k => !finite(s[k]))) ||
    !Array.isArray(value.facts) || value.facts.length < 8 || value.facts.length > 20 || value.facts.some(f => !record(f) || !text(f.id, 40) || !text(f.label, 100) || !text(f.value, 300)) ||
    !Array.isArray(value.limitations) || value.limitations.length > 8 || value.limitations.some(l => !text(l))) return fail();
  if (new Set(value.facts.map(f => f.id)).size !== value.facts.length || new Set(value.scenarios.map(s => s.id)).size !== 6) return fail();
  return value as unknown as RiskFacts;
}
export function validateRiskResponse(value: unknown, requested: RiskSnapshot): RiskResponse {
  if (!record(value) || !record(value.review) || !record(value.metadata)) return fail();
  const facts = validateRiskFacts(value.facts, requested), review = value.review, meta = value.metadata;
  const ids = new Set(facts.facts.map(f => f.id));
  if (!text(review.summary, 280) || !text(review.lesson, 220) || !text(review.question, 180) || !Array.isArray(review.observations) || review.observations.length !== 2 ||
    review.observations.some(o => !record(o) || !text(o.text, 300) || !Array.isArray(o.evidenceIds) || o.evidenceIds.length < 1 || o.evidenceIds.length > 3 || o.evidenceIds.some(id => typeof id !== 'string' || !ids.has(id)))) return fail();
  if (!text(meta.model, 101) || !text(meta.promptVersion, 80) || !text(meta.generatedAt, 80) || !Number.isFinite(Date.parse(meta.generatedAt)) || !finite(meta.generationMs) || meta.generationMs < 0 || !finite(meta.requestMs) || meta.requestMs < 0 || typeof meta.cached !== 'boolean') return fail();
  return value as unknown as RiskResponse;
}
