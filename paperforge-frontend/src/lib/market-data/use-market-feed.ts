/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { LIVE_PRICE_MAX_AGE_MS } from "@paperforge/simulation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fallbackMarkets, normalizeMarkets, normalizeTicker, type Market, type Quote } from "./markets";
import { fetchFirst } from "./client";
import { marketRepository } from "./market-repository";
import type { Feed } from "@/features/account/types";

export function useMarketFeed() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [feed, setFeed] = useState<Feed>("connecting");
  const [catalogueError, setCatalogueError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(0);
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const loadCatalogue = useCallback(async () => {
    setCatalogueError("");
    let eligible: Market[] = [];
    let usedEmergencyDirectory = false;
    try {
      const info = await fetchFirst([
        "/api/binance?resource=exchangeInfo",
      ]);
      eligible = normalizeMarkets(info);
    } catch {
      eligible = marketRepository.load();
      if (!eligible.length) {
        eligible = fallbackMarkets();
        usedEmergencyDirectory = true;
      }
    }
    try {
      const [tickerRows, marks] = await Promise.all([
        fetchFirst([
          "/api/binance?resource=ticker24hr",
        ]),
        fetchFirst([
          "/api/binance?resource=premiumIndex",
        ]).catch(() => []),
      ]);
      const markMap = new Map(
        (marks as Array<Record<string, unknown>>).map((x) => [
          String(x.symbol),
          Number(x.markPrice),
        ]),
      );
      const eligiblePairs = new Set(eligible.map((x) => x.pair));
      const next: Record<string, Quote> = {};
      (tickerRows as Array<Record<string, unknown>>).forEach((row) => {
        const item = normalizeTicker(row, markMap.get(String(row.symbol)) || 0);
        if (item && eligiblePairs.has(item[0])) next[item[0]] = item[1];
      });
      const valid = eligible.filter((x) => next[x.pair]);
      setMarkets(valid.length ? valid : eligible);
      setQuotes((old) => ({ ...old, ...next }));
      setLastUpdate(Date.now());
      setFeed(Object.keys(next).length ? "live" : "delayed");
      if (!usedEmergencyDirectory) marketRepository.save(eligible);
      if (usedEmergencyDirectory)
        setCatalogueError(
          "Live futures directory is temporarily unavailable; showing the emergency perpetual catalogue",
        );
    } catch {
      setMarkets(eligible.length ? eligible : fallbackMarkets());
      setCatalogueError(
        "Live prices are temporarily unavailable; markets remain available for browsing",
      );
      setFeed(navigator.onLine ? "delayed" : "offline");
    }
  }, []);
  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue, catalogueAttempt]);
  useEffect(() => {
    let stopped = false;
    const ingest = (rows: unknown) => {
      if (!Array.isArray(rows)) return;
      const allowed = new Set(markets.map((x) => x.pair));
      const updates: Record<string, Quote> = {};
      rows.forEach((raw) => {
        const item = normalizeTicker(raw as Record<string, unknown>);
        if (item && allowed.has(item[0])) updates[item[0]] = item[1];
      });
      if (Object.keys(updates).length) {
        setQuotes((old) => ({ ...old, ...updates }));
        setLastUpdate(Date.now());
        setFeed("live");
        attemptRef.current = 0;
      }
    };
    const connect = () => {
      if (stopped || !markets.length) return;
      setFeed(attemptRef.current ? "reconnecting" : "connecting");
      try {
        const ws = new WebSocket("wss://fstream.binance.com/ws/!ticker@arr");
        socketRef.current = ws;
        ws.onmessage = (e) => {
          try {
            ingest(JSON.parse(e.data));
          } catch {}
        };
        ws.onopen = () => setFeed("live");
        ws.onclose = () => {
          if (stopped) return;
          setFeed(navigator.onLine ? "reconnecting" : "offline");
          attemptRef.current += 1;
          reconnectRef.current = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** attemptRef.current),
          );
        };
        ws.onerror = () => ws.close();
      } catch {
        setFeed("delayed");
      }
    };
    connect();
    const poll = setInterval(async () => {
      try {
        ingest(
          await fetchFirst([
            "/api/binance?resource=ticker24hr",
          ]),
        );
      } catch {}
    }, 30000);
    return () => {
      stopped = true;
      socketRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      clearInterval(poll);
    };
  }, [markets]);
  useEffect(() => {
    const stale = setInterval(() => {
      if (lastUpdate && Date.now() - lastUpdate > LIVE_PRICE_MAX_AGE_MS)
        setFeed(navigator.onLine ? "delayed" : "offline");
    }, 5000);
    const online = () => {
      setFeed("reconnecting");
      setCatalogueAttempt((x) => x + 1);
    };
    const offline = () => setFeed("offline");
    addEventListener("online", online);
    addEventListener("offline", offline);
    return () => {
      clearInterval(stale);
      removeEventListener("online", online);
      removeEventListener("offline", offline);
    };
  }, [lastUpdate]);

  return { markets, quotes, feed, catalogueError, lastUpdate, retry: () => setCatalogueAttempt(x => x + 1) };
}
