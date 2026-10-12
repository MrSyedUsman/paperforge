import type { Market, Quote } from "../../lib/market-data/markets.ts";
import type { Pos, ClosedPos, Activity } from "./types.ts";
import {
  calculateLiquidationPrice, DEFAULT_LIQUIDATION_FEE_RATE,
  DEFAULT_MAINTENANCE_MARGIN_RATE, grossPnl, MAX_LEVERAGE,
  positionQuantity, positionSize, roundMoney, tradingFee, settleIsolatedLiquidation,
} from "../../lib/simulation/trading.ts";

export function priceFor(quotes: Record<string, Quote>, pairOrBase: string): number {
  const pair = pairOrBase.endsWith("USDT") ? pairOrBase : `${pairOrBase}USDT`;
  return quotes[pair]?.markPrice || quotes[pair]?.price || 0;
}

export function accountMetrics(balance: number, positions: Pos[], history: ClosedPos[], activity: Activity[], quotes: Record<string, Quote>) {
  const totalPnl = positions.reduce((sum, p) => sum + grossPnl(p.size, p.entry, priceFor(quotes, p.pair || p.symbol), p.side), 0);
  const marginUsed = positions.reduce((sum, p) => sum + p.margin, 0);
  return {
    balance, totalPnl, marginUsed, equity: balance + marginUsed + totalPnl,
    realizedPnl: history.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0),
    totalFees: history.reduce((sum, p) => sum + (Number(p.totalFees) || 0), 0) + positions.reduce((sum, p) => sum + (Number(p.openFee) || 0), 0),
    faucetTotal: activity.filter(x => x.type === "faucet").reduce((sum, x) => sum + x.amount, 0),
  };
}

export function validateOrder(market: Market | undefined, feed: string, current: number, margin: number, leverage: number, balance: number): string {
  const notional = positionSize(margin, leverage), fee = tradingFee(notional), quantity = positionQuantity(notional, current, market);
  if (!market || market.status !== "TRADING") return "This market is unavailable";
  if (feed !== "live" || !current) return "A current live price is required";
  if (!Number.isFinite(margin) || margin <= 0) return "Enter a valid margin greater than zero";
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > MAX_LEVERAGE) return `Leverage must be between 1× and ${MAX_LEVERAGE}×`;
  if (margin + fee > balance) return "Available balance does not cover margin and opening fee";
  if (market.minNotional && notional < market.minNotional) return `Position must be at least $${market.minNotional}`;
  if (!quantity || quantity < 0) return "Position quantity is invalid";
  if (market.minQty && quantity < market.minQty) return `Quantity must be at least ${market.minQty}`;
  if (market.maxQty && quantity > market.maxQty) return `Quantity exceeds ${market.maxQty}`;
  return "";
}

export function createPosition(market: Market, current: number, amount: number, lev: number, side: Pos["side"], now = Date.now()): Pos {
  const margin = roundMoney(amount), size = positionSize(margin, lev);
  return {
    id: now, symbol: market.symbol, pair: market.pair, side, margin, size,
    quantity: positionQuantity(size, current, market), entry: current, lev,
    liquidation: calculateLiquidationPrice({ entry: current, side, leverage: lev, margin, notional: size }),
    maintenanceMarginRate: DEFAULT_MAINTENANCE_MARGIN_RATE, liquidationFeeRate: DEFAULT_LIQUIDATION_FEE_RATE,
    openFee: tradingFee(size), opened: new Date(now).toLocaleString(),
  };
}

export function closePosition(position: Pos, mark: number, at: string): { record: ClosedPos; walletCredit: number } {
  const exit = mark || position.entry, gross = grossPnl(position.size, position.entry, exit, position.side);
  const closeFee = tradingFee(position.size), totalFees = roundMoney((position.openFee || 0) + closeFee);
  const netPnl = roundMoney(gross - totalFees);
  return {
    walletCredit: position.margin + roundMoney(gross - closeFee),
    record: { ...position, pnl: netPnl, exit, closeFee, totalFees,
      roi: position.margin ? roundMoney(netPnl / position.margin * 100) : 0, closed: at, reason: "Manual close" },
  };
}

export function liquidatePosition(position: Pos, at: string): ClosedPos {
  const liquidation = Number(position.liquidation) || calculateLiquidationPrice({
    entry: position.entry, side: position.side, leverage: position.lev, margin: position.margin, notional: position.size,
  });
  const result = settleIsolatedLiquidation({ margin: position.margin, notional: position.size,
    openFee: position.openFee, liquidationPrice: liquidation, liquidationFeeRate: position.liquidationFeeRate });
  return { ...position, liquidation, pnl: result.netPnl, exit: result.executionPrice,
    closeFee: result.liquidationFee, liquidationFee: result.liquidationFee, marginLost: result.marginLost,
    totalFees: roundMoney((position.openFee || 0) + result.liquidationFee),
    roi: position.margin ? roundMoney(result.netPnl / position.margin * 100) : 0, closed: at, reason: "Liquidation" };
}
