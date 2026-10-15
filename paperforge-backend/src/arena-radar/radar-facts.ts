import { createHash } from 'node:crypto';
import {
  competitionEligibility,
  roundMoney,
  tradingFee,
  grossPnl,
  LIVE_PRICE_MAX_AGE_MS,
  compareCompetitionScores,
} from '@paperforge/simulation';
import { BOT_CATALOG, BOT_REASON_CODES } from '@paperforge/simulation/bots';
import {
  validateArenaSnapshot,
  invalid,
  type ArenaSnapshot,
} from '../arena-debriefs/arena-input.js';
import { tradeMetric, type ArenaFact } from '../arena-debriefs/arena-facts.js';
export type RadarSnapshot = {
  arena: ArenaSnapshot;
  at: number;
  marks: { pair: string; price: number; timestamp: number }[];
};
export type RadarPlayer = {
  id: string;
  name: string;
  speciality: string;
  freeBalance: number;
  reservedMargin: number;
  unrealized: number | null;
  equity: number | null;
  realizedNet: number | null;
  fees: number | null;
  exposure: number;
  averageLeverage: number | null;
  opened: number;
  closed: number;
  liquidations: number;
  usedMargin: number;
  requiredMargin: number;
  eligible: boolean;
  rank: number | null;
  achieved: number | null;
  order: number;
};
export type RadarFacts = {
  arenaKey: string;
  fingerprint: string;
  previousFingerprint: string | null;
  at: number;
  end: number;
  remainingMs: number;
  comparison: boolean;
  comparisonNote: string;
  headline: { kind: string; title: string; evidenceIds: string[] };
  opponentId: string;
  topic: string;
  players: RadarPlayer[];
  facts: ArenaFact[];
  limitations: string[];
};
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function obj(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    return invalid('Unexpected or invalid radar fields.');
  return value as Record<string, unknown>;
}
export function validateRadarSnapshot(
  value: unknown,
  live: boolean,
  now = Date.now(),
): RadarSnapshot {
  const s = obj(value, ['arena', 'at', 'marks']);
  if (
    typeof s.at !== 'number' ||
    !Number.isFinite(s.at) ||
    s.at > now + 5000 ||
    (live && now - s.at > LIVE_PRICE_MAX_AGE_MS)
  )
    return invalid(
      'The radar snapshot is unavailable or too old. Capture a fresh update.',
    );
  const at = s.at;
  const arena = validateArenaSnapshot(s.arena, now, at);
  if (
    arena.players.some((p) =>
      p.trades.some((t) => !['normal', 'liquidation'].includes(t.reason)),
    )
  )
    return invalid('An active arena cannot contain final settlement records.');
  if (
    s.at < arena.start ||
    s.at >= arena.end ||
    (live && now >= arena.end) ||
    arena.finalized !== null ||
    arena.completionReason !== 'unknown'
  )
    return invalid('Radar requires an active, unfinished arena.');
  if (
    arena.players.some(
      (p) =>
        p.trades.some((t) => t.closed > at) ||
        (p.achieved !== null && p.achieved > at + 1000),
    )
  )
    return invalid('Arena records occur after the snapshot.');
  if (!Array.isArray(s.marks) || s.marks.length > 30)
    return invalid('Too many radar marks.');
  const required = new Set(
    arena.players.flatMap((p) => p.positions.map((pos) => pos.pair)),
  );
  const marks = s.marks
    .map((value) => {
      const m = obj(value, ['pair', 'price', 'timestamp']);
      if (
        typeof m.pair !== 'string' ||
        !required.has(m.pair) ||
        typeof m.price !== 'number' ||
        !Number.isFinite(m.price) ||
        m.price <= 0 ||
        m.price > 1e9 ||
        typeof m.timestamp !== 'number' ||
        !Number.isFinite(m.timestamp) ||
        m.timestamp < 0 ||
        m.timestamp > at + 1000
      )
        return invalid('Invalid radar mark.');
      return { pair: m.pair, price: m.price, timestamp: m.timestamp };
    })
    .sort((a, b) => a.pair.localeCompare(b.pair));
  if (new Set(marks.map((m) => m.pair)).size !== marks.length)
    return invalid('Duplicate radar marks.');
  return { arena, at: s.at, marks };
}
function metrics(s: RadarSnapshot): RadarPlayer[] {
  const allocation = s.arena.settings.allocation;
  return s.arena.players.map((p) => {
    const rows = p.trades.map(tradeMetric),
      complete =
        rows.every((t) => t.net !== null && t.fees !== null) &&
        p.positions.every((pos) => pos.openFee !== null);
    for (const pos of p.positions)
      if (
        pos.openFee !== null &&
        Math.abs(pos.openFee - tradingFee(pos.size)) > 0.011
      )
        return invalid('Position opening fee contradicts the simulator.');
    if (complete) {
      const intervals = [
        ...p.trades.map((t, index) => ({
          opened: t.opened,
          closed: t.closed,
          margin: t.margin,
          openFee: t.openFee!,
          delta: rows[index].walletDelta!,
        })),
        ...p.positions.map((t) => ({
          opened: t.opened,
          closed: Infinity,
          margin: t.margin,
          openFee: t.openFee!,
          delta: 0,
        })),
      ];
      for (const at of new Set(intervals.map((t) => t.opened))) {
        const settled = intervals
            .filter((t) => t.closed <= at)
            .reduce((n, t) => n + t.delta, 0),
          committed = intervals
            .filter((t) => t.opened <= at && t.closed > at)
            .reduce((n, t) => n + t.margin + t.openFee, 0);
        if (allocation + settled - committed < -0.021)
          return invalid(
            'Recorded position openings exceed available simulation funds.',
          );
      }
    }
    const realizedNet = rows.every((t) => t.net !== null)
      ? roundMoney(rows.reduce((n, t) => n + t.net!, 0))
      : null;
    const fees = complete
      ? roundMoney(
          rows.reduce((n, t) => n + t.fees!, 0) +
            p.positions.reduce((n, t) => n + t.openFee!, 0),
        )
      : null;
    if (
      (realizedNet !== null &&
        p.realized !== null &&
        Math.abs(realizedNet - p.realized) > 0.011) ||
      (fees !== null && p.fees !== null && Math.abs(fees - p.fees) > 0.011)
    )
      return invalid('Recorded totals contradict the trade ledger.');
    const reservedMargin = roundMoney(
      p.positions.reduce((n, pos) => n + pos.margin, 0),
    );
    const expected = complete
      ? roundMoney(
          allocation +
            rows.reduce((n, t) => n + t.walletDelta!, 0) -
            reservedMargin -
            p.positions.reduce((n, pos) => n + pos.openFee!, 0),
        )
      : null;
    if (
      expected !== null &&
      Math.abs(expected - p.balance) > 0.011 &&
      !(
        p.status === 'eliminated' &&
        p.balance === 0 &&
        expected >= -0.01 &&
        expected <= 1
      )
    )
      return invalid('Free balance does not reconcile with arena records.');
    const fresh = p.positions.every((pos) =>
      s.marks.some(
        (m) =>
          m.pair === pos.pair && s.at - m.timestamp <= LIVE_PRICE_MAX_AGE_MS,
      ),
    );
    const unrealized = fresh
      ? roundMoney(
          p.positions.reduce(
            (n, pos) =>
              n +
              grossPnl(
                pos.size,
                pos.entry,
                s.marks.find((m) => m.pair === pos.pair)!.price,
                pos.side,
              ),
            0,
          ),
        )
      : null;
    const progress = competitionEligibility(
      rows.length + p.positions.length,
      rows.reduce((n, t) => n + t.margin, 0) + reservedMargin,
      allocation,
    );
    const bot = p.isUser
      ? null
      : BOT_CATALOG.find((b) => b.name === p.botName)!;
    return {
      id: p.id,
      name: bot?.name ?? 'You',
      speciality: bot?.speciality ?? 'Manual paper trading',
      freeBalance: p.balance,
      reservedMargin,
      unrealized,
      equity:
        unrealized === null
          ? null
          : roundMoney(p.balance + reservedMargin + unrealized),
      realizedNet,
      fees,
      exposure: roundMoney(p.positions.reduce((n, t) => n + t.size, 0)),
      averageLeverage: p.positions.length
        ? roundMoney(
            p.positions.reduce((n, t) => n + t.lev, 0) / p.positions.length,
          )
        : null,
      opened: progress.opened,
      closed: rows.length,
      liquidations: rows.filter((t) => t.liquidated).length,
      usedMargin: progress.used,
      requiredMargin: progress.required,
      eligible: progress.eligible,
      rank: null,
      achieved: p.achieved,
      order: p.order,
    };
  });
}
function comparator(a: RadarPlayer, b: RadarPlayer): number | null {
  if (a.equity === null || b.equity === null) return null;
  if (a.equity !== b.equity) return b.equity - a.equity;
  if (a.realizedNet === null || b.realizedNet === null) return null;
  if (a.realizedNet !== b.realizedNet) return b.realizedNet - a.realizedNet;
  if (a.fees === null || b.fees === null) return null;
  if (a.fees !== b.fees) return a.fees - b.fees;
  if (a.achieved === null || b.achieved === null) return null;
  return (
    compareCompetitionScores(
      {
        equity: a.equity,
        realized: a.realizedNet,
        fees: a.fees,
        achieved: a.achieved,
      },
      {
        equity: b.equity,
        realized: b.realizedNet,
        fees: b.fees,
        achieved: b.achieved,
      },
    ) || a.order - b.order
  );
}
function placements(players: RadarPlayer[]) {
  if (players.some((p) => p.equity === null)) return;
  for (const p of players) {
    const values = players
      .filter((b) => b.id !== p.id)
      .map((b) => comparator(b, p));
    p.rank = values.some((v) => v === null)
      ? null
      : 1 + values.filter((v) => v! < 0).length;
  }
}
export function calculateRadarFacts(body: unknown) {
  if (Buffer.byteLength(JSON.stringify(body) ?? '') > 1_400_000)
    return invalid('The radar request is too large.');
  const input = obj(body, ['current', 'previous']),
    current = validateRadarSnapshot(input.current, true),
    previous =
      input.previous == null
        ? null
        : validateRadarSnapshot(input.previous, false);
  const signature = (s: RadarSnapshot) =>
    hash([
      s.arena.start,
      s.arena.end,
      s.arena.settings,
      s.arena.players.map((p) => [p.id, p.botName]),
    ]);
  const compatible =
    previous !== null &&
    signature(previous) === signature(current) &&
    previous.at < current.at &&
    current.at - previous.at <= 120000 &&
    previous.arena.players.every((p) =>
      p.trades.every((t) =>
        current.arena.players
          .find((row) => row.id === p.id)
          ?.trades.some(
            (row) =>
              row.id === t.id && JSON.stringify(row) === JSON.stringify(t),
          ),
      ),
    );
  const players = metrics(current);
  placements(players);
  const checkedPrevious = previous ? metrics(previous) : null;
  const old = compatible ? checkedPrevious : null;
  if (old) placements(old);
  const user = players.find((p) => p.id === 'user')!,
    before = old?.find((p) => p.id === 'user'),
    bots = players.filter((p) => p.id !== 'user');
  const opponent = [...bots].sort((a, b) =>
    user.rank !== null && bots.every((p) => p.rank !== null)
      ? Math.abs(a.rank! - user.rank) - Math.abs(b.rank! - user.rank) ||
        a.id.localeCompare(b.id)
      : a.id.localeCompare(b.id),
  )[0];
  const leader = players.find((p) => p.rank === 1),
    eligible = players.filter((p) => p.eligible),
    eligibleLeader = players.every((p) => p.rank !== null)
      ? eligible.find((p) =>
          eligible.every(
            (b) =>
              b.id === p.id ||
              (comparator(p, b) !== null && comparator(p, b)! <= 0),
          ),
        )
      : undefined;
  const comparisonNote = compatible
    ? 'Compared with the last successful update.'
    : previous
      ? 'Previous snapshot is incompatible, not earlier, or older than two minutes; current snapshot only.'
      : 'First update; no change history is inferred.';
  const facts: ArenaFact[] = [];
  const add = (
    id: string,
    label: string,
    value: string,
    participantId?: string,
    source: ArenaFact['source'] = 'calculated',
  ) => facts.push({ id, label, value, participantId, source });
  const val = (n: number | null, currency = false) =>
    n === null ? 'Unavailable' : currency ? `$${n.toFixed(2)}` : String(n);
  for (const p of [user, opponent]) {
    const id = p.id.replaceAll('-', '_');
    for (const [key, label, value] of [
      ['equity', 'Current equity', val(p.equity, true)],
      ['free', 'Free balance', val(p.freeBalance, true)],
      ['reserved', 'Reserved margin', val(p.reservedMargin, true)],
      ['unrealized', 'Unrealized PnL', val(p.unrealized, true)],
      ['net', 'Realized net trading PnL', val(p.realizedNet, true)],
      ['fees', 'Fees already charged', val(p.fees, true)],
      ['exposure', 'Open notional exposure', val(p.exposure, true)],
      ['leverage', 'Average open leverage', val(p.averageLeverage)],
      [
        'margin',
        'Qualifying margin',
        `${val(p.usedMargin, true)} / ${val(p.requiredMargin, true)}`,
      ],
      [
        'eligibility',
        'Currently meets participation requirement',
        p.eligible ? 'Yes' : 'No',
      ],
      ['rank', 'Current equity placement', val(p.rank)],
      ['trades', 'Opened trades', String(p.opened)],
      ['liquidations', 'Recorded liquidations', String(p.liquidations)],
    ])
      add(`${id}_${key}`, `${p.name}: ${label}`, value, p.id);
    add(
      `${id}_style`,
      `${p.name}: configured speciality`,
      p.speciality,
      p.id,
      'recorded',
    );
    const decision = current.arena.players.find(
      (row) => row.id === p.id,
    )!.decision;
    if (decision)
      add(
        `${id}_decision`,
        `${p.name}: retained recorded entry reason`,
        BOT_REASON_CODES[decision.reasonCode],
        p.id,
        'recorded',
      );
  }
  add(
    'leadership',
    'Current leadership',
    `${leader?.name ?? 'Unverified'} by equity; ${eligibleLeader?.name ?? 'none verified'} among currently eligible participants.`,
  );
  let kind = 'quiet',
    title = 'An early snapshot, not a final result',
    evidenceIds = ['user_trades', 'user_margin'];
  if (before && user.liquidations > before.liquidations) {
    kind = 'liquidation';
    title = 'A new user liquidation is recorded';
    evidenceIds = ['user_liquidations', 'change_liquidations'];
  } else if (before && user.eligible !== before.eligible) {
    kind = 'eligibility';
    title = 'Your participation status changed';
    evidenceIds = ['user_eligibility', 'change_eligibility'];
  } else if (leader && eligibleLeader && leader.id !== eligibleLeader.id) {
    kind = 'leadership';
    title = 'Equity and eligible leadership differ';
    evidenceIds = ['leadership', 'user_eligibility'];
  } else if (
    before &&
    user.rank !== null &&
    before.rank !== null &&
    user.rank !== before.rank
  ) {
    kind = 'placement';
    title = 'Your equity placement changed';
    evidenceIds = ['user_rank', 'change_rank'];
  } else if (
    before &&
    Math.abs(user.exposure - before.exposure) >=
      Math.max(1, before.exposure * 0.1)
  ) {
    kind = 'exposure';
    title = 'Your recorded exposure changed';
    evidenceIds = ['user_exposure', 'change_exposure'];
  } else if (user.opened || opponent.opened) {
    kind = 'contrast';
    title = 'Two recorded approaches to compare';
    evidenceIds = ['user_margin', `${opponent.id.replaceAll('-', '_')}_margin`];
  }
  if (before) {
    for (const [key, label, value] of [
      [
        'liquidations',
        'User liquidation count change',
        String(user.liquidations - before.liquidations),
      ],
      [
        'eligibility',
        'User participation change',
        `${before.eligible ? 'met' : 'not met'} to ${user.eligible ? 'met' : 'not met'}`,
      ],
      [
        'rank',
        'User equity placement change',
        `${val(before.rank)} to ${val(user.rank)}`,
      ],
      [
        'exposure',
        'User open exposure change',
        val(roundMoney(user.exposure - before.exposure), true),
      ],
    ])
      add(`change_${key}`, label, value, 'user');
  }
  const limitations = [
    'Unverified browser simulation records; a single snapshot does not establish skill or a final winner.',
    'Equity includes reserved margin and unrealized PnL without hypothetical closing fees. Charged fees include opening fees.',
    'Activity and retained bot reasons are incomplete; no unseen actions, market path or causal strategy claims can be inferred.',
  ];
  if (players.some((p) => p.equity === null || p.rank === null))
    limitations.push(
      'Missing or stale required marks, or missing tie-break data, prevent complete equity ranking. No partial live ranking is presented.',
    );
  if (players.some((p) => p.realizedNet === null || p.fees === null))
    limitations.push(
      'Legacy fee records are incomplete. Affected net results and costs are unavailable, not zero.',
    );
  add('headline', 'Selected arena observation', title);
  add(
    'comparison',
    'Snapshot comparison',
    comparisonNote,
    undefined,
    'limitation',
  );
  limitations.forEach((l, i) =>
    add(`limitation_${i}`, 'Evidence limitation', l, undefined, 'limitation'),
  );
  const result: RadarFacts = {
    arenaKey: `${current.arena.start}:${current.arena.end}`,
    fingerprint: hash(current),
    previousFingerprint: previous ? hash(previous) : null,
    at: current.at,
    end: current.arena.end,
    remainingMs: current.arena.end - current.at,
    comparison: compatible,
    comparisonNote,
    headline: { kind, title, evidenceIds },
    opponentId: opponent.id,
    topic:
      kind === 'quiet'
        ? 'Observe participation and how equity differs from free balance.'
        : kind === 'leadership' || kind === 'eligibility'
          ? 'Observe participation and equity standings separately.'
          : 'Observe recorded costs, exposure and equity placement without making a trade recommendation.',
    players,
    facts,
    limitations,
  };
  return { current, previous, facts: result };
}
