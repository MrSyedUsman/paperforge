import fs from "node:fs";
import {
  activityArena,
  activityScenarios,
} from "../tests/bot-activity-fixtures.mjs";
import { eligibilityFor } from "../src/features/competitions/engine.ts";
import { NAMES } from "../src/features/competitions/constants.ts";
const label =
  process.argv.find((v) => v.startsWith("--label="))?.split("=")[1] ||
  "current";
const rows = [];
for (const [duration, warmup] of [
  [1, false],
  [1, true],
  [10, false],
  [30, true],
])
  for (const difficulty of ["Easy", "Medium", "Hard", "Expert"])
    for (const scenario of activityScenarios)
      for (const seed of [1, 2]) {
        const running = Object.fromEntries(
          NAMES.map((name) => [
            name,
            {
              holds: {},
              peakExposure: 0,
              peakPositions: 0,
              lastSequence: 0,
              entries: {},
            },
          ]),
        );
        const lobby = activityArena({
          scenario,
          duration,
          warmup,
          difficulty,
          seed,
          custom: seed === 2,
          observe(lobby) {
            for (const p of lobby.players.filter((p) => !p.isUser)) {
              const r = running[p.name];
              r.peakExposure = Math.max(
                r.peakExposure,
                p.positions.reduce((n, t) => n + t.size, 0),
              );
              r.peakPositions = Math.max(r.peakPositions, p.positions.length);
              for (const t of [...p.positions, ...p.trades])
                if (!r.entries[t.id])
                  r.entries[t.id] = t.botEntry?.quality || "preferred";
              if (p.botState?.sequence !== r.lastSequence) {
                r.lastSequence = p.botState.sequence;
                const d = p.botState.decisions.at(-1);
                if (d?.action === "hold")
                  r.holds[d.reason] = (r.holds[d.reason] || 0) + 1;
              }
            }
          },
        });
        for (const p of lobby.players.filter((p) => !p.isUser)) {
          const state = running[p.name],
            trades = p.trades,
            first = trades.length
              ? Math.min(...trades.map((t) => t.opened)) - lobby.start
              : null;
          rows.push({
            duration,
            warmup,
            difficulty,
            scenario,
            seed,
            custom: seed === 2,
            bot: p.name,
            opened: trades.length,
            closed: trades.length,
            firstEntrySeconds: first === null ? null : first / 1000,
            margin: eligibilityFor(p, 1000).used,
            eligible: eligibilityFor(p, 1000).eligible,
            fees: p.fees,
            peakExposure: state.peakExposure,
            peakPositions: state.peakPositions,
            preferred: Object.values(state.entries).filter(
              (q) => q === "preferred",
            ).length,
            developing: Object.values(state.entries).filter(
              (q) => q === "developing",
            ).length,
            exploratory: Object.values(state.entries).filter(
              (q) => q === "exploratory",
            ).length,
            holds: state.holds,
          });
        }
      }
const summarize = (filter) =>
  NAMES.map((bot) => {
    const selected = rows.filter((r) => r.bot === bot && filter(r)),
      active = selected.filter((r) => r.opened),
      avg = (k) =>
        +(
          selected.reduce((n, r) => n + r[k], 0) / (selected.length || 1)
        ).toFixed(2);
    return {
      bot,
      arenas: selected.length,
      participationPercent: +(
        (active.length / (selected.length || 1)) *
        100
      ).toFixed(1),
      averageFirstEntrySeconds: active.length
        ? +(
            active.reduce((n, r) => n + r.firstEntrySeconds, 0) / active.length
          ).toFixed(1)
        : null,
      averageOpened: avg("opened"),
      averageClosed: avg("closed"),
      averageMargin: avg("margin"),
      eligibilityPercent: +(
        (selected.filter((r) => r.eligible).length / (selected.length || 1)) *
        100
      ).toFixed(1),
      averageFees: avg("fees"),
      averagePeakExposure: avg("peakExposure"),
      preferred: avg("preferred"),
      developing: avg("developing"),
      exploratory: avg("exploratory"),
      topHolds: Object.entries(
        selected.reduce((out, r) => {
          for (const [k, v] of Object.entries(r.holds))
            out[k] = (out[k] || 0) + v;
          return out;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    };
  });
const summary = {
  coldOneMinuteMoving: summarize(
    (r) => r.duration === 1 && !r.warmup && r.scenario !== "flat",
  ),
  warmOneMinuteMoving: summarize(
    (r) => r.duration === 1 && r.warmup && r.scenario !== "flat",
  ),
  longerMoving: summarize((r) => r.duration > 1 && r.scenario !== "flat"),
  flat: summarize((r) => r.scenario === "flat"),
};
console.table(summary.coldOneMinuteMoving);
if (process.argv.includes("--write")) {
  fs.writeFileSync(
    `docs/bot-activity-${label}.json`,
    JSON.stringify(
      {
        note: "Constructed synthetic scenarios, not live-market performance. Same seeds and cases are used before and after.",
        summary,
        rows,
      },
      null,
      2,
    ) + "\n",
  );
}
