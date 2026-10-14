import type { BotKind } from './bot-types.ts';
import type { Difficulty } from './types.ts';
export type BotPolicy = { kind: BotKind; normalMargin: number; maxMargin: number; totalMargin: number; maxPositions: number; leverage: number; stop: number; horizonFraction: number; maxHorizonMs: number; cooldownFraction: number; opportunityFactor: number; cadence: number };
export const BOT_POLICIES: Record<string, BotPolicy> = {
  TrendFox: { kind: 'trend', normalMargin: .12, maxMargin: .22, totalMargin: .36, maxPositions: 2, leverage: 5, stop: .08, horizonFraction: .2, maxHorizonMs: 180_000, cooldownFraction: .04, opportunityFactor: .6, cadence: 1.2 },
  NovaQuant: { kind: 'momentum', normalMargin: .11, maxMargin: .20, totalMargin: .4, maxPositions: 3, leverage: 6, stop: .06, horizonFraction: .1, maxHorizonMs: 75_000, cooldownFraction: .025, opportunityFactor: .8, cadence: .8 },
  CandleByte: { kind: 'breakout', normalMargin: .14, maxMargin: .24, totalMargin: .38, maxPositions: 2, leverage: 5, stop: .08, horizonFraction: .16, maxHorizonMs: 120_000, cooldownFraction: .05, opportunityFactor: .45, cadence: 1 },
  RiskRaven: { kind: 'reversion', normalMargin: .10, maxMargin: .20, totalMargin: .34, maxPositions: 2, leverage: 3, stop: .05, horizonFraction: .14, maxHorizonMs: 120_000, cooldownFraction: .03, opportunityFactor: .55, cadence: .65 },
  MomentumX: { kind: 'conservative', normalMargin: .08, maxMargin: .15, totalMargin: .16, maxPositions: 1, leverage: 2, stop: .035, horizonFraction: .1, maxHorizonMs: 90_000, cooldownFraction: .025, opportunityFactor: .45, cadence: 1.3 },
  DeltaBot: { kind: 'adaptive', normalMargin: .12, maxMargin: .22, totalMargin: .35, maxPositions: 2, leverage: 5, stop: .07, horizonFraction: .14, maxHorizonMs: 120_000, cooldownFraction: .03, opportunityFactor: .65, cadence: 1 },
  AtlasAlgo: { kind: 'volatility', normalMargin: .10, maxMargin: .18, totalMargin: .30, maxPositions: 2, leverage: 4, stop: .07, horizonFraction: .12, maxHorizonMs: 90_000, cooldownFraction: .03, opportunityFactor: .55, cadence: 1 },
};
export function cadenceMs(difficulty: Difficulty, durationMs: number, policy: BotPolicy): number {
  const base = durationMs <= 120_000 ? { Easy: 4500, Medium: 3000, Hard: 2500, Expert: 2000 }[difficulty] : { Easy: 12_000, Medium: 8500, Hard: 6000, Expert: 4500 }[difficulty];
  return Math.max(1500, Math.round(base * policy.cadence));
}
export function holdingHorizonMs(durationMs: number, policy: BotPolicy): number { return Math.max(6000, Math.min(policy.maxHorizonMs, durationMs * policy.horizonFraction)); }
/** Used only for patience and close candidate tie-breaks, never to invent price direction. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
