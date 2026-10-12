import { BadRequestException } from '@nestjs/common';
import { calculateLiquidationPrice, DEFAULT_LIQUIDATION_FEE_RATE, DEFAULT_MAINTENANCE_MARGIN_RATE,
  grossPnl, MAX_LEVERAGE, positionSize, roundMoney, settleIsolatedLiquidation, tradingFee } from '@paperforge/simulation';

export type TradeSnapshot = {
  pair: string; side: 'Long' | 'Short'; entry: number; margin: number; leverage: number;
  notional: number; exit: number | null; openingFee: number | null;
  reason: 'Manual close' | 'Liquidation' | 'Closed'; maintenanceMarginRate: number; liquidationFeeRate: number;
};
export type Fact = { id: string; label: string; value: string };
export type TradeFacts = {
  trade: TradeSnapshot; grossPnl: number | null; priceMovePnl: number | null;
  closingFee: number; totalFees: number | null; netPnl: number | null; roi: number | null;
  liquidationPrice: number; outcome: 'Profit' | 'Loss' | 'Flat' | 'Unknown';
  facts: Fact[]; limitations: string[];
};
const allowed = new Set(['pair', 'side', 'entry', 'exit', 'margin', 'leverage', 'notional',
  'openingFee', 'reason', 'maintenanceMarginRate', 'liquidationFeeRate']);
function number(value: unknown, label: string, max: number, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > max || (allowZero ? value < 0 : value <= 0)) {
    throw new BadRequestException(`${label} is missing or outside the supported range.`);
  }
  return value;
}
export function calculateTradeFacts(body: unknown): TradeFacts {
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 4000) {
    throw new BadRequestException('Provide one completed paper-trade snapshot.');
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !allowed.has(key))) throw new BadRequestException('Unexpected trade fields.');
  if (typeof input.pair !== 'string' || !/^[A-Z0-9]{1,24}USDT$/.test(input.pair)) throw new BadRequestException('Invalid USDT market.');
  if (input.side !== 'Long' && input.side !== 'Short') throw new BadRequestException('Invalid direction.');
  const margin = number(input.margin, 'Margin', 1_000_000);
  const leverage = number(input.leverage, 'Leverage', MAX_LEVERAGE);
  if (!Number.isInteger(leverage)) throw new BadRequestException('Leverage must be an integer.');
  const notional = positionSize(margin, leverage);
  if (input.notional !== undefined && Math.abs(number(input.notional, 'Notional', 50_000_000) - notional) > 0.011) {
    throw new BadRequestException('Notional does not match margin and leverage.');
  }
  if (input.reason !== undefined && (typeof input.reason !== 'string' || !['Manual close', 'Liquidation', 'Closed'].includes(input.reason))) {
    throw new BadRequestException('Unsupported closing reason.');
  }
  const trade: TradeSnapshot = {
    pair: input.pair, side: input.side, margin, leverage, notional,
    entry: number(input.entry, 'Entry price', 1_000_000_000),
    exit: input.exit == null ? null : number(input.exit, 'Exit price', 1_000_000_000),
    openingFee: input.openingFee == null ? null : number(input.openingFee, 'Opening fee', notional * 0.05, true),
    reason: (input.reason ?? 'Closed') as TradeSnapshot['reason'],
    maintenanceMarginRate: input.maintenanceMarginRate === undefined ? DEFAULT_MAINTENANCE_MARGIN_RATE : number(input.maintenanceMarginRate, 'Maintenance rate', 0.05, true),
    liquidationFeeRate: input.liquidationFeeRate === undefined ? DEFAULT_LIQUIDATION_FEE_RATE : number(input.liquidationFeeRate, 'Liquidation rate', 0.05, true),
  };
  if(margin<0.01||trade.entry<1e-12||(trade.exit!==null&&trade.exit<1e-12)) throw new BadRequestException('Trade amounts or prices are below the supported precision.');
  const liquidationPrice = calculateLiquidationPrice({entry: trade.entry, side: trade.side, margin, notional,
    maintenanceMarginRate: trade.maintenanceMarginRate, liquidationFeeRate: trade.liquidationFeeRate});
  const liquidation = settleIsolatedLiquidation({margin, notional, openFee: trade.openingFee ?? 0,
    liquidationPrice, liquidationFeeRate: trade.liquidationFeeRate});
  const isLiquidation = trade.reason === 'Liquidation';
  const priceMovePnl = trade.exit === null ? null : grossPnl(notional, trade.entry, trade.exit, trade.side);
  // On liquidation the closing fee is already inside the exhausted isolated margin.
  const gross = isLiquidation ? roundMoney(-margin + liquidation.liquidationFee) : priceMovePnl;
  const closingFee = isLiquidation ? liquidation.liquidationFee : tradingFee(notional);
  const totalFees = trade.openingFee === null ? null : roundMoney(trade.openingFee + closingFee);
  const netPnl = trade.openingFee === null || gross === null ? null :
    isLiquidation ? liquidation.netPnl : roundMoney(gross - totalFees!);
  const roi = netPnl === null ? null : roundMoney(netPnl / margin * 100);
  const outcome = netPnl === null ? 'Unknown' : netPnl > 0 ? 'Profit' : netPnl < 0 ? 'Loss' : 'Flat';
  const limitations = ['This is a user-submitted browser-local simulation record, not a verified account transaction.',
    'Market conditions, price path, timing and trader intentions were not supplied. Funding and slippage are not simulated.'];
  if (trade.openingFee === null) limitations.push('The opening fee is missing; total fees and net PnL cannot be reconstructed.');
  if (trade.exit === null) limitations.push('The recorded exit price is missing; price-move PnL is unavailable.');
  if (isLiquidation) limitations.push('Liquidation exhausts isolated margin, including its liquidation fee. Do not subtract that fee a second time. Gross settlement can differ from price-move PnL.');
  const money = (v: number) => `${v<0?"-":""}$${Math.abs(v).toFixed(2)}`;
  const price = (value: number) => `$${value.toLocaleString('en-US',{maximumSignificantDigits:10})}`;
  const facts: Fact[] = [
    {id:'direction',label:'Direction',value:trade.side},
    {id:'margin',label:'Isolated margin',value:money(margin)},
    {id:'leverage',label:'Leverage',value:`${leverage}×`},
    {id:'notional',label:'Leveraged notional',value:money(notional)},
    {id:'entry',label:'Entry price',value:price(trade.entry)},
    {id:'closingFee',label:isLiquidation ? 'Liquidation fee (inside margin)' : 'Closing fee',value:money(closingFee)},
    {id:'liquidationPrice',label:'Estimated liquidation threshold',value:price(liquidationPrice)},
    {id:'reason',label:'Closing reason',value:trade.reason},
    {id:'outcome',label:'Net outcome',value:outcome},
  ];
  if(trade.exit!==null)facts.push({id:'exit',label:'Recorded exit',value:price(trade.exit)});
  if(trade.openingFee!==null)facts.push({id:'openingFee',label:'Opening fee',value:money(trade.openingFee)});
  if(gross!==null)facts.push({id:'grossPnl',label:isLiquidation?'Gross settlement before fees':'Gross PnL before fees',value:money(roundMoney(gross))});
  if(totalFees!==null)facts.push({id:'totalFees',label:'Total entry + closing fees',value:money(totalFees)});
  if(netPnl!==null)facts.push({id:'netPnl',label:'Net PnL after fees',value:money(netPnl)});
  if(roi!==null)facts.push({id:'roi',label:'Net return on margin',value:`${roi}%`});
  return {trade, grossPnl:gross===null?null:roundMoney(gross),priceMovePnl:priceMovePnl===null?null:roundMoney(priceMovePnl),
    closingFee,totalFees,netPnl,roi,liquidationPrice,outcome,facts,limitations};
}
