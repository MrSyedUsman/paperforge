import { browserStorage } from "../../lib/storage/browser-storage.ts";
import { KEY, STATS, emptyStats } from "./constants.ts";
import type { Lobby, Stats } from "./types";
import { safeLobby } from "./lobby-migration.ts";

export function restoreStats(saved: unknown): Stats {
  const stats: Stats = { ...emptyStats, results: [] };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return stats;
  const data = saved as Record<string, unknown>;
  for (const key of ["entered", "wins", "podiums", "streak", "bestRank", "pnl", "trades", "lastFinalizedLobby"] as const) {
    if (typeof data[key] === "number" && Number.isFinite(data[key])) {
      stats[key] = key === "pnl" ? data[key] : Math.max(0, data[key]);
    }
  }
  if (typeof data.bestDifficulty === "string") stats.bestDifficulty = data.bestDifficulty;
  if (Array.isArray(data.results)) {
    stats.results = data.results.filter((row): row is Stats["results"][number] =>
      row && typeof row === "object" &&
      ["name", "difficulty", "result"].every(key => typeof row[key] === "string") &&
      ["duration", "rank", "equity", "at"].every(key => typeof row[key] === "number" && Number.isFinite(row[key])),
    ).slice(0, 12);
  }
  return stats;
}

export const competitionRepository = {
  loadLobby(): Lobby | null { return safeLobby(browserStorage.getRaw(KEY)); },
  saveLobby(lobby: Lobby): boolean { return browserStorage.write(KEY, lobby); },
  clearLobby(): void { browserStorage.remove(KEY); },
  loadStats(): Stats { return restoreStats(browserStorage.read<unknown>(STATS, {})); },
  saveStats(stats: Stats): boolean { return browserStorage.write(STATS, stats); },
  loadOrderWidth(): number {
    const width = browserStorage.read<number>("paperforge-competition-order-width", 390);
    return Number.isFinite(width) && width >= 330 && width <= 620 ? width : 390;
  },
  saveOrderWidth(width: number): boolean { return browserStorage.write("paperforge-competition-order-width", width); },
};
