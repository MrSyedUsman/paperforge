/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo } from "react";
import { CoinIcon } from "@/components/coin-icon";
import { formatMarketPrice, type Market, type Quote } from "@/lib/market-data/markets";
function CoinBadge({ m, size = "normal" }: { m: Market; size?: string }) {
  return <CoinIcon className={`coin ${size}`} symbol={m.symbol} color={m.color} />;
}
function MarketPrice({ m, q }: { m: Market; q?: Quote }) {
  return <>{q ? `$${formatMarketPrice(q.price, m)}` : "—"}</>;
}
export function MarketModal({
  markets,
  quotes,
  query,
  setQuery,
  favorites,
  onFav,
  onTrade,
  close,
}: any) {
  const filtered = useMemo(
    () =>
      markets
        .filter((m: Market) =>
          `${m.symbol} ${m.name} ${m.pair}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort(
          (a: Market, b: Market) =>
            (quotes[b.pair]?.volume ?? 0) - (quotes[a.pair]?.volume ?? 0),
        ),
    [markets, quotes, query],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [close]);
  return (
    <div className="backdrop" onMouseDown={close}>
      <div
        className="market-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-search">
          ⌕
          <input
            autoFocus
            placeholder="Search coin or perpetual pair"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={close}>ESC</button>
        </div>
        <div className="modal-summary">
          <span>{filtered.length} active USDT perpetual markets</span>
          <small>Sorted by quote volume</small>
        </div>
        <div className="modal-labels">
          <span>Market</span>
          <span>Price</span>
          <span>24h</span>
          <span />
        </div>
        <div className="modal-list">
          {filtered.slice(0, 150).map((m: Market) => {
            const q = quotes[m.pair];
            return (
              <div key={m.pair}>
                <button
                  className={favorites.includes(m.pair) ? "fav-on" : ""}
                  onClick={() => onFav(m.pair)}
                >
                  {favorites.includes(m.pair) ? "★" : "☆"}
                </button>
                <button className="modal-pair" onClick={() => onTrade(m)}>
                  <CoinBadge m={m} />
                  <b>
                    {m.pair}
                    <small>{m.name} · Perpetual</small>
                  </b>
                </button>
                <span>
                  <MarketPrice m={m} q={q} />
                </span>
                <em className={(q?.change ?? 0) >= 0 ? "up" : "down"}>
                  {q
                    ? `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}%`
                    : "—"}
                </em>
                <button className="trade-link" onClick={() => onTrade(m)}>
                  Trade
                </button>
              </div>
            );
          })}
          {!filtered.length && (
            <div className="modal-empty">
              No eligible perpetual market matches “{query}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
