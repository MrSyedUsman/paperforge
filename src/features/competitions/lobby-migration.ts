/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Position, Trade, Lobby } from "./types";
import { calculateLiquidationPrice, DEFAULT_MAINTENANCE_MARGIN_RATE, DEFAULT_LIQUIDATION_FEE_RATE, roundMoney } from "../../lib/simulation/trading.ts";
import { finite, validPosition } from "./engine.ts";
export function safeLobby(raw: string | null): Lobby | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      !Array.isArray(x.players) ||
      !x.players.length ||
      (x.status === "active" && x.players.length < 2) ||
      x.players.filter((p: any) => p?.isUser === true).length !== 1 ||
      x.players.some((p: any) => !p || typeof p.id !== "string" ||
        typeof p.name !== "string" || typeof p.avatar !== "string" ||
        typeof p.isUser !== "boolean" || !Array.isArray(p.positions)) ||
      new Set(x.players.map((p: any) => p.id)).size !== x.players.length ||
      !x.settings || typeof x.settings.name !== "string" ||
      !Array.isArray(x.settings.custom) ||
      x.settings.custom.some((pair: unknown) => typeof pair !== "string") ||
      !["Easy", "Medium", "Hard", "Expert"].includes(x.settings.difficulty) ||
      !["all", "majors", "custom"].includes(x.settings.marketMode) ||
      ["duration", "allocation", "maxLeverage", "maxPositions"].some(key =>
        !Number.isFinite(x.settings[key]) || x.settings[key] <= 0) ||
      !["active", "finished"].includes(x.status) ||
      !Number.isFinite(x.start) || !Number.isFinite(x.end)
    )
      return null;
    const allocation = Math.max(500, finite(x.settings?.allocation, 5000)),
      legacyFees = x.feeAccounting !== 2;
    x.players = x.players.map((p: any) => {
      const corrupted =
          !Number.isFinite(Number(p.balance)) ||
          !Number.isFinite(Number(p.realized)) ||
          !Number.isFinite(Number(p.fees)) ||
          (p.positions || []).some((pos: any) => !validPosition(pos)),
        normalizePosition = <T extends Position>(position: T): T => ({
          ...position,
          maintenanceMarginRate:
            finite(position.maintenanceMarginRate) ||
            DEFAULT_MAINTENANCE_MARGIN_RATE,
          liquidationFeeRate:
            finite(position.liquidationFeeRate) ||
            DEFAULT_LIQUIDATION_FEE_RATE,
          liquidation:
            calculateLiquidationPrice({
              entry: finite(position.entry),
              side: position.side,
              leverage: finite(position.lev),
              margin: finite(position.margin),
              notional: finite(position.size),
            }),
        }),
        storedTrades = Array.isArray(p.trades)
          ? p.trades.filter(
              (t: Trade) => validPosition(t) && Number.isFinite(Number(t.pnl)),
            ).map(normalizePosition)
          : [],
        trades = legacyFees
          ? storedTrades.map((t: any) => ({
              ...t,
              pnl: roundMoney(finite(t.pnl) - finite(t.openFee)),
            }))
          : storedTrades,
        legacyOpenFees = legacyFees
          ? storedTrades.reduce((n: number, t: any) => n + finite(t.openFee), 0)
          : 0;
      return {
        ...p,
        balance: corrupted ? allocation : finite(p.balance, allocation),
        realized: corrupted
          ? 0
          : roundMoney(finite(p.realized) - legacyOpenFees),
        fees: corrupted ? 0 : finite(p.fees),
        positions: corrupted
          ? []
          : (p.positions || []).filter(validPosition).map(normalizePosition),
        trades,
        rank: Math.max(1, finite(p.rank, 1)),
        previousRank: Math.max(1, finite(p.previousRank, 1)),
        achieved: finite(p.achieved, Date.now()),
      };
    });
    x.feeAccounting = 2;
    x.events = Array.isArray(x.events)
      ? x.events
          .filter(
            (e: any) => e && typeof e.text === "string" && !/NaN/i.test(e.text),
          )
          .slice(0, 80)
      : [];
    return x;
  } catch {
    return null;
  }
}
