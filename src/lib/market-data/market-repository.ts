import type { Market } from "./markets";
import { browserStorage } from "../storage/browser-storage.ts";

export function restoreMarketCache(cached: unknown): Market[] {
  if (!cached || typeof cached !== "object" || !("markets" in cached) || !Array.isArray(cached.markets)) return [];
  return cached.markets.filter((value): value is Market => {
    if (!value || typeof value !== "object") return false;
    const m = value as Record<string, unknown>;
    return ["pair", "symbol", "name", "color"].every(key => typeof m[key] === "string") &&
      (m.pair as string).endsWith("USDT") && m.quoteAsset === "USDT" &&
      m.contractType === "PERPETUAL" && m.status === "TRADING" &&
      ["pricePrecision", "quantityPrecision"].every(key =>
        typeof m[key] === "number" && Number.isInteger(m[key]) && m[key] >= 0 && m[key] <= 12);
  });
}

export const marketRepository = {
  load(): Market[] {
    return restoreMarketCache(browserStorage.read<unknown>("paperforge-market-cache", null));
  },
  save(markets: Market[]): boolean {
    return browserStorage.write("paperforge-market-cache", { savedAt: Date.now(), markets });
  },
};
