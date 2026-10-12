/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";
import { useEffect, useState } from "react";
import type { Market } from "./markets";
import type { Candle } from "@/features/account/types";
import { fetchFirst } from "./client";
const CHART_RANGES: Record<string, { interval: string; limit: number }> = {
  "1H": { interval: "1m", limit: 60 },
  "1D": { interval: "15m", limit: 96 },
  "1W": { interval: "1h", limit: 168 },
  "1M": { interval: "4h", limit: 180 },
  "3M": { interval: "1d", limit: 90 },
  "1Y": { interval: "1d", limit: 365 },
};

export function useMarketChart(market: Market | undefined, timeframe: string) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!market) return;
    setCandles([]);
    setChartLoading(true);
    const range = CHART_RANGES[timeframe] || CHART_RANGES["1D"],
      load = () =>
        fetchFirst([
          `/api/binance?resource=klines&symbol=${market.pair}&interval=${range.interval}&limit=${range.limit}`,
        ])
          .then((rows: any[]) => {
            if (active) {
              setCandles(
                rows
                  .map((r) => ({
                    time: Number(r[0]),
                    open: Number(r[1]),
                    high: Number(r[2]),
                    low: Number(r[3]),
                    close: Number(r[4]),
                    volume: Number(r[5]),
                  }))
                  .filter((c) => Object.values(c).every(Number.isFinite)),
              );
              setChartLoading(false);
            }
          })
          .catch(() => {
            if (active) setChartLoading(false);
          });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [market, timeframe]);

  return { candles, chartLoading };
}

