export const TAKER_FEE_RATE: number;
export const MAX_LEVERAGE: number;
export const DEFAULT_MAINTENANCE_MARGIN_RATE: number;
export const DEFAULT_LIQUIDATION_FEE_RATE: number;
export type PositionSide = 'Long' | 'Short';
export type LiquidationInput = {
  entry: number; side: PositionSide; leverage?: number; margin?: number; notional?: number;
  maintenanceMarginRate?: number; liquidationFeeRate?: number;
};
export function roundMoney(value: number): number;
export function positionSize(margin: number, leverage: number): number;
export function tradingFee(notional: number): number;
export function grossPnl(size: number, entry: number, mark: number, side: PositionSide): number;
export function calculateLiquidationPrice(input: LiquidationInput): number;
export function settleIsolatedLiquidation(input: {
  margin: number; notional: number; openFee?: number; liquidationPrice: number; liquidationFeeRate?: number;
}): { executionPrice: number; marginLost: number; liquidationFee: number; walletCredit: number; netPnl: number };
