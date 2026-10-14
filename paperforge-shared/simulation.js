// Shared accounting primitives. Preserve the simulator's arithmetic and rounding.
export const TAKER_FEE_RATE = 0.0005;
export const MAX_LEVERAGE = 50;
export const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005;
export const DEFAULT_LIQUIDATION_FEE_RATE = 0.001;
export function roundMoney(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function positionSize(margin, leverage) { return roundMoney(margin * leverage); }
export function tradingFee(notional) { return roundMoney(notional * TAKER_FEE_RATE); }
export function grossPnl(size, entry, mark, side) {
  if (!entry || !mark) return 0;
  return size * ((mark - entry) / entry) * (side === 'Long' ? 1 : -1);
}
const positive = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};
export function calculateLiquidationPrice({ entry, side, leverage, margin, notional,
  maintenanceMarginRate = DEFAULT_MAINTENANCE_MARGIN_RATE,
  liquidationFeeRate = DEFAULT_LIQUIDATION_FEE_RATE }) {
  const safeEntry = positive(entry);
  const safeMargin = positive(margin, 1);
  const safeNotional = positive(notional, safeMargin * positive(leverage, 1));
  const effectiveLeverage = Math.max(1, safeNotional / safeMargin);
  if (!safeEntry || (side !== 'Long' && side !== 'Short')) return 0;
  const reserveRate = Math.max(0, Number(maintenanceMarginRate) + Number(liquidationFeeRate));
  const adverseMove = Math.max(0.0001, 1 / effectiveLeverage - reserveRate);
  return safeEntry * (side === 'Long' ? 1 - adverseMove : 1 + adverseMove);
}
export function settleIsolatedLiquidation({ margin, notional, openFee = 0,
  liquidationPrice, liquidationFeeRate = DEFAULT_LIQUIDATION_FEE_RATE }) {
  const safeMargin = positive(margin);
  const fee = Math.min(safeMargin, positive(notional) * Math.max(0, Number(liquidationFeeRate) || 0));
  return {
    executionPrice: positive(liquidationPrice), marginLost: safeMargin,
    liquidationFee: Math.round(fee * 100) / 100, walletCredit: 0,
    netPnl: Math.round((-safeMargin - Math.max(0, Number(openFee) || 0)) * 100) / 100,
  };
}

export const LIVE_PRICE_MAX_AGE_MS = 45_000;
