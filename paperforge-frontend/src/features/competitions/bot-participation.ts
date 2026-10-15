import { TAKER_FEE_RATE, roundMoney } from "@paperforge/simulation";
import { eligibilityFor } from "./engine.ts";
import {
  cadenceMs,
  holdingHorizonMs,
  entryLimit,
  type BotPolicy,
} from "./bot-profiles.ts";
import type { Player, Lobby } from "./types.ts";
export type ParticipationPlan = {
  used: number;
  required: number;
  eligible: boolean;
  deficit: number;
  opportunities: number;
  margin: number;
  behind: boolean;
  entryAllowed: boolean;
  adjustment: string;
  minimumHoldMs: number;
  firstEntryDelayMs: number;
  idleMs: number;
  opportunityLevel: 1 | 2;
  entryLimit: number;
};
export function planParticipation(
  player: Player,
  lobby: Lobby,
  now: number,
  policy: BotPolicy,
  leverage: number,
  markedEquity?: number,
  setupScale = 1,
): ParticipationPlan {
  const progress = eligibilityFor(player, lobby.settings.allocation),
    duration = lobby.end - lobby.start,
    remaining = lobby.end - now;
  const horizon = holdingHorizonMs(duration, policy),
    interval = cadenceMs(lobby.settings.difficulty, duration, policy);
  const elapsed = Math.max(0, now - lobby.start),
    target = progress.required * Math.min(1, elapsed / (duration * 0.75));
  const deficit = Math.max(0, progress.required - progress.used),
    behind = !progress.eligible && progress.used < target;
  const opportunities = Math.max(
    1,
    Math.floor(
      (Math.max(0, remaining - 6000) / (horizon + interval)) *
        Math.min(policy.maxPositions, lobby.settings.maxPositions) *
        policy.opportunityFactor,
    ),
  );
  const allocation = lobby.settings.allocation,
    committed = player.positions.reduce((sum, p) => sum + p.margin, 0);
  const equity = markedEquity ?? player.balance + committed,
    drawdown = Math.max(0, 1 - equity / allocation);
  const riskScale = Math.max(
    policy.kind === "conservative" ? 0.3 : 0.45,
    1 - drawdown * (policy.kind === "conservative" ? 3 : 2),
  );
  const normal = allocation * policy.normalMargin * riskScale;
  const projected = !progress.eligible
    ? deficit / (opportunities * Math.max(0.5, Math.min(1, setupScale)))
    : normal;
  const paced = Math.max(
    normal,
    Math.min(
      projected,
      normal * (behind ? (policy.kind === "conservative" ? 1.9 : 1.8) : 1.4),
    ),
  );
  const margin = roundMoney(
    Math.max(
      0,
      Math.min(
        paced,
        allocation * policy.maxMargin * riskScale,
        allocation * policy.totalMargin * riskScale - committed,
        player.balance / (1 + leverage * TAKER_FEE_RATE),
      ),
    ),
  );
  const minimumHoldMs = Math.max(4000, Math.min(12_000, horizon * 0.5));
  const records = [...player.positions, ...player.trades],
    first = records.length ? Math.min(...records.map((p) => p.opened)) : now;
  const latestAction = records.length
    ? Math.max(
        ...records.map((p) => ("closed" in p ? Number(p.closed) : p.opened)),
      )
    : lobby.start;
  const idleMs = Math.max(0, now - latestAction),
    firstEntryDelayMs = records.length ? first - lobby.start : elapsed;
  const explorationAfter = Math.max(
    policy.kind === "conservative" ? 14000 : 10000,
    Math.min(45000, duration * 0.12),
  );
  const opportunityLevel: 1 | 2 =
    idleMs >= explorationAfter || (behind && elapsed >= explorationAfter)
      ? 2
      : 1;
  const limit = entryLimit(duration, policy);
  const entryAllowed =
    records.length < limit &&
    now >= lobby.start &&
    remaining >= Math.max(8000, minimumHoldMs + interval) &&
    player.positions.length <
      Math.min(policy.maxPositions, lobby.settings.maxPositions) &&
    margin >= 0.01 &&
    player.status === "active";
  const adjustment =
    paced > normal + 0.01
      ? `Participation pace: bounded sizing adjustment; ${roundMoney(progress.used)} of ${progress.required} cumulative margin used.`
      : progress.eligible
        ? "Eligibility met; normal strategy risk policy."
        : "Normal strategy sizing; participation tracked from the start.";
  return {
    firstEntryDelayMs,
    idleMs,
    opportunityLevel,
    entryLimit: limit,
    used: progress.used,
    required: progress.required,
    eligible: progress.eligible,
    deficit,
    opportunities,
    margin,
    behind,
    entryAllowed,
    adjustment,
    minimumHoldMs,
  };
}
