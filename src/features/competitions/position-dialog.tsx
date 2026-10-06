/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import type { Position } from "./types";
import { money } from "./constants";
import { pricesFor } from "./engine";
import { grossPnl } from "@/lib/simulation/trading";
export function PositionDialog({ player, quotes, visible, close }: any) {
  if (!player) return null;
  return (
    <div
      className="bc-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name} positions`}
      onMouseDown={(e) => e.currentTarget === e.target && close()}
    >
      <section>
        <button onClick={close} aria-label="Close">
          ×
        </button>
        <span>PARTICIPANT DETAIL</span>
        <h2>{player.name}</h2>
        <p>
          {player.strategy} · {player.positions.length} open ·{" "}
          {player.trades.length} closed
        </p>
        {visible ? (
          <div>
            {player.positions.length ? (
              player.positions.map((p: Position) => {
                const mark = pricesFor(quotes, p.pair) || p.entry,
                  gain = grossPnl(p.size, p.entry, mark, p.side);
                return (
                  <article key={p.id}>
                    <b>
                      {p.pair} · {p.side} · {p.lev}×
                    </b>
                    <span>
                      Margin {money(p.margin)} · Size {money(p.size)}
                    </span>
                    <span>
                      Entry {money(p.entry)} · Mark {money(mark)}
                    </span>
                    <strong className={gain >= 0 ? "up" : "down"}>
                      {money(gain)} · {((gain / p.margin) * 100).toFixed(2)}%
                      ROI
                    </strong>
                  </article>
                );
              })
            ) : (
              <p>No open positions.</p>
            )}
          </div>
        ) : (
          <div className="bc-hidden">
            Bot position details are hidden by lobby settings.
          </div>
        )}
      </section>
    </div>
  );
}
