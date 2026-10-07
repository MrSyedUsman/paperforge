export const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005;
export const DEFAULT_LIQUIDATION_FEE_RATE = 0.001;

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

export function calculateLiquidationPrice({
  entry,
  side,
  leverage,
  margin,
  notional,
  maintenanceMarginRate = DEFAULT_MAINTENANCE_MARGIN_RATE,
  liquidationFeeRate = DEFAULT_LIQUIDATION_FEE_RATE,
}: LiquidationInput) {
  const safeEntry = positive(entry);
  const safeMargin = positive(margin, 1);
  const safeNotional = positive(notional, safeMargin * positive(leverage, 1));
  const effectiveLeverage = Math.max(1, safeNotional / safeMargin);
  if (!safeEntry || (side !== "Long" && side !== "Short")) return 0;
  const reserveRate = Math.max(
    0,
    Number(maintenanceMarginRate) + Number(liquidationFeeRate),
  );
  const adverseMove = Math.max(0.0001, 1 / effectiveLeverage - reserveRate);
  return safeEntry * (side === "Long" ? 1 - adverseMove : 1 + adverseMove);
}

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

export function settleIsolatedLiquidation({
  margin,
  notional,
  openFee = 0,
  liquidationPrice,
  liquidationFeeRate = DEFAULT_LIQUIDATION_FEE_RATE,
}: {
  margin: number;
  notional: number;
  openFee?: number;
  liquidationPrice: number;
  liquidationFeeRate?: number;
}) {
  const safeMargin = positive(margin);
  const fee = Math.min(
    safeMargin,
    positive(notional) * Math.max(0, Number(liquidationFeeRate) || 0),
  );
  return {
    executionPrice: positive(liquidationPrice),
    marginLost: safeMargin,
    liquidationFee: Math.round(fee * 100) / 100,
    walletCredit: 0,
    netPnl: Math.round((-safeMargin - Math.max(0, Number(openFee) || 0)) * 100) / 100,
  };
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
