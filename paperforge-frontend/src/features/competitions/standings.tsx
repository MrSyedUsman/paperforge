/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import type { Player } from "./types";
import { money } from "./constants";
import { equityFor, pnlFor, eligibilityFor } from "./engine";
import { LiveMetric } from "./live-metric";
export function Standings({ players, quotes, settings, inspect, final = false }: any) {
  const displayedPlayers = final
    ? [...players].sort(
        (a: Player, b: Player) =>
          equityFor(b, quotes) - equityFor(a, quotes) ||
          b.realized - a.realized ||
          a.fees - b.fees,
      )
    : players;
  const awardedWinner = final
    ? [...players]
        .sort((a: Player, b: Player) => a.rank - b.rank)
        .find((p: Player) => eligibilityFor(p, settings.allocation).eligible)
    : null;
  return (
    <section className={`bc-panel ${final ? "bc-final-standings" : ""}`}>
      <div className="bc-panel-title">
        <span>
          <small>{final ? "FINAL TABLE" : "LIVE TABLE"}</small>
          <h2>{final ? "Final standings" : "Standings"}</h2>
        </span>
        <em className={!final ? "bc-mark-live" : ""} aria-live="polite">
          {final
            ? "Select any participant to generate their stats card"
            : "Live futures prices · ~1s stream"}
        </em>
      </div>
      <div className="bc-table">
        <div className="bc-stand labels">
          <span>Rank</span>
          <span>Participant</span>
          <span>Available / margin</span>
          <span>Open PnL</span>
          <span>Equity / return</span>
          <span>Eligibility progress</span>
          <span>Status</span>
        </div>
        {displayedPlayers.map((p: Player, index: number) => {
          const eq = equityFor(p, quotes),
            unreal = pnlFor(p, quotes),
            move =
              p.previousRank > p.rank
                ? "▲"
                : p.previousRank < p.rank
                  ? "▼"
                  : "—",
            eligibility = eligibilityFor(p, settings.allocation),
            progress = eligibility.eligible
              ? `${eligibility.opened} trade${eligibility.opened === 1 ? "" : "s"} · ${money(eligibility.used)} used`
              : eligibility.opened < 1
                ? `No trade · ${money(eligibility.used)} / ${money(eligibility.required)}`
                : `Trade met · ${money(eligibility.used)} / ${money(eligibility.required)}`;
          return (
            <button
              className={`bc-stand ${p.isUser ? "is-user" : ""} ${final && !eligibility.eligible ? "is-ineligible" : ""}`}
              key={p.id}
              onClick={() => inspect(p.id)}
            >
              <span>
                <b>#{final ? index + 1 : p.rank}</b>
                <small>{final ? "Equity place" : move}</small>
              </span>
              <span className="bc-player">
                <i>{p.avatar}</i>
                <b>
                  {p.name}
                  {p.isUser && <em className="bc-you-badge">YOU</em>}
                  <small>
                    {p.isUser
                      ? "Your competition wallet"
                      : `${settings.difficulty} BOT · ${p.strategy}`}
                  </small>
                </b>
              </span>
              <span>
                <b>{money(p.balance)}</b>
                <small>
                  {money(p.positions.reduce((n, x) => n + x.margin, 0))} margin
                </small>
              </span>
              <span>
                <b className={unreal >= 0 ? "up" : "down"}>
                  <LiveMetric value={unreal} arrow tone={unreal >= 0 ? "positive" : "negative"} />
                </b>
                <small className={p.realized >= 0 ? "up" : "down"}>
                  {money(p.realized)} realized
                </small>
              </span>
              <span>
                <b><LiveMetric value={eq} arrow /></b>
                <small>
                  {eq >= settings.allocation ? "▲" : "▼"}{" "}
                  {((eq / settings.allocation - 1) * 100).toFixed(2)}%
                </small>
              </span>
              <span>
                <b className={eligibility.eligible ? "up" : "down"}>
                  {eligibility.eligible ? "Eligible" : "Not eligible"}
                </b>
                <small
                  className={eligibility.eligible ? "eligible" : "needs-trade"}
                >
                  {progress}
                </small>
              </span>
              <span>
                {final ? (
                  <em
                    className={
                      eligibility.eligible
                        ? "eligible-status"
                        : "ineligible-status"
                    }
                  >
                    {awardedWinner?.id === p.id
                      ? "Winner"
                      : eligibility.eligible
                        ? "Eligible"
                        : "No award"}
                  </em>
                ) : (
                  <em className={p.status}>{p.status}</em>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
