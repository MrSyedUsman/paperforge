import {
  arena,
  markets,
  quote,
  pairs,
  scenarioPrice,
} from "./bot-fixtures.mjs";
import { sampleMarkets } from "../src/features/competitions/bot-history.ts";
import { runBotRound } from "../src/features/competitions/bot-scheduler.ts";
import { settleLobby } from "../src/features/competitions/settlement.ts";
export const activityScenarios = [
  "gentleTrend",
  "modestMomentum",
  "range",
  "recovery",
  "breakout",
  "volatility",
  "flat",
];
export function activityPrice(scenario, step, index, seed = 1) {
  const t = step + index * 3 + seed * 2;
  switch (scenario) {
    case "gentleTrend":
      return 100 * (1 + 0.000065 * step + 0.00012 * Math.sin(t / 2.8));
    case "modestMomentum":
      return 100 * (1 + 0.00008 * step + 0.0002 * Math.sin(t / 4));
    case "range":
      return 100 * (1 + 0.0008 * Math.sin(t / 3.2));
    case "recovery":
      return 100 * (1 + 0.0011 * Math.sin(t / 5) + 0.00018 * Math.sin(t / 1.8));
    case "breakout":
      return (
        100 *
        (1 +
          Math.floor(step / 20) * 0.0015 +
          (step % 20 < 12
            ? 0.00012 * Math.sin(t)
            : 0.00019 * ((step % 20) - 12)))
      );
    case "volatility":
      return (
        100 *
        (1 +
          0.000025 * step +
          (step % 24 < 12 ? 0.00006 : 0.00065) * Math.sin(t / 2))
      );
    case "flat":
      return 100;
    default:
      return scenarioPrice(scenario, step, index, seed);
  }
}
export function activityArena({
  scenario = "gentleTrend",
  duration = 1,
  warmup = false,
  difficulty = "Medium",
  seed = 1,
  custom = false,
  reload,
  observe,
} = {}) {
  let lobby = arena(difficulty, duration),
    history = {};
  lobby.settings.marketMode = custom ? "custom" : "majors";
  lobby.settings.custom = custom
    ? ["ETHUSDT", "SOLUSDT"]
    : lobby.settings.custom;
  lobby.players = lobby.players.map((p) => ({ ...p, achieved: lobby.start }));
  for (let step = warmup ? -40 : 0; step <= duration * 30; step++) {
    const now = lobby.start + step * 2000,
      quotes = Object.fromEntries(
        pairs.map((pair, i) => [
          pair,
          quote(activityPrice(scenario, step, i, seed), now),
        ]),
      );
    history = sampleMarkets(history, markets, quotes, now, true);
    if (step < 0) continue;
    lobby = runBotRound(lobby, history, markets, quotes, now, true);
    observe?.(lobby, now);
    if (reload && step === 15) {
      lobby = reload(lobby);
      history = lobby.botHistory;
    }
  }
  const quotes = Object.fromEntries(
      pairs.map((pair, i) => [
        pair,
        quote(activityPrice(scenario, duration * 30, i, seed), lobby.end),
      ]),
    ),
    saved = Date.now;
  try {
    Date.now = () => lobby.end;
    return settleLobby(lobby, quotes);
  } finally {
    Date.now = saved;
  }
}
