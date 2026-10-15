import { BOT_REASON_CODES } from "@paperforge/simulation/bots";
import { grossPnl, tradingFee } from "@paperforge/simulation";
import type {
  BotKind,
  BotEntry,
  BotState,
  BotDecision,
  Regime,
  EntryQuality,
} from "./bot-types.ts";
import type { Signals } from "./bot-signals.ts";
import type { Difficulty, Position } from "./types.ts";
import type { BotPolicy } from "./bot-profiles.ts";
import { holdingHorizonMs } from "./bot-profiles.ts";
export type EntrySignal = {
  quality?: EntryQuality;
  side: "Long" | "Short";
  strength: number;
  reason: string;
  reference: number;
  regime: Regime;
};
const sideFor = (direction: number): "Long" | "Short" =>
  direction > 0 ? "Long" : "Short";
export function classifyRegime(s: Signals): Regime {
  if (s.breakout && s.volatilityRatio > 1.2) return "breakout";
  if (
    Math.abs(s.trend) > Math.max(0.025, s.movement * 0.6) &&
    Math.abs(s.longReturn) > 0.12
  )
    return "trend";
  if (
    Math.abs(s.trend) < Math.max(0.03, s.rangeWidth * 0.18) &&
    s.volatility < 0.3
  )
    return "range";
  return "uncertain";
}
/** Hysteresis: a candidate must persist, and the current regime gets a minimum lifetime. */
export function updateRegime(
  state: BotState,
  next: Regime,
  now: number,
  shortArena: boolean,
): BotState {
  const wait = shortArena ? 4000 : 12_000,
    lifetime = shortArena ? 8000 : 30_000;
  if (next === state.regime)
    return { ...state, candidateRegime: next, candidateSince: now };
  if (next !== state.candidateRegime)
    return { ...state, candidateRegime: next, candidateSince: now };
  if (now - state.candidateSince < wait || now - state.regimeSince < lifetime)
    return state;
  return { ...state, regime: next, regimeSince: now };
}
function preferredEntrySignal(
  kind: BotKind,
  s: Signals,
  difficulty: Difficulty,
  behind = false,
  regime: Regime = "uncertain",
): EntrySignal | null {
  const precision =
    { Easy: 1.15, Medium: 1, Hard: 0.95, Expert: 0.9 }[difficulty] *
    (behind && kind !== "conservative" ? 0.9 : 1);
  const directional =
    Math.sign(s.trend) === Math.sign(s.slope) &&
    Math.sign(s.trend) === Math.sign(s.longReturn);
  // Fees are 0.1% round trip on notional; require some observed room beyond them.
  const room = Math.max(
    Math.abs(s.longReturn),
    s.rangeWidth,
    s.movement * Math.sqrt(7),
  );
  if (s.volatility > 0.9 || room < Math.max(0.12, 0.12 * precision))
    return null;
  const trend = (): EntrySignal | null => {
    const stretched =
      Math.abs((s.price / s.fast - 1) * 100) > Math.max(0.15, s.movement * 3);
    if (
      !directional ||
      Math.abs(s.trend) < Math.max(0.018, s.movement * 0.25) * precision ||
      stretched ||
      Math.sign(s.lastReturn) !== Math.sign(s.trend)
    )
      return null;
    return {
      side: sideFor(s.trend),
      strength:
        Math.abs(s.trend) / Math.max(0.01, s.movement) + (s.pullback ? 0.5 : 0),
      reason: s.pullback
        ? "Trend-aligned recovery after a sampled-price pullback"
        : "Fast and slow averages confirm an established, unextended trend",
      reference: s.slow,
      regime: "trend",
    };
  };
  const momentum = (): EntrySignal | null => {
    if (
      Math.sign(s.shortReturn) !== Math.sign(s.longReturn) ||
      Math.abs(s.shortReturn) < 0.065 * precision ||
      s.shortReturn * s.acceleration < -0.015 ||
      Math.abs(s.shortReturn) > Math.max(0.6, s.movement * 7)
    )
      return null;
    return {
      side: sideFor(s.shortReturn),
      strength:
        Math.abs(s.shortReturn) / Math.max(0.015, s.movement) +
        Math.max(0, Math.sign(s.shortReturn) * s.acceleration),
      reason:
        "Recent return agrees with broader momentum without excessive extension",
      reference: s.fast,
      regime: "trend",
    };
  };
  const breakout = (): EntrySignal | null => {
    if (
      !s.breakout ||
      s.rangeWidth < 0.06 * precision ||
      Math.sign(s.shortReturn) !== s.breakout
    )
      return null;
    return {
      side: sideFor(s.breakout),
      strength: Math.abs(s.shortReturn) / Math.max(0.02, s.movement),
      reason:
        "Two sampled prices confirm a buffered break beyond the prior range",
      reference: s.breakout > 0 ? s.rangeHigh : s.rangeLow,
      regime: "breakout",
    };
  };
  const reversion = (): EntrySignal | null => {
    const rangeBound = s.meanReady && Math.abs(s.meanSlope) < 0.035 * precision;
    const turning =
      (s.z < -1.05 * precision && s.lastReturn > 0 && s.z > s.previousZ) ||
      (s.z > 1.05 * precision && s.lastReturn < 0 && s.z < s.previousZ);
    const roomToMean = Math.abs((s.referenceMean / s.price - 1) * 100);
    if (!rangeBound || s.breakout || !turning || roomToMean < 0.12) return null;
    return {
      side: s.z < 0 ? "Long" : "Short",
      strength: Math.abs(s.z),
      reason:
        "An extended deviation is turning back toward the mean in a weak trend",
      reference: s.referenceMean,
      regime: "range",
    };
  };
  switch (kind) {
    case "trend":
      return trend();
    case "momentum":
      return momentum();
    case "breakout":
      return breakout();
    case "reversion":
      return reversion();
    case "conservative": {
      const t = trend(),
        m = momentum();
      if (
        !t ||
        !m ||
        t.side !== m.side ||
        s.volatility > 0.12 ||
        Math.abs(s.shortReturn) < 0.1 * precision ||
        room < 0.2 * precision
      )
        return null;
      return {
        ...t,
        strength: Math.min(t.strength, m.strength),
        reason:
          "Low-volatility trend and momentum agree with room beyond estimated fees",
      };
    }
    case "adaptive":
      return regime === "trend"
        ? trend()
        : regime === "range"
          ? reversion()
          : regime === "breakout"
            ? breakout()
            : null;
    case "volatility": {
      if (
        !s.volatilityReady ||
        s.volatilityRatio < 1.5 * precision ||
        s.volatility < 0.015 ||
        s.volatility > 0.45 ||
        Math.abs(s.shortReturn) < 0.07 * precision ||
        Math.sign(s.shortReturn) !== Math.sign(s.longReturn)
      )
        return null;
      return {
        side: sideFor(s.shortReturn),
        strength:
          s.volatilityRatio +
          Math.abs(s.shortReturn) / Math.max(0.02, s.volatility),
        reason:
          "Realized volatility expanded with independent directional confirmation",
        reference: s.fast,
        regime: "breakout",
      };
    }
  }
}
export type OpportunityOptions = { level: 1 | 2; durationMs: number };
/** Specialty confidence affects exposure; only market/risk constraints remain universal gates. */
export function entrySignal(
  kind: BotKind,
  s: Signals,
  difficulty: Difficulty,
  behind = false,
  regime: Regime = "uncertain",
  options?: OpportunityOptions,
): EntrySignal | null {
  if (
    [
      s.price,
      s.previous,
      s.trend,
      s.shortReturn,
      s.longReturn,
      s.volatility,
      s.movement,
      s.z,
      s.referenceMean,
    ].some((value) => !Number.isFinite(value))
  )
    return null;
  if (options && s.price === s.previous) return null;
  const preferred = !s.provisional
    ? preferredEntrySignal(kind, s, difficulty, behind, regime)
    : null;
  if (preferred) return { ...preferred, quality: "preferred" };
  if (!options) return null;
  if (
    [
      s.price,
      s.trend,
      s.shortReturn,
      s.longReturn,
      s.volatility,
      s.movement,
      s.z,
      s.referenceMean,
    ].some((v) => !Number.isFinite(v)) ||
    s.volatility > 0.9 ||
    s.movement < 0.0008
  )
    return null;
  const precision = { Easy: 1.12, Medium: 1, Hard: 0.95, Expert: 0.9 }[
    difficulty
  ];
  const threshold = (options.durationMs <= 120000 ? 0.012 : 0.018) * precision;
  const choose = (exploratory: boolean): EntrySignal | null => {
    const base = threshold * (exploratory ? 0.5 : 1),
      quality: EntryQuality = exploratory ? "exploratory" : "developing";
    const result = (
      side: "Long" | "Short",
      strength: number,
      reference: number,
      entryRegime: Regime,
    ): EntrySignal => ({
      side,
      strength,
      reference,
      regime: entryRegime,
      quality,
      reason: BOT_REASON_CODES[`${kind}_${quality}`],
    });
    if (kind === "trend") {
      if (
        Math.abs(s.trend) < base * 0.4 ||
        s.trend * s.shortReturn <= 0 ||
        s.trend * s.longReturn <= 0 ||
        Math.abs(s.shortReturn) < base ||
        s.lastReturn * Math.sign(s.trend) < -base * 0.4 ||
        Math.abs((s.price / s.fast - 1) * 100) > Math.max(0.35, s.movement * 8)
      )
        return null;
      return result(
        sideFor(s.trend),
        Math.abs(s.trend) / Math.max(base, s.movement),
        s.slow,
        "trend",
      );
    }
    if (kind === "momentum") {
      if (
        Math.abs(s.shortReturn) < base ||
        Math.abs(s.shortReturn) > Math.max(0.6, s.movement * 8) ||
        s.shortReturn * s.lastReturn <= 0 ||
        (s.shortReturn * s.longReturn < 0 &&
          Math.abs(s.longReturn) > Math.abs(s.shortReturn) * 1.5)
      )
        return null;
      return result(
        sideFor(s.shortReturn),
        Math.abs(s.shortReturn) / Math.max(base, s.movement),
        s.fast,
        "trend",
      );
    }
    if (kind === "breakout") {
      const span = s.rangeHigh - s.rangeLow;
      if (
        span <= 0 ||
        Math.abs(s.shortReturn) < base ||
        s.shortReturn * s.lastReturn <= 0
      )
        return null;
      const sign = Math.sign(s.shortReturn),
        near =
          sign > 0
            ? s.price >= s.rangeHigh - span * (exploratory ? 0.4 : 0.2)
            : s.price <= s.rangeLow + span * (exploratory ? 0.4 : 0.2);
      if (!near || sign * s.longReturn < 0) return null;
      return result(
        sideFor(sign),
        Math.abs(s.shortReturn) / Math.max(base, s.movement),
        s.fast,
        "breakout",
      );
    }
    if (kind === "reversion") {
      const recovery =
        (s.z < 0 && s.lastReturn > 0 && s.z > s.previousZ) ||
        (s.z > 0 && s.lastReturn < 0 && s.z < s.previousZ);
      if (
        !recovery ||
        Math.abs(s.z) < (exploratory ? 0.35 : 0.65) ||
        Math.abs(s.z) > 3 ||
        s.breakout ||
        Math.abs(s.meanSlope) > Math.max(0.06, Math.abs(s.longReturn) * 0.7) ||
        Math.abs((s.referenceMean / s.price - 1) * 100) < base * 0.7
      )
        return null;
      return result(
        s.z < 0 ? "Long" : "Short",
        Math.abs(s.z),
        s.referenceMean,
        "range",
      );
    }
    if (kind === "conservative") {
      if (
        s.volatility > 0.18 ||
        Math.abs(s.shortReturn) < base * 1.1 ||
        s.shortReturn * s.lastReturn <= 0 ||
        (s.shortReturn * s.longReturn <= 0 && s.shortReturn * s.trend <= 0)
      )
        return null;
      return result(
        sideFor(s.shortReturn),
        Math.abs(s.shortReturn) / Math.max(base, s.movement),
        s.slow,
        "trend",
      );
    }
    if (kind === "volatility") {
      if (
        s.volatility > (exploratory ? 0.3 : 0.4) ||
        s.volatility < (exploratory ? 0.0015 : 0.002) ||
        s.volatilityRatio < (exploratory ? 0.65 : 1.05) ||
        Math.abs(s.shortReturn) < base ||
        s.shortReturn * s.longReturn <= 0 ||
        s.shortReturn * s.lastReturn <= 0
      )
        return null;
      return result(
        sideFor(s.shortReturn),
        s.volatilityRatio +
          Math.abs(s.shortReturn) / Math.max(base, s.movement),
        s.fast,
        "breakout",
      );
    }
    const candidates = (
      regime === "range"
        ? ["reversion", "trend", "breakout"]
        : regime === "breakout"
          ? ["breakout", "trend", "reversion"]
          : ["trend", "reversion", "breakout"]
    ) as BotKind[];
    const choices = candidates
      .map((candidate) =>
        entrySignal(candidate, s, difficulty, behind, regime, {
          ...options,
          level: exploratory ? 2 : 1,
        }),
      )
      .filter((value): value is EntrySignal => Boolean(value));
    const found = choices.sort((a, b) => b.strength - a.strength)[0];
    if (!found) return null;
    return {
      ...found,
      quality,
      reason: BOT_REASON_CODES[`adaptive_${quality}`],
    };
  };
  return choose(false) ?? (options.level === 2 ? choose(true) : null);
}
export function exitDecision(
  pos: Position,
  s: Signals | null,
  mark: number,
  now: number,
  policy: BotPolicy,
  state: BotState,
  durationMs: number,
): BotDecision | null {
  const gross = grossPnl(pos.size, pos.entry, mark, pos.side),
    fees = pos.openFee + tradingFee(pos.size),
    net = gross - fees,
    age = now - pos.opened;
  const signals = {
    ...(s?.evidence || {}),
    grossPnl: gross,
    estimatedRoundTripFees: fees,
    netPnl: net,
    positionAgeMs: age,
  };
  const result = (reason: string): BotDecision => ({
    action: "close",
    positionId: pos.id,
    pair: pos.pair,
    reason,
    signals,
    limitations: s
      ? ["Signals use sampled prices, not candle patterns or interval volume."]
      : [
          "Market history is warming up; only recorded position risk is available.",
        ],
  });
  const volatilityStop =
    policy.kind === "volatility" && s
      ? Math.min(
          policy.stop,
          Math.max(0.025, (s.volatility / 100) * pos.lev * 3),
        )
      : policy.stop;
  if (net <= -pos.margin * volatilityStop)
    return result("Position loss reached the strategy risk limit");
  const best = state.bestNet[String(pos.id)] || 0;
  if (best > Math.max(fees * 2, pos.margin * 0.02) && net < best * 0.55)
    return result("Fee-adjusted profit retreated from its recorded peak");
  const minimumHold = Math.max(
    5000,
    Math.min(12_000, holdingHorizonMs(durationMs, policy) * 0.65),
  );
  if (age < minimumHold) return null;
  const sign = pos.side === "Long" ? 1 : -1,
    original = pos.botEntry;
  const originalKind =
    original?.kind === "adaptive"
      ? original.regime === "range"
        ? "reversion"
        : original.regime === "breakout"
          ? "breakout"
          : "trend"
      : original?.kind || policy.kind;
  if (
    policy.kind === "adaptive" &&
    original &&
    state.regime !== original.regime &&
    state.regime !== "uncertain"
  )
    return result(
      "Confirmed regime transition no longer supports the original entry",
    );
  if (s) {
    if (
      (originalKind === "trend" || originalKind === "conservative") &&
      (sign * s.trend <= 0 || sign * s.slope < -0.015)
    )
      return result("The recorded trend weakened or reversed");
    if (originalKind === "momentum" && sign * s.shortReturn < 0.015)
      return result("Recent momentum faded or reversed");
    if (
      originalKind === "breakout" &&
      original &&
      (pos.side === "Long"
        ? mark < original.reference
        : mark > original.reference)
    )
      return result("Price returned inside the original breakout range");
    if (originalKind === "reversion") {
      if (original && sign * (mark - original.reference) >= 0 && net > 0)
        return result(
          "Price reached the entry reference mean after covering fees",
        );
      if (
        sign * s.z < -3 ||
        (Math.abs(s.meanSlope) > 0.055 && sign * s.meanSlope < 0)
      )
        return result(
          "Deviation or a new directional regime invalidated the mean-reversion entry",
        );
    }
    if (
      originalKind === "volatility" &&
      (s.volatilityRatio <
        (original?.quality && original.quality !== "preferred" ? 0.5 : 0.85) ||
        sign * s.shortReturn <= 0)
    )
      return result(
        "Volatility expansion or its directional confirmation faded",
      );
  }
  if (
    ["momentum", "conservative", "volatility"].includes(originalKind) &&
    net >=
      Math.max(
        fees * 0.5,
        pos.size *
          (originalKind === "volatility" && s
            ? Math.max(0.0015, (s.volatility / 100) * 2)
            : 0.0015),
      )
  )
    return result("The strategy fee-adjusted profit target was reached");
  const horizon = holdingHorizonMs(durationMs, policy);
  if (
    policy.kind === "conservative" &&
    durationMs <= 120000 &&
    age >= horizon * 1.3
  )
    return result("The conservative short-arena exposure review window ended");
  if (
    original?.quality &&
    original.quality !== "preferred" &&
    age >= horizon * 1.5 &&
    (!s || sign * s.shortReturn < 0.01)
  )
    return result("The developing setup no longer has enough observed support");
  if (
    (age >= horizon && net > fees * 0.25) ||
    (age >= horizon * 2 && (!s || Math.abs(s.shortReturn) < 0.04))
  )
    return result("The planned signal-review window ended");
  return null;
}
export function entryContext(
  kind: BotKind,
  signal: EntrySignal,
  signals: Signals,
  now: number,
): BotEntry {
  return {
    quality: signal.quality ?? "preferred",
    version: 1,
    kind,
    regime: signal.regime,
    reason: signal.reason,
    signals: {
      ...signals.evidence,
      entryQuality:
        signal.quality === "exploratory"
          ? 2
          : signal.quality === "developing"
            ? 1
            : 0,
    },
    reference: signal.reference,
    at: now,
  };
}
