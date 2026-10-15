import { defaults, NAMES, STRATEGIES } from '../src/features/competitions/constants.ts';
import { seededRandom } from '../src/features/competitions/bot-profiles.ts';
import { sampleMarkets } from '../src/features/competitions/bot-history.ts';
import { runBotRound } from '../src/features/competitions/bot-scheduler.ts';
import { settleLobby } from '../src/features/competitions/settlement.ts';
export const pairs = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT'];
export const markets = pairs.map(pair => ({ pair, symbol: pair.slice(0,-4), name: pair, status: 'TRADING', color: '#39d8a0', tickSize: 0, stepSize: 0, minQty: 0, maxQty: 0, minNotional: 0, quantityPrecision: 6 }));
export const quote = (price, now) => ({ price, markPrice: price, updatedAt: now, change: 0, volume: 1000, baseVolume: 10, high: price, low: price, open: price });
export const player = (name = 'TrendFox', isUser = false) => ({ id: isUser ? 'user' : `bot-${NAMES.indexOf(name)}`, name, isUser, strategy: isUser ? 'Manual trader' : STRATEGIES[NAMES.indexOf(name)], avatar: 'PF', balance: 1000, realized: 0, fees: 0, positions: [], trades: [], status: 'active', rank: 1, previousRank: 1, achieved: 1 });
export function arena(difficulty = 'Medium', duration = 1) { return { version: 1, feeAccounting: 2, status: 'active', settings: { ...defaults, spots: 8, allocation: 1000, duration, difficulty, maxPositions: 3 }, start: 1_000_000, end: 1_000_000 + duration * 60_000, players: [player('You',true), ...NAMES.map(name => player(name))], events: [] }; }
// Deliberately constructed toy paths, never claimed to represent live-market frequencies.
export function scenarioPrice(scenario, step, marketIndex, seed = 1) {
  const t = step + marketIndex * 2 + seed * 3;
  const random = seededRandom(`${seed}:${marketIndex}:${step}`)();
  const noise = (random - .5) * .025;
  switch (scenario) {
    case 'trend': return 100 * (1 + .00055 * step + .0012 * Math.sin(t / 3) + noise / 100);
    case 'range': return 100 * (1 + .0045 * Math.sin(t / 3.5) + noise / 100);
    case 'breakout': { const cycle = Math.floor(step / 24), within = step % 24; return 100 * (1 + cycle * .005 + (within < 12 ? .0005 * Math.sin(t) : .00055 * (within - 12)) + noise / 100); }
    case 'reversal': return 100 * (1 + .005 * Math.sin(t / 12) + .001 * Math.sin(t / 2) + noise / 100);
    case 'volatility': { const amplitude = step % 30 < 15 ? .00015 : .003; return 100 * (1 + .0003 * step + amplitude * Math.sin(t / 1.5) + noise / 100); }
    case 'flat': return 100;
    default: throw Error('Unknown scenario');
  }
}
export function simulateArena({ scenario = 'trend', difficulty = 'Medium', duration = 1, seed = 1, warmup = true, reload } = {}) {
  let lobby = arena(difficulty, duration), history = {}, quotes;
  const warmupSteps = warmup ? 24 : 0;
  for (let step = -warmupSteps; step <= duration * 30; step++) {
    const now = lobby.start + step * 2000;
    quotes = Object.fromEntries(pairs.map((pair, i) => [pair, quote(scenarioPrice(scenario, step, i, seed), now)]));
    history = sampleMarkets(history, markets, quotes, now, true);
    if (step < 0) continue;
    lobby = runBotRound(lobby, history, markets, quotes, now, true);
    if (reload && step === 15) { lobby = reload(lobby); history = lobby.botHistory; }
  }
  const savedNow = Date.now;
  try { Date.now = () => lobby.end; return settleLobby(lobby, quotes); } finally { Date.now = savedNow; }
}
