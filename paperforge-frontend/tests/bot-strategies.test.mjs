import test from 'node:test';
import assert from 'node:assert/strict';
import { entrySignal, exitDecision, classifyRegime, updateRegime } from '../src/features/competitions/bot-strategies.ts';
import { newBotState } from '../src/features/competitions/bot-state.ts';
import { signalsFor } from '../src/features/competitions/bot-signals.ts';
import { sampleMarkets, observedPrices, restorePriceHistory } from '../src/features/competitions/bot-history.ts';
import { BOT_POLICIES } from '../src/features/competitions/bot-profiles.ts';
import { planParticipation } from '../src/features/competitions/bot-participation.ts';
import { runBotRound } from '../src/features/competitions/bot-scheduler.ts';
import { eligibilityFor, openFor } from '../src/features/competitions/engine.ts';
import { safeLobby } from '../src/features/competitions/lobby-migration.ts';
import { settleLobby } from '../src/features/competitions/settlement.ts';
import { arena, player, markets, quote, simulateArena } from './bot-fixtures.mjs';
const signal = changes => ({ price: 100.3, previous: 100.2, fast: 100.15, slow: 100, trend: .15, slope: .04, shortReturn: .2, longReturn: .3, acceleration: .02, lastReturn: .05, volatility: .04, movement: .06, volatilityRatio: 1, rangeHigh: 100.2, rangeLow: 99.9, rangeWidth: .3, z: 1, previousZ: .9, referenceMean: 100, meanSlope: .04, meanReady: true, volatilityReady: true, breakout: 0, pullback: true, evidence: { shortReturnPercent: .2 }, ...changes });
const settings = arena().settings;
const position = (kind, changes = {}) => ({ id: 1, pair: 'BTCUSDT', side: 'Long', lev: 5, margin: 100, size: 500, entry: 100, liquidation: 80.6, openFee: .25, opened: 1_000_000, botEntry: { version: 1, kind, regime: 'trend', reason: 'test', reference: 100.5, signals: {}, at: 1_000_000 }, ...changes });
test('TrendFox requires directional agreement and holds without a valid trend', () => {
  assert.equal(entrySignal('trend', signal(), 'Medium').side, 'Long');
  assert.equal(entrySignal('trend', signal({ trend: 0, slope: 0 }), 'Medium'), null);
  assert.equal(entrySignal('trend', signal({ slope: -.04 }), 'Medium'), null);
  assert.equal(entrySignal('trend', signal({ price: 102 }), 'Medium'), null);
  assert.equal(exitDecision(position('trend'), signal({ trend: -.05 }), 100.1, 1_010_000, BOT_POLICIES.TrendFox, newBotState(1000), 60_000).action, 'close');
});
test('NovaQuant ranks recent momentum and rejects fading or overextended entries', () => {
  assert.equal(entrySignal('momentum', signal(), 'Medium').side, 'Long');
  assert.equal(entrySignal('momentum', signal({ shortReturn: -.2 }), 'Medium'), null);
  assert.equal(entrySignal('momentum', signal({ shortReturn: 2 }), 'Medium'), null);
  assert.equal(exitDecision(position('momentum'), signal({ shortReturn: -.02 }), 100.1, 1_010_000, BOT_POLICIES.NovaQuant, newBotState(1000), 60_000).reason, 'Recent momentum faded or reversed');
});
test('CandleByte needs confirmed range breaks and exits failed breakouts', () => {
  assert.equal(entrySignal('breakout', signal(), 'Medium'), null);
  assert.equal(entrySignal('breakout', signal({ breakout: 1 }), 'Medium').side, 'Long');
  assert.equal(exitDecision(position('breakout'), signal(), 100.1, 1_010_000, BOT_POLICIES.CandleByte, newBotState(1000), 60_000).reason, 'Price returned inside the original breakout range');
});
test('RiskRaven requires a recovering deviation in a weak trend and takes a fee-covered mean exit', () => {
  const s = signal({ price: 99.7, previous: 99.6, slow: 100, trend: -.02, slope: 0, meanSlope: .01, longReturn: -.05, z: -1.4, previousZ: -1.8 });
  assert.equal(entrySignal('reversion', s, 'Medium').side, 'Long');
  assert.equal(entrySignal('reversion', { ...s, lastReturn: -.1 }, 'Medium'), null);
  assert.equal(entrySignal('reversion', { ...s, meanSlope: -.1 }, 'Medium'), null);
  assert.equal(exitDecision(position('reversion', { botEntry: { ...position('reversion').botEntry, reference: 100.2 } }), s, 100.3, 1_010_000, BOT_POLICIES.RiskRaven, newBotState(1000), 60_000).reason, 'Price reached the entry reference mean after covering fees');
});
test('MomentumX requires stronger agreement, rejects volatility and has the lowest exposure policy', () => {
  assert.ok(entrySignal('conservative', signal(), 'Medium'));
  assert.equal(entrySignal('conservative', signal({ volatility: .2 }), 'Medium'), null);
  assert.equal(entrySignal('conservative', signal({ shortReturn: .08 }), 'Medium'), null);
  for (const p of Object.values(BOT_POLICIES).filter(p => p.kind !== 'conservative')) { assert.ok(BOT_POLICIES.MomentumX.normalMargin < p.normalMargin); assert.ok(BOT_POLICIES.MomentumX.leverage < p.leverage); }
  assert.equal(exitDecision(position('conservative'), signal(), 101, 1_010_000, BOT_POLICIES.MomentumX, newBotState(1000), 60_000).action, 'close');
});
test('DeltaBot uses measured regimes with hysteresis and explicit transition exits', () => {
  assert.equal(entrySignal('adaptive', signal(), 'Medium', false, 'uncertain'), null);
  assert.ok(entrySignal('adaptive', signal(), 'Medium', false, 'trend'));
  let state = newBotState(1000); state = updateRegime(state, 'trend', 10_000, true); assert.equal(state.regime, 'uncertain');
  state = updateRegime(state, 'trend', 12_000, true); assert.equal(state.regime, 'uncertain');
  state = updateRegime(state, 'trend', 15_000, true); assert.equal(state.regime, 'trend');
  state = updateRegime(state, 'range', 16_000, true); state = updateRegime(state, 'range', 20_000, true); assert.equal(state.regime, 'trend');
  state = updateRegime(state, 'range', 24_000, true); assert.equal(state.regime, 'range');
  assert.equal(exitDecision(position('adaptive'), signal(), 100.1, 1_010_000, BOT_POLICIES.DeltaBot, { ...state, regime: 'range' }, 60_000).reason, 'Confirmed regime transition no longer supports the original entry');
  assert.equal(classifyRegime(signal({ breakout: 1, volatilityRatio: 2 })), 'breakout');
});
test('AtlasAlgo requires volatility expansion plus an independent direction', () => {
  assert.equal(entrySignal('volatility', signal(), 'Medium'), null);
  assert.ok(entrySignal('volatility', signal({ volatilityRatio: 2 }), 'Medium'));
  assert.equal(entrySignal('volatility', signal({ volatilityRatio: 2, shortReturn: -.2 }), 'Medium'), null);
  assert.equal(entrySignal('volatility', signal({ volatilityRatio: 3, volatility: 1 }), 'Medium'), null);
  assert.equal(exitDecision(position('volatility'), signal({ volatilityRatio: .5 }), 100.1, 1_010_000, BOT_POLICIES.AtlasAlgo, newBotState(1000), 60_000).reason, 'Volatility expansion or its directional confirmation faded');
});
test('all bots enforce loss limits, fee-aware targets and bounded trailing exits', () => {
  for (const policy of Object.values(BOT_POLICIES)) {
    assert.equal(exitDecision(position(policy.kind), signal(), 95, 1_002_000, policy, newBotState(1000), 60_000).action, 'close');
    assert.equal(exitDecision(position(policy.kind), signal(), 100.02, 1_002_000, policy, newBotState(1000), 60_000), null);
    assert.equal(exitDecision(position(policy.kind), signal(), 100.3, 1_004_000, policy, { ...newBotState(1000), bestNet: { '1': 5 } }, 60_000).reason, 'Fee-adjusted profit retreated from its recorded peak');
  }
});
test('signals warm up, exclude the current observation from breakout boundaries and use no future samples', () => {
  assert.equal(signalsFor([100,101], true), null);
  const base = Array.from({ length: 12 }, (_, i) => 100 + .1 * Math.sin(i));
  const first = signalsFor([...base,102], true), confirmed = signalsFor([...base,102,102.1], true);
  assert.equal(first.breakout, 0); assert.equal(confirmed.breakout, 1); assert.ok(confirmed.rangeHigh < 101);
  assert.deepEqual(observedPrices({ BTCUSDT: [{ at: 1000, sourceAt: 1000, price: 100 }, { at: 2000, sourceAt: 2000, price: 999 }] }, 'BTCUSDT', 1000), [100]);
});
test('sampling is bounded, bucketed, quote-fresh and does not invent data through gaps', () => {
  let history = {};
  for (let i = 1; i <= 140; i++) history = sampleMarkets(history, markets, { BTCUSDT: quote(100, i * 2000) }, i * 2000, true);
  assert.ok(history.BTCUSDT.length <= 120);
  assert.equal(sampleMarkets(history, markets, { BTCUSDT: quote(200, 280100) }, 280100, true), history);
  assert.equal(sampleMarkets(history, markets, { BTCUSDT: quote(200, 1) }, 300000, true), history);
  assert.equal(sampleMarkets(history, markets, { BTCUSDT: quote(200, 400000) }, 300000, true), history);
  assert.deepEqual(observedPrices({ BTCUSDT: [{ at: 1000, sourceAt: 1000, price: 100 }, { at: 20000, sourceAt: 20000, price: 101 }] }, 'BTCUSDT', 20000), [101]);
  assert.deepEqual(restorePriceHistory({ invalid: [null] }), {});
});
test('eligibility planner counts cumulative margin, never leveraged notional, and avoids late entries', () => {
  const lobby = arena(), p = openFor(player(), 'BTCUSDT', 'Long', 100, 10, settings, { BTCUSDT: quote(100, lobby.start) }, { now: lobby.start, id: 1 });
  assert.equal(eligibilityFor(p, 1000).used, 100);
  const plan = planParticipation(p, lobby, lobby.start + 20000, BOT_POLICIES.TrendFox, 5);
  assert.equal(plan.deficit, 400); assert.equal(plan.required, 500); assert.ok(plan.margin <= 220);
  assert.equal(planParticipation(p, lobby, lobby.end - 1000, BOT_POLICIES.TrendFox, 5).entryAllowed, false);
  assert.equal(planParticipation({ ...p, balance: 0 }, lobby, lobby.start, BOT_POLICIES.TrendFox, 5).entryAllowed, false);
});
test('scheduler is reproducible, preserves user state, respects cooldowns and cannot trade after expiry', () => {
  const final = simulateArena(), again = simulateArena(); assert.deepEqual({ ...final, events: final.events.map(e=>({at:e.at,text:e.text,tone:e.tone})) }, { ...again, events: again.events.map(e=>({at:e.at,text:e.text,tone:e.tone})) });
  const user = final.players.find(p => p.isUser); assert.equal(user.balance, 1000); assert.equal(user.positions.length, 0); assert.equal(user.trades.length, 0);
  const lobby = arena(), quotes = { BTCUSDT: quote(100, lobby.start) }; const first = runBotRound(lobby, {}, markets, quotes, lobby.start, true);
  assert.equal(runBotRound(first, first.botHistory, markets, quotes, lobby.start, true), first);
  assert.equal(runBotRound(lobby, {}, markets, quotes, lobby.end, true), lobby);
  assert.equal(runBotRound(lobby, {}, markets, quotes, lobby.start, false), lobby);
  assert.equal(runBotRound(first, first.botHistory, markets, quotes, lobby.start + 500, true).players.find(p => p.name === 'TrendFox').botState.sequence, first.players.find(p => p.name === 'TrendFox').botState.sequence);
});
test('flat markets naturally miss eligibility without fabricated trades or fee churn', () => {
  const final = simulateArena({ scenario: 'flat' });
  for (const p of final.players) { assert.equal(p.trades.length, 0); assert.equal(eligibilityFor(p,1000).eligible,false); assert.equal(p.balance,1000); }
});
test('bot engine execution reconciles fees and balances, respects constraints and bounds metadata', () => {
  const final = simulateArena({ duration: 10, scenario: 'reversal', difficulty: 'Expert' });
  for (const p of final.players.filter(p => !p.isUser)) {
    assert.equal(p.positions.length,0); assert.ok(Math.abs(p.balance - (1000 + p.realized)) < .05);
    assert.ok(p.botState.decisions.length <= 24);
    for (const [i,t] of p.trades.entries()) { assert.ok(t.lev <= settings.maxLeverage); assert.ok(t.opened < final.end); if (i < 32) assert.ok(t.botEntry); else assert.equal(t.botEntry,undefined); assert.ok(t.margin + t.openFee <= 1000 + Math.max(0,p.realized)); }
  }
  assert.ok(final.events.length <= 83);
  assert.equal(settleLobby(final,{}),final);
});
test('legacy lobbies warm up safely and reload preserves bot pacing and bounded history', () => {
  const legacy = safeLobby(JSON.stringify(arena())); assert.ok(legacy); assert.deepEqual(legacy.botHistory,{});
  assert.equal(legacy.players.find(p => !p.isUser).botState.sequence,0);
  const uninterrupted = simulateArena({ duration: 1 });
  const reloaded = simulateArena({ duration: 1, reload: lobby => safeLobby(JSON.stringify(lobby)) });
  for (const p of uninterrupted.players) { const r=reloaded.players.find(r=>r.id===p.id); assert.equal(p.trades.length,r.trades.length); assert.equal(p.balance,r.balance); }
});

test('seeded patience is reproducible and never changes an unsupported direction into an entry', async () => {
  const {seededRandom}=await import('../src/features/competitions/bot-profiles.ts');
  const a=seededRandom('arena:bot:1'), b=seededRandom('arena:bot:1'); assert.deepEqual(Array.from({length:20},a),Array.from({length:20},b));
  assert.equal(entrySignal('momentum',signal({shortReturn:0,longReturn:0,rangeWidth:0,movement:0}),'Easy',true),null);
});
test('stale and future quotes cannot open or close bot positions', () => {
  const lobby=arena(), p=openFor(player(),'BTCUSDT','Long',100,5,settings,{BTCUSDT:quote(100,lobby.start)},{now:lobby.start,id:1});
  lobby.players=lobby.players.map(row=>row.name==='TrendFox'?p:row);
  for(const updatedAt of [lobby.start-50000,lobby.start+50000]) {
    const next=runBotRound(lobby,{},markets,{BTCUSDT:quote(50,updatedAt)},lobby.start,true), bot=next.players.find(row=>row.name==='TrendFox');
    assert.equal(bot.positions.length,1);assert.equal(bot.trades.length,0);assert.equal(bot.balance,p.balance);
  }
});
test('bot liquidation uses isolated engine settlement once and preserves manual positions', () => {
  const lobby=arena(), p=openFor(player(),'BTCUSDT','Long',100,10,settings,{BTCUSDT:quote(100,lobby.start)},{now:lobby.start,id:1});
  const u=openFor(player('You',true),'BTCUSDT','Long',100,10,settings,{BTCUSDT:quote(100,lobby.start)},{now:lobby.start,id:2});
  lobby.players=[u,p]; const quotes={BTCUSDT:quote(90,lobby.start+2000)};
  const next=runBotRound(lobby,{},markets,quotes,lobby.start+2000,true), bot=next.players.find(row=>!row.isUser);
  assert.equal(bot.trades.length,1);assert.equal(bot.trades[0].reason,'Liquidation');assert.equal(bot.trades[0].pnl,-100.5);assert.equal(bot.balance,899.5);
  assert.equal(next.players.find(row=>row.isUser).positions.length,1);
  assert.equal(runBotRound(next,next.botHistory,markets,quotes,lobby.start+2000,true).players.find(row=>!row.isUser).trades.length,1);
});
test('drawdown reduces planned sizing and cumulative closed margin remains eligible evidence', async () => {
  const {closePosition}=await import('../src/features/competitions/engine.ts');
  const lobby=arena(), quotes={BTCUSDT:quote(100,lobby.start)}, opened=openFor(player(),'BTCUSDT','Long',300,2,settings,quotes,{now:lobby.start,id:1});
  const closed=closePosition(opened,opened.positions[0],'Test close',100,lobby.start+10000);
  assert.equal(eligibilityFor(closed,1000).used,300);
  const normal=planParticipation(player(),lobby,lobby.start+20000,BOT_POLICIES.MomentumX,2,1000);
  const loss=planParticipation({...player(),balance:700},lobby,lobby.start+20000,BOT_POLICIES.MomentumX,2,700);
  assert.ok(loss.margin<normal.margin);assert.ok(normal.margin+normal.margin*2*.0005<=1000);
});
test('legacy or corrupted optional bot metadata is safely bounded without removing financial trades', async () => {
  const {trimBotTradeMetadata,restoreBotState}=await import('../src/features/competitions/bot-state.ts');
  const trade={...position('trend'),exit:101,pnl:4.5,fee:.25,closed:1010000,reason:'test'};
  const bounded=trimBotTradeMetadata(Array.from({length:100},(_,i)=>({...trade,id:i})));
  assert.equal(bounded.length,100);assert.equal(bounded[0].botEntry.kind,'trend');assert.equal(bounded[99].botEntry,undefined);assert.equal(bounded[99].pnl,4.5);
  assert.deepEqual(restoreBotState({version:9,decisions:[null]},1000),newBotState(1000));
  assert.equal(restoreBotState({version:1,lastDecisionAt:1000,nextDecisionAt:1e99},1000).nextDecisionAt,61000);
});
test('short arenas with cold history still use real signals and retain natural misses', () => {
  const lobby=simulateArena({duration:1,warmup:false,scenario:'trend',difficulty:'Hard'});
  assert.ok(lobby.players.some(p=>!p.isUser&&p.trades.length));
  assert.ok(lobby.players.filter(p=>!p.isUser).every(p=>p.trades.every(t=>t.opened>=lobby.start+16000)));
});
