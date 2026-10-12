/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CoinIcon } from "@/components/coin-icon";
import { formatMarketPrice, type Market } from "@/lib/market-data/markets";
import { Faucet } from "@/features/account/faucet";
const FEATURED = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
];
function MarketCard({ market, quote, favorite, onFav, onTrade, feed }: any) {
  return (
    <article className="p3-market-card">
      <div className="p3-market-top">
        <CoinIcon symbol={market.symbol} color={market.color} />
        <span>
          <b>{market.pair}</b>
          <small>{market.name} · Perpetual</small>
        </span>
        <button
          aria-label={`${favorite ? "Remove" : "Add"} ${market.pair} favorite`}
          onClick={() => onFav(market.pair)}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      <strong>
        {quote ? `$${formatMarketPrice(quote.price, market)}` : "—"}
      </strong>
      <div className="p3-market-foot">
        <span className={(quote?.change ?? 0) >= 0 ? "up" : "down"}>
          {quote
            ? `${quote.change >= 0 ? "▲ +" : "▼ "}${quote.change.toFixed(2)}%`
            : feed === "live"
              ? "Waiting for price"
              : "Price unavailable"}
        </span>
        <button onClick={() => onTrade(market)}>Trade →</button>
      </div>
    </article>
  );
}
export function HomeExperience(p: any) {
  const { markets, quotes, favorites, recent, positions, account, feed } = p;
  const choose = (pairs: string[]) =>
    pairs.map((x) => markets.find((m: Market) => m.pair === x)).filter(Boolean);
  const favoriteMarkets = choose(favorites).slice(0, 4),
    recentMarkets = choose(recent).slice(0, 4),
    popular = choose(FEATURED).length ? choose(FEATURED) : markets.slice(0, 6),
    cards = favoriteMarkets.length
      ? favoriteMarkets
      : recentMarkets.length
        ? recentMarkets
        : popular.slice(0, 4);
  return (
    <div className="page p3-home home-refresh">
      <section className="p3-hero">
        <div className="p3-hero-copy">
          <span className="eyebrow">
            PRACTICE / COMPETE / IMPROVE
          </span>
          <h1>
            Learn futures trading <em>without risking your money.</em>
          </h1>
          <p>
            Real market data. Virtual funds. Practise Long and Short positions,
            test your strategy, and build confidence before trading with real money.
          </p>
          <div className="hero-actions">
            <button
              className="primary"
              onClick={() => popular[0] && p.onTrade(popular[0])}
            >
              Start trading for free <span>→</span>
            </button>
            <button className="secondary" onClick={p.explore}>
              Explore Markets
            </button>
          </div>
          <div className="p3-trust">
            <span>✓ No deposit</span>
            <span>✓ $1,000 virtual start</span>
            <span>✓ Live market prices</span>
            <span>✓ Paper orders only</span>
          </div>
        </div>
        <aside className="p3-account-card home-terminal">
          <div className="home-terminal-tabs"><b>YOUR PRACTICE DESK</b><span>Virtual funds only</span></div>
          <div className="p3-card-heading">
            <span>
              <i /> SIMULATION ACCOUNT
            </span>
            <b>Browser local</b>
          </div>
          <div className="p3-equity">
            <small>Estimated paper equity</small>
            <strong>${account.equity.toFixed(2)}</strong>
            <span className={account.totalPnl >= 0 ? "up" : "down"}>
              {account.totalPnl >= 0 ? "▲ +" : "▼ "}$
              {Math.abs(account.totalPnl).toFixed(2)} unrealized
            </span>
          </div>
          <div className="p3-balance-grid">
            <span>
              <small>Available balance</small>
              <b>${account.balance.toFixed(2)}</b>
            </span>
            <span>
              <small>Used margin</small>
              <b>${account.marginUsed.toFixed(2)}</b>
            </span>
            <span>
              <small>Open positions</small>
              <b>{positions.length}</b>
            </span>
            <span>
              <small>Faucet</small>
              <b>{p.canClaim ? "Ready" : p.clock}</b>
            </span>
          </div>
          <div className="home-quotes" aria-label="Featured market prices">
            {popular.slice(0, 3).map((m: Market) => <button key={m.pair} onClick={() => p.onTrade(m)}>
              <span>{m.pair}<small>USDT perpetual</small></span>
              <b>{quotes[m.pair] ? `$${formatMarketPrice(quotes[m.pair].price, m)}` : "—"}</b>
              <em className={(quotes[m.pair]?.change ?? 0) >= 0 ? "up" : "down"}>{quotes[m.pair] ? `${quotes[m.pair].change >= 0 ? "+" : ""}${quotes[m.pair].change.toFixed(2)}%` : "Waiting"}</em>
            </button>)}
          </div>
          <button onClick={() => p.claim()} disabled={!p.canClaim}>
            {p.canClaim ? "Claim $50 virtual funds" : "Faucet cooling down"}
          </button>
        </aside>
      </section>
      <section className="p3-strip">
        <span>
          <i className={feed} />
          <b>
            {feed === "live"
              ? "Live Binance Futures data"
              : feed === "reconnecting"
                ? "Market feed reconnecting"
                : "Market prices delayed"}
          </b>
          <small>{markets.length || "—"} eligible USDT perpetual markets</small>
        </span>
        <span>
          <b>$1,000</b>
          <small>Virtual starting balance</small>
        </span>
        <span>
          <b>1×–50×</b>
          <small>Practice leverage range</small>
        </span>
        <span>
          <b>$50 / 6h</b>
          <small>Virtual faucet reward</small>
        </span>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {favoriteMarkets.length
                ? "YOUR FAVORITES"
                : recentMarkets.length
                  ? "RECENTLY VIEWED"
                  : "POPULAR MARKETS"}
            </span>
            <h2>
              {favoriteMarkets.length
                ? "Markets on your radar"
                : recentMarkets.length
                  ? "Continue exploring"
                  : "Start with active perpetuals"}
            </h2>
          </div>
          <button onClick={p.explore}>Browse all {markets.length} →</button>
        </div>
        {cards.length ? (
          <div className="p3-market-grid">
            {cards.map((m: Market) => (
              <MarketCard
                key={m.pair}
                market={m}
                quote={quotes[m.pair]}
                favorite={favorites.includes(m.pair)}
                onFav={p.onFav}
                onTrade={p.onTrade}
                feed={feed}
              />
            ))}
          </div>
        ) : (
          <div className="p3-empty">
            <b>Markets are loading</b>
            <span>Live futures data will appear here automatically.</span>
          </div>
        )}
      </section>
      <section className="p3-how section">
        <div className="section-head">
          <div>
            <span className="eyebrow">HOW PAPERFORGE WORKS</span>
            <h2>Your first trade starts here.</h2>
          </div>
        </div>
        <div className="p3-step-grid">
          {[
            [
              "01",
              "Receive virtual funds",
              "Start with $1,000 and claim $50 every six hours.",
            ],
            [
              "02",
              "Choose a futures market",
              "Search the complete active USDT perpetual catalogue.",
            ],
            [
              "03",
              "Open Long or Short",
              "Select margin and leverage, then review the simulated order.",
            ],
            [
              "04",
              "Monitor risk and PnL",
              "Watch mark price, ROI and estimated liquidation in real time.",
            ],
            [
              "05",
              "Try a bot competition",
              "Trade against bots, review your result, and try a new strategy.",
            ],
          ].map((x) => (
            <article key={x[0]}>
              <i>{x[0]}</i>
              <b>{x[1]}</b>
              <p>{x[2]}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="p3-feature-section section">
        <div className="p3-feature-copy">
          <span className="eyebrow">PAPER TRADING TOOLKIT</span>
          <h2>A realistic practice loop without real-money execution</h2>
          <p>
            Market discovery, leverage controls, live-moving PnL, a detailed
            portfolio and a personal trading journal—all clearly separated from
            production accounts.
          </p>
          <button className="secondary" onClick={p.explore}>
            Explore the market catalogue
          </button>
        </div>
        <div className="p3-feature-grid">
          {[
            [
              "⌁",
              "Live futures markets",
              "Dynamic Binance USDT perpetual catalogue",
            ],
            ["↗", "Long and Short", "Direction-aware simulated positions"],
            ["×", "Adjustable leverage", "Practise from 1× up to 50×"],
            ["◎", "Portfolio statistics", "Local PnL, fees and trade outcomes"],
            [
              "★",
              "Favorites and discovery",
              "Watchlists, movers and volume leaders",
            ],
            [
              "♟",
              "Bot competitions",
              "Configurable practice lobbies and live standings",
            ],
          ].map((x) => (
            <article key={x[1]}>
              <i>{x[0]}</i>
              <span>
                <b>{x[1]}</b>
                <small>{x[2]}</small>
              </span>
              {x[3] && <em>{x[3]}</em>}
            </article>
          ))}
        </div>
      </section>
      <Faucet clock={p.clock} canClaim={p.canClaim} claim={p.claim} />
      <section className="p3-competition-tease">
        <div>
          <span className="eyebrow">TRADING COMPETITIONS</span>
          <h2>Trade the clock.<br />Test your strategy.</h2>
          <p>
            Build a bot practice lobby, choose your difficulty, and compete with
            separate virtual funds. Human multiplayer is planned for a future release.
          </p>
          <button className="primary" onClick={p.competitions}>
            Explore bot competitions →
          </button>
        </div>
        <div className="home-arena-details">
          <span className="eyebrow">YOUR NEXT CHALLENGE</span>
          <h3>Bot Practice Arena</h3>
          <p>A fresh allocation. A fixed deadline. Your decisions.</p>
          <div><span><b>2–8</b><small>Total participants</small></span><span><b>4 levels</b><small>Bot difficulty</small></span></div>
          <small>Browser-local practice · unverified results</small>
        </div>
      </section>
      <section className="home-final-cta">
        <div><span className="eyebrow">MAKE YOUR NEXT MOVE</span><h2>Build confidence, one trade at a time.</h2><p>No sign-up or deposit required. Your practice progress stays in this browser.</p></div>
        <button className="primary" onClick={() => popular[0] && p.onTrade(popular[0])}>Start practising <span>→</span></button>
      </section>
      <section className="p3-risk">
        <i>!</i>
        <div>
          <b>Simulation and risk notice</b>
          <p>
            PaperForge uses virtual funds for education. Simulated results do
            not guarantee real-world performance, and leverage can produce rapid
            gains or losses even in a simulation. Nothing here can be deposited,
            withdrawn or transferred.
          </p>
        </div>
      </section>
    </div>
  );
}

