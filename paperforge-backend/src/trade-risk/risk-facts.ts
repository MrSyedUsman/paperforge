import { BadRequestException } from '@nestjs/common';
import { LIVE_PRICE_MAX_AGE_MS, MAX_LEVERAGE, positionSize, tradingFee, roundMoney, grossPnl, calculateLiquidationPrice, settleIsolatedLiquidation } from '@paperforge/simulation';
import type { Fact } from '../trade-reviews/trade-facts.js';
export type RiskSnapshot = { pair: string; side: 'Long' | 'Short'; margin: number; leverage: number; price: number; priceTimestamp: number };
export type Scenario = { id: string; movePercent: number; hypotheticalPrice: number; executionPrice: number; liquidated: boolean; priceMovePnl: number; grossPnl: number; closingFee: number; totalFees: number; netPnl: number };
export type RiskFacts = { snapshot: RiskSnapshot; notional: number; openingFee: number; liquidationPrice: number; liquidationDistancePercent: number; scenarios: Scenario[]; facts: Fact[]; limitations: string[] };
const allowed = new Set(['pair', 'side', 'margin', 'leverage', 'price', 'priceTimestamp']);
export function calculateRiskFacts(body: unknown, now = Date.now()): RiskFacts {
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 1500) throw new BadRequestException('Provide one paper-trade risk snapshot.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !allowed.has(key))) throw new BadRequestException('Unexpected risk-check fields.');
  if (typeof input.pair !== 'string' || !/^[A-Z0-9]{1,24}USDT$/.test(input.pair)) throw new BadRequestException('Invalid USDT market.');
  if (input.side !== 'Long' && input.side !== 'Short') throw new BadRequestException('Invalid direction.');
  for (const [name, min, max] of [['margin', .01, 1_000_000], ['leverage', 1, MAX_LEVERAGE], ['price', 1e-12, 1_000_000_000], ['priceTimestamp', 1, now + 5000]] as const) {
    const value = input[name];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new BadRequestException(`${name} is missing or outside the supported range.`);
  }
  if (!Number.isInteger(input.leverage) || !Number.isInteger(input.priceTimestamp)) throw new BadRequestException('Leverage and price timestamp must be integers.');
  if (now - Number(input.priceTimestamp) > LIVE_PRICE_MAX_AGE_MS) throw new BadRequestException('The price snapshot is stale. Check again with a fresh live price.');
  const snapshot: RiskSnapshot = { pair: input.pair, side: input.side, margin: roundMoney(Number(input.margin)), leverage: Number(input.leverage), price: Number(input.price), priceTimestamp: Number(input.priceTimestamp) };
  // Opening the actual position rounds margin first; use exactly the same convention here.
  const notional = positionSize(snapshot.margin, snapshot.leverage), openingFee = tradingFee(notional);
  const liquidationPrice = calculateLiquidationPrice({ entry: snapshot.price, side: snapshot.side, margin: snapshot.margin, notional });
  const liquidationDistancePercent = Math.abs(liquidationPrice - snapshot.price) / snapshot.price * 100;
  const scenarios = [.5, 1, 2].flatMap(move => [move, -move]).map(move => {
    const id = `${move > 0 ? 'favourable' : 'adverse'}${Math.abs(move).toString().replace('.', '_')}`;
    const hypotheticalPrice = snapshot.price * (1 + move / 100 * (snapshot.side === 'Long' ? 1 : -1));
    const liquidated = snapshot.side === 'Long' ? hypotheticalPrice <= liquidationPrice : hypotheticalPrice >= liquidationPrice;
    const executionPrice = liquidated ? liquidationPrice : hypotheticalPrice;
    const settlement = settleIsolatedLiquidation({ margin: snapshot.margin, notional, openFee: openingFee, liquidationPrice });
    const closingFee = liquidated ? settlement.liquidationFee : tradingFee(notional), totalFees = roundMoney(openingFee + closingFee);
    const rawGross = grossPnl(notional, snapshot.price, executionPrice, snapshot.side);
    const gross = liquidated ? roundMoney(-snapshot.margin + closingFee) : roundMoney(rawGross);
    return { id, movePercent: move, hypotheticalPrice, executionPrice, liquidated, priceMovePnl: roundMoney(grossPnl(notional, snapshot.price, executionPrice, snapshot.side)), grossPnl: gross, closingFee, totalFees, netPnl: liquidated ? settlement.netPnl : roundMoney(rawGross - totalFees) };
  });
  const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
  const price = (n: number) => `$${n.toLocaleString('en-US', { maximumSignificantDigits: 10 })}`;
  const facts: Fact[] = [
    { id: 'margin', label: 'Isolated margin', value: money(snapshot.margin) },
    { id: 'leverage', label: 'Leverage', value: `${snapshot.leverage}x` },
    { id: 'notional', label: 'Position exposure', value: money(notional) },
    { id: 'entry', label: 'Price snapshot', value: price(snapshot.price) },
    { id: 'openingFee', label: 'Estimated opening fee', value: money(openingFee) },
    { id: 'liquidationPrice', label: 'Estimated liquidation price', value: price(liquidationPrice) },
    { id: 'liquidationDistance', label: 'Liquidation distance from entry', value: `${liquidationDistancePercent.toFixed(2)}%` },
    { id: 'roundTripFees', label: 'Normal-close entry + exit fees', value: money(openingFee + tradingFee(notional)) },
    ...scenarios.map(s => ({ id: s.id, label: `${Math.abs(s.movePercent)}% ${s.movePercent > 0 ? 'favourable' : 'adverse'} example`, value: `${s.liquidated ? 'Liquidates at threshold; gross settlement' : 'Gross PnL'} ${money(s.grossPnl)}, fees ${money(s.totalFees)}, net ${money(s.netPnl)}` })),
  ];
  const limitations = ['Unverified user-submitted simulation inputs and price timestamp; this is not a verified account or market quote.', 'Hypothetical favourable and adverse price moves are examples, not predictions. Actual order execution uses its own current price.', 'Isolated margin; standard simulator maintenance and liquidation rates. Funding, slippage and the intervening price path are not simulated.', 'Liquidation executes at the threshold and exhausts margin including the liquidation fee. Gross settlement differs from price-move PnL; do not charge the liquidation fee twice.'];
  return { snapshot, notional, openingFee, liquidationPrice, liquidationDistancePercent, scenarios, facts, limitations };
}
