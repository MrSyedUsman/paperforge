import type { BotKind } from "./bot-types.ts";
import type { Difficulty } from "./types.ts";
export type BotPolicy = {
  kind: BotKind;
  normalMargin: number;
  maxMargin: number;
  totalMargin: number;
  maxPositions: number;
  leverage: number;
  stop: number;
  horizonFraction: number;
  maxHorizonMs: number;
  cooldownFraction: number;
  opportunityFactor: number;
  cadence: number;
};
export const BOT_POLICIES: Record<string, BotPolicy> = {
  TrendFox: {
    kind: "trend",
    normalMargin: 0.12,
    maxMargin: 0.22,
    totalMargin: 0.36,
    maxPositions: 2,
    leverage: 5,
    stop: 0.08,
    horizonFraction: 0.2,
    maxHorizonMs: 180_000,
    cooldownFraction: 0.04,
    opportunityFactor: 0.6,
    cadence: 1.2,
  },
  NovaQuant: {
    kind: "momentum",
    normalMargin: 0.11,
    maxMargin: 0.2,
    totalMargin: 0.4,
    maxPositions: 3,
    leverage: 6,
    stop: 0.06,
    horizonFraction: 0.1,
    maxHorizonMs: 75_000,
    cooldownFraction: 0.025,
    opportunityFactor: 0.8,
    cadence: 0.8,
  },
  CandleByte: {
    kind: "breakout",
    normalMargin: 0.14,
    maxMargin: 0.24,
    totalMargin: 0.38,
    maxPositions: 2,
    leverage: 5,
    stop: 0.08,
    horizonFraction: 0.16,
    maxHorizonMs: 120_000,
    cooldownFraction: 0.05,
    opportunityFactor: 0.45,
    cadence: 1,
  },
  RiskRaven: {
    kind: "reversion",
    normalMargin: 0.1,
    maxMargin: 0.2,
    totalMargin: 0.34,
    maxPositions: 2,
    leverage: 3,
    stop: 0.05,
    horizonFraction: 0.14,
    maxHorizonMs: 120_000,
    cooldownFraction: 0.03,
    opportunityFactor: 0.55,
    cadence: 0.65,
  },
  MomentumX: {
    kind: "conservative",
    normalMargin: 0.08,
    maxMargin: 0.15,
    totalMargin: 0.16,
    maxPositions: 1,
    leverage: 2,
    stop: 0.035,
    horizonFraction: 0.1,
    maxHorizonMs: 90_000,
    cooldownFraction: 0.025,
    opportunityFactor: 0.45,
    cadence: 1.3,
  },
  DeltaBot: {
    kind: "adaptive",
    normalMargin: 0.12,
    maxMargin: 0.22,
    totalMargin: 0.35,
    maxPositions: 2,
    leverage: 5,
    stop: 0.07,
    horizonFraction: 0.14,
    maxHorizonMs: 120_000,
    cooldownFraction: 0.03,
    opportunityFactor: 0.65,
    cadence: 1,
  },
  AtlasAlgo: {
    kind: "volatility",
    normalMargin: 0.1,
    maxMargin: 0.18,
    totalMargin: 0.3,
    maxPositions: 2,
    leverage: 4,
    stop: 0.07,
    horizonFraction: 0.12,
    maxHorizonMs: 90_000,
    cooldownFraction: 0.03,
    opportunityFactor: 0.55,
    cadence: 1,
  },
};
export function cadenceMs(
  difficulty: Difficulty,
  durationMs: number,
  policy: BotPolicy,
): number {
  const base =
    durationMs <= 120_000
      ? { Easy: 3000, Medium: 2500, Hard: 2000, Expert: 1800 }[difficulty]
      : { Easy: 12_000, Medium: 8500, Hard: 6000, Expert: 4500 }[difficulty];
  return Math.max(1500, Math.round(base * policy.cadence));
}
export function holdingHorizonMs(
  durationMs: number,
  policy: BotPolicy,
): number {
  return Math.max(
    6000,
    Math.min(policy.maxHorizonMs, durationMs * policy.horizonFraction),
  );
}
/** Used only for patience and close candidate tie-breaks, never to invent price direction. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bound participation without making every bot trade at the same frequency. */
export function entryLimit(durationMs: number, policy: BotPolicy) {
  const perMinute =
    policy.kind === "conservative" ? 4 : policy.kind === "momentum" ? 7 : 6;
  return Math.min(
    120,
    Math.max(5, Math.ceil((durationMs / 60000) * perMinute)),
  );
}
