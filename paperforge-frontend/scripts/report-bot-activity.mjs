import fs from 'node:fs';
import assert from 'node:assert/strict';
const before=JSON.parse(fs.readFileSync('docs/bot-activity-before.json','utf8'));
const after=JSON.parse(fs.readFileSync('docs/bot-activity-after.json','utf8'));
for(const key of ['coldOneMinuteMoving','warmOneMinuteMoving']) for(const row of after.summary[key]) {
  assert.ok(row.participationPercent >= (row.bot==='RiskRaven'?60:80), `${key}: ${row.bot} participation`);
  if(key==='coldOneMinuteMoving') assert.ok(row.averageFirstEntrySeconds<=20, `${row.bot} first entry`);
}
for(const row of after.rows) {
  if(row.scenario==='flat') assert.equal(row.opened,0);
  if(row.duration===1) assert.ok(row.opened <= (row.bot==='NovaQuant'?7:row.bot==='MomentumX'?5:6));
}
const lines=['# Competition bot activity verification','','Constructed synthetic scenarios; these are activity and accounting checks, not live-market performance or profit predictions. The archived baseline is commit a4bca70. Each run uses the same 224 arenas (1,568 bot results), four difficulties, seven price paths, two seeds, cold/warm starts and one-, ten- and thirty-minute durations. Half use custom allowed markets.','','First-entry averages include participating bots only. Margin means cumulative margin committed, not leveraged notional. Fees include opening and closing fees; all positions settle at expiry. Peak exposure is notional. Eligibility remains at least one opened trade and 50% cumulative margin.'];
for(const [key,title] of [['coldOneMinuteMoving','Cold one-minute moving markets'],['warmOneMinuteMoving','Warm one-minute moving markets'],['longerMoving','Longer moving markets']]) {
 lines.push('',`## ${title}`,'','Values show before -> after; monetary values are simulated USD.','','| Bot | Participation % | First entry seconds | Opened / closed | Cumulative margin | Eligible % | Fees | Peak notional |','| --- | --- | --- | --- | --- | --- | --- | --- |');
 for(const a of after.summary[key]) {const b=before.summary[key].find(r=>r.bot===a.bot); const pair=k=>`${b[k]??'none'} -> ${a[k]??'none'}`; lines.push(`| ${a.bot} | ${pair('participationPercent')} | ${pair('averageFirstEntrySeconds')} | ${b.averageOpened}/${b.averageClosed} -> ${a.averageOpened}/${a.averageClosed} | ${pair('averageMargin')} | ${pair('eligibilityPercent')} | ${pair('averageFees')} | ${pair('averagePeakExposure')} |`);}
 lines.push('','Entry quality counts are averages per arena. Hold counts are scheduler observations, not distinct missed trades.','','| Bot | Preferred | Developing | Exploratory | Most common holds after |','| --- | --- | --- | --- | --- |');
 for(const a of after.summary[key]) lines.push(`| ${a.bot} | ${a.preferred} | ${a.developing} | ${a.exploratory} | ${a.topHolds.map(([k,v])=>`${k}: ${v}`).join('; ')} |`);
}
lines.push('','## Acceptance and limitations','','All moving-market participation targets passed: at least 80% for six bots and 60% for recovery-focused RiskRaven, for both cold and warm one-minute runs. Participating cold-start bots average at most 20 seconds to first entry. Flat paths produce no entries or fees. One-minute entry caps are five for MomentumX, seven for NovaQuant and six for the others.','','RiskRaven can remain inactive without a recovery signal; eligibility is not guaranteed. Developing and exploratory entries reduce margin and leverage. More participation can increase fees and losses. Warm starts use previously observed data; cold starts require actual samples. These fixtures do not cover every live feed or market regime.','','Reproduce the current run with `node --experimental-strip-types scripts/evaluate-bot-activity.mjs --label=after --write`, then `node scripts/report-bot-activity.mjs`. The before JSON is an archived baseline, not produced by the updated engine.','');
fs.writeFileSync('docs/bot-activity-results.md',lines.join('\n'));
console.log('Activity targets passed; generated docs/bot-activity-results.md');
