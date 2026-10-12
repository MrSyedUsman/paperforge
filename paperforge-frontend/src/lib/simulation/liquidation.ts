export { DEFAULT_MAINTENANCE_MARGIN_RATE, DEFAULT_LIQUIDATION_FEE_RATE } from "@paperforge/simulation";

export type PositionSide = "Long" | "Short";

export type LiquidationInput = {
  entry: number;
  side: PositionSide;
  leverage?: number;
  margin?: number;
  notional?: number;
  maintenanceMarginRate?: number;
  liquidationFeeRate?: number;
};

const positive = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export { calculateLiquidationPrice, settleIsolatedLiquidation } from "@paperforge/simulation";

export function isLiquidated(mark: number, liquidation: number, side: PositionSide) {
  const safeMark = positive(mark);
  const safeLiquidation = positive(liquidation);
  return Boolean(
    safeMark &&
      safeLiquidation &&
      (side === "Long"
        ? safeMark <= safeLiquidation
        : safeMark >= safeLiquidation),
  );
}

export function liquidationDistancePercent(mark: number, liquidation: number, side: PositionSide) {
  const safeMark = positive(mark);
  const safeLiquidation = positive(liquidation);
  if (!safeMark || !safeLiquidation) return 0;
  const distance =
    side === "Long"
      ? (safeMark - safeLiquidation) / safeMark
      : (safeLiquidation - safeMark) / safeMark;
  return Math.max(0, distance * 100);
}

export function liquidationRiskStatus(distance: number) {
  const value = Math.max(0, Number(distance) || 0);
  if (value <= 1) return "Critical";
  if (value <= 3) return "High";
  if (value <= 7) return "Elevated";
  return "Safe";
}

export function findLiquidatedPositions<T extends {
  pair?: string;
  symbol?: string;
  side: PositionSide;
  liquidation: number;
}>(positions: T[], marks: Record<string, number>) {
  return (Array.isArray(positions) ? positions : []).filter((position) => {
    const mark = Number(marks?.[position.pair || position.symbol || ""]);
    return isLiquidated(mark, Number(position.liquidation), position.side);
  });
}
