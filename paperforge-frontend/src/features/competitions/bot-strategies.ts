import { grossPnl, tradingFee } from '@paperforge/simulation';
import type { BotKind, BotEntry, BotState, BotDecision, Regime } from './bot-types.ts';
import type { Signals } from './bot-signals.ts';
import type { Difficulty, Position } from './types.ts';
import type { BotPolicy } from './bot-profiles.ts';
import { holdingHorizonMs } from './bot-profiles.ts';
export type EntrySignal = { side: 'Long' | 'Short'; strength: number; reason: string; reference: number; regime: Regime };
const sideFor = (direction: number): 'Long' | 'Short' => direction > 0 ? 'Long' : 'Short';
export function classifyRegime(s: Signals): Regime {
  if (s.breakout && s.volatilityRatio > 1.2) return 'breakout';
  if (Math.abs(s.trend) > Math.max(.025, s.movement * .6) && Math.abs(s.longReturn) > .12) return 'trend';
  if (Math.abs(s.trend) < Math.max(.03, s.rangeWidth * .18) && s.volatility < .3) return 'range';
  return 'uncertain';
}
/** Hysteresis: a candidate must persist, and the current regime gets a minimum lifetime. */
export function updateRegime(state: BotState, next: Regime, now: number, shortArena: boolean): BotState {
  const wait = shortArena ? 4000 : 12_000, lifetime = shortArena ? 8000 : 30_000;
  if (next === state.regime) return { ...state, candidateRegime: next, candidateSince: now };
  if (next !== state.candidateRegime) return { ...state, candidateRegime: next, candidateSince: now };
  if (now - state.candidateSince < wait || now - state.regimeSince < lifetime) return state;
  return { ...state, regime: next, regimeSince: now };
}
export function entrySignal(kind: BotKind, s: Signals, difficulty: Difficulty, behind = false, regime: Regime = 'uncertain'): EntrySignal | null {
  const precision = { Easy: 1.15, Medium: 1, Hard: .95, Expert: .9 }[difficulty] * (behind && kind !== 'conservative' ? .9 : 1);
  const directional = Math.sign(s.trend) === Math.sign(s.slope) && Math.sign(s.trend) === Math.sign(s.longReturn);
  // Fees are 0.1% round trip on notional; require some observed room beyond them.
  const room = Math.max(Math.abs(s.longReturn), s.rangeWidth, s.movement * Math.sqrt(7));
  if (s.volatility > .9 || room < Math.max(.12, .12 * precision)) return null;
  const trend = (): EntrySignal | null => {
    const stretched = Math.abs((s.price / s.fast - 1) * 100) > Math.max(.15, s.movement * 3);
    if (!directional || Math.abs(s.trend) < Math.max(.018, s.movement * .25) * precision || stretched || Math.sign(s.lastReturn) !== Math.sign(s.trend)) return null;
    return { side: sideFor(s.trend), strength: Math.abs(s.trend) / Math.max(.01, s.movement) + (s.pullback ? .5 : 0), reason: s.pullback ? 'Trend-aligned recovery after a sampled-price pullback' : 'Fast and slow averages confirm an established, unextended trend', reference: s.slow, regime: 'trend' };
  };
  const momentum = (): EntrySignal | null => {
    if (Math.sign(s.shortReturn) !== Math.sign(s.longReturn) || Math.abs(s.shortReturn) < .065 * precision || s.shortReturn * s.acceleration < -.015 || Math.abs(s.shortReturn) > Math.max(.6, s.movement * 7)) return null;
    return { side: sideFor(s.shortReturn), strength: Math.abs(s.shortReturn) / Math.max(.015, s.movement) + Math.max(0, Math.sign(s.shortReturn) * s.acceleration), reason: 'Recent return agrees with broader momentum without excessive extension', reference: s.fast, regime: 'trend' };
  };
  const breakout = (): EntrySignal | null => {
    if (!s.breakout || s.rangeWidth < .06 * precision || Math.sign(s.shortReturn) !== s.breakout) return null;
    return { side: sideFor(s.breakout), strength: Math.abs(s.shortReturn) / Math.max(.02, s.movement), reason: 'Two sampled prices confirm a buffered break beyond the prior range', reference: s.breakout > 0 ? s.rangeHigh : s.rangeLow, regime: 'breakout' };
  };
  const reversion = (): EntrySignal | null => {
    const rangeBound = s.meanReady && Math.abs(s.meanSlope) < .035 * precision;
    const turning = s.z < -1.05 * precision && s.lastReturn > 0 && s.z > s.previousZ || s.z > 1.05 * precision && s.lastReturn < 0 && s.z < s.previousZ;
    const roomToMean = Math.abs((s.referenceMean / s.price - 1) * 100);
    if (!rangeBound || s.breakout || !turning || roomToMean < .12) return null;
    return { side: s.z < 0 ? 'Long' : 'Short', strength: Math.abs(s.z), reason: 'An extended deviation is turning back toward the mean in a weak trend', reference: s.referenceMean, regime: 'range' };
  };
  switch (kind) {
    case 'trend': return trend();
    case 'momentum': return momentum();
    case 'breakout': return breakout();
    case 'reversion': return reversion();
    case 'conservative': {
      const t = trend(), m = momentum();
      if (!t || !m || t.side !== m.side || s.volatility > .12 || Math.abs(s.shortReturn) < .1 * precision || room < .2 * precision) return null;
      return { ...t, strength: Math.min(t.strength, m.strength), reason: 'Low-volatility trend and momentum agree with room beyond estimated fees' };
    }
    case 'adaptive': return regime === 'trend' ? trend() : regime === 'range' ? reversion() : regime === 'breakout' ? breakout() : null;
    case 'volatility': {
      if (!s.volatilityReady || s.volatilityRatio < 1.5 * precision || s.volatility < .015 || s.volatility > .45 || Math.abs(s.shortReturn) < .07 * precision || Math.sign(s.shortReturn) !== Math.sign(s.longReturn)) return null;
      return { side: sideFor(s.shortReturn), strength: s.volatilityRatio + Math.abs(s.shortReturn) / Math.max(.02, s.volatility), reason: 'Realized volatility expanded with independent directional confirmation', reference: s.fast, regime: 'breakout' };
    }
  }
}
export function exitDecision(pos: Position, s: Signals | null, mark: number, now: number, policy: BotPolicy, state: BotState, durationMs: number): BotDecision | null {
  const gross = grossPnl(pos.size, pos.entry, mark, pos.side), fees = pos.openFee + tradingFee(pos.size), net = gross - fees, age = now - pos.opened;
  const signals = { ...(s?.evidence || {}), grossPnl: gross, estimatedRoundTripFees: fees, netPnl: net, positionAgeMs: age };
  const result = (reason: string): BotDecision => ({ action: 'close', positionId: pos.id, pair: pos.pair, reason, signals, limitations: s ? ['Signals use sampled prices, not candle patterns or interval volume.'] : ['Market history is warming up; only recorded position risk is available.'] });
  const volatilityStop = policy.kind === 'volatility' && s ? Math.min(policy.stop, Math.max(.025, s.volatility / 100 * pos.lev * 3)) : policy.stop;
  if (net <= -pos.margin * volatilityStop) return result('Position loss reached the strategy risk limit');
  const best = state.bestNet[String(pos.id)] || 0;
  if (best > Math.max(fees * 2, pos.margin * .02) && net < best * .55) return result('Fee-adjusted profit retreated from its recorded peak');
  const minimumHold = Math.max(4000, Math.min(12_000, holdingHorizonMs(durationMs, policy) * .5));
  if (age < minimumHold) return null;
  const sign = pos.side === 'Long' ? 1 : -1, original = pos.botEntry;
  const originalKind = original?.kind === 'adaptive' ? original.regime === 'range' ? 'reversion' : original.regime === 'breakout' ? 'breakout' : 'trend' : original?.kind || policy.kind;
  if (policy.kind === 'adaptive' && original && state.regime !== original.regime && state.regime !== 'uncertain') return result('Confirmed regime transition no longer supports the original entry');
  if (s) {
    if ((originalKind === 'trend' || originalKind === 'conservative') && (sign * s.trend <= 0 || sign * s.slope < -.015)) return result('The recorded trend weakened or reversed');
    if (originalKind === 'momentum' && sign * s.shortReturn < .015) return result('Recent momentum faded or reversed');
    if (originalKind === 'breakout' && original && (pos.side === 'Long' ? mark < original.reference : mark > original.reference)) return result('Price returned inside the original breakout range');
    if (originalKind === 'reversion') {
      if (original && sign * (mark - original.reference) >= 0 && net > 0) return result('Price reached the entry reference mean after covering fees');
      if (sign * s.z < -3 || Math.abs(s.meanSlope) > .055 && sign * s.meanSlope < 0) return result('Deviation or a new directional regime invalidated the mean-reversion entry');
    }
    if (originalKind === 'volatility' && (s.volatilityRatio < .85 || sign * s.shortReturn <= 0)) return result('Volatility expansion or its directional confirmation faded');
  }
  if (['momentum', 'conservative', 'volatility'].includes(originalKind) && net >= Math.max(fees * .5, pos.size * (originalKind === 'volatility' && s ? Math.max(.0015, s.volatility / 100 * 2) : .0015))) return result('The strategy fee-adjusted profit target was reached');
  const horizon = holdingHorizonMs(durationMs, policy);
  if (age >= horizon && net > fees * .25 || age >= horizon * 2 && (!s || Math.abs(s.shortReturn) < .04)) return result('The planned signal-review window ended');
  return null;
}
export function entryContext(kind: BotKind, signal: EntrySignal, signals: Signals, now: number): BotEntry {
  return { version: 1, kind, regime: signal.regime, reason: signal.reason, signals: signals.evidence, reference: signal.reference, at: now };
}
