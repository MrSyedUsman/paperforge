export type Quote = {
  price: number;
  markPrice: number;
  change: number;
  volume: number;
  baseVolume: number;
  high: number;
  low: number;
  open: number;
  updatedAt: number;
};

export type Market = {
  symbol: string;
  pair: string;
  name: string;
  quoteAsset: "USDT";
  contractType: "PERPETUAL";
  status: "TRADING";
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
  color: string;
};

const KNOWN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", XRP: "XRP",
  DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche", LINK: "Chainlink",
  DOT: "Polkadot", TRX: "TRON", TON: "Toncoin", LTC: "Litecoin", BCH: "Bitcoin Cash",
  NEAR: "NEAR Protocol", UNI: "Uniswap", AAVE: "Aave", SUI: "Sui", HBAR: "Hedera",
  XLM: "Stellar", ATOM: "Cosmos", FIL: "Filecoin", PEPE: "Pepe", SHIB: "Shiba Inu",
};

export function marketName(base: string) { return KNOWN_NAMES[base] ?? base; }
export function marketColor(symbol: string) {
  const colors = ["#37d49a", "#f5b942", "#7c6cff", "#ff6474", "#30a7ff", "#d85cff"];
  return colors[[...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
}

const FALLBACK_PERPETUALS = "BTC ETH BNB SOL XRP DOGE ADA AVAX LINK DOT TRX LTC BCH NEAR UNI AAVE SUI HBAR XLM ATOM FIL ETC APT OP ARB INJ PEPE SHIB WIF BONK FLOKI JUP TIA SEI ONDO ENA WLD TAO RENDER FET ALGO VET ICP CRV DYDX GALA SAND MANA AXS THETA RUNE KAS LDO MKR SNX COMP ZEC DASH EOS XTZ IOTA CAKE ZIL ENS WOO CELO KAVA ROSE MINA PENDLE JASMY PYTH STRK BLUR".split(" ");

/** A non-authoritative emergency directory so a provider outage never leaves the UI empty. */
export function fallbackMarkets(): Market[] {
  return FALLBACK_PERPETUALS.map(symbol => ({
    symbol, pair: `${symbol}USDT`, name: marketName(symbol), quoteAsset: "USDT",
    contractType: "PERPETUAL", status: "TRADING", pricePrecision: 8, quantityPrecision: 6,
    tickSize: 0, stepSize: 0, minQty: 0, maxQty: 0, minNotional: 0, color: marketColor(symbol),
  }));
}

function filterValue(filters: Array<Record<string, string>>, type: string, key: string) {
  const value = filters.find(filter => filter.filterType === type)?.[key];
  return value ? Number(value) : 0;
}

export function normalizeMarkets(payload: unknown): Market[] {
  const symbols = (payload as { symbols?: Array<Record<string, unknown>> })?.symbols;
  if (!Array.isArray(symbols)) return [];
  const seen = new Set<string>();
  return symbols.flatMap(raw => {
    const pair = String(raw.symbol ?? "");
    const base = String(raw.baseAsset ?? "");
    const filters = Array.isArray(raw.filters) ? raw.filters as Array<Record<string, string>> : [];
    if (raw.quoteAsset !== "USDT" || raw.contractType !== "PERPETUAL" || raw.status !== "TRADING" || !pair.endsWith("USDT") || !base || seen.has(pair)) return [];
    seen.add(pair);
    return [{
      symbol: base, pair, name: marketName(base), quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING",
      pricePrecision: Number(raw.pricePrecision ?? 2), quantityPrecision: Number(raw.quantityPrecision ?? 3),
      tickSize: filterValue(filters, "PRICE_FILTER", "tickSize"), stepSize: filterValue(filters, "LOT_SIZE", "stepSize"),
      minQty: filterValue(filters, "LOT_SIZE", "minQty"), maxQty: filterValue(filters, "LOT_SIZE", "maxQty"),
      minNotional: filterValue(filters, "MIN_NOTIONAL", "notional"), color: marketColor(base),
    } satisfies Market];
  });
}

export function normalizeTicker(raw: Record<string, unknown>, markPrice = 0): [string, Quote] | null {
  const pair = String(raw.s ?? raw.symbol ?? "");
  const price = Number(raw.c ?? raw.lastPrice);
  const open = Number(raw.o ?? raw.openPrice);
  if (!pair.endsWith("USDT") || !Number.isFinite(price) || price <= 0) return null;
  return [pair, {
    price, markPrice: markPrice || price,
    change: Number(raw.P ?? raw.priceChangePercent ?? (open ? ((price - open) / open) * 100 : 0)),
    volume: Number(raw.q ?? raw.quoteVolume ?? 0), baseVolume: Number(raw.v ?? raw.volume ?? 0),
    high: Number(raw.h ?? raw.highPrice ?? price), low: Number(raw.l ?? raw.lowPrice ?? price), open,
    updatedAt: Date.now(),
  }];
}

export function decimalsFromStep(step: number, fallback: number) {
  if (!step || step >= 1) return step === 1 ? 0 : fallback;
  return Math.min(12, Math.max(0, Math.ceil(-Math.log10(step))));
}

export function formatMarketPrice(value: number, market?: Market) {
  if (!Number.isFinite(value)) return "—";
  const decimals = decimalsFromStep(market?.tickSize ?? 0, value < 1 ? 6 : 2);
  return value.toLocaleString(undefined, { minimumFractionDigits: Math.min(decimals, 2), maximumFractionDigits: decimals });
}

export function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
