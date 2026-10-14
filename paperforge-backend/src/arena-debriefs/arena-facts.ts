import { createHash } from 'node:crypto';
import {
  competitionEligibility,
  roundMoney,
  tradingFee,
  grossPnl,
  settleIsolatedLiquidation,
  calculateLiquidationPrice,
} from '@paperforge/simulation';
import { BOT_CATALOG, BOT_REASON_CODES } from '@paperforge/simulation/bots';
import {
  validateArenaSnapshot,
  invalid,
  type ArenaSnapshot,
  type ArenaTrade,
} from './arena-input.js';
export type ArenaFact = {
  id: string;
  label: string;
  value: string;
  participantId?: string;
  tradeId?: number;
  source: 'calculated' | 'recorded' | 'limitation';
};
export type TradeMetric = {
  id: number;
  pair: string;
  side: string;
  leverage: number;
  margin: number;
  gross: number;
  net: number | null;
  fees: number | null;
  liquidated: boolean;
  opened: number;
  closed: number;
};
export type ParticipantMetric = {
  id: string;
  name: string;
  isUser: boolean;
  style: string;
  equity: number;
  equityChange: number;
  tradingNet: number | null;
  fees: number | null;
  usedMargin: number;
  requiredMargin: number;
  eligible: boolean;
  trades: number;
  liquidations: number;
  averageLeverage: number | null;
  rawRank: number | null;
  awardedRank: number | null;
  reconciled: boolean;
  forfeited: number | null;
};
export type ArenaFacts = {
  arenaKey: string;
  fingerprint: string;
  completionReason: ArenaSnapshot['completionReason'];
  allocation: number;
  userId: string;
  winnerId: string | null;
  outcome: string;
  participants: ParticipantMetric[];
  mirror: {
    participantId: string;
    selection: string;
    speciality: string;
    looksFor: string;
    recordedReason: string | null;
    recordedAt: number | null;
  } | null;
  highlight: {
    participantId: string;
    selection: string;
    trade: TradeMetric;
  } | null;
  highlightUnavailable: string | null;
  facts: ArenaFact[];
  promptEvidenceIds: string[];
  limitations: string[];
};
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
const closeEnough = (a: number, b: number) => Math.abs(a - b) <= 0.011;
const prefix = (id: string) => id.replaceAll('-', '_');
export function tradeMetric(
  t: ArenaTrade,
): TradeMetric & { walletDelta: number | null } {
  const liquidated = t.reason === 'liquidation';
  const liquidationPrice = calculateLiquidationPrice({
    entry: t.entry,
    side: t.side,
    margin: t.margin,
    notional: t.size,
    maintenanceMarginRate: t.maintenanceMarginRate,
    liquidationFeeRate: t.liquidationFeeRate,
  });
  const settlement = settleIsolatedLiquidation({
    margin: t.margin,
    notional: t.size,
    openFee: t.openFee ?? 0,
    liquidationPrice,
    liquidationFeeRate: t.liquidationFeeRate,
  });
  const expectedFee = liquidated
    ? settlement.liquidationFee
    : tradingFee(t.size);
  if (
    (t.openFee !== null && !closeEnough(t.openFee, tradingFee(t.size))) ||
    (t.fee !== null && !closeEnough(t.fee, expectedFee))
  )
    return invalid('Recorded trade fees contradict the simulation formulas.');
  if (
    liquidated &&
    Math.abs(t.exit - liquidationPrice) >
      Math.max(1e-8, t.entry * 1e-8, (t.entry * 0.00500001) / t.size)
  )
    return invalid(
      'Liquidation exit contradicts the recorded rates and threshold.',
    );
  const rawGross = liquidated
    ? -t.margin + settlement.liquidationFee
    : grossPnl(t.size, t.entry, t.exit, t.side);
  const fees =
    t.openFee === null || t.fee === null ? null : roundMoney(t.openFee + t.fee);
  const net =
    fees === null
      ? null
      : liquidated
        ? settlement.netPnl
        : roundMoney(rawGross - fees);
  if (net !== null && t.pnl !== null && !closeEnough(net, t.pnl))
    return invalid('Recorded trade PnL contradicts its entry, exit and fees.');
  const walletDelta =
    fees === null
      ? null
      : liquidated
        ? -t.margin - t.openFee!
        : roundMoney(rawGross - t.fee!) - t.openFee!;
  return {
    id: t.id,
    pair: t.pair,
    side: t.side,
    leverage: t.lev,
    margin: t.margin,
    gross: roundMoney(rawGross),
    net,
    fees,
    liquidated,
    opened: t.opened,
    closed: t.closed,
    walletDelta,
  };
}
export function calculateArenaFacts(input: unknown): {
  snapshot: ArenaSnapshot;
  facts: ArenaFacts;
} {
  const snapshot = validateArenaSnapshot(input),
    allocation = snapshot.settings.allocation;
  const limitations = [
    'Browser-submitted competition records and bot decisions are unverified simulation data; internal consistency is not account verification.',
    'A single arena does not establish consistent skill. No market path, drawdown, missed-opportunity or causal strategy claims can be established from this summary.',
    'Activity events are not a complete chronology. Older bot signal metadata may have been discarded; missing decisions are not reconstructed.',
    'Legacy trades without recorded liquidation rates use simulator defaults. Liquidation threshold checks allow the rounding range of stored cent-based margins. Fees and isolated liquidation follow the simulator. Liquidation fees are inside exhausted margin. Rewards and the normal-trading wallet are excluded.',
  ];
  if (snapshot.completionReason === 'unknown')
    limitations.push(
      'The legacy completion type is unavailable; an awarded outcome cannot be verified.',
    );
  const trades = new Map<string, ReturnType<typeof tradeMetric>[]>();
  const participants: ParticipantMetric[] = snapshot.players.map((p) => {
    const rows = p.trades.map(tradeMetric);
    trades.set(p.id, rows);
    const complete = rows.every(
      (t) => t.net !== null && t.fees !== null && t.walletDelta !== null,
    );
    const net = complete
      ? roundMoney(rows.reduce((s, t) => s + t.net!, 0))
      : null;
    const fees = complete
      ? roundMoney(rows.reduce((s, t) => s + t.fees!, 0))
      : null;
    if (net !== null && p.realized !== null && !closeEnough(net, p.realized))
      return invalid(
        'Participant realized PnL contradicts the complete trade ledger.',
      );
    if (fees !== null && p.fees !== null && !closeEnough(fees, p.fees))
      return invalid('Participant fee total contradicts its trade ledger.');
    const expected = complete
      ? roundMoney(allocation + rows.reduce((s, t) => s + t.walletDelta!, 0))
      : null;
    const abandoned = snapshot.completionReason === 'abandonment' && p.isUser;
    const eliminatedAdjustment =
      !abandoned &&
      p.status === 'eliminated' &&
      p.balance === 0 &&
      expected !== null &&
      expected >= -0.01 &&
      expected <= 1;
    if (
      expected !== null &&
      !abandoned &&
      !eliminatedAdjustment &&
      !closeEnough(expected, p.balance)
    )
      return invalid(
        'Final balance does not reconcile with the complete trade ledger.',
      );
    const progress = competitionEligibility(
      rows.length,
      rows.reduce((sum, t) => sum + t.margin, 0),
      allocation,
    );
    const bot = p.isUser
      ? null
      : BOT_CATALOG.find((b) => b.name === p.botName)!;
    return {
      id: p.id,
      name: bot?.name ?? 'You',
      isUser: p.isUser,
      style: bot?.style ?? 'Manual trader',
      equity: p.balance,
      equityChange: roundMoney(p.balance - allocation),
      tradingNet: net,
      fees,
      usedMargin: progress.used,
      requiredMargin: progress.required,
      eligible: progress.eligible,
      trades: rows.length,
      liquidations: rows.filter((t) => t.liquidated).length,
      averageLeverage: rows.length
        ? roundMoney(rows.reduce((s, t) => s + t.leverage, 0) / rows.length)
        : null,
      rawRank: null,
      awardedRank: null,
      reconciled: complete,
      forfeited: abandoned ? expected : eliminatedAdjustment ? expected : 0,
    };
  });
  function compare(
    a: ParticipantMetric,
    b: ParticipantMetric,
    abandon = false,
  ): number | null {
    if (a.equity !== b.equity) return b.equity - a.equity;
    const ar = snapshot.players.find((p) => p.id === a.id)!,
      br = snapshot.players.find((p) => p.id === b.id)!;
    if (!abandon) {
      for (const [av, bv, descending] of [
        [a.tradingNet ?? ar.realized, b.tradingNet ?? br.realized, true],
        [a.fees ?? ar.fees, b.fees ?? br.fees, false],
        [ar.achieved, br.achieved, false],
      ] as const) {
        if (av === null || bv === null) return null;
        if (av !== bv) return descending ? bv - av : av - bv;
      }
    }
    return ar.order - br.order;
  }
  function rank(
    p: ParticipantMetric,
    rows: ParticipantMetric[],
    cmp: (a: ParticipantMetric, b: ParticipantMetric) => number | null,
  ): number | null {
    const comparisons = rows.filter((r) => r.id !== p.id).map((r) => cmp(r, p));
    return comparisons.some((v) => v === null)
      ? null
      : 1 + comparisons.filter((v) => v! < 0).length;
  }
  const abandoned = snapshot.completionReason === 'abandonment',
    known = snapshot.completionReason !== 'unknown';
  for (const p of participants) {
    p.rawRank = rank(p, participants, (a, b) => compare(a, b));
    p.awardedRank = known
      ? abandoned
        ? p.isUser
          ? participants.length
          : rank(
              p,
              participants.filter((r) => !r.isUser),
              (a, b) => compare(a, b, true),
            )
        : p.eligible
          ? rank(
              p,
              participants.filter((r) => r.eligible),
              (a, b) => compare(a, b),
            )
          : null
      : null;
    const reported = snapshot.players.find((r) => r.id === p.id)!.rank;
    const fullRank = known
      ? abandoned
        ? p.awardedRank
        : rank(
            p,
            participants,
            (a, b) => Number(b.eligible) - Number(a.eligible) || compare(a, b),
          )
      : null;
    if (reported !== null && fullRank !== null && reported !== fullRank)
      return invalid(
        'Recorded standings contradict the competition ranking rules.',
      );
  }
  const user = participants.find((p) => p.isUser)!;
  const winner = known
    ? (participants.find(
        (p) => p.awardedRank === 1 && (abandoned ? !p.isUser : p.eligible),
      ) ?? null)
    : null;
  const bots = participants.filter((p) => !p.isUser);
  const eligibleBots = bots.filter((p) => p.eligible),
    pool = eligibleBots.length ? eligibleBots : bots;
  const byRank = user.rawRank !== null && pool.every((p) => p.rawRank !== null);
  const distance = (p: ParticipantMetric) =>
    Math.abs(byRank ? p.rawRank! - user.rawRank! : p.equity - user.equity);
  const mirrorBot =
    [...pool].sort(
      (a, b) =>
        distance(a) - distance(b) ||
        Math.abs(a.equity - user.equity) - Math.abs(b.equity - user.equity) ||
        a.id.localeCompare(b.id),
    )[0] ?? null;
  const botDescription = mirrorBot
    ? BOT_CATALOG.find((b) => b.name === mirrorBot.name)!
    : null;
  const recordedDecision = mirrorBot
    ? snapshot.players.find((p) => p.id === mirrorBot.id)!.decision
    : null;
  const mirror =
    mirrorBot && botDescription
      ? {
          participantId: mirrorBot.id,
          selection: `${eligibleBots.length ? 'Nearest eligible bot' : 'No bot qualified; nearest bot'} by ${byRank ? 'equity placement' : 'equity gap because tied placements are unavailable'}; equity gap and identity break selection ties.`,
          speciality: botDescription.speciality,
          looksFor: botDescription.looksFor,
          recordedReason: recordedDecision
            ? BOT_REASON_CODES[recordedDecision.reasonCode]
            : null,
          recordedAt: recordedDecision?.at ?? null,
        }
      : null;
  const userTrades = trades.get(user.id)!;
  const candidates = userTrades.filter((t) => t.net !== null);
  const selected = [...candidates].sort((a, b) => {
    const priority = (t: typeof a) =>
      t.liquidated ? 0 : t.gross > 0 && t.net! <= 0 ? 1 : t.net! < 0 ? 2 : 3;
    return (
      priority(a) - priority(b) ||
      Math.abs(b.net!) - Math.abs(a.net!) ||
      a.closed - b.closed ||
      a.id - b.id
    );
  })[0];
  const highlight = selected
    ? {
        participantId: user.id,
        selection: selected.liquidated
          ? 'Liquidation with the largest absolute net result'
          : selected.gross > 0 && selected.net! <= 0
            ? 'Positive gross result outweighed by fees'
            : selected.net! < 0
              ? 'Largest recorded net loss'
              : 'Largest absolute recorded net result',
        trade: selected as TradeMetric,
      }
    : null;
  const highlightUnavailable = highlight
    ? null
    : userTrades.length
      ? 'Required trade fees are missing, so no fully grounded trade highlight is available.'
      : 'No user trade was opened; participation is the useful learning focus.';
  if (participants.some((p) => !p.reconciled))
    limitations.push(
      'Some legacy trade fees are missing. Their net trading PnL and fee totals are unavailable; final equity is reported rather than fully reconciled.',
    );
  if (participants.some((p) => p.rawRank === null))
    limitations.push(
      'A tied result lacks a recorded tie-break value; affected placements cannot be verified.',
    );
  const outcome = abandoned
    ? 'Abandoned'
    : !known
      ? 'Completion type unavailable'
      : !winner
        ? participants.some((p) => p.eligible)
          ? 'Awarded winner unavailable'
          : 'No eligible winner'
        : !user.eligible
          ? 'Not winner-eligible'
          : winner.id === user.id
            ? 'Awarded winner'
            : 'Eligible finisher';
  const facts: ArenaFact[] = [
    {
      id: 'arena_outcome',
      label: 'Competition outcome',
      value: outcome,
      source: 'calculated',
    },
    {
      id: 'arena_completion',
      label: 'Completion type',
      value: snapshot.completionReason,
      source: 'recorded',
    },
    {
      id: 'arena_allocation',
      label: 'Starting allocation per participant',
      value: money(allocation),
      source: 'recorded',
    },
    {
      id: 'arena_winner',
      label: abandoned ? 'Winner by abandonment' : 'Awarded winner',
      value: winner?.name ?? (known ? 'None verified' : 'Unavailable'),
      source: 'calculated',
    },
  ];
  for (const p of participants) {
    const add = (
      key: string,
      label: string,
      value: string,
      source: ArenaFact['source'] = 'calculated',
    ) =>
      facts.push({
        id: `${prefix(p.id)}_${key}`,
        participantId: p.id,
        label: `${p.name}: ${label}`,
        value,
        source,
      });
    add(
      'equity',
      p.reconciled ? 'Final equity' : 'Reported final equity',
      money(p.equity),
      p.reconciled ? 'calculated' : 'recorded',
    );
    add(
      'equityReturn',
      'Arena equity return (includes any forfeiture)',
      `${roundMoney((p.equityChange / allocation) * 100)}%`,
    );
    add(
      'netReturn',
      'Net trading return on starting allocation',
      p.tradingNet === null
        ? 'Unavailable'
        : `${roundMoney((p.tradingNet / allocation) * 100)}%`,
    );
    add(
      'net',
      'Net trading PnL',
      p.tradingNet === null ? 'Unavailable' : money(p.tradingNet),
    );
    add(
      'fees',
      'Entry + closing fees',
      p.fees === null ? 'Unavailable' : money(p.fees),
    );
    add(
      'margin',
      'Cumulative qualifying margin',
      `${money(p.usedMargin)} / ${money(p.requiredMargin)}`,
    );
    add('eligibility', 'Winner eligibility', p.eligible ? 'Met' : 'Not met');
    add('trades', 'Opened trades', String(p.trades));
    add('liquidations', 'Liquidations', String(p.liquidations));
    add(
      'leverage',
      'Average recorded leverage',
      p.averageLeverage === null ? 'No trades' : `${p.averageLeverage}x`,
    );
    add(
      'rawRank',
      'Equity placement',
      p.rawRank === null ? 'Unverified tie' : `#${p.rawRank}`,
    );
    add(
      'awardedRank',
      abandoned
        ? 'Recorded abandonment placement'
        : 'Placement among eligible participants',
      p.awardedRank === null
        ? 'Not awarded / unavailable'
        : `#${p.awardedRank}`,
    );
    if (p.forfeited !== null && p.forfeited > 0)
      add(
        'forfeiture',
        'Wallet forfeiture / elimination adjustment',
        money(p.forfeited),
      );
  }
  if (highlight) {
    const t = highlight.trade;
    for (const [key, label, value] of [
      [
        'gross',
        t.liquidated ? 'Gross settlement before fees' : 'Gross PnL',
        money(t.gross),
      ],
      ['fees', 'Opening + closing fees', money(t.fees!)],
      ['net', 'Net result', money(t.net!)],
      ['margin', 'Isolated margin', money(t.margin)],
      ['leverage', 'Recorded leverage', `${t.leverage}x`],
    ])
      facts.push({
        id: `highlight_${key}`,
        label: `Selected user trade: ${label}`,
        value,
        tradeId: t.id,
        participantId: user.id,
        source: 'calculated',
      });
  }
  if (mirror) {
    facts.push({
      id: 'mirror_style',
      participantId: mirror.participantId,
      label: 'Bot mirror: configured speciality',
      value: mirror.speciality,
      source: 'recorded',
    });
    facts.push({
      id: 'mirror_decision',
      participantId: mirror.participantId,
      label: 'Available recorded entry reason',
      value:
        mirror.recordedReason ?? 'No retained entry explanation is available.',
      source: mirror.recordedReason ? 'recorded' : 'limitation',
    });
  }
  limitations.forEach((value, index) =>
    facts.push({
      id: `limitation_${index + 1}`,
      label: 'Evidence limitation',
      value,
      source: 'limitation',
    }),
  );
  const ids = new Set([
    'user',
    ...(mirror ? [mirror.participantId] : []),
    ...(winner ? [winner.id] : []),
  ]);
  const promptEvidenceIds = facts
    .filter((f) => !f.participantId || ids.has(f.participantId))
    .map((f) => f.id);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');
  return {
    snapshot,
    facts: {
      arenaKey: `${snapshot.start}:${snapshot.end}`,
      fingerprint,
      completionReason: snapshot.completionReason,
      allocation,
      userId: user.id,
      winnerId: winner?.id ?? null,
      outcome,
      participants,
      mirror,
      highlight,
      highlightUnavailable,
      facts,
      promptEvidenceIds,
      limitations,
    },
  };
}
