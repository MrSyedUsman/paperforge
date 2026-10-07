/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";
import { useEffect, useRef, useState } from "react";
import { ThemeSlider } from "@/components/theme-slider";
import { CoinIcon } from "@/components/coin-icon";
import { AdvancedChart } from "@/components/advanced-chart";
import { formatMarketPrice, type Market } from "@/lib/market-data/markets";
import { calculateLiquidationPrice, grossPnl, liquidationDistancePercent, liquidationRiskStatus, roundMoney, tradingFee, TAKER_FEE_RATE } from "@/lib/simulation/trading";
import type { Position } from "./types";
import { money } from "./constants";
import { pricesFor, finite } from "./engine";
import { competitionRepository } from "./competition-repository";
import { LiveMetric } from "./live-metric";
export function UserTerminal({
  user,
  allowed,
  quotes,
  selected,
  setSelected,
  side,
  setSide,
  margin,
  setMargin,
  leverage,
  setLeverage,
  settings,
  open,
  close,
  error,
  disabled,
  market,
  chartData,
  chartLoading,
  chartRange,
  setChartRange,
  chartUpdated,
  feed,
}: any) {
  const [marketQuery, setMarketQuery] = useState("");
  const [orderWidth, setOrderWidth] = useState(390),
    workspaceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const saved = competitionRepository.loadOrderWidth();
    if (Number.isFinite(saved) && saved >= 330 && saved <= 620)
      setOrderWidth(saved);
  }, []);
  const startResize = (e: any) => {
    e.preventDefault();
    const move = (event: PointerEvent) => {
      const box = workspaceRef.current?.getBoundingClientRect();
      if (!box) return;
      setOrderWidth(
        Math.max(330, Math.min(620, box.right - event.clientX - 10)),
      );
    };
    const done = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", done);
      setOrderWidth((value) => {
        try {
          competitionRepository.saveOrderWidth(value);
        } catch {}
        return value;
      });
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", done);
  };
  const currentMarket: Market | undefined = allowed.find(
      (m: Market) => m.pair === selected,
    ),
    current = pricesFor(quotes, selected),
    amount = Math.max(0, finite(margin)),
    safeLev = Math.max(1, finite(leverage, 1)),
    size = roundMoney(amount * safeLev),
    fee = tradingFee(size),
    liquidation = current
      ? calculateLiquidationPrice({
          entry: current,
          side,
          leverage: safeLev,
          margin: amount,
          notional: size,
        })
      : 0;
  const shown = allowed
    .filter((m: Market) =>
      `${m.pair} ${m.name} ${m.symbol}`
        .toLowerCase()
        .includes(marketQuery.trim().toLowerCase()),
    )
    .slice(0, 24);
  const setPercent = (pct: number) =>
    setMargin(
      Math.max(
        0,
        (finite(user.balance) * pct) / 100 / (1 + safeLev * 0.0005),
      ).toFixed(2),
    );
  return (
    <section className="bc-panel bc-terminal">
      <div className="bc-panel-title">
        <span>
          <small>BOT COMPETITION MODE</small>
          <h2>Your competition terminal</h2>
        </span>
        <em>Isolated wallet only</em>
      </div>
      <div className="bc-market-browser">
        <div>
          <span>
            <b>Choose a competition market</b>
            <small>{allowed.length} eligible pairs in this lobby</small>
          </span>
          <label>
            ⌕
            <input
              value={marketQuery}
              onChange={(e) => setMarketQuery(e.target.value)}
              placeholder="Search BTC, Ethereum, SOL…"
              aria-label="Search competition markets"
            />
          </label>
        </div>
        <div>
          {shown.length ? (
            shown.map((m: Market) => (
              <button
                key={m.pair}
                className={selected === m.pair ? "active" : ""}
                onClick={() => setSelected(m.pair)}
              >
                <CoinIcon symbol={m.symbol} color={m.color} />
                <span>
                  <b>{m.pair}</b>
                  <small>
                    {quotes[m.pair]
                      ? `$${formatMarketPrice(pricesFor(quotes, m.pair), m)}`
                      : "Waiting for price"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p>No allowed competition markets match your search.</p>
          )}
        </div>
      </div>
      <div className="bc-eligibility-note">
        <i>✓</i>
        <span>
          <b>Winner eligibility</b>
          <small>
            Open at least 1 trade and use at least 50% of the starting
            allocation as cumulative trade margin. Otherwise, the next eligible
            competitor takes the win.
          </small>
        </span>
      </div>
      <div
        className="bc-terminal-workspace"
        ref={workspaceRef}
        style={{ "--order-width": `${orderWidth}px` } as any}
      >
        {market && (
          <div className="bc-terminal-chart">
            <div className="bc-terminal-chart-title">
              <span>
                <small>STEP 2 · LIVE CHART</small>
                <h3>{market.pair} price action</h3>
              </span>
              <strong>
                <i className={feed} />
                {feed === "live" ? "Updating live" : "Prices delayed"}
              </strong>
            </div>
            <AdvancedChart
              market={market}
              data={chartData}
              loading={chartLoading}
              range={chartRange}
              setRange={setChartRange}
              current={current}
              feed={feed}
              lastUpdate={chartUpdated}
            />
          </div>
        )}
        <button
          className="bc-workspace-resizer"
          aria-label="Resize chart and order panel"
          title="Drag to resize chart and trade panel"
          onPointerDown={startResize}
        >
          <i />
        </button>
        <div className="bc-trade-layout">
          <div className="bc-order-main">
            <div className="bc-selected-market">
              <i style={{ background: currentMarket?.color }}>
                {currentMarket?.symbol?.[0] || "?"}
              </i>
              <span>
                <small>Selected perpetual</small>
                <b>{selected}</b>
              </span>
              <strong className="bc-selected-live-price">
                {currentMarket && current ? <LiveMetric value={current} arrow format={(value) => `$${formatMarketPrice(value, currentMarket)}`} /> : "Price unavailable"}
                {currentMarket && current && <small>LIVE PRICE</small>}
              </strong>
            </div>
            <div className="bc-side">
              <button
                aria-pressed={side === "Long"}
                className={side === "Long" ? "long active" : "long"}
                onClick={() => setSide("Long")}
              >
                ↗ Long
              </button>
              <button
                aria-pressed={side === "Short"}
                className={side === "Short" ? "short active" : "short"}
                onClick={() => setSide("Short")}
              >
                ↘ Short
              </button>
            </div>
            <label className="bc-margin-label">
              <span>
                Margin <small>Available {money(user.balance)}</small>
              </span>
              <div>
                <input
                  aria-label="Competition margin"
                  inputMode="decimal"
                  type="number"
                  min="1"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                />
                <b>USDT</b>
              </div>
            </label>
            <div className="bc-quick">
              {[25, 50, 75, 100].map((n) => (
                <button key={n} onClick={() => setPercent(n)}>
                  {n}%
                </button>
              ))}
            </div>
            <div className="bc-leverage-head">
              <span>
                Leverage <small>Maximum {settings.maxLeverage}×</small>
              </span>
              <b>{safeLev}×</b>
            </div>
            <ThemeSlider
              aria-label="Competition leverage"
              className="bc-leverage-range"
              min={1}
              max={settings.maxLeverage}
              value={safeLev}
              onChange={(e) => setLeverage(+e.target.value)}
            />
            {safeLev >= 20 && (
              <div className="bc-risk-warning">
                ⚠ High leverage: liquidation is closer and competition equity
                can be exhausted quickly.
              </div>
            )}
          </div>
          <aside className="bc-order-preview">
            <span>MARKET ORDER PREVIEW</span>
            <h3>
              {side} {selected}
            </h3>
            <div>
              <p>
                <small>Margin / leverage</small>
                <b>
                  {money(amount)} · {safeLev}×
                </b>
              </p>
              <p>
                <small>Position size</small>
                <b>{money(size)}</b>
              </p>
              <p>
                <small>Estimated entry</small>
                <b>
                  {currentMarket && current
                    ? `$${formatMarketPrice(current, currentMarket)}`
                    : "—"}
                </b>
              </p>
              <p>
                <small>Est. liquidation</small>
                <b>
                  {currentMarket && liquidation
                    ? `$${formatMarketPrice(liquidation, currentMarket)}`
                    : "—"}
                </b>
              </p>
              <p>
                <small>Opening fee</small>
                <b>{money(fee)}</b>
              </p>
              <p>
                <small>Est. closing fee</small>
                <b>{money(fee)}</b>
              </p>
              <p>
                <small>Est. round-trip fees</small>
                <b>{money(fee * 2)}</b>
              </p>
              <p>
                <small>Balance after opening</small>
                <b>{money(finite(user.balance) - amount - fee)}</b>
              </p>
            </div>
            <button
              className={side === "Long" ? "primary" : "bc-short"}
              disabled={disabled || !current || amount <= 0}
              onClick={open}
            >
              Open {side} · {safeLev}×
            </button>
            <small>
              Competition wallet only · normal Portfolio is unchanged
            </small>
          </aside>
        </div>
      </div>
      <CompetitionFeeGuide margin={amount} leverage={safeLev} />
      {error && (
        <div className="bc-error" role="alert">
          {error}
        </div>
      )}
      <div className="bc-user-positions">
        <div className="bc-position-heading">
          <div>
            <h3>
              Your open competition positions <i>{user.positions.length}</i>
            </h3>
            <p>
              Liquidation distance is the adverse price move remaining before
              this position&apos;s isolated margin is exhausted.
            </p>
          </div>
          <div className="bc-risk-legend" aria-label="Liquidation risk levels">
            <span className="safe" title="More than 7% from liquidation">
              <i /> Safe <b>&gt;7%</b>
            </span>
            <span className="elevated" title="3% to 7% from liquidation">
              <i /> Elevated <b>3–7%</b>
            </span>
            <span className="high" title="1% to 3% from liquidation">
              <i /> High <b>1–3%</b>
            </span>
            <span className="critical" title="1% or less from liquidation">
              <i /> Critical <b>≤1%</b>
            </span>
          </div>
        </div>
        {user.positions.length ? (
          user.positions.map((p: Position) => {
            const mark = pricesFor(quotes, p.pair) || p.entry,
              gross = grossPnl(p.size, p.entry, mark, p.side),
              closingFee = tradingFee(p.size),
              totalFees = roundMoney(finite(p.openFee) + closingFee),
              net = roundMoney(gross - totalFees),
              distance = liquidationDistancePercent(
                mark,
                p.liquidation,
                p.side,
              ),
              risk = liquidationRiskStatus(distance);
            return (
              <div className="bc-position-card" key={p.id}>
                <span className="bc-position-market">
                  <b>
                    {p.pair} · {p.side} {p.lev}×
                  </b>
                  <small>
                    Entry {money(p.entry)} · Mark {money(mark)}
                  </small>
                </span>
                <span>
                  <small>Margin</small>
                  <b>{money(p.margin)}</b>
                  <small>{money(p.size)} position size</small>
                </span>
                <span className={`bc-liq-risk ${risk.toLowerCase()}`}>
                  <small>Est. liquidation price</small>
                  <b>{money(p.liquidation)}</b>
                  <em>{risk} · {distance.toFixed(2)}% away</em>
                  <small>
                    Mark can {p.side === "Long" ? "fall" : "rise"} about{" "}
                    {distance.toFixed(2)}% before liquidation
                  </small>
                </span>
                <span className={gross >= 0 ? "up" : "down"}>
                  <small>Unrealized PnL</small>
                  <b>
                    {gross >= 0 ? "▲" : "▼"} {money(gross)} gross
                  </b>
                  <small>
                    {Number.isFinite((gross / p.margin) * 100)
                      ? ((gross / p.margin) * 100).toFixed(2)
                      : "0.00"}
                    % gross ROI
                  </small>
                </span>
                <span className={net >= 0 ? "up" : "down"}>
                  <small>Net PnL</small>
                  <b>
                    {net >= 0 ? "▲" : "▼"} {money(net)}
                  </b>
                  <small>
                    If closed now · {money(totalFees)} total fees
                  </small>
                </span>
                <div className="bc-position-actions">
                  <button onClick={() => close(p.id)}>
                    Review &amp; close
                  </button>
                  <small>Fee-adjusted exit</small>
                </div>
              </div>
            );
          })
        ) : (
          <p>
            No competition positions open. Select a market above and place a
            Long or Short market order.
          </p>
        )}
      </div>
    </section>
  );
}
function CompetitionFeeGuide({
  margin,
  leverage,
}: {
  margin: number;
  leverage: number;
}) {
  const size = roundMoney(margin * leverage),
    entry = tradingFee(size),
    exit = tradingFee(size),
    total = entry + exit,
    impact = margin ? (total / margin) * 100 : 0;
  return (
    <section className="bc-fee-guide" aria-label="Competition fee calculation">
      <div>
        <small>REALISTIC MARKET-ORDER FEES</small>
        <h3>Why a trade starts slightly below break-even</h3>
        <p>
          A {(TAKER_FEE_RATE * 100).toFixed(2)}% taker fee is charged on the
          full leveraged position when you open and again when you close. Bots
          pay exactly the same fees.
        </p>
      </div>
      <div className="bc-fee-math">
        <span>
          <small>Margin × leverage</small>
          <b>
            {money(margin)} × {leverage} = {money(size)}
          </b>
        </span>
        <span>
          <small>Opening + closing fee</small>
          <b>
            {money(entry)} + {money(exit)} = {money(total)}
          </b>
        </span>
        <span>
          <small>Margin return needed</small>
          <b>{impact.toFixed(2)}%</b>
        </span>
      </div>
      <p>
        Example updates with your order. A price move of about{" "}
        {(TAKER_FEE_RATE * 2 * 100).toFixed(2)}% in your favor covers both
        estimated fees before profit begins.
      </p>
    </section>
  );
}
