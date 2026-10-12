/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMemo, useState } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { formatMarketPrice, formatVolume, type Market, type Quote } from "@/lib/market-data/markets";
import type { SortKey } from "@/features/account/types";
function CoinBadge({ m, size = "normal" }: { m: Market; size?: string }) {
  return <CoinIcon className={`coin ${size}`} symbol={m.symbol} color={m.color} />;
}
function MarketPrice({ m, q }: { m: Market; q?: Quote }) {
  return <>{q ? `$${formatMarketPrice(q.price, m)}` : "—"}</>;
}
export function MarketsView({
  markets,
  quotes,
  favorites,
  recent,
  onFav,
  onTrade,
  feed,
  lastUpdate,
  retry,
}: any) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<SortKey>("volume"),
    [direction, setDirection] = useState<"asc" | "desc">("desc"),
    [tab, setTab] = useState<
      "all" | "favorites" | "recent" | "gainers" | "losers"
    >("all"),
    [page, setPage] = useState(1);
  const pageSize = 25;
  const filtered = useMemo(() => {
    let rows = markets.filter((m: Market) =>
      `${m.symbol} ${m.name} ${m.pair}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
    if (tab === "favorites")
      rows = rows.filter((m: Market) => favorites.includes(m.pair));
    if (tab === "recent")
      rows = rows.filter((m: Market) => recent.includes(m.pair));
    if (tab === "gainers")
      rows = rows.filter((m: Market) => (quotes[m.pair]?.change ?? 0) > 0);
    if (tab === "losers")
      rows = rows.filter((m: Market) => (quotes[m.pair]?.change ?? 0) < 0);
    return [...rows].sort((a: Market, b: Market) => {
      const av =
        sort === "symbol"
          ? a.symbol
          : sort === "price"
            ? (quotes[a.pair]?.price ?? -Infinity)
            : sort === "change"
              ? (quotes[a.pair]?.change ?? -Infinity)
              : (quotes[a.pair]?.volume ?? -Infinity);
      const bv =
        sort === "symbol"
          ? b.symbol
          : sort === "price"
            ? (quotes[b.pair]?.price ?? -Infinity)
            : sort === "change"
              ? (quotes[b.pair]?.change ?? -Infinity)
              : (quotes[b.pair]?.volume ?? -Infinity);
      const result =
        typeof av === "string" ? av.localeCompare(String(bv)) : av - bv;
      return direction === "asc" ? result : -result;
    });
  }, [markets, quotes, query, tab, sort, direction, favorites, recent]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  function sortBy(key: SortKey) {
    setPage(1);
    if (sort === key) setDirection((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "symbol" ? "asc" : "desc");
    }
  }
  return (
    <div className="page markets-page">
      <div className="markets-title">
        <div>
          <span className="eyebrow">BINANCE USDⓈ-M FUTURES</span>
          <h1>Perpetual markets</h1>
          <p>
            Every active USDT-margined perpetual contract returned by Binance
            Futures.
          </p>
        </div>
        <div className={`catalogue-status ${feed}`}>
          <i />
          <span>
            <b>
              {feed === "live"
                ? "Prices live"
                : feed === "reconnecting"
                  ? "Reconnecting"
                  : feed === "offline"
                    ? "Offline"
                    : "Prices delayed"}
            </b>
            <small>
              {lastUpdate
                ? `Updated ${new Date(lastUpdate).toLocaleTimeString()}`
                : "Waiting for first update"}
            </small>
          </span>
          {feed !== "live" && <button onClick={retry}>Retry</button>}
        </div>
      </div>
      <div className="market-controls">
        <label className="market-search">
          ⌕
          <input
            placeholder="Search symbol, asset or pair"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </label>
        <div className="filter-tabs">
          {(
            [
              ["all", "All"],
              ["favorites", "Favorites"],
              ["recent", "Recent"],
              ["gainers", "Gainers"],
              ["losers", "Losers"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => { setTab(key); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="results-line">
        <span>
          {filtered.length} eligible perpetual{" "}
          {filtered.length === 1 ? "market" : "markets"}
        </span>
        <span>
          Page {page} of {pages}
        </span>
      </div>
      <div className="market-table full">
        <div className="trow labels">
          <button onClick={() => sortBy("symbol")}>
            Pair {sort === "symbol" && (direction === "asc" ? "↑" : "↓")}
          </button>
          <button onClick={() => sortBy("price")}>
            Last price {sort === "price" && (direction === "asc" ? "↑" : "↓")}
          </button>
          <button onClick={() => sortBy("change")}>
            24h change {sort === "change" && (direction === "asc" ? "↑" : "↓")}
          </button>
          <button>24h range</button>
          <button onClick={() => sortBy("volume")}>
            Quote volume{" "}
            {sort === "volume" && (direction === "asc" ? "↑" : "↓")}
          </button>
          <span />
        </div>
        {shown.length ? (
          <MarketRows
            markets={shown}
            quotes={quotes}
            favorites={favorites}
            onFav={onFav}
            onTrade={onTrade}
            bare
          />
        ) : (
          <div className="empty-card">
            No eligible futures markets match this view. Try another search or
            filter.
          </div>
        )}
      </div>
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage((x) => x - 1)}>
          ← Previous
        </button>
        <span>
          {filtered.length ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, filtered.length)} of {filtered.length}
        </span>
        <button disabled={page === pages} onClick={() => setPage((x) => x + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
function MarketRows({
  markets,
  quotes,
  favorites,
  onFav,
  onTrade,
  bare = false,
}: any) {
  const rows = (
    <>
      {markets.map((m: Market) => {
        const q = quotes[m.pair];
        return (
          <div className="trow" key={m.pair}>
            <span className="pair-name">
              <button
                className={favorites.includes(m.pair) ? "fav-on" : ""}
                onClick={() => onFav(m.pair)}
              >
                {favorites.includes(m.pair) ? "★" : "☆"}
              </button>
              <CoinBadge m={m} />
              <b>
                {m.pair}
                <small>{m.name} · Perpetual</small>
              </b>
            </span>
            <span className="mono">
              <MarketPrice m={m} q={q} />
              <small>
                {q?.markPrice
                  ? `Mark $${formatMarketPrice(q.markPrice, m)}`
                  : "Waiting for price"}
              </small>
            </span>
            <span className={(q?.change ?? 0) >= 0 ? "up" : "down"}>
              {q ? `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}%` : "—"}
            </span>
            <span className="range-cell">
              {q
                ? `$${formatMarketPrice(q.low, m)} – $${formatMarketPrice(q.high, m)}`
                : "—"}
            </span>
            <span>{q ? formatVolume(q.volume) : "—"}</span>
            <span>
              <button className="trade-link" onClick={() => onTrade(m)}>
                Trade
              </button>
            </span>
          </div>
        );
      })}
    </>
  );
  return bare ? (
    rows
  ) : (
    <div className="market-table">
      <div className="trow labels">
        <span>Pair</span>
        <span>Last price</span>
        <span>24h change</span>
        <span>24h range</span>
        <span>Quote volume</span>
        <span />
      </div>
      {rows}
    </div>
  );
}
