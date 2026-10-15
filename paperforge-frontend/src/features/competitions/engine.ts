import { competitionEligibility, compareCompetitionScores } from '@paperforge/simulation';
import { trimBotTradeMetadata } from './bot-state.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Quote } from "@/lib/market-data/markets";
import type { Position, Player, Settings, Trade, Lobby } from "./types";
import { calculateLiquidationPrice, DEFAULT_MAINTENANCE_MARGIN_RATE, DEFAULT_LIQUIDATION_FEE_RATE, grossPnl, roundMoney, tradingFee, settleIsolatedLiquidation } from "../../lib/simulation/trading.ts";
import { money } from "./constants.ts";
export function pricesFor(quotes: Record<string, Quote>, pair: string) {
  return quotes[pair]?.markPrice || quotes[pair]?.price || 0;
}
export function finite(n: unknown, fallback = 0) {
  const value = Number(n);
  return Number.isFinite(value) ? value : fallback;
}
export function validPosition(p: any): p is Position {
  return Boolean(
    p &&
    typeof p.pair === "string" &&
    (p.side === "Long" || p.side === "Short") &&
    finite(p.lev) > 0 &&
    finite(p.margin) > 0 &&
    finite(p.size) > 0 &&
    finite(p.entry) > 0,
  );
}
export function pnlFor(player: Player, quotes: Record<string, Quote>) {
  return roundMoney(
    (player.positions || [])
      .filter(validPosition)
      .reduce(
        (n, p) =>
          n +
          finite(
            grossPnl(
              p.size,
              p.entry,
              pricesFor(quotes, p.pair) || p.entry,
              p.side,
            ),
          ),
        0,
      ),
  );
}
export function equityFor(player: Player, quotes: Record<string, Quote>) {
  return roundMoney(
    finite(player.balance) +
      (player.positions || [])
        .filter(validPosition)
        .reduce((n, p) => n + finite(p.margin), 0) +
      pnlFor(player, quotes),
  );
}
export function tradedMarginFor(player: Player) {
  return roundMoney(
    [...(player.positions || []), ...(player.trades || [])]
      .filter(validPosition)
      .reduce((n, p) => n + finite(p.margin), 0),
  );
}
export function eligibilityFor(player: Player, allocation: number) {
  const opened = (player.positions?.length || 0) + (player.trades?.length || 0),
    used = tradedMarginFor(player),
    required = competitionEligibility(opened, used, allocation).required;
  return {
    opened,
    used,
    required,
    eligible: competitionEligibility(opened, used, allocation).eligible,
    reason:
      opened < 1
        ? "No trade was opened."
        : `Only ${money(used)} of ${money(required)} required margin was used.`,
  };
}
export function rankPlayers(players: Player[], quotes: Record<string, Quote>) {
  return [...players]
    .sort(
      (a, b) =>
        compareCompetitionScores({equity:equityFor(a,quotes),realized:a.realized,fees:a.fees,achieved:a.achieved},{equity:equityFor(b,quotes),realized:b.realized,fees:b.fees,achieved:b.achieved}),
    )
    .map((p, i) => ({ ...p, previousRank: p.rank, rank: i + 1 }));
}
export function rankFinalPlayers(
  players: Player[],
  quotes: Record<string, Quote>,
  allocation: number,
) {
  return [...players]
    .sort(
      (a, b) =>
        Number(eligibilityFor(b, allocation).eligible) -
          Number(eligibilityFor(a, allocation).eligible) ||
        compareCompetitionScores({equity:equityFor(a,quotes),realized:a.realized,fees:a.fees,achieved:a.achieved},{equity:equityFor(b,quotes),realized:b.realized,fees:b.fees,achieved:b.achieved}),
    )
    .map((p, i) => ({ ...p, previousRank: p.rank, rank: i + 1 }));
}
export function competitionCardMetrics(
  user: Player,
  lobby: Lobby,
  quotes: Record<string, Quote>,
) {
  const allocation = lobby.settings.allocation,
    equity = equityFor(user, quotes),
    netReturn = allocation ? ((equity - allocation) / allocation) * 100 : 0;
  const ordered = [...user.trades].sort((a, b) => a.closed - b.closed);
  let curve = allocation,
    peak = allocation,
    maxDrawdown = 0;
  ordered.forEach((trade) => {
    curve = roundMoney(curve + finite(trade.pnl));
    peak = Math.max(peak, curve);
    if (peak > 0)
      maxDrawdown = Math.max(maxDrawdown, ((peak - curve) / peak) * 100);
  });
  const best = [...ordered].sort(
      (a, b) => finite(b.pnl) - finite(a.pnl),
    )[0],
    eligibility = eligibilityFor(user, allocation),
    eligible = eligibility.eligible,
    count = lobby.players.length,
    equityOrder = [...lobby.players].sort(
      (a, b) =>
        equityFor(b, quotes) - equityFor(a, quotes) ||
        b.realized - a.realized ||
        a.fees - b.fees,
    ),
    equityRank = equityOrder.findIndex((p) => p.id === user.id) + 1,
    eligibleOrder = equityOrder.filter(
      (player) => eligibilityFor(player, allocation).eligible,
    ),
    awardedWinner = eligibleOrder[0] || null,
    awardedWinnerEquityRank = awardedWinner
      ? equityOrder.findIndex((player) => player.id === awardedWinner.id) + 1
      : 0,
    awardedRank = eligible
      ? eligibleOrder.findIndex((player) => player.id === user.id) + 1
      : 0,
    isWinner = awardedRank === 1,
    promotedWinner = isWinner && equityRank > 1,
    rawLeaderNoAward = equityRank === 1 && !eligible;
  const placement = count > 1 ? ((count - equityRank) / (count - 1)) * 35 : 35,
    returnScore = Math.max(0, Math.min(35, 20 + netReturn * 2)),
    riskScore = Math.max(0, 20 - maxDrawdown),
    discipline = eligible ? 10 : 0;
  return {
    equity,
    netReturn,
    maxDrawdown,
    best,
    eligibility,
    eligible,
    equityRank,
    awardedRank,
    awardedWinnerEquityRank,
    isWinner,
    promotedWinner,
    rawLeaderNoAward,
    skillScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(placement + returnScore + riskScore + discipline),
      ),
    ),
  };
}

export function closePosition(
  player: Player,
  pos: Position,
  reason = "Closed",
  mark: number = pos.entry,
  now: number = Date.now(),
) {
  const gross = grossPnl(pos.size, pos.entry, mark, pos.side),
    fee = tradingFee(pos.size),
    settlementCredit = roundMoney(gross - fee),
    net = roundMoney(gross - finite(pos.openFee) - fee),
    trade: Trade = {
      ...pos,
      exit: mark,
      pnl: net,
      fee,
      closed: now,
      reason,
    };
  return {
    ...player,
    balance: roundMoney(player.balance + pos.margin + settlementCredit),
    realized: roundMoney(player.realized + net),
    fees: roundMoney(player.fees + fee),
    positions: player.positions.filter((p) => p.id !== pos.id),
    trades: player.isUser ? [trade, ...player.trades] : trimBotTradeMetadata([trade, ...player.trades]),
    achieved: now,
  };
}
export function liquidatePosition(player: Player, pos: Position, now: number = Date.now()) {
  const result = settleIsolatedLiquidation({
      margin: pos.margin,
      notional: pos.size,
      openFee: pos.openFee,
      liquidationPrice: pos.liquidation,
      liquidationFeeRate: pos.liquidationFeeRate,
    }),
    trade: Trade = {
      ...pos,
      exit: result.executionPrice,
      pnl: result.netPnl,
      fee: result.liquidationFee,
      liquidationFee: result.liquidationFee,
      marginLost: result.marginLost,
      closed: now,
      reason: "Liquidation",
    };
  return {
    ...player,
    balance: player.balance,
    realized: roundMoney(player.realized + result.netPnl),
    fees: roundMoney(player.fees + result.liquidationFee),
    positions: player.positions.filter((p) => p.id !== pos.id),
    trades: player.isUser ? [trade, ...player.trades] : trimBotTradeMetadata([trade, ...player.trades]),
    achieved: now,
  };
}
export function openFor(
  player: Player,
  pair: string,
  direction: "Long" | "Short",
  m: number,
  lev: number,
  settings: Settings,
  quotes: Record<string, Quote>,
  execution: { now: number; id: number } = { now: Date.now(), id: Date.now() + Math.random() },
) {
  const safeMargin = finite(m),
    safeLeverage = Math.floor(finite(lev)),
    mark = pricesFor(quotes, pair),
    size = roundMoney(safeMargin * safeLeverage),
    fee = tradingFee(size),
    balance = finite(player.balance);
  if (
    !mark ||
    player.status !== "active" ||
    player.positions.length >= settings.maxPositions ||
    safeMargin <= 0 ||
    safeLeverage < 1 ||
    safeLeverage > settings.maxLeverage ||
    !Number.isFinite(size) ||
    !Number.isFinite(fee) ||
    safeMargin + fee > balance
  )
    return player;
  if (!settings.repeats && player.positions.some((p) => p.pair === pair))
    return player;
  const pos: Position = {
    id: execution.id,
    pair,
    side: direction,
    lev: safeLeverage,
    margin: roundMoney(safeMargin),
    size,
    entry: mark,
    liquidation: calculateLiquidationPrice({
      entry: mark,
      side: direction,
      leverage: safeLeverage,
      margin: safeMargin,
      notional: size,
    }),
    maintenanceMarginRate: DEFAULT_MAINTENANCE_MARGIN_RATE,
    liquidationFeeRate: DEFAULT_LIQUIDATION_FEE_RATE,
    openFee: fee,
    opened: execution.now,
  };
  return {
    ...player,
    balance: roundMoney(balance - safeMargin - fee),
    fees: roundMoney(finite(player.fees) + fee),
    positions: [pos, ...player.positions],
    achieved: execution.now,
  };
}
