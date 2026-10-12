"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import type { ApiUser } from "@/features/auth/api-client";
import type { Pos } from "@/features/account/types";
import { useStoredAccount } from "@/features/account/use-stored-account";
import { accountMetrics, priceFor, validateOrder, createPosition, closePosition, liquidatePosition } from "@/features/account/engine";
import { useMarketFeed } from "@/lib/market-data/use-market-feed";
import { useMarketChart } from "@/lib/market-data/use-market-chart";
import { calculateLiquidationPrice, grossPnl, isLiquidated, MAX_LEVERAGE, roundMoney } from "@/lib/simulation/trading";
import { ConfirmTrade, TradeTerminalV2 } from "@/features/trading/trading-terminal";
import { HomeExperience } from "@/features/home/home-experience";
import { PortfolioExperience } from "@/features/portfolio/portfolio-experience";
import { ProfileExperience } from "@/features/profile/profile-experience";
import { BotCompetition } from "@/features/competitions/bot-competition";
import { Leaderboards } from "@/features/leaderboards/leaderboards";
import { MarketsView } from "@/features/markets/markets-view";
import { MarketModal } from "@/features/markets/market-modal";
import type { Market } from "@/lib/market-data/markets";
export function PaperForgeApp({ authUser }: { authUser: ApiUser }) {
  const { signOut } = useAuth();
  const [view, setView] = useState<
      | "Home"
      | "Markets"
      | "Trade"
      | "Portfolio"
      | "Profile"
      | "Competitions"
      | "Leaderboards"
    >("Home"),
    [query, setQuery] = useState(""),
    [marketOpen, setMarketOpen] = useState(false),
    [side, setSide] = useState<"Long" | "Short">("Long"),
    [amount, setAmount] = useState("100"),
    [lev, setLev] = useState(10),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [timeframe, setTimeframe] = useState("1D"),
    [orderError, setOrderError] = useState(""),
    [confirming, setConfirming] = useState<
      { kind: "open" } | { kind: "close"; position: Pos } | null
    >(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const liquidatedRef = useRef(new Set<number>());
  const { balance, setBalance, favorites, setFavorites, recent, setRecent, positions, setPositions,
    history, setHistory, activity, setActivity, profile: storedProfile, setProfile, claimAt, setClaimAt,
    selectedPair, setSelectedPair } = useStoredAccount(note);
  const profile = useMemo(() => ({
    ...storedProfile,
    name: authUser.displayName || storedProfile.name,
    username: authUser.username || storedProfile.username,
    avatar: authUser.displayName
      ? authUser.displayName.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()
      : storedProfile.avatar,
  }), [storedProfile, authUser]);
  const { markets, quotes, feed, catalogueError, lastUpdate, retry } = useMarketFeed();
  const price = useCallback((pair: string) => priceFor(quotes, pair), [quotes]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const selected = markets.find((x) => x.pair === selectedPair) ?? markets[0];
  const { candles, chartLoading } = useMarketChart(selected, timeframe);
  useEffect(() => {
    if (markets.length && !markets.some((x) => x.pair === selectedPair))
      setSelectedPair(markets[0].pair);
  }, [markets, selectedPair, setSelectedPair]);
  useEffect(() => {
    if (feed !== "live" || !positions.length) return;
    const liquidated = positions.filter((p) => {
        if (liquidatedRef.current.has(p.id)) return false;
        const mark = price(p.pair || p.symbol);
        const threshold =
          Number(p.liquidation) ||
          calculateLiquidationPrice({
            entry: p.entry,
            side: p.side,
            leverage: p.lev,
            margin: p.margin,
            notional: p.size,
          });
        return isLiquidated(mark, threshold, p.side);
      });
    if (!liquidated.length) return;
    const ids = new Set(liquidated.map((p) => p.id));
    ids.forEach((id) => liquidatedRef.current.add(id));
    const at = new Date().toLocaleString();
    const records = liquidated.map(p => liquidatePosition(p, at));
    setPositions((value) => value.filter((p) => !ids.has(p.id)));
    setHistory((value) => [...records, ...value]);
    setActivity((value) => [
      ...records.map((p, index) => ({
        id: Date.now() + index,
        type: "trade" as const,
        label: `Liquidated ${p.side} ${p.pair || p.symbol} · isolated margin exhausted`,
        amount: p.pnl,
        at,
      })),
      ...value,
    ].slice(0, 100));
    note(
      records.length === 1
        ? `${records[0].pair || records[0].symbol} liquidated · $${records[0].marginLost?.toFixed(2)} isolated margin exhausted`
        : `${records.length} positions liquidated · isolated margins exhausted`,
    );
    setConfirming((value) =>
      value?.kind === "close" && ids.has(value.position.id) ? null : value,
    );
  }, [quotes, feed, positions, price, note, setPositions, setHistory, setActivity]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMarketOpen(true);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    document.body.style.overflow = marketOpen || confirming ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [marketOpen, confirming]);
  const pnl = (p: Pos) => grossPnl(p.size, p.entry, price(p.pair || p.symbol), p.side);
  const { totalPnl, marginUsed, equity, realizedPnl, totalFees, faucetTotal } = accountMetrics(balance, positions, history, activity, quotes);
  const countdown = Math.max(0, claimAt - now),
    clock = countdown
      ? `${String(Math.floor(countdown / 3600000)).padStart(2, "0")}:${String(Math.floor(countdown / 60000) % 60).padStart(2, "0")}:${String(Math.floor(countdown / 1000) % 60).padStart(2, "0")}`
      : "Ready";
  const chart = { candles };
  function goTrade(m: Market) {
    setSelectedPair(m.pair);
    setRecent((v) => [m.pair, ...v.filter((x) => x !== m.pair)].slice(0, 12));
    setView("Trade");
    setMarketOpen(false);
    scrollTo(0, 0);
  }
  function fav(pair: string) {
    setFavorites((v) =>
      v.includes(pair) ? v.filter((x) => x !== pair) : [...v, pair],
    );
    note(
      favorites.includes(pair)
        ? `${pair} removed from watchlist`
        : `${pair} added to watchlist`,
    );
  }
  function requestOpen() {
    const error = validateOrder(selected, feed, selected ? price(selected.pair) : 0, Number(amount), lev, balance);
    setOrderError(error);
    if (error) return note(error);
    if (lev >= 25) {
      setConfirming({ kind: "open" });
      return;
    }
    executeOpen();
  }
  function executeOpen() {
    if (!selected) return;
    const error = validateOrder(selected, feed, price(selected.pair), Number(amount), lev, balance);
    if (error) { setConfirming(null); setOrderError(error); return note(error); }
    const p = createPosition(selected, price(selected.pair), Number(amount), lev, side);
    const margin = p.margin, fee = p.openFee || 0;
    setBalance((v) => roundMoney(v - margin - fee));
    setPositions((v) => [p, ...v]);
    setConfirming(null);
    setOrderError("");
    note(`${side} ${selected.pair} opened · $${fee.toFixed(2)} fee`);
  }
  function requestClose(p: Pos) {
    setConfirming({ kind: "close", position: p });
  }
  function executeClose(p: Pos) {
    if (!positions.some((x) => x.id === p.id)) {
      setConfirming(null);
      return note("That position is no longer open.");
    }
    const at = new Date().toLocaleString();
    const { record, walletCredit } = closePosition(p, price(p.pair || p.symbol), at);
    const netPnl = record.pnl;
    setBalance(v => roundMoney(v + walletCredit));
    setPositions(v => v.filter(x => x.id !== p.id));
    setHistory(v => [record, ...v]);
    setActivity((v) =>
      [
        {
          id: Date.now(),
          type: "trade" as const,
          label: `Closed ${p.side} ${p.pair || p.symbol}`,
          amount: netPnl,
          at,
        },
        ...v,
      ].slice(0, 100),
    );
    setConfirming(null);
    note(
      `${p.symbol} closed · ${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)} true net PnL`,
    );
  }
  function claim() {
    if (countdown) return;
    const at = new Date().toLocaleString();
    setBalance((v) => roundMoney(v + 50));
    setClaimAt(Date.now() + 21600000);
    setActivity((v) =>
      [
        {
          id: Date.now(),
          type: "faucet" as const,
          label: "Virtual faucet reward",
          amount: 50,
          at,
        },
        ...v,
      ].slice(0, 100),
    );
    note("$50 virtual practice funds claimed");
  }
  const feedLabel = {
    live: "LIVE PRICES · PAPER ORDERS",
    connecting: "CONNECTING MARKET FEED",
    reconnecting: "RECONNECTING MARKET FEED",
    delayed: "PRICES DELAYED",
    offline: "OFFLINE",
  }[feed];
  return (
    <main id="main-content" tabIndex={-1}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="top">
        <button
          className="logo"
          aria-label="PaperForge home"
          onClick={() => setView("Home")}
        >
          <i>P</i>Paper<span>Forge</span>
        </button>
        <nav aria-label="Primary navigation">
          {(
            [
              "Home",
              "Trade",
              "Portfolio",
              "Markets",
              "Competitions",
              "Leaderboards",
            ] as const
          ).map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              aria-current={view === v ? "page" : undefined}
              onClick={() => setView(v)}
            >
              {v}
              {v === "Portfolio" && positions.length ? (
                <b>{positions.length}</b>
              ) : null}
              {v === "Competitions" && <small>Play</small>}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <button
            className={`sim ${feed}`}
            aria-live="polite"
            onClick={() => feed !== "live" && retry()}
          >
            <i /> <span className="feed-text">{feedLabel}</span>
          </button>
          <button
            className="global-search"
            aria-label="Search markets"
            onClick={() => setMarketOpen(true)}
            aria-haspopup="dialog"
          >
            ⌕ <span>Search {markets.length || "futures"} markets</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="account-controls">
            <button className="mini-balance" onClick={() => setView("Portfolio")} title={`Paper equity: $${equity.toFixed(2)}`}>
              <small>Paper equity</small>
              <b>${equity.toFixed(2)}</b>
            </button>
            <span className="mini-balance signed-in" title={`Signed in as @${profile.username}`}>
              <small>Signed in as</small>
              <b>@{profile.username}</b>
            </span>
            <button className="signout" onClick={signOut}>Sign out</button>
            <button
              className="avatar"
              aria-label="Open profile"
              onClick={() => setView("Profile")}
            >
              {profile.avatar ||
                profile.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
            </button>
          </div>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(
          [
            "Home",
            "Markets",
            "Trade",
            "Portfolio",
            "Competitions",
            "Leaderboards",
            "Profile",
          ] as const
        ).map((v) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            aria-current={view === v ? "page" : undefined}
            onClick={() => setView(v)}
          >
            <i>
              {v === "Home"
                ? "⌂"
                : v === "Markets"
                  ? "◎"
                  : v === "Trade"
                    ? "↗"
                    : v === "Portfolio"
                      ? "▦"
                      : v === "Competitions"
                        ? "♟"
                        : v === "Leaderboards"
                          ? "♛"
                        : "●"}
            </i>
            <span>{v}</span>
            {v === "Competitions" && <em>Play</em>}
          </button>
        ))}
      </nav>
      {catalogueError && (
        <div className="feed-alert">
          <span>
            {catalogueError}. Cached markets may be shown, but prices are not
            marked live.
          </span>
          <button onClick={() => retry()}>
            Retry now
          </button>
        </div>
      )}
      {view === "Home" && (
        <HomeExperience
          markets={markets}
          quotes={quotes}
          favorites={favorites}
          recent={recent}
          positions={positions}
          history={history}
          account={{
            balance,
            equity,
            marginUsed,
            totalPnl,
            realizedPnl,
            totalFees,
            faucetTotal,
          }}
          feed={feed}
          clock={clock}
          canClaim={!countdown}
          claim={claim}
          onFav={fav}
          onTrade={goTrade}
          explore={() => setView("Markets")}
          competitions={() => setView("Competitions")}
        />
      )}{" "}
      {view === "Markets" && (
        <MarketsView
          markets={markets}
          quotes={quotes}
          favorites={favorites}
          recent={recent}
          onFav={fav}
          onTrade={goTrade}
          feed={feed}
          lastUpdate={lastUpdate}
          retry={retry}
        />
      )}{" "}
      {view === "Trade" && selected && (
        <TradeTerminalV2
          market={selected}
          ticker={markets.slice(0, 7)}
          quotes={quotes}
          current={price(selected.pair)}
          chart={chart}
          chartLoading={chartLoading}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          side={side}
          setSide={setSide}
          amount={amount}
          setAmount={setAmount}
          lev={lev}
          setLev={(value: number) =>
            setLev(Math.max(1, Math.min(MAX_LEVERAGE, value)))
          }
          balance={balance}
          openTrade={requestOpen}
          orderError={orderError}
          favorite={favorites.includes(selected.pair)}
          fav={() => fav(selected.pair)}
          setMarketOpen={setMarketOpen}
          positions={positions}
          history={history}
          pnl={pnl}
          closeTrade={requestClose}
          feed={feed}
          lastUpdate={lastUpdate}
        />
      )}{" "}
      {view === "Portfolio" && (
        <PortfolioExperience
          markets={markets}
          quotes={quotes}
          positions={positions}
          history={history}
          activity={activity}
          account={{
            balance,
            equity,
            marginUsed,
            totalPnl,
            realizedPnl,
            totalFees,
            faucetTotal,
          }}
          pnl={pnl}
          closeTrade={requestClose}
          onTrade={goTrade}
          explore={() => setView("Markets")}
          claim={claim}
          clock={clock}
          canClaim={!countdown}
        />
      )}{" "}
      {view === "Profile" && (
        <ProfileExperience
          profile={profile}
          save={(next: typeof profile) => {
            setProfile(next);
            note("Profile saved in this browser");
          }}
          history={history}
          positions={positions}
          activity={activity}
          account={{ equity, totalPnl, realizedPnl }}
          competitions={() => setView("Competitions")}
        />
      )}{" "}
      {view === "Competitions" && (
        <BotCompetition
          markets={markets}
          quotes={quotes}
          feed={feed}
          profileName={profile.name}
          onPortfolio={() => setView("Portfolio")}
        />
      )}
      {view === "Leaderboards" && (
        <Leaderboards profile={profile} equity={equity} history={history} />
      )}
      {view === "Home" ? <footer className="home-footer">
        <div className="home-footer-main">
          <div><div className="logo"><i>P</i><b>Paper <span>Forge</span></b></div><p>Practise today. Learn for tomorrow.</p></div>
          <nav aria-label="Footer trading navigation"><b>Explore</b><button onClick={() => setView("Trade")}>Trading terminal</button><button onClick={() => setView("Markets")}>Markets</button><button onClick={() => setView("Portfolio")}>Portfolio & journal</button></nav>
          <nav aria-label="Footer competition navigation"><b>Compete</b><button onClick={() => setView("Competitions")}>Bot practice</button><button onClick={() => setView("Leaderboards")}>Local leaderboards</button><span>Human multiplayer · coming later</span></nav>
          <div className="home-footer-note"><b>PRACTICE / IMPROVE / REPEAT</b><p>Virtual funds. No deposits or withdrawals. Progress is saved on this browser, and results are not verified.</p></div>
        </div>
        <div className="home-footer-bottom"><span>© {new Date().getFullYear()} PaperForge</span><span>Crypto futures practice · Browser-local beta</span></div>
      </footer> : <footer>
        <span>
          <i /> Live Binance Futures market data · Paper orders only
        </span>
        <b>PaperForge Simulation</b>
        <span>Virtual funds · No deposits or withdrawals</span>
      </footer>}
      {marketOpen && (
        <MarketModal
          markets={markets}
          quotes={quotes}
          query={query}
          setQuery={setQuery}
          favorites={favorites}
          onFav={fav}
          onTrade={goTrade}
          close={() => setMarketOpen(false)}
        />
      )}{" "}
      {confirming && (
        <ConfirmTrade
          action={confirming}
          market={selected}
          current={selected ? price(selected.pair) : 0}
          amount={Number(amount)}
          leverage={lev}
          side={side}
          pnl={pnl}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            confirming.kind === "open"
              ? executeOpen()
              : executeClose(confirming.position)
          }
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <i aria-hidden="true">✓</i>
          {toast}
        </div>
      )}
    </main>
  );
}
