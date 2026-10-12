/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useRef, useState } from "react";
import { formatMarketPrice, type Market } from "@/lib/market-data/markets";
import { Faucet } from "@/features/account/faucet";
import { money } from "@/features/account/format";
import type { ClosedPos } from "@/features/account/types";
import { TradeReviewPanel } from "./trade-review-panel";
import { tradeReviewSnapshot } from "./trade-review-api";
import { TradeShareCard } from "./trade-share-card";
export function PortfolioExperience(p: any) {
  const { account, positions, history, activity } = p;
  const [cardTrade, setCardTrade] = useState<any>(null);
  const [reviewTrade, setReviewTrade] = useState<ClosedPos | null>(null);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null);
  function closeReview() { setReviewTrade(null); reviewTrigger.current?.focus({ preventScroll: true }); }
  const profitable = history.filter((h: any) => h.pnl > 0).length,
    losing = history.filter((h: any) => h.pnl < 0).length,
    best = [...history].sort((a: any, b: any) => b.pnl - a.pnl)[0],
    worst = [...history].sort((a: any, b: any) => a.pnl - b.pnl)[0];
  return (
    <div className="page p3-portfolio">
      <section className="p3-page-title">
        <div>
          <span className="eyebrow">BROWSER-LOCAL PRACTICE ACCOUNT</span>
          <h1>Portfolio overview</h1>
          <p>
            One reconciled view of your virtual balance, positions and completed
            paper trades.
          </p>
        </div>
        <div className="p3-sim-label">
          <i /> PAPER TRADING
        </div>
      </section>
      <section className="p3-metric-grid">
        {[
          [
            "Estimated equity",
            account.equity,
            "Available balance + margin + open PnL",
          ],
          ["Available balance", account.balance, "Ready for margin and fees"],
          ["Used margin", account.marginUsed, "Reserved by open positions"],
          ["Unrealized PnL", account.totalPnl, "Live result on open positions"],
          [
            "Realized PnL",
            account.realizedPnl,
            "Net result on closed positions",
          ],
          [
            "Trading fees",
            -account.totalFees,
            "Estimated opening and closing fees",
          ],
          ["Faucet rewards", account.faucetTotal, "Virtual funds claimed"],
          ["Completed trades", history.length, "Stored in this browser"],
        ].map((x: any, i) => (
          <article key={x[0]}>
            <span>
              {x[0]} <i title={x[2]}>?</i>
            </span>
            <b
              className={
                i === 3 || i === 4 || i === 5 ? (x[1] >= 0 ? "up" : "down") : ""
              }
            >
              {i === 7 ? x[1] : money(x[1])}
            </b>
            <small>{x[2]}</small>
          </article>
        ))}
      </section>
      <Faucet clock={p.clock} canClaim={p.canClaim} claim={p.claim} />
      <section className="p3-portfolio-grid">
        <article className="p3-performance">
          <div className="p3-section-title">
            <div>
              <span className="eyebrow">PERFORMANCE</span>
              <h2>Trading snapshot</h2>
            </div>
          </div>
          {history.length ? (
            <>
              <div className="p3-donut-row">
                <div
                  className="p3-donut"
                  style={
                    {
                      "--win": `${Math.round((profitable / history.length) * 100)}%`,
                    } as any
                  }
                >
                  <b>{Math.round((profitable / history.length) * 100)}%</b>
                  <small>Win rate</small>
                </div>
                <div className="p3-breakdown">
                  <span>
                    <i className="green" />
                    Profitable trades <b>{profitable}</b>
                  </span>
                  <span>
                    <i className="red" />
                    Losing trades <b>{losing}</b>
                  </span>
                  <span>
                    <i className="gray" />
                    Flat trades <b>{history.length - profitable - losing}</b>
                  </span>
                </div>
              </div>
              <div className="p3-best-worst">
                <span>
                  <small>Best trade</small>
                  <b className="up">
                    {best?.pair || best?.symbol} · {money(best?.pnl)}
                  </b>
                </span>
                <span>
                  <small>Worst trade</small>
                  <b className="down">
                    {worst?.pair || worst?.symbol} · {money(worst?.pnl)}
                  </b>
                </span>
              </div>
            </>
          ) : (
            <div className="p3-empty">
              <i>◌</i>
              <b>No performance history yet</b>
              <span>
                Close a paper position to build an honest performance summary.
              </span>
              <button onClick={p.explore}>Explore markets</button>
            </div>
          )}
        </article>
        <article className="p3-activity">
          <div className="p3-section-title">
            <div>
              <span className="eyebrow">ACCOUNT ACTIVITY</span>
              <h2>Recent events</h2>
            </div>
          </div>
          {activity.length ? (
            <div className="p3-activity-list">
              {activity.slice(0, 6).map((a: any) => (
                <div key={a.id}>
                  <i>{a.type === "faucet" ? "✦" : "↗"}</i>
                  <span>
                    <b>{a.label}</b>
                    <small>{a.at}</small>
                  </span>
                  <strong className={a.amount >= 0 ? "up" : "down"}>
                    {a.amount >= 0 ? "+" : ""}
                    {money(a.amount)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="p3-empty">
              <i>◎</i>
              <b>No wallet activity</b>
              <span>Faucet claims and closed trades will appear here.</span>
            </div>
          )}
        </article>
      </section>
      <section className="p3-position-section">
        <div className="p3-section-title">
          <div>
            <span className="eyebrow">LIVE POSITIONS</span>
            <h2>Open paper positions</h2>
          </div>
          <button onClick={p.explore}>＋ Open a position</button>
        </div>
        {positions.length ? (
          <div className="p3-position-list">
            <div className="p3-position-row labels">
              <span>Market / direction</span>
              <span>Margin / size</span>
              <span>Entry / mark</span>
              <span>Liquidation</span>
              <span>Unrealized / ROI</span>
              <span>Opened</span>
              <span />
            </div>
            {positions.map((pos: any) => {
              const market = p.markets.find(
                  (m: Market) => m.pair === (pos.pair || `${pos.symbol}USDT`),
                ),
                mark =
                  p.quotes[pos.pair || `${pos.symbol}USDT`]?.markPrice ||
                  p.quotes[pos.pair || `${pos.symbol}USDT`]?.price ||
                  pos.entry,
                gain = p.pnl(pos);
              return (
                <div className="p3-position-row" key={pos.id}>
                  <span>
                    <b>{pos.pair || `${pos.symbol}USDT`}</b>
                    <small className={pos.side === "Long" ? "up" : "down"}>
                      {pos.side === "Long" ? "↗" : "↘"} {pos.side} · {pos.lev}
                      ×
                    </small>
                  </span>
                  <span>
                    <b>${pos.margin.toFixed(2)}</b>
                    <small>${pos.size.toFixed(2)} notional</small>
                  </span>
                  <span>
                    <b>${pos.entry.toLocaleString()}</b>
                    <small>
                      {market
                        ? `$${formatMarketPrice(mark, market)}`
                        : `$${mark.toLocaleString()}`}{" "}
                      mark
                    </small>
                  </span>
                  <span>
                    <b>${(pos.liquidation || 0).toLocaleString()}</b>
                    <small>Estimated</small>
                  </span>
                  <span className={gain >= 0 ? "up" : "down"}>
                    <b>{money(gain)}</b>
                    <small>{((gain / pos.margin) * 100).toFixed(2)}% ROI</small>
                  </span>
                  <span>
                    <small>{pos.opened}</small>
                  </span>
                  <span>
                    <button onClick={() => market && p.onTrade(market)}>
                      Trade
                    </button>
                    <button onClick={() => p.closeTrade(pos)}>Close</button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p3-empty roomy">
            <i>↗</i>
            <b>No open positions</b>
            <span>
              Choose an active futures market and open a simulated Long or Short
              position.
            </span>
            <button onClick={p.explore}>Start Paper Trading</button>
          </div>
        )}
      </section>
      <section className="p3-history-section">
        <div className="p3-section-title">
          <div>
            <span className="eyebrow">TRADING JOURNAL</span>
            <h2>Closed positions</h2>
          </div>
        </div>
        {history.length ? (
          <div className="p3-history-list">
            {history.slice(0, 15).map((h: any) => (
              <div key={h.id}>
                <span>
                  <b>{h.pair || `${h.symbol}USDT`}</b>
                  <small>
                    {h.side} · {h.lev}× · {h.reason || "Closed"}
                  </small>
                </span>
                <span>
                  <small>Entry → exit</small>
                  <b>
                    ${h.entry.toLocaleString()} → $
                    {(h.exit || h.entry).toLocaleString()}
                  </b>
                </span>
                <span>
                  <small>Fees</small>
                  <b>${(h.totalFees || 0).toFixed(2)}</b>
                </span>
                <span className={h.pnl >= 0 ? "up" : "down"}>
                  <small>Net PnL</small>
                  <b>
                    {money(h.pnl)} · {Number(h.roi || 0).toFixed(2)}%
                  </b>
                </span>
                <span>
                  <small>Closed</small>
                  <b>{h.closed}</b>
                </span>
                <span className="p3-history-actions">
                <button className="p3-ai-review-button" onClick={(event) => { reviewTrigger.current = event.currentTarget; setReviewTrade(h); }}
                  aria-label={`Review ${h.pair || h.symbol} ${h.side} trade with AI`} aria-expanded={reviewTrade?.id === h.id} aria-controls={reviewTrade?.id === h.id ? "ai-review-panel" : undefined}>
                  <span aria-hidden="true">✦</span> Review with AI
                </button>
                <button
                  className="p3-trade-card-button"
                  onClick={() => setCardTrade(h)}
                  aria-label={`Generate ${h.pair || h.symbol} trade card`}
                >
                  ◫ Generate card
                </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p3-empty">
            <b>Your journal is empty</b>
            <span>
              Completed paper trades will be recorded here with entry, exit,
              fees and net results.
            </span>
          </div>
        )}
      </section>
      <div className="p3-local-notice">
        This portfolio is a browser-local simulation. Values can be reset or
        modified locally and are not verified account records.
      </div>
      {reviewTrade && <TradeReviewPanel key={JSON.stringify(tradeReviewSnapshot(reviewTrade))} trade={reviewTrade} history={history} onSelect={setReviewTrade} close={closeReview} />}
      {cardTrade && (
        <TradeShareCard
          trade={cardTrade}
          close={() => setCardTrade(null)}
        />
      )}
    </div>
  );
}

