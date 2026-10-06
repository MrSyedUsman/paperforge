import type { Settings, Stats, Difficulty } from "./types";
export const KEY = "paperforge-bot-lobby-v1",
  STATS = "paperforge-bot-stats-v1",
  MAJORS = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "AVAXUSDT",
  ];
export const NAMES = [
    "TrendFox",
    "NovaQuant",
    "CandleByte",
    "RiskRaven",
    "MomentumX",
    "DeltaBot",
    "AtlasAlgo",
  ],
  STRATEGIES = [
    "Trend follower",
    "Momentum trader",
    "Breakout trader",
    "Mean-reversion trader",
    "Conservative trader",
    "Adaptive trader",
    "Volatility trader",
  ];
export const defaults: Settings = {
  name: "Quick Practice Arena",
  duration: 10,
  spots: 4,
  difficulty: "Medium",
  allocation: 5000,
  maxLeverage: 10,
  marketMode: "majors",
  custom: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  showPositions: true,
  showActivity: true,
  repeats: true,
  maxPositions: 3,
  elimination: true,
};
export const emptyStats: Stats = {
  entered: 0,
  wins: 0,
  podiums: 0,
  streak: 0,
  bestRank: 0,
  bestDifficulty: "—",
  pnl: 0,
  trades: 0,
  results: [],
};
export const money = (n: number) =>
  Number.isFinite(Number(n))
    ? `${Number(n) >= 0 ? "" : "−"}$${Math.abs(Number(n)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
export const resultLabel = (rank: number, eligible = true) =>
  !eligible
    ? "Not winner-eligible"
    : rank === 1
      ? "1st place · Winner"
      : rank === 2
        ? "2nd place · Podium finish"
        : rank === 3
          ? "3rd place · Podium finish"
          : `${rank}th place · Finished`;
export const difficultyInfo: Record<Difficulty, string> = {
  Easy: "Slower, fewer trades, low leverage and more mistakes.",
  Medium: "Momentum and trend strategies with moderate risk control.",
  Hard: "Disciplined entries, sizing and stronger risk management.",
  Expert: "Adaptive strategies and equity protection—never guaranteed to win.",
};
