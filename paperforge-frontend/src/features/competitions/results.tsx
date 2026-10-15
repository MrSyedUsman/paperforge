/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import type { Player, Trade } from "./types";
import { money, resultLabel } from "./constants";
import { equityFor, eligibilityFor } from "./engine";
import { CompetitionShareCard } from "./competition-share-card";
import { ArenaDebrief } from "./arena-debrief";
import { Standings } from "./standings";
export function Results({ lobby, quotes, rematch, create, portfolio }: any) {
  const [cardPlayerId, setCardPlayerId] = useState<string | null>(null);
  const user = lobby.players.find((p: Player) => p.isUser),
    equityOrder = [...lobby.players].sort(
      (a: Player, b: Player) =>
        equityFor(b, quotes) - equityFor(a, quotes) ||
        b.realized - a.realized ||
        a.fees - b.fees,
    ),
    equityRank = equityOrder.findIndex((p: Player) => p.id === user.id) + 1,
    higherIneligible = equityOrder
      .slice(0, Math.max(0, equityRank - 1))
      .filter(
        (p: Player) =>
          !eligibilityFor(p, lobby.settings.allocation).eligible,
      ),
    winner =
      lobby.players.find(
        (p: Player) => eligibilityFor(p, lobby.settings.allocation).eligible,
      ) || null,
    eq = equityFor(user, quotes),
    delta = eq - lobby.settings.allocation,
    totalTrades = lobby.players.reduce(
      (n: number, p: Player) => n + p.trades.length,
      0,
    ),
    fees = lobby.players.reduce((n: number, p: Player) => n + p.fees, 0),
    eligibility = eligibilityFor(user, lobby.settings.allocation),
    userWon = winner?.id === user.id,
    noWinner = !winner,
    promotedWin = userWon && equityRank > 1 && higherIneligible.length > 0;
  const title = noWinner
    ? "No eligible winner"
    : userWon
      ? "You won the arena!"
      : `${winner.name} takes the win`;
  const outcomeNote = noWinner
    ? "Every participant missed at least one winner-eligibility requirement, so no winner was awarded."
    : !eligibility.eligible
      ? `You were not winner-eligible: ${eligibility.reason} ${winner.name} takes the win.`
      : "";
  const missedRequirement = (player: Player) => {
    const check = eligibilityFor(player, lobby.settings.allocation);
    if (check.opened < 1 && check.used < check.required)
      return `opened no trade and used ${money(check.used)} of the ${money(check.required)} required margin`;
    if (check.opened < 1) return "did not open a required trade";
    return `used only ${money(check.used)} of the ${money(check.required)} required margin`;
  };
  const promotedNames = higherIneligible.map((p: Player) => p.name).join(", ");
  return (
    <div className="bc page">
      <section className={`bc-results-hero ${noWinner ? "no-winner" : ""}`}>
        <span>COMPETITION COMPLETE · LOCAL RESULT</span>
        <i>{userWon ? "🏆" : noWinner ? "—" : "◆"}</i>
        <h1>{title}</h1>
        <p>
          You finished{" "}
          <b>
            #{equityRank} of {lobby.players.length}
          </b>{" "}
          by final equity with <b>{money(eq)}</b>.
        </p>
        {outcomeNote && <p className="bc-result-warning">{outcomeNote}</p>}
        {promotedWin && (
          <div className="bc-award-explainer">
            <header>
              <i>✓</i>
              <span>
                <b>Win awarded after eligibility review</b>
                <small>
                  Equity determines the live order. Only eligible traders can
                  receive the final win.
                </small>
              </span>
            </header>
            <section>
              <article>
                <small>YOUR EQUITY PLACEMENT</small>
                <strong>#{equityRank}</strong>
                <span>{money(eq)} final equity</span>
              </article>
              <div>
                <i>→</i>
                <small>Eligibility applied</small>
              </div>
              <article className="awarded">
                <small>YOUR AWARDED RESULT</small>
                <strong>Winner</strong>
                <span>#1 among eligible traders</span>
              </article>
            </section>
            <aside>
              <i>i</i>
              <div>
                <b>Why you received the win</b>
                <p>
                  {promotedNames} finished above you by equity but{" "}
                  {higherIneligible.length === 1 ? "was" : "were"} not
                  winner-eligible: {higherIneligible.length === 1
                    ? missedRequirement(higherIneligible[0])
                    : "each missed at least one competition requirement"}. You
                  were the highest-finishing eligible participant.
                </p>
              </div>
            </aside>
          </div>
        )}
        <div className="bc-results-actions">
          <ArenaDebrief key={`${lobby.start}:${lobby.end}`} lobby={lobby}/>
          <button className="primary" onClick={rematch}>
            Rematch same settings
          </button>
          <button className="secondary" onClick={create}>
            Create another lobby
          </button>
        </div>
      </section>
      <section className="bc-result-kpis">
        {[
          [
            "Your result",
            userWon
              ? "Winner"
              : eligibility.eligible
                ? resultLabel(user.rank, true)
                : "Not winner-eligible",
          ],
          [
            "Eligibility",
            eligibility.eligible
              ? `Eligible · ${money(eligibility.used)} used`
              : `Not eligible · ${money(eligibility.used)} / ${money(eligibility.required)}`,
          ],
          ["Equity placement", `#${equityRank} of ${lobby.players.length}`],
          ["Awarded placement", userWon ? "#1 eligible · Winner" : noWinner ? "No award" : `#${user.rank} eligible`],
          ["Competition PnL", money(delta)],
          ["Winner", winner?.name || "None — requirements unmet"],
          ["Winning equity", winner ? money(equityFor(winner, quotes)) : "—"],
          ["Your closed trades", user.trades.length],
          ["Your total fees", money(user.fees)],
          ["All players' trades", totalTrades],
          ["All players' fees", money(fees)],
          ["Difficulty at start", lobby.settings.difficulty],
          ["Duration", `${lobby.settings.duration} min`],
        ].map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1]}</b>
          </article>
        ))}
      </section>
      <CompetitionShareCard user={user} lobby={lobby} quotes={quotes} />
      <Standings
        players={lobby.players}
        quotes={quotes}
        settings={lobby.settings}
        inspect={(id: string) => setCardPlayerId(id)}
        final
      />
      {cardPlayerId && (() => {
        const cardPlayer = lobby.players.find((p: Player) => p.id === cardPlayerId);
        return cardPlayer ? <div className="bc-card-backdrop" role="dialog" aria-modal="true" aria-label={`${cardPlayer.name} competition result card`}><div className="bc-card-dialog"><button className="bc-card-close" onClick={() => setCardPlayerId(null)} aria-label="Close participant card">×</button><CompetitionShareCard key={cardPlayer.id} user={cardPlayer} lobby={lobby} quotes={quotes}/></div></div> : null;
      })()}
      <section className="bc-result-actions">
        <button onClick={portfolio}>Return to Portfolio</button>
        <button
          onClick={() => document.getElementById("history")?.scrollIntoView()}
        >
          Review competition history
        </button>
      </section>
      <section id="history" className="bc-panel bc-history">
        <div className="bc-panel-title">
          <span>
            <small>COMPETITION JOURNAL</small>
            <h2>Your closed trades</h2>
          </span>
        </div>
        {user.trades.length ? (
          user.trades.map((t: Trade) => (
            <div key={t.id}>
              <span>
                <b>
                  {t.pair} · {t.side} {t.lev}×
                </b>
                <small>{t.reason}</small>
                {t.reason === "Liquidation" && (
                  <small>
                    {money(t.marginLost || t.margin)} isolated margin exhausted
                  </small>
                )}
              </span>
              <span>
                <small>Entry → exit</small>
                <b>
                  {money(t.entry)} → {money(t.exit)}
                </b>
              </span>
              <span className={t.pnl >= 0 ? "up" : "down"}>
                <small>Net PnL</small>
                <b>{money(t.pnl)}</b>
                {t.reason === "Liquidation" && (
                  <small>{money(t.liquidationFee || 0)} liquidation fee</small>
                )}
              </span>
            </div>
          ))
        ) : (
          <div className="bc-hidden">
            You completed no trades in this round.
          </div>
        )}
      </section>
      <div className="bc-notice">
        This result and Local Bot Practice Stats are stored only in this
        browser. They are unverified and are never mixed with planned
        multiplayer rankings or verified performance.
      </div>
    </div>
  );
}
