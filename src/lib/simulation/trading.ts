import type { Market } from "../market-data/markets.ts";
import { calculateLiquidationPrice } from "./liquidation.ts";
export {
  calculateLiquidationPrice,
  DEFAULT_LIQUIDATION_FEE_RATE,
  DEFAULT_MAINTENANCE_MARGIN_RATE,
  findLiquidatedPositions,
  isLiquidated,
  liquidationDistancePercent,
  liquidationRiskStatus,
  settleIsolatedLiquidation,
} from "./liquidation.ts";

export const TAKER_FEE_RATE = 0.0005;
export const MAX_LEVERAGE = 50;

export function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function positionSize(margin: number, leverage: number) { return roundMoney(margin * leverage); }
export function tradingFee(notional: number) { return roundMoney(notional * TAKER_FEE_RATE); }
export function estimatedLiquidation(entry: number, side: "Long" | "Short", leverage: number) {
  return calculateLiquidationPrice({ entry, side, leverage });
}
export function positionQuantity(notional: number, entry: number, market?: Market) {
  if (!entry) return 0;
  const raw = notional / entry, step = market?.stepSize ?? 0;
  return step > 0 ? Math.floor(raw / step) * step : raw;
}
export function grossPnl(size: number, entry: number, mark: number, side: "Long" | "Short") {
  if (!entry || !mark) return 0;
  return size * ((mark - entry) / entry) * (side === "Long" ? 1 : -1);
}
