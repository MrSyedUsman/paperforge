import { grossPnl, tradingFee } from '@paperforge/simulation';
import type { Market, Quote } from '../../lib/market-data/markets.ts';
import { positionQuantity } from '../../lib/simulation/trading.ts';
import type { Lobby, Player, Event, Settings } from './types.ts';
import type { BotState, BotDecision, BotDecisionRecord, PriceHistory } from './bot-types.ts';
import { BOT_POLICIES, cadenceMs, seededRandom, type BotPolicy } from './bot-profiles.ts';
import { newBotState, trimBotTradeMetadata } from './bot-state.ts';
import { freshQuote, observedPrices } from './bot-history.ts';
import { signalsFor, type Signals } from './bot-signals.ts';
import { classifyRegime, updateRegime, entrySignal, entryContext, exitDecision } from './bot-strategies.ts';
import { planParticipation } from './bot-participation.ts';
import { closePosition, openFor, pricesFor, equityFor, rankPlayers, liquidatePosition } from './engine.ts';
import { MAJORS } from './constants.ts';
export function allowedBotMarkets(markets: Market[], settings?: Settings): Market[] {
  return markets.filter(m => m.status === 'TRADING' && (!settings || settings.marketMode !== 'custom' ? MAJORS.includes(m.pair) : settings.custom.includes(m.pair))).slice(0, 30);
}
const limitations = ['Signals use sampled prices, not candle patterns or interval volume.'];
function hold(reason: string, signals: Record<string, number> = {}, missing: string[] = []): BotDecision { return { action: 'hold', reason, signals, limitations: [...limitations, ...missing] }; }
function decide(player: Player, state: BotState, lobby: Lobby, markets: Market[], quotes: Record<string, Quote>, signals: Map<string, Signals>, now: number, policy: BotPolicy, random: () => number): BotDecision {
  const duration = lobby.end - lobby.start;
  if (!markets.some(m => freshQuote(quotes[m.pair], now))) return hold('No fresh allowed-market quote is available', {}, ['Entries and exits wait for fresh quotes.']);
  for (const position of player.positions) {
    if (!freshQuote(quotes[position.pair], now)) continue;
    const close = exitDecision(position, signals.get(position.pair) || null, pricesFor(quotes, position.pair), now, policy, state, duration);
    if (close) return close;
  }
  if (now < state.cooldownUntil) return hold('Entry cooldown after the previous exit');
  const basePlan = planParticipation(player, lobby, now, policy, Math.min(policy.leverage, lobby.settings.maxLeverage), equityFor(player, quotes));
  if (!basePlan.entryAllowed) return hold(lobby.end - now < 12_000 ? 'Too little time remains for a meaningful entry' : 'Exposure, balance or position capacity prevents another entry');
  const candidates = markets.flatMap(market => {
    const signal = signals.get(market.pair);
    if (!signal || !freshQuote(quotes[market.pair], now)) return [];
    if (player.positions.some(p => p.pair === market.pair) && (!lobby.settings.repeats || policy.kind === 'conservative')) return [];
    if (policy.kind === 'adaptive' && (market.pair !== state.regimePair || classifyRegime(signal) !== state.regime)) return [];
    const found = entrySignal(policy.kind, signal, lobby.settings.difficulty, basePlan.behind, state.regime);
    const volume = quotes[market.pair]?.volume;
    const liquidityTieBreak = policy.kind === 'volatility' && Number.isFinite(volume) && volume > 0 ? Math.min(.02, Math.log10(Math.max(1, volume)) * .001) : 0;
    return found ? [{ market, signal, found, score: found.strength + liquidityTieBreak + random() * .01 }] : [];
  }).sort((a, b) => b.score - a.score || a.market.pair.localeCompare(b.market.pair));
  if (!candidates.length) return hold(signals.size ? 'No fee-aware signal matches this bot speciality' : 'Sampled-price history is warming up', {}, signals.size ? [] : ['Not enough contiguous sampled-price observations for entry.']);
  if (lobby.settings.difficulty === 'Easy' && random() < .15) return hold('Easy bot waits for another observation before committing', candidates[0].signal.evidence);
  for (const { market, signal, found } of candidates) {
    const volatilityScale = policy.kind === 'volatility' ? Math.max(.4, 1 - signal.volatility * 2) : 1;
    const discipline = lobby.settings.difficulty === 'Easy' ? .8 : lobby.settings.difficulty === 'Expert' ? .9 : 1;
    const leverage = Math.max(1, Math.min(lobby.settings.maxLeverage, Math.floor(policy.leverage * volatilityScale * discipline)));
    const plan = planParticipation(player, lobby, now, policy, leverage, equityFor(player, quotes));
    const margin = policy.kind === 'volatility' ? Math.min(plan.margin, lobby.settings.allocation * policy.maxMargin * volatilityScale) : plan.margin;
    const quantity = positionQuantity(margin * leverage, pricesFor(quotes, market.pair), market);
    if (margin <= 0 || margin + tradingFee(margin * leverage) > player.balance || market.minNotional && margin * leverage < market.minNotional || !quantity || market.minQty && quantity < market.minQty || market.maxQty && quantity > market.maxQty) continue;
    const evidence = policy.kind === 'volatility' && Number.isFinite(quotes[market.pair]?.volume) ? { ...signal.evidence, liquidityQuoteVolume24h: quotes[market.pair].volume } : signal.evidence;
    return { action: 'open', pair: market.pair, side: found.side, margin, leverage, reason: found.reason, signals: evidence, entry: { ...entryContext(policy.kind, found, signal, now), signals: evidence }, limitations };
  }
  return hold('Market quantity, fee or balance constraints prevent entry');
}
/** Pure state transition. The committed next-decision timestamp prevents duplicate decisions on rerender/reload. */
export function runBotRound(lobby: Lobby, history: PriceHistory, markets: Market[], quotes: Record<string, Quote>, now: number, live: boolean): Lobby {
  if (!live || lobby.status !== 'active' || now < lobby.start || now >= lobby.end) return lobby;
  const allowed = allowedBotMarkets(markets, lobby.settings), shortArena = lobby.end - lobby.start <= 120_000;
  const signals = new Map<string, Signals>();
  for (const market of allowed) { const s = signalsFor(observedPrices(history, market.pair, now), shortArena); if (s && freshQuote(quotes[market.pair], now)) signals.set(market.pair, s); }
  let changed = lobby.botHistory !== history;
  let events: Event[] = lobby.events;
  const players = lobby.players.map((original, index) => {
    if (original.isUser || original.status !== 'active') return original;
    const policy = BOT_POLICIES[original.name];
    if (!policy) return original;
    let player = original, state: BotState = original.botState?.version === 1 && original.botState.lastDecisionAt <= now ? original.botState : newBotState(lobby.settings.allocation);
    const log = (decision: BotDecision, adjustment: string): BotDecisionRecord => {
      const progress = planParticipation(player, lobby, now, policy, policy.leverage);
      return { at: now, action: decision.action, ...('pair' in decision ? { pair: decision.pair } : {}), reason: decision.reason, signals: decision.signals, usedMargin: progress.used, requiredMargin: progress.required, adjustment, limitations: decision.limitations, version: 1 };
    };
    const addEvent = (text: string, tone: Event['tone'] = 'info') => { events = [{ id: now + (index + 1) / 100 + events.length / 10000, at: now, text, tone }, ...events].slice(0, 80); };
    for (const position of original.positions) {
      if (!freshQuote(quotes[position.pair], now)) continue;
      const mark = pricesFor(quotes, position.pair);
      if (position.side === 'Long' ? mark <= position.liquidation : mark >= position.liquidation) {
        const decision: BotDecision = { action: 'close', positionId: position.id, pair: position.pair, reason: 'Liquidation exhausted isolated margin', signals: { mark, liquidationPrice: position.liquidation }, limitations };
        const record = log(decision, 'Liquidation follows the unchanged competition engine.');
        player = liquidatePosition(player, position, now);
        player = { ...player, trades: player.trades.map((t, i) => i === 0 ? { ...t, botExit: record } : t) };
        state = { ...state, decisions: [...state.decisions, record].slice(-24), cooldownUntil: now + 6000 };
        addEvent(`${player.name} liquidated ${position.pair}: isolated margin exhausted`, 'down'); changed = true;
      }
    }
    if (lobby.settings.elimination && equityFor(player, quotes) <= 1) { changed = true; return { ...player, botState: state, status: 'eliminated' as const }; }
    if (now < state.nextDecisionAt || state.lastDecisionAt === now) return player === original ? original : { ...player, botState: state };
    const equity = equityFor(player, quotes), bestNet: Record<string, number> = {};
    for (const pos of player.positions) {
      if (!freshQuote(quotes[pos.pair], now)) { bestNet[String(pos.id)] = state.bestNet[String(pos.id)] || 0; continue; }
      const net = grossPnl(pos.size, pos.entry, pricesFor(quotes, pos.pair), pos.side) - pos.openFee - tradingFee(pos.size);
      bestNet[String(pos.id)] = Math.max(0, state.bestNet[String(pos.id)] || 0, net);
    }
    state = { ...state, bestNet, peakEquity: Math.max(state.peakEquity, equity) };
    if (policy.kind === 'adaptive') {
      const heldPair = player.positions[0]?.pair || state.regimePair;
      const basis = heldPair ? (signals.has(heldPair) ? [heldPair, signals.get(heldPair)!] as const : undefined) : [...signals.entries()].sort(([a, x], [b, y]) => (Math.abs(y.longReturn) + y.rangeWidth) - (Math.abs(x.longReturn) + x.rangeWidth) || a.localeCompare(b))[0];
      if (basis) {
        const [pair, marketSignal] = basis;
        if (state.regimePair !== pair) state = { ...state, regimePair: pair, regime: 'uncertain', regimeSince: now, candidateRegime: 'uncertain', candidateSince: now };
        state = updateRegime(state, classifyRegime(marketSignal), now, shortArena);
      }
    }
    // Reduce conservative exposure after drawdown from its peak, not just after a below-allocation balance.
    const conservativeDrawdown = policy.kind === 'conservative' ? Math.max(.3, equity / Math.max(lobby.settings.allocation, state.peakEquity)) : 1;
    const effectivePolicy = conservativeDrawdown < 1 ? { ...policy, normalMargin: policy.normalMargin * conservativeDrawdown, maxMargin: policy.maxMargin * conservativeDrawdown, totalMargin: policy.totalMargin * conservativeDrawdown } : policy;
    const random = seededRandom(`${lobby.start}:${player.id}:${state.sequence}`);
    const decision = decide(player, state, lobby, allowed, quotes, signals, now, effectivePolicy, random);
    const plan = planParticipation(player, lobby, now, effectivePolicy, policy.leverage, equityFor(player, quotes));
    const record = log(decision, plan.adjustment);
    if (decision.action === 'open') {
      const next = openFor(player, decision.pair, decision.side, decision.margin, decision.leverage, lobby.settings, quotes, { now, id: now + (index + 1) / 100 });
      if (next !== player) {
        player = { ...next, positions: next.positions.map((p, i) => i === 0 ? { ...p, botEntry: decision.entry } : p) };
        addEvent(`${player.name} opened ${decision.side} ${decision.pair} at ${decision.leverage}x: ${decision.reason}${plan.margin > lobby.settings.allocation * effectivePolicy.normalMargin + .01 ? ' (participation sizing adjusted)' : ''}`);
      }
    } else if (decision.action === 'close') {
      const position = player.positions.find(p => p.id === decision.positionId);
      if (position) {
        const next = closePosition(player, position, decision.reason, pricesFor(quotes, position.pair), now);
        player = { ...next, trades: next.trades.map((t, i) => i === 0 ? { ...t, botExit: record } : t) };
        state = { ...state, cooldownUntil: now + Math.max(2000, Math.min(15_000, (lobby.end - lobby.start) * policy.cooldownFraction)) };
        addEvent(`${player.name} closed ${position.pair}: ${decision.reason}`, player.realized >= original.realized ? 'up' : 'down');
      }
    }
    const interval = cadenceMs(lobby.settings.difficulty, lobby.end - lobby.start, policy);
    state = { ...state, sequence: state.sequence + 1, lastDecisionAt: now, nextDecisionAt: now + Math.max(1500, Math.round(interval * (plan.behind && policy.kind !== 'conservative' ? .85 : 1))), decisions: [...state.decisions, record].slice(-24) };
    changed = true;
    const trades = trimBotTradeMetadata(player.trades);
    return { ...player, trades, botState: state };
  });
  return changed ? { ...lobby, botHistory: history, players: rankPlayers(players, quotes), events } : lobby;
}
