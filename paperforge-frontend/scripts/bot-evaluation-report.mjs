import fs from 'node:fs';
import path from 'node:path';
import { NAMES } from '../src/features/competitions/constants.ts';
export function writeEvaluationReport(result) {
  const lines = ['# Synthetic bot eligibility results', '', 'Constructed-scenario measurements, not predictions of live-market success. Each cell shows eligible arenas out of eighteen and the rounded percentage. Six paths (trend, range, breakout, reversal, volatility expansion and flat) are each evaluated with three seeds. Flat arenas intentionally remain ineligible.', '', 'Allocation: $1,000. Eligibility: $500 cumulative margin and at least one opened trade, using the unchanged competition rule.', ''];
  for (const [duration, warm] of [[1,true],[1,false],[10,true]]) {
    lines.push(`## ${duration}-minute arenas, ${warm ? 'pre-arena history available' : 'cold start without history'}`, '', '| Bot | Easy | Medium | Hard | Expert |', '| --- | --- | --- | --- | --- |');
    for (const name of NAMES) {
      const cells = ['Easy','Medium','Hard','Expert'].map(difficulty => {
        const row = result.rows.find(r => r.durationMinutes === duration && r.preArenaHistory === warm && r.difficulty === difficulty && r.bot === name);
        return `${row.eligible}/${row.arenas} (${row.eligibilityPercent}%)`;
      });
      lines.push(`| ${name} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }
  lines.push('## Interpretation', '', '- Warmup materially affects one-minute arenas. Mean reversion needs historical variation and a recovering deviation; conservative entries need stronger agreement. Cold starts leave less time for cumulative participation.', '- Selective bots are never forced into unrelated trades. Mean-reversion misses occur when the reference mean slopes too strongly, the recovery does not cover fees, or too few valid entries remain before the deadline.', '- Difficulty changes decision opportunities and exit timing. A faster cadence can catch a different trade, so eligibility need not rise monotonically with difficulty.', '- Ten-minute arenas offer more opportunity, but fees, losses and missing signals still constrain participation.', '- The deliberately moving toy paths do not establish predictive skill, live profitability, or a target production qualification rate.', '', 'Per-arena margin, fees, trade counts and last-decision reasons are in [bot-evaluation.json](bot-evaluation.json). Regenerate both reports with `npm run evaluate:bots -- --write`.');
  fs.writeFileSync(path.resolve('docs/bot-eligibility-report.md'), lines.join('\n') + '\n');
}
