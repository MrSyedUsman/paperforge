/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/purity, react-hooks/refs */
"use client";
import { CoinIcon } from "@/components/coin-icon";
import { ThemeSlider } from "@/components/theme-slider";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { formatMarketPrice, type Market, type Quote } from "@/lib/market-data/markets";
import {
  calculateLiquidationPrice,
  grossPnl,
  isLiquidated,
  liquidationDistancePercent,
  liquidationRiskStatus,
  roundMoney,
  TAKER_FEE_RATE,
  tradingFee,
} from "@/lib/simulation/trading";



import type { Difficulty, Settings, Position, Trade, Player, Event, Lobby, Stats, Candle, Status } from "./types";
import { defaults, emptyStats, MAJORS, NAMES, STRATEGIES, money, resultLabel, difficultyInfo } from "./constants";
import { pricesFor, finite, validPosition, pnlFor, equityFor, rankPlayers, closePosition, liquidatePosition, openFor } from "./engine";
import { competitionRepository } from "./competition-repository";

import { settleLobby, recordSettlement, event } from "./settlement";
import { useCompetitionBots } from "./use-competition-bots";
import { BotGuide } from "./bot-guide";
import { CompetitionHub } from "./competition-hub";
import { Create } from "./create-lobby";
import { Confirm } from "./confirm-lobby";
import { Standings } from "./standings";
import { QuitDialog } from "./quit-dialog";
import { FinalMinuteDialog } from "./final-minute-dialog";
import { UserTerminal } from "./competition-terminal";
import { Activity } from "./activity";
import { PositionDialog } from "./position-dialog";
import { ArenaRadar } from "./arena-radar";
import { Results } from "./results";

export function BotCompetition({
  markets,
  quotes,
  feed,
  profileName,
  onPortfolio,
}: any) {
  const [radarOpen,setRadarOpen]=useState(false);
  const radarTrigger=useRef<HTMLButtonElement|null>(null);
  const [guideOpen, setGuideOpen] = useState(false), [guideArena, setGuideArena] = useState(false);
  const guideTrigger = useRef<HTMLButtonElement | null>(null);
  function openGuide(event: MouseEvent<HTMLButtonElement>) { guideTrigger.current = event.currentTarget; setGuideArena(screen === "arena" && lobby?.status === "active"); setGuideOpen(true); }
  const [hydrated, setHydrated] = useState(false);
  const [lobby, setLobby] = useState<Lobby | null>(null),
    [screen, setScreen] = useState<
      "hub" | "create" | "confirm" | "arena" | "results"
    >("hub"),
    [settings, setSettings] = useState<Settings>(defaults),
    [stats, setStats] = useState<Stats>(emptyStats),
    [now, setNow] = useState(Date.now()),
    [selected, setSelected] = useState("BTCUSDT"),
    [side, setSide] = useState<"Long" | "Short">("Long"),
    [margin, setMargin] = useState("250"),
    [leverage, setLeverage] = useState(5),
    [error, setError] = useState(""),
    [inspect, setInspect] = useState<string | null>(null),
    [customSearch, setCustomSearch] = useState(""),
    [chartRange, setChartRange] = useState("1D"),
    [chartData, setChartData] = useState<Candle[]>([]),
    [chartLoading, setChartLoading] = useState(false),
    [chartUpdated, setChartUpdated] = useState(0),
    [quitOpen, setQuitOpen] = useState(false),
    [finalMinuteOpen, setFinalMinuteOpen] = useState(false);
  const quotesRef = useRef(quotes),
    busy = useRef(false),
    finalMinuteSeen = useRef<number | null>(null);
  quotesRef.current = quotes;
  useEffect(() => {
    const saved = competitionRepository.loadLobby();
    if (saved) {
      setLobby(saved);
      setSettings(saved.settings);
      setScreen(saved.status === "finished" ? "results" : "arena");
    }
    setStats(competitionRepository.loadStats());
    setHydrated(true);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!lobby || lobby.status !== "active") return;
    const remaining = lobby.end - now;
    if (
      remaining > 60000 ||
      remaining < 0 ||
      finalMinuteSeen.current === lobby.end
    )
      return;
    finalMinuteSeen.current = lobby.end;
    setFinalMinuteOpen(true);
  }, [lobby, now]);
  useEffect(() => {
    if (!hydrated || !lobby) return;
    competitionRepository.saveLobby(lobby);
  }, [lobby, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      competitionRepository.saveStats(stats);
    } catch {}
  }, [stats, hydrated]);
  const allowed = useMemo(() => {
    if (!lobby) return [];
    const mode = lobby.settings.marketMode;
    return markets.filter((m: Market) =>
      mode === "all" || mode === "majors"
        ? MAJORS.includes(m.pair)
        : lobby.settings.custom.includes(m.pair),
    );
  }, [lobby, markets]);
  useEffect(() => {
    if (allowed.length && !allowed.some((m: Market) => m.pair === selected))
      setSelected(allowed[0].pair);
  }, [allowed, selected]);
  useEffect(() => {
    if (!selected || screen !== "arena") return;
    let active = true;
    const ranges: Record<string, { interval: string; limit: number }> = {
        "1H": { interval: "1m", limit: 60 },
        "1D": { interval: "15m", limit: 96 },
        "1W": { interval: "1h", limit: 168 },
        "1M": { interval: "4h", limit: 180 },
        "3M": { interval: "1d", limit: 90 },
        "1Y": { interval: "1d", limit: 365 },
      },
      range = ranges[chartRange] || ranges["1D"],
      url =
        `/api/binance?resource=klines&symbol=${encodeURIComponent(selected)}&interval=${range.interval}&limit=${range.limit}`;
    setChartLoading(true);
    setChartData([]);
    const fetchRows = async (url: string) => {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 16000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("History source unavailable");
        const rows = await response.json(),
          normalized = (Array.isArray(rows) ? rows : [])
            .map((r: any) => ({
              time: finite(r[0]),
              open: finite(r[1]),
              high: finite(r[2]),
              low: finite(r[3]),
              close: finite(r[4]),
              volume: finite(r[5]),
            }))
            .filter(
              (c: Candle) =>
                c.time > 0 &&
                c.open > 0 &&
                c.high > 0 &&
                c.low > 0 &&
                c.close > 0,
            );
        if (!normalized.length) throw new Error("Empty history");
        return normalized;
      } finally {
        clearTimeout(timeout);
      }
    };
    const load = async () => {
      let normalized: Candle[] = [];
      try {
        normalized = await fetchRows(url);
      } catch {}
      if (active) {
        setChartData(normalized);
        if (normalized.length) setChartUpdated(Date.now());
        setChartLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, chartRange, screen]);
  function makePlayers(s: Settings): Player[] {
    const user: Player = {
      id: "user",
      name: profileName || "You",
      isUser: true,
      strategy: "Manual trader",
      avatar: "YOU",
      balance: s.allocation,
      realized: 0,
      fees: 0,
      positions: [],
      trades: [],
      status: "active",
      rank: 1,
      previousRank: 1,
      achieved: Date.now(),
    };
    return [
      user,
      ...Array.from({ length: s.spots - 1 }, (_, i) => ({
        id: `bot-${i}`,
        name: NAMES[i],
        isUser: false,
        strategy: STRATEGIES[i],
        avatar: NAMES[i].slice(0, 2).toUpperCase(),
        balance: s.allocation,
        realized: 0,
        fees: 0,
        positions: [],
        trades: [],
        status: "active" as Status,
        rank: i + 2,
        previousRank: i + 2,
        achieved: Date.now() + i,
      })),
    ];
  }
  function startLobby() {
    setRadarOpen(false);
    if (busy.current) return;
    busy.current = true;
    const s = {
      ...settings,
      name: settings.name.trim().slice(0, 40) || defaults.name,
      allocation: Math.max(
        500,
        Math.min(100000, Number(settings.allocation) || 5000),
      ),
      custom: settings.custom.slice(0, 30),
    };
    if (s.marketMode === "custom" && !s.custom.length) {
      setError("Select at least one custom market.");
      busy.current = false;
      return;
    }
    const start = Date.now(),
      next: Lobby = {
        version: 1,
        feeAccounting: 2,
        status: "active",
        settings: s,
        start,
        end: start + s.duration * 60000,
        players: makePlayers(s),
        events: [
          event(
            `Competition started with ${s.spots - 1} ${s.difficulty} bot opponents`,
          ),
        ],
      };
    finalizedLobby.current = null;
    finalMinuteSeen.current = null;
    setFinalMinuteOpen(false);
    competitionRepository.saveLobby(next);
    setLobby(next);
    setStats((v) => ({ ...v, entered: v.entered + 1 }));
    setScreen("arena");
    setError("");
    setTimeout(() => (busy.current = false), 400);
  }
  useEffect(() => {
    if (feed !== "live" || lobby?.status !== "active") return;
    setLobby((current) => {
      if (!current || current.status !== "active") return current;
      let changed = false,
        events = current.events;
      const players = current.players.map((player) => {
        if (player.status !== "active" || !player.isUser) return player;
        let next = player,
          playerLiquidated = false;
        player.positions.forEach((pos) => {
          const mark = pricesFor(quotesRef.current, pos.pair),
            liquidation =
              finite(pos.liquidation) ||
              calculateLiquidationPrice({
                entry: pos.entry,
                side: pos.side,
                leverage: pos.lev,
                margin: pos.margin,
                notional: pos.size,
              });
          if (!isLiquidated(mark, liquidation, pos.side)) return;
          changed = true;
          playerLiquidated = true;
          next = liquidatePosition(next, { ...pos, liquidation });
          events = [
            event(
              `${player.name} ${pos.side} ${pos.pair} at ${pos.lev}× liquidated at ${money(liquidation)} · ${money(pos.margin)} isolated margin exhausted`,
              "down",
            ),
            ...events,
          ];
        });
        if (
          playerLiquidated &&
          current.settings.elimination &&
          equityFor(next, quotesRef.current) <= 1
        ) {
          next = { ...next, status: "eliminated" as Status };
          events = [event(`${next.name} was eliminated`, "down"), ...events];
        }
        return next;
      });
      return changed
        ? {
            ...current,
            players: rankPlayers(players, quotesRef.current),
            events: events.slice(0, 80),
          }
        : current;
    });
  }, [quotes, feed, lobby?.status]);
  const finalizedLobby = useRef<number | null>(null);
  const settle = useCallback((current: Lobby) => {
    if (current.status === "finished" || finalizedLobby.current === current.start) return;
    finalizedLobby.current = current.start;
    const next = settleLobby(current, quotesRef.current);
    competitionRepository.saveLobby(next);
    setLobby(next);
    setStats(previous => recordSettlement(previous, next));
    setScreen("results");
  }, [setLobby, setStats, setScreen]);
  function abandon() {
    if (!lobby || lobby.status !== "active") return;
    let players = lobby.players.map((p) =>
      p.positions.reduce(
        (x, pos) =>
          closePosition(
            x,
            pos,
            p.isUser ? "Quit settlement" : "Opponent win settlement",
            pricesFor(quotesRef.current, pos.pair) || pos.entry,
          ),
        p,
      ),
    );
    const user = players.find((p) => p.isUser)!;
    players = players
      .filter((p) => !p.isUser)
      .sort(
        (a, b) =>
          equityFor(b, quotesRef.current) - equityFor(a, quotesRef.current),
      )
      .map((p, i) => ({
        ...p,
        status: "finished" as Status,
        rank: i + 1,
        previousRank: p.rank,
      }));
    const loser = {
      ...user,
      balance: 0,
      positions: [],
      status: "eliminated" as Status,
      previousRank: user.rank,
      rank: players.length + 1,
    };
    players = [...players, loser];
    const winner = players[0],
      next: Lobby = {
        ...lobby,
        status: "finished",
        completionReason: "abandonment",
        finalized: Date.now(),
        players,
        events: [
          event(
            `${profileName || "Player"} quit. ${winner.name} wins by abandonment.`,
            "down",
          ),
          ...lobby.events,
        ],
      };
    const userEq = 0;
    competitionRepository.saveLobby(next);
    setLobby(next);
    setStats((v) => ({
      ...v,
      lastFinalizedLobby: lobby.start,
      streak: 0,
      bestRank: v.bestRank ? Math.min(v.bestRank, loser.rank) : loser.rank,
      pnl: roundMoney(v.pnl - lobby.settings.allocation),
      trades: v.trades + loser.trades.length,
      results: [
        {
          name: lobby.settings.name,
          difficulty: lobby.settings.difficulty,
          duration: lobby.settings.duration,
          rank: loser.rank,
          equity: userEq,
          result: "Quit · opponent won",
          at: Date.now(),
        },
        ...v.results,
      ].slice(0, 12),
    }));
    setQuitOpen(false);
    setScreen("results");
  }
  useEffect(() => {
    if (!lobby || lobby.status !== "active") return;
    if (now >= lobby.end) {
      settle(lobby);
      return;
    }
    if (lobby.settings.elimination) {
      const bankrupt = lobby.players.find(
        (p) =>
          p.status === "active" &&
          (equityFor(p, quotesRef.current) <= 1 ||
            (finite(p.balance) <= 0.01 && p.positions.length === 0)),
      );
      if (bankrupt) {
        setLobby((current) =>
          current
            ? {
                ...current,
                players: current.players.map((p) =>
                  p.id === bankrupt.id
                    ? { ...p, status: "eliminated" as Status, balance: 0 }
                    : p,
                ),
                events: [
                  event(
                    `${bankrupt.name} ran out of usable competition equity and was eliminated`,
                    "down",
                  ),
                  ...current.events,
                ],
              }
            : current,
        );
        return;
      }
    }
    const active = lobby.players.filter((p) => p.status === "active");
    if (
      lobby.settings.elimination &&
      active.length <= 1 &&
      lobby.players.length > 1
    )
      settle(lobby);
  }, [now, lobby, settle]);
  function userOpen() {
    if (!lobby || feed !== "live")
      return setError(
        "Live prices are required before placing competition orders.",
      );
    if (Date.now() >= lobby.end)
      return setError(
        "Competition time has ended. Orders are locked while positions settle.",
      );
    const m = Number(margin),
      safeLeverage = Math.floor(Number(leverage)),
      u = lobby.players.find((p) => p.isUser)!;
    if (!Number.isFinite(m) || m <= 0)
      return setError("Enter a valid positive margin.");
    if (!Number.isFinite(safeLeverage) || safeLeverage < 1)
      return setError("Choose a valid leverage level.");
    if (safeLeverage > lobby.settings.maxLeverage)
      return setError(
        `Maximum lobby leverage is ${lobby.settings.maxLeverage}×.`,
      );
    const next = openFor(u, selected, side, m, safeLeverage, lobby.settings, quotesRef.current);
    if (next === u)
      return setError(
        "Order rejected: check balance, market, leverage and open-position limit.",
      );
    setLobby({
      ...lobby,
      players: rankPlayers(
        lobby.players.map((p) => (p.id === u.id ? next : p)),
        quotes,
      ),
      events: [
        event(`${u.name} opened ${side} ${selected} at ${safeLeverage}×`),
        ...lobby.events,
      ].slice(0, 80),
    });
    setError("");
  }
  function userClose(id: number) {
    if (!lobby) return;
    if (Date.now() >= lobby.end)
      return setError(
        "Competition time has ended. Positions are being settled automatically.",
      );
    const u = lobby.players.find((p) => p.isUser)!,
      pos = u.positions.find((p) => p.id === id);
    if (!pos) return;
    const next = closePosition(u, pos, "Manual close", pricesFor(quotesRef.current, pos.pair) || pos.entry);
    setLobby({
      ...lobby,
      players: rankPlayers(
        lobby.players.map((p) => (p.id === u.id ? next : p)),
        quotes,
      ),
      events: [
        event(
          `${u.name} closed ${pos.side} ${pos.pair} for ${money(next.realized - u.realized)}`,
          next.realized >= u.realized ? "up" : "down",
        ),
        ...lobby.events,
      ].slice(0, 80),
    });
  }
  useCompetitionBots(lobby, setLobby, markets, quotes, feed, now);
  function renderScreen() {
  if (
    screen === "hub" ||
    (!lobby && screen !== "create" && screen !== "confirm")
  )
    return (
      <CompetitionHub
        stats={stats}
        meetBots={openGuide}
        create={() => setScreen("create")}
        resume={
          lobby
            ? () => setScreen(lobby.status === "active" ? "arena" : "results")
            : null
        }
      />
    );
  if (screen === "create")
    return (
      <Create
        settings={settings}
        setSettings={setSettings}
        markets={markets}
        search={customSearch}
        setSearch={setCustomSearch}
        cancel={() => setScreen("hub")}
        next={() => setScreen("confirm")}
      />
    );
  if (screen === "confirm")
    return (
      <Confirm
        settings={settings}
        error={error}
        cancel={() => setScreen("create")}
        start={startLobby}
      />
    );
  if (!lobby) return null;
  const ranked = rankPlayers(lobby.players, quotes),
    user = ranked.find((p) => p.isUser)!,
    remaining = Math.max(0, lobby.end - now),
    userPnl = pnlFor(user, quotes),
    userMargin = user.positions
      .filter(validPosition)
      .reduce((n, p) => n + finite(p.margin), 0),
    userEquity = equityFor(user, quotes),
    selectedMarket = allowed.find((m: Market) => m.pair === selected);
  if (screen === "results" || lobby.status === "finished")
    return (
      <Results
        lobby={lobby}
        quotes={quotes}
        stats={stats}
        rematch={() => {
          setSettings(lobby.settings);
          setScreen("confirm");
        }}
        create={() => {
          setLobby(null);
          competitionRepository.clearLobby();
          setScreen("create");
        }}
        portfolio={onPortfolio}
      />
    );
  return (
    <div className="bc page">
      <section className="bc-arena-head">
        <div>
          <span className="bc-live">
            <i /> LIVE BOT PRACTICE · BROWSER LOCAL
          </span>
          <h1>{lobby.settings.name}</h1>
          <p>
            {lobby.settings.difficulty} bots · {lobby.settings.spots}{" "}
            participants · {lobby.settings.marketMode} markets · max{" "}
            {lobby.settings.maxLeverage}×
          </p>
        </div>
        <div className="bc-arena-actions">
          <button type="button" className="bot-guide-button" aria-haspopup="dialog" aria-expanded={guideOpen} onClick={openGuide}>Meet the bots</button>
          <div className={remaining <= 60000 ? "bc-timer warning" : "bc-timer"}>
            <small>TIME REMAINING</small>
            <b aria-label={`${Math.ceil(remaining / 1000)} seconds remaining`}>
              {formatTime(remaining)}
            </b>
            <span>
              {remaining <= 60000 ? "Final minute" : "Competition active"}
            </span>
          </div>
          <button className="bc-quit" onClick={() => setQuitOpen(true)}>
            Quit competition
          </button>
        </div>
      </section>
      {feed !== "live" && (
        <div className="bc-data-warning" role="alert">
          Market data is {feed}. Bot decisions and new orders are paused until
          reliable live prices return.
        </div>
      )}
      <section className="bc-kpis">
        {[
          ["Virtual equity", money(userEquity)],
          ["Available", money(user.balance)],
          ["Used margin", money(userMargin)],
          ["Unrealized PnL", money(userPnl)],
          ["Realized PnL", money(user.realized)],
          ["Current rank", `#${user.rank} of ${ranked.length}`],
          [
            "Active players",
            ranked.filter((p) => p.status === "active").length,
          ],
          ["Starting allocation", money(lobby.settings.allocation)],
        ].map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1]}</b>
          </article>
        ))}
      </section>
      <div className="bc-standings-top">
        <button type="button" className="bot-guide-button arena-radar-trigger" ref={radarTrigger} aria-expanded={radarOpen} aria-controls="arena-radar-title" onClick={()=>setRadarOpen(true)}>Arena Radar <span aria-hidden="true">&#9678;</span></button>
        <Standings
          players={ranked}
          quotes={quotes}
          settings={lobby.settings}
          inspect={setInspect}
        />
      </div>
      <section className="bc-arena-grid">
        <div>
          <UserTerminal
            user={user}
            allowed={allowed}
            quotes={quotes}
            selected={selected}
            setSelected={setSelected}
            side={side}
            setSide={setSide}
            margin={margin}
            setMargin={setMargin}
            leverage={leverage}
            setLeverage={setLeverage}
            settings={lobby.settings}
            open={userOpen}
            close={userClose}
            error={error}
            disabled={feed !== "live" || remaining <= 0}
            market={selectedMarket}
            chartData={chartData}
            chartLoading={chartLoading}
            chartRange={chartRange}
            setChartRange={setChartRange}
            chartUpdated={chartUpdated}
            feed={feed}
          />
        </div>
        <aside>
          <Activity
            events={lobby.events}
            visible={lobby.settings.showActivity}
          />
          <div className="bc-rulebox">
            <b>Fair-play engine</b>
            <p>
              Bots follow distinct rules using observed ticker history and the same fees, margin, leverage
              and PnL formulas as you. No future candles or hidden balance
              bonuses.
            </p>
            <small>
              Ties: equity → realized PnL → lower fees → earlier achievement.
            </small>
          </div>
        </aside>
      </section>
      {inspect && (
        <PositionDialog
          player={ranked.find((p) => p.id === inspect)}
          quotes={quotes}
          visible={lobby.settings.showPositions}
          close={() => setInspect(null)}
        />
      )}
      {quitOpen && (
        <QuitDialog
          opponents={ranked.filter((p) => !p.isUser).length}
          cancel={() => setQuitOpen(false)}
          confirm={abandon}
        />
      )}{" "}
      {finalMinuteOpen && (
        <FinalMinuteDialog close={() => setFinalMinuteOpen(false)} />
      )}
      <div className="bc-notice">
        Local simulation: bots, balances and results are stored in this browser
        and can be modified locally. No real money or cryptocurrency is
        involved. Production competitions require a secure backend.
      </div>
    </div>
  );
  }
  return <>{renderScreen()}{lobby&&<ArenaRadar key={lobby.start} lobby={lobby} quotes={quotes} feed={feed} open={radarOpen} close={()=>setRadarOpen(false)} trigger={radarTrigger}/>}<BotGuide open={guideOpen} dismiss={() => setGuideOpen(false)} trigger={guideTrigger} participants={guideArena ? lobby?.players.filter(p => !p.isUser).map(p => p.name) : undefined} finished={Boolean(guideArena && lobby?.status === "finished")}/></>;
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
