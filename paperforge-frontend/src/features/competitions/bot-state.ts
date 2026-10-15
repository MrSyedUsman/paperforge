import type { Trade } from "./types.ts";
import type {
  BotState,
  BotEntry,
  BotDecisionRecord,
  BotEvidence,
  Regime,
  BotKind,
} from "./bot-types.ts";
const regimes: Regime[] = ["trend", "range", "breakout", "uncertain"];
const kinds: BotKind[] = [
  "trend",
  "momentum",
  "breakout",
  "reversion",
  "conservative",
  "adaptive",
  "volatility",
];
export function newBotState(equity: number): BotState {
  return {
    version: 1,
    sequence: 0,
    nextDecisionAt: 0,
    lastDecisionAt: 0,
    cooldownUntil: 0,
    peakEquity: equity,
    regime: "uncertain",
    regimePair: "",
    regimeSince: 0,
    candidateRegime: "uncertain",
    candidateSince: 0,
    bestNet: {},
    decisions: [],
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
export function safeEvidence(value: unknown): BotEvidence {
  if (!record(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([k, v]) =>
          /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(k) &&
          typeof v === "number" &&
          Number.isFinite(v),
      )
      .slice(0, 20),
  ) as BotEvidence;
}
export function restoreBotEntry(value: unknown): BotEntry | undefined {
  if (
    !record(value) ||
    value.version !== 1 ||
    !kinds.includes(value.kind as BotKind) ||
    !regimes.includes(value.regime as Regime) ||
    typeof value.reason !== "string" ||
    !Number.isFinite(value.reference) ||
    !Number.isFinite(value.at)
  )
    return undefined;
  return {
    ...(typeof value.quality === "string" &&
    ["preferred", "developing", "exploratory"].includes(value.quality)
      ? { quality: value.quality as BotEntry["quality"] }
      : {}),
    version: 1,
    kind: value.kind as BotKind,
    regime: value.regime as Regime,
    reason: value.reason.slice(0, 180),
    reference: Number(value.reference),
    at: Number(value.at),
    signals: safeEvidence(value.signals),
  };
}
export function restoreBotState(value: unknown, equity: number): BotState {
  const fresh = newBotState(equity);
  if (!record(value) || value.version !== 1) return fresh;
  for (const key of [
    "sequence",
    "nextDecisionAt",
    "lastDecisionAt",
    "cooldownUntil",
    "peakEquity",
    "regimeSince",
    "candidateSince",
  ] as const)
    if (
      typeof value[key] === "number" &&
      Number.isFinite(value[key]) &&
      value[key] >= 0
    )
      fresh[key] = value[key];
  if (
    typeof value.regimePair === "string" &&
    /^[A-Z0-9]{1,24}USDT$/.test(value.regimePair)
  )
    fresh.regimePair = value.regimePair;
  if (regimes.includes(value.regime as Regime))
    fresh.regime = value.regime as Regime;
  if (regimes.includes(value.candidateRegime as Regime))
    fresh.candidateRegime = value.candidateRegime as Regime;
  if (record(value.bestNet))
    fresh.bestNet = Object.fromEntries(
      Object.entries(value.bestNet)
        .filter(
          ([k, v]) =>
            k.length < 40 && typeof v === "number" && Number.isFinite(v),
        )
        .slice(0, 10),
    ) as Record<string, number>;
  if (Array.isArray(value.decisions))
    fresh.decisions = value.decisions
      .slice(-24)
      .map(restoreBotDecision)
      .filter((d): d is BotDecisionRecord => Boolean(d));
  fresh.nextDecisionAt = Math.min(
    fresh.nextDecisionAt,
    fresh.lastDecisionAt + 60_000,
  );
  fresh.cooldownUntil = Math.min(
    fresh.cooldownUntil,
    fresh.lastDecisionAt + 30_000,
  );
  return fresh;
}
export function restoreBotDecision(
  value: unknown,
): BotDecisionRecord | undefined {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.at !== "number" ||
    !Number.isFinite(value.at) ||
    !["hold", "open", "close"].includes(String(value.action)) ||
    typeof value.reason !== "string" ||
    typeof value.adjustment !== "string" ||
    typeof value.usedMargin !== "number" ||
    !Number.isFinite(value.usedMargin) ||
    typeof value.requiredMargin !== "number" ||
    !Number.isFinite(value.requiredMargin)
  )
    return undefined;
  return {
    version: 1,
    at: value.at,
    action: value.action as BotDecisionRecord["action"],
    ...(typeof value.pair === "string" &&
    /^[A-Z0-9]{1,24}USDT$/.test(value.pair)
      ? { pair: value.pair }
      : {}),
    reason: value.reason.slice(0, 180),
    adjustment: value.adjustment.slice(0, 240),
    usedMargin: value.usedMargin,
    requiredMargin: value.requiredMargin,
    signals: safeEvidence(value.signals),
    limitations: Array.isArray(value.limitations)
      ? value.limitations
          .filter((l): l is string => typeof l === "string")
          .slice(0, 4)
          .map((l) => l.slice(0, 200))
      : [],
  };
}

/** Never discard financial trades: only remove old, optional signal explanation payloads. */
export function trimBotTradeMetadata(trades: Trade[]): Trade[] {
  return trades.map((trade, index) => {
    if (index < 32 || (!trade.botEntry && !trade.botExit)) return trade;
    const financial = { ...trade };
    delete financial.botEntry;
    delete financial.botExit;
    return financial;
  });
}
