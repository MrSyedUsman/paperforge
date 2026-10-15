import { writeEvaluationReport } from './bot-evaluation-report.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { NAMES } from '../src/features/competitions/constants.ts';
import { eligibilityFor } from '../src/features/competitions/engine.ts';
import { simulateArena } from '../tests/bot-fixtures.mjs';
const difficulties = ['Easy','Medium','Hard','Expert'], scenarios = ['trend','range','breakout','reversal','volatility','flat'];
const rows = [], details = [];
for (const {duration,warmup} of [{duration:1,warmup:true},{duration:1,warmup:false},{duration:10,warmup:true}]) for (const difficulty of difficulties) {
  const counts = Object.fromEntries(NAMES.map(name => [name, { eligible: 0, total: 0, trades: 0 }]));
  for (const scenario of scenarios) for (const seed of [1,2,3]) {
    const lobby = simulateArena({ scenario, seed, difficulty, duration, warmup });
    for (const player of lobby.players.filter(p => !p.isUser)) {
      const progress = eligibilityFor(player, 1000), row = counts[player.name]; row.total++; row.eligible += Number(progress.eligible); row.trades += player.trades.length;
      details.push({ duration, warmup, difficulty, scenario, seed, bot: player.name, eligible: progress.eligible, cumulativeMargin: progress.used, closedTrades: player.trades.length, fees: player.fees, lastReason: player.botState?.decisions.at(-1)?.reason || 'No decision' });
    }
  }
  for (const [bot, countsRow] of Object.entries(counts)) rows.push({ durationMinutes: duration, preArenaHistory: warmup, difficulty, bot, eligible: countsRow.eligible, arenas: countsRow.total, eligibilityPercent: Math.round(countsRow.eligible / countsRow.total * 100), averageClosedTrades: +(countsRow.trades / countsRow.total).toFixed(1) });
}
const result = { note: 'Synthetic constructed paths with warm and cold one-minute starts plus warm ten-minute starts, three seeds and six scenarios (including deliberately flat markets). Not a prediction of live eligibility or returns.', allocation: 1000, requiredCumulativeMargin: 500, rows, details };
console.table(rows);
if (process.argv.includes('--write')) { const target = path.resolve('docs/bot-evaluation.json'); fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n'); writeEvaluationReport(result); console.log(`Saved ${target} and the eligibility report.`); }
