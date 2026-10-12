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

export { TAKER_FEE_RATE, MAX_LEVERAGE, roundMoney, positionSize, tradingFee, grossPnl } from "@paperforge/simulation";

export function estimatedLiquidation(entry: number, side: "Long" | "Short", leverage: number) {
  return calculateLiquidationPrice({ entry, side, leverage });
}
export function positionQuantity(notional: number, entry: number, market?: Market) {
  if (!entry) return 0;
  const raw = notional / entry, step = market?.stepSize ?? 0;
  return step > 0 ? Math.floor(raw / step) * step : raw;
}
