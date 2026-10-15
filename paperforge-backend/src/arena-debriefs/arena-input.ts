import { BadRequestException } from '@nestjs/common';
import { BOT_CATALOG, BOT_REASON_CODES } from '@paperforge/simulation/bots';
export const ARENA_MAX_BYTES = 700_000;
export type ArenaTrade = {
  id: number;
  pair: string;
  side: 'Long' | 'Short';
  lev: number;
  margin: number;
  size: number;
  entry: number;
  exit: number;
  openFee: number | null;
  fee: number | null;
  pnl: number | null;
  opened: number;
  closed: number;
  reason: 'normal' | 'liquidation' | 'time' | 'quit' | 'opponent';
  maintenanceMarginRate: number;
  liquidationFeeRate: number;
};
export type ArenaPosition = Omit<
  ArenaTrade,
  'exit' | 'fee' | 'pnl' | 'closed' | 'reason'
>;
export type ArenaDecision = {
  tradeId: number;
  version: number;
  kind: string;
  regime: string;
  at: number;
  reasonCode: string;
  signals: Record<string, number>;
};
export type ArenaPlayer = {
  id: string;
  isUser: boolean;
  botName: string | null;
  order: number;
  balance: number;
  realized: number | null;
  fees: number | null;
  achieved: number | null;
  rank: number | null;
  status: 'active' | 'finished' | 'eliminated';
  positions: ArenaPosition[];
  trades: ArenaTrade[];
  decision: ArenaDecision | null;
};
export type ArenaSnapshot = {
  version: 1;
  status: 'active' | 'finished';
  completionReason: 'time' | 'elimination' | 'abandonment' | 'unknown';
  start: number;
  end: number;
  finalized: number | null;
  settings: {
    duration: number;
    spots: number;
    allocation: number;
    maxLeverage: number;
    maxPositions: number;
    difficulty: string;
    elimination: boolean;
    marketMode: string;
    custom: string[];
    repeats: boolean;
  };
  players: ArenaPlayer[];
};
export const invalid = (message: string): never => {
  throw new BadRequestException(message);
};
function object(
  value: unknown,
  allowed: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(`Invalid ${label}.`);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    return invalid(`Unexpected ${label} fields.`);
  return data;
}
function num(value: unknown, label: string, min = 0, max = 1e12): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    return invalid(`Invalid ${label}.`);
  return value;
}
function nullable(
  value: unknown,
  label: string,
  min = -1e12,
  max = 1e12,
): number | null {
  return value == null ? null : num(value, label, min, max);
}
function enumeration<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    return invalid(`Invalid ${label}.`);
  return value as T;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') return invalid(`Invalid ${label}.`);
  return value;
}
export function validateArenaSnapshot(
  body: unknown,
  now = Date.now(),
  activeAt?: number,
): ArenaSnapshot {
  if (Buffer.byteLength(JSON.stringify(body) ?? '') > ARENA_MAX_BYTES)
    return invalid(
      'This arena is too large to debrief. No records were changed.',
    );
  const d = object(
    body,
    [
      'version',
      'status',
      'completionReason',
      'start',
      'end',
      'finalized',
      'settings',
      'players',
    ],
    'arena',
  );
  if (
    d.version !== 1 ||
    d.status !== (activeAt === undefined ? 'finished' : 'active')
  )
    return invalid(
      activeAt === undefined
        ? 'Only completed competitions can be debriefed.'
        : 'Radar requires an active competition.',
    );
  const start = num(d.start, 'start', 1, now + 5000),
    end = num(d.end, 'end', start + 1, now + 3_600_000),
    finalized = nullable(
      d.finalized,
      'completion timestamp',
      start,
      now + 5000,
    );
  const completionReason = enumeration(
    d.completionReason,
    ['time', 'elimination', 'abandonment', 'unknown'] as const,
    'completion type',
  );
  if (completionReason === 'time' && (finalized === null || finalized < end))
    return invalid('Timed settlement has not completed.');
  const s = object(
    d.settings,
    [
      'duration',
      'spots',
      'allocation',
      'maxLeverage',
      'maxPositions',
      'difficulty',
      'elimination',
      'marketMode',
      'custom',
      'repeats',
    ],
    'settings',
  );
  const duration = num(s.duration, 'duration', 1, 60),
    spots = num(s.spots, 'participant count', 2, 8),
    maxLeverage = num(s.maxLeverage, 'maximum leverage', 1, 50),
    maxPositions = num(s.maxPositions, 'position limit', 1, 10);
  if (
    ![1, 10, 15, 20, 30, 45, 60].includes(duration) ||
    Math.abs(end - start - duration * 60000) > 1 ||
    ![spots, maxLeverage, maxPositions].every(Number.isInteger)
  )
    return invalid('Unsupported competition settings.');
  const marketMode = enumeration(
    s.marketMode,
    ['all', 'majors', 'custom'] as const,
    'market mode',
  );
  if (
    !Array.isArray(s.custom) ||
    s.custom.length > 30 ||
    s.custom.some(
      (p) => typeof p !== 'string' || !/^[A-Z0-9]{1,24}USDT$/.test(p),
    ) ||
    new Set(s.custom).size !== s.custom.length ||
    (marketMode === 'custom' && !s.custom.length)
  )
    return invalid('Invalid allowed markets.');
  const settings = {
    duration,
    spots,
    allocation: num(s.allocation, 'allocation', 500, 100000),
    maxLeverage,
    maxPositions,
    difficulty: enumeration(
      s.difficulty,
      ['Easy', 'Medium', 'Hard', 'Expert'] as const,
      'difficulty',
    ),
    elimination: bool(s.elimination, 'elimination'),
    marketMode,
    custom: [...(s.custom as string[])].sort(),
    repeats: bool(s.repeats, 'repeated markets'),
  };
  if (!Array.isArray(d.players) || d.players.length !== spots)
    return invalid('Participant count does not match the arena.');
  let totalTrades = 0;
  const players = d.players.map((value) => {
    const p = object(
      value,
      [
        'id',
        'isUser',
        'botName',
        'order',
        'balance',
        'realized',
        'fees',
        'achieved',
        'rank',
        'status',
        'positions',
        'trades',
        'decision',
      ],
      'participant',
    );
    const isUser = bool(p.isUser, 'participant type');
    if (
      typeof p.id !== 'string' ||
      (isUser ? p.id !== 'user' : !/^bot-[0-6]$/.test(p.id))
    )
      return invalid('Invalid participant identity.');
    const bot = isUser ? null : BOT_CATALOG[Number(p.id.slice(4))];
    if (isUser ? p.botName != null : p.botName !== bot?.name)
      return invalid('Bot identity does not match the known roster.');
    if (
      !Array.isArray(p.positions) ||
      (activeAt === undefined && p.positions.length) ||
      p.positions.length > maxPositions
    )
      return invalid('Completed arenas must have no unsettled positions.');
    if (!Array.isArray(p.trades) || p.trades.length > 500)
      return invalid('Too many trades for one participant.');
    totalTrades += p.trades.length;
    if (totalTrades > 2500)
      return invalid('Too many arena trades for a debrief.');
    const normalizeTrade = (value: unknown): ArenaTrade => {
      const t = object(
        value,
        [
          'id',
          'pair',
          'side',
          'lev',
          'margin',
          'size',
          'entry',
          'exit',
          'openFee',
          'fee',
          'pnl',
          'opened',
          'closed',
          'reason',
          'maintenanceMarginRate',
          'liquidationFeeRate',
        ],
        'trade',
      );
      if (typeof t.pair !== 'string' || !/^[A-Z0-9]{1,24}USDT$/.test(t.pair))
        return invalid('Invalid trade market.');
      if (
        (marketMode === 'custom' && !settings.custom.includes(t.pair)) ||
        (marketMode !== 'custom' &&
          ![
            'BTCUSDT',
            'ETHUSDT',
            'SOLUSDT',
            'BNBUSDT',
            'XRPUSDT',
            'DOGEUSDT',
            'ADAUSDT',
            'AVAXUSDT',
          ].includes(t.pair))
      )
        return invalid('Trade market is outside the arena settings.');
      const lev = num(t.lev, 'trade leverage', 1, maxLeverage),
        opened = num(
          t.opened,
          'trade opening time',
          start,
          end - Number.EPSILON,
        ),
        closed = num(
          t.closed,
          'trade closing time',
          opened,
          activeAt ?? (finalized ?? now) + 2000,
        );
      if (!Number.isInteger(lev) || opened >= end)
        return invalid('Trade opened outside the competition deadline.');
      const trade: ArenaTrade = {
        id: num(t.id, 'trade identity', 0, 1e16),
        pair: t.pair,
        side: enumeration(t.side, ['Long', 'Short'] as const, 'trade side'),
        lev,
        margin: num(t.margin, 'margin', 0.01, 1e8),
        size: num(t.size, 'notional', 0.01, 5e9),
        entry: num(t.entry, 'entry', 1e-12, 1e9),
        exit: num(t.exit, 'exit', 1e-12, 1e9),
        openFee: nullable(t.openFee, 'opening fee', 0, 1e9),
        fee: nullable(t.fee, 'closing fee', 0, 1e9),
        pnl: nullable(t.pnl, 'recorded net PnL'),
        opened,
        closed,
        reason: enumeration(
          t.reason,
          ['normal', 'liquidation', 'time', 'quit', 'opponent'] as const,
          'trade close type',
        ),
        maintenanceMarginRate:
          t.maintenanceMarginRate == null
            ? 0.005
            : num(t.maintenanceMarginRate, 'maintenance rate', 0, 0.05),
        liquidationFeeRate:
          t.liquidationFeeRate == null
            ? 0.001
            : num(t.liquidationFeeRate, 'liquidation rate', 0, 0.05),
      };
      if (Math.abs(trade.size - trade.margin * lev) > 0.005 * lev + 0.011)
        return invalid('Trade exposure contradicts margin and leverage.');
      return trade;
    };
    const trades = p.trades
      .map(normalizeTrade)
      .sort(
        (a, b) => a.opened - b.opened || a.closed - b.closed || a.id - b.id,
      );
    const positions: ArenaPosition[] =
      activeAt === undefined
        ? []
        : (p.positions as unknown[]).map((value) => {
            const pos = object(
              value,
              [
                'id',
                'pair',
                'side',
                'lev',
                'margin',
                'size',
                'entry',
                'openFee',
                'opened',
                'maintenanceMarginRate',
                'liquidationFeeRate',
              ],
              'position',
            );
            const t = normalizeTrade({
              ...pos,
              exit: pos.entry,
              fee: null,
              pnl: null,
              closed: activeAt,
              reason: 'normal',
            });
            if (t.opened > activeAt)
              return invalid('Position opened after the snapshot.');
            const {
              exit: ignoredExit,
              fee: ignoredFee,
              pnl: ignoredPnl,
              closed: ignoredClosed,
              reason: ignoredReason,
              ...result
            } = t;
            void ignoredExit;
            void ignoredFee;
            void ignoredPnl;
            void ignoredClosed;
            void ignoredReason;
            return result;
          });
    if (
      new Set([...trades, ...positions].map((t) => t.id)).size !==
      trades.length + positions.length
    )
      return invalid('Duplicate position or trade identities.');
    if (
      !settings.repeats &&
      new Set(positions.map((p) => p.pair)).size !== positions.length
    )
      return invalid('Repeated open markets are disabled.');
    if (new Set(trades.map((t) => t.id)).size !== trades.length)
      return invalid('Duplicate trade identities.');
    // Equal close/open timestamps can represent sequential actions in the same millisecond.
    // Only reject overlaps that the recorded timestamps establish unambiguously.
    const intervals =
      activeAt === undefined
        ? trades
        : [
            ...trades,
            ...positions.map((pos) => ({ ...pos, closed: activeAt + 1 })),
          ];
    for (const t of intervals) {
      const concurrent = intervals.filter(
        (other) => other.opened <= t.opened && other.closed > t.opened,
      );
      if (concurrent.length > maxPositions)
        return invalid('Recorded concurrent positions exceed the arena limit.');
      if (
        !settings.repeats &&
        concurrent.filter((other) => other.pair === t.pair).length > 1
      )
        return invalid(
          'Recorded overlapping markets contradict repeated-market settings.',
        );
    }
    let decision: ArenaDecision | null = null;
    if (p.decision != null) {
      const v = object(
        p.decision,
        ['tradeId', 'version', 'kind', 'regime', 'at', 'reasonCode', 'signals'],
        'bot decision',
      );
      const trade = trades.find((t) => t.id === v.tradeId);
      if (
        !bot ||
        !trade ||
        v.version !== 1 ||
        v.kind !== bot.kind ||
        typeof v.reasonCode !== 'string' ||
        !Object.hasOwn(BOT_REASON_CODES, v.reasonCode)
      )
        return invalid('Unknown recorded bot decision.');
      const allowedReasons: Record<string, string[]> = {
        trend: ['trend_pullback', 'trend_confirmed'],
        momentum: ['momentum_confirmed'],
        breakout: ['breakout_confirmed'],
        reversion: ['reversion_confirmed'],
        conservative: ['conservative_confirmed'],
        volatility: ['volatility_confirmed'],
        adaptive: [
          'trend_pullback',
          'trend_confirmed',
          'breakout_confirmed',
          'reversion_confirmed',
        ],
      };
      if (!allowedReasons[bot.kind].includes(v.reasonCode))
        return invalid(
          'Entry reason does not match the configured bot strategy.',
        );
      const at = num(v.at, 'decision timestamp', start, end);
      if (Math.abs(at - trade.opened) > 2000)
        return invalid('Decision does not match its recorded entry.');
      const signals = object(
        v.signals,
        [
          'fastAverage',
          'slowAverage',
          'trendPercent',
          'slopePercent',
          'shortReturnPercent',
          'longReturnPercent',
          'volatilityPercent',
          'volatilityRatio',
          'zScore',
          'referenceMean',
          'meanSlopePercent',
          'rangeHigh',
          'rangeLow',
          'liquidityQuoteVolume24h',
        ],
        'decision signals',
      );
      decision = {
        tradeId: trade.id,
        version: 1,
        kind: bot.kind,
        regime: enumeration(
          v.regime,
          ['trend', 'range', 'breakout', 'uncertain'] as const,
          'recorded regime',
        ),
        at,
        reasonCode: v.reasonCode,
        signals: Object.fromEntries(
          Object.entries(signals)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, num(value, 'signal', -1e15, 1e15)]),
        ),
      };
    }
    const order = num(p.order, 'recorded order', 0, spots - 1),
      rank = nullable(p.rank, 'reported rank', 1, spots);
    if (!Number.isInteger(order) || (rank !== null && !Number.isInteger(rank)))
      return invalid('Invalid participant order.');
    return {
      id: p.id,
      isUser,
      botName: bot?.name ?? null,
      order,
      balance: num(p.balance, 'balance', -1e9, 1e12),
      realized: nullable(p.realized, 'realized PnL'),
      fees: nullable(p.fees, 'total fees', 0, 1e12),
      achieved: nullable(p.achieved, 'achievement time', start, now + 5000),
      rank,
      status: enumeration(
        p.status,
        activeAt === undefined
          ? (['finished', 'eliminated'] as const)
          : (['active', 'eliminated'] as const),
        'participant status',
      ),
      positions,
      trades,
      decision,
    };
  });
  if (
    players.filter((p) => p.isUser).length !== 1 ||
    new Set(players.map((p) => p.id)).size !== spots ||
    new Set(players.map((p) => p.order)).size !== spots
  )
    return invalid('Duplicate or missing participant identities.');
  if (
    completionReason === 'abandonment' &&
    (players.find((p) => p.isUser)!.balance !== 0 ||
      players.find((p) => p.isUser)!.status !== 'eliminated')
  )
    return invalid('Abandonment must record the user forfeiture.');
  if (
    completionReason === 'elimination' &&
    (!settings.elimination ||
      players.filter((p) => p.status !== 'eliminated').length > 1)
  )
    return invalid('Elimination outcome contradicts the arena state.');
  return {
    version: 1,
    status: activeAt === undefined ? 'finished' : 'active',
    completionReason,
    start,
    end,
    finalized,
    settings,
    players: players.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
