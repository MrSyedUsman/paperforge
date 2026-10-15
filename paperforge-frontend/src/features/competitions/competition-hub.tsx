/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { money } from "./constants";
export function CompetitionHub({ stats, create, resume, meetBots }: any) {
  return (
    <div className="bc page">
      <section className="bc-hero">
        <div>
          <span className="eyebrow">TRADING COMPETITIONS</span>
          <h1>
            Trade the clock.
            <br />
            <em>Prove your strategy.</em>
          </h1>
          <p>
            Enter focused futures competitions using isolated virtual balances
            and live market prices. Practice against bots now, then challenge
            human traders when secure multiplayer launches.
          </p>
          <div>
            <button className="primary" onClick={create}>
              Start Bot Practice →
            </button>
            <button type="button" className="bot-guide-button" aria-haspopup="dialog" onClick={meetBots}>Meet the bots</button>
            {resume && (
              <button className="secondary" onClick={resume}>
                Resume saved lobby
              </button>
            )}
          </div>
        </div>
        <div className="bc-mode-card bc-mode-live">
          <header>
            <span>AVAILABLE NOW</span>
            <small>Bot practice mode</small>
          </header>
          <div className="bc-mode-title">
            <i>♟</i>
            <span>
              <h2>Bot Practice Arena</h2>
              <p>
                Compete against simulated traders today while building the
                skills needed for future multiplayer lobbies.
              </p>
            </span>
          </div>
          <div className="bc-mode-features">
            <span>2–8 participants</span>
            <span>Easy to Expert</span>
            <span>Isolated wallet</span>
            <span>Live standings</span>
          </div>
          <button onClick={create}>
            <span>Configure bot lobby</span>
            <b>→</b>
          </button>
        </div>
      </section>
      <section className="bc-mode-row">
        <article>
          <span>AVAILABLE NOW</span>
          <h3>Bot Practice</h3>
          <p>
            Fast browser-local competitions against explainable simulated
            traders.
          </p>
        </article>
        <article className="locked">
          <span>PLANNED MULTIPLAYER</span>
          <h3>Human Competitions</h3>
          <p>
            Private joining codes, live human standings and secure
            backend-authoritative results.
          </p>
          <button disabled>Human lobbies · Coming later</button>
        </article>
      </section>
      <section className="bc-stats">
        <div>
          <span className="eyebrow">LOCAL BOT PRACTICE STATS</span>
          <h2>Your browser-local record</h2>
        </div>
        {[
          ["Entered", stats.entered],
          ["Wins", stats.wins],
          ["Podiums", stats.podiums],
          [
            "Win rate",
            stats.entered
              ? `${Math.round((stats.wins / stats.entered) * 100)}%`
              : "—",
          ],
          ["Best rank", stats.bestRank ? `#${stats.bestRank}` : "—"],
          ["Win streak", stats.streak],
          ["Best difficulty", stats.bestDifficulty],
          ["Practice PnL", money(stats.pnl)],
        ].map((x) => (
          <span key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1]}</b>
          </span>
        ))}
      </section>
      <div className="bc-notice">
        Current bot-practice results are unverified local simulation data. Human
        multiplayer, global rankings and verified competition records require
        production accounts and backend enforcement.
      </div>
    </div>
  );
}
