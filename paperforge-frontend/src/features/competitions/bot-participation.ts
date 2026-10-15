import { TAKER_FEE_RATE, roundMoney } from '@paperforge/simulation';
import { eligibilityFor } from './engine.ts';
import { cadenceMs, holdingHorizonMs, type BotPolicy } from './bot-profiles.ts';
import type { Player, Lobby } from './types.ts';
export type ParticipationPlan = { used: number; required: number; eligible: boolean; deficit: number; opportunities: number; margin: number; behind: boolean; entryAllowed: boolean; adjustment: string; minimumHoldMs: number };
export function planParticipation(player: Player, lobby: Lobby, now: number, policy: BotPolicy, leverage: number, markedEquity?: number): ParticipationPlan {
  const progress = eligibilityFor(player, lobby.settings.allocation), duration = lobby.end - lobby.start, remaining = lobby.end - now;
  const horizon = holdingHorizonMs(duration, policy), interval = cadenceMs(lobby.settings.difficulty, duration, policy);
  const elapsed = Math.max(0, now - lobby.start), target = progress.required * Math.min(1, elapsed / (duration * .75));
  const deficit = Math.max(0, progress.required - progress.used), behind = !progress.eligible && progress.used < target;
  const opportunities = Math.max(1, Math.floor(Math.max(0, remaining - 6000) / (horizon + interval) * Math.min(policy.maxPositions, lobby.settings.maxPositions) * policy.opportunityFactor));
  const allocation = lobby.settings.allocation, committed = player.positions.reduce((sum, p) => sum + p.margin, 0);
  const equity = markedEquity ?? player.balance + committed, drawdown = Math.max(0, 1 - equity / allocation);
  const riskScale = Math.max(policy.kind === 'conservative' ? .3 : .45, 1 - drawdown * (policy.kind === 'conservative' ? 3 : 2));
  const normal = allocation * policy.normalMargin * riskScale;
  const projected = !progress.eligible ? deficit / opportunities : normal;
  const paced = Math.max(normal, Math.min(projected, normal * (behind ? 1.8 : 1.4)));
  const margin = roundMoney(Math.max(0, Math.min(paced, allocation * policy.maxMargin * riskScale, allocation * policy.totalMargin * riskScale - committed, player.balance / (1 + leverage * TAKER_FEE_RATE))));
  const minimumHoldMs = Math.max(4000, Math.min(12_000, horizon * .5));
  const entryAllowed = now >= lobby.start && remaining >= Math.max(8000, minimumHoldMs + interval) && player.positions.length < Math.min(policy.maxPositions, lobby.settings.maxPositions) && margin >= .01 && player.status === 'active';
  const adjustment = paced > normal + .01 ? `Participation pace: bounded sizing adjustment; ${roundMoney(progress.used)} of ${progress.required} cumulative margin used.` : progress.eligible ? 'Eligibility met; normal strategy risk policy.' : 'Normal strategy sizing; participation tracked from the start.';
  return { used: progress.used, required: progress.required, eligible: progress.eligible, deficit, opportunities, margin, behind, entryAllowed, adjustment, minimumHoldMs };
}
