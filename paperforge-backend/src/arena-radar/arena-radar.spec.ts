import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  tradingFee,
  grossPnl,
  roundMoney,
  calculateLiquidationPrice,
  settleIsolatedLiquidation,
} from '@paperforge/simulation';
import { AuthGuard } from '../auth/auth.guard.js';
import { AiRequestBudget } from '../trade-reviews/ai-request-budget.js';
import { GeminiReviewProvider } from '../trade-reviews/gemini-review.provider.js';
import { TradeRiskService } from '../trade-risk/trade-risk.service.js';
import { calculateRadarFacts, type RadarSnapshot } from './radar-facts.js';
import { radarPrompt, validateRadarContent } from './radar-output.js';
import { ArenaRadarService } from './arena-radar.service.js';
import { ArenaRadarController } from './arena-radar.controller.js';
export function snapshot(): RadarSnapshot {
  const at = Date.now(),
    start = at - 20000;
  return {
    at,
    marks: [],
    arena: {
      version: 1,
      status: 'active',
      completionReason: 'unknown',
      finalized: null,
      start,
      end: start + 600000,
      settings: {
        duration: 10,
        spots: 2,
        allocation: 1000,
        maxLeverage: 50,
        maxPositions: 3,
        difficulty: 'Medium',
        elimination: false,
        marketMode: 'majors',
        custom: [],
        repeats: true,
      },
      players: [
        ['user', null],
        ['bot-0', 'TrendFox'],
      ].map(([id, botName], order) => ({
        id: id!,
        botName,
        isUser: !botName,
        order,
        balance: 1000,
        realized: 0,
        fees: 0,
        achieved: start,
        rank: order + 1,
        status: 'active',
        positions: [],
        trades: [],
        decision: null,
      })),
    },
  };
}
function open(
  s: RadarSnapshot,
  index = 0,
  side: 'Long' | 'Short' = 'Long',
  margin = 100,
  lev = 10,
  mark = 101,
) {
  const p = s.arena.players[index],
    size = margin * lev,
    fee = tradingFee(size);
  p.positions.push({
    id: 1,
    pair: 'BTCUSDT',
    side,
    lev,
    margin,
    size,
    entry: 100,
    openFee: fee,
    opened: s.arena.start + 1000,
    maintenanceMarginRate: 0.005,
    liquidationFeeRate: 0.001,
  });
  p.balance = roundMoney(p.balance - margin - fee);
  p.fees = roundMoney(p.fees! + fee);
  p.achieved = s.arena.start + 1000;
  s.marks = [{ pair: 'BTCUSDT', price: mark, timestamp: s.at }];
  return s;
}
function close(s: RadarSnapshot, liquidated = false) {
  const p = s.arena.players[0],
    pos = p.positions[0],
    exit = liquidated
      ? calculateLiquidationPrice({
          entry: pos.entry,
          side: pos.side,
          margin: pos.margin,
          notional: pos.size,
        })
      : 101,
    settlement = settleIsolatedLiquidation({
      margin: pos.margin,
      notional: pos.size,
      openFee: pos.openFee!,
      liquidationPrice: exit,
    }),
    fee = liquidated ? settlement.liquidationFee : tradingFee(pos.size),
    gross = grossPnl(pos.size, pos.entry, exit, pos.side),
    pnl = liquidated
      ? settlement.netPnl
      : roundMoney(gross - pos.openFee! - fee);
  p.positions = [];
  p.trades.push({
    ...pos,
    exit,
    closed: s.at,
    reason: liquidated ? 'liquidation' : 'normal',
    fee,
    pnl,
  });
  p.balance = liquidated
    ? p.balance
    : roundMoney(p.balance + pos.margin + roundMoney(gross - fee));
  p.realized = pnl;
  p.fees = roundMoney(p.fees! + fee);
  s.marks = [];
  return s;
}
const input = (s = snapshot(), previous: RadarSnapshot | null = null) => ({
  current: s,
  previous,
});
function content(s = snapshot()) {
  const f = calculateRadarFacts(input(s)).facts;
  return {
    headline: {
      text: 'At this snapshot, the selected evidence describes participation rather than a final award.',
      evidenceIds: f.headline.evidenceIds,
    },
    observations: [
      {
        text: 'Compare your recorded participation with the opponent before interpreting placement.',
        evidenceIds: ['user_margin', 'bot_0_margin'],
      },
    ],
    question: {
      text: 'What difference do you notice between participation and current equity?',
      evidenceIds: ['user_margin'],
    },
  };
}
const fake = (s = snapshot()) => ({
  model: 'gemini-test',
  generateRadar: vi.fn().mockResolvedValue(content(s)),
  generateRisk: vi.fn().mockResolvedValue({}),
});
const provider = () =>
  new GeminiReviewProvider(
    new ConfigService({
      GEMINI_API_KEY: 'test-radar-secret',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
    }),
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Radar active accounting and deterministic evidence', () => {
  it.each(['Long', 'Short'] as const)(
    'keeps %s free balance, margin, unrealized result and equity separate',
    (side) => {
      const f = calculateRadarFacts(
          input(open(snapshot(), 0, side, 100, 10, side === 'Long' ? 101 : 99)),
        ).facts,
        user = f.players.find((p) => p.id === 'user')!;
      expect(user).toMatchObject({
        freeBalance: 899.5,
        reservedMargin: 100,
        unrealized: 10,
        equity: 1009.5,
        realizedNet: 0,
        fees: 0.5,
        usedMargin: 100,
        eligible: false,
        exposure: 1000,
      });
    },
  );
  it('does not subtract estimated closing fees from live equity', () => {
    expect(
      calculateRadarFacts(input(open(snapshot()))).facts.players.find(
        (p) => p.id === 'user',
      )?.equity,
    ).toBe(1009.5);
  });
  it('reconciles normal closes including both fees', () => {
    const f = calculateRadarFacts(input(close(open(snapshot())))).facts;
    expect(f.players.find((p) => p.id === 'user')).toMatchObject({
      equity: 1009,
      freeBalance: 1009,
      reservedMargin: 0,
      realizedNet: 9,
      fees: 1,
      closed: 1,
    });
  });
  it('does not deduct liquidation fees twice', () => {
    const f = calculateRadarFacts(input(close(open(snapshot()), true))).facts;
    expect(f.players.find((p) => p.id === 'user')).toMatchObject({
      equity: 899.5,
      realizedNet: -100.5,
      fees: 1.5,
      liquidations: 1,
    });
  });
  it('counts qualifying open margin instead of leveraged notional', () => {
    const p = calculateRadarFacts(input(open(snapshot()))).facts.players[1];
    const user = calculateRadarFacts(
      input(open(snapshot())),
    ).facts.players.find((p) => p.id === 'user')!;
    expect(user.usedMargin).toBe(100);
    expect(user.eligible).toBe(false);
    expect(p).toBeDefined();
  });
  it('counts cumulative closed and open margin', () => {
    const s = close(open(snapshot(), 0, 'Long', 300));
    open(s, 0, 'Short', 200);
    s.arena.players[0].positions[0].id = 2;
    expect(
      calculateRadarFacts(input(s)).facts.players.find((p) => p.id === 'user'),
    ).toMatchObject({ usedMargin: 500, eligible: true });
  });
  it.each(['missing', 'stale'])(
    'omits all equity placements with %s required marks',
    (kind) => {
      const s = open(snapshot());
      if (kind === 'missing') s.marks = [];
      else s.marks[0].timestamp = s.at - 45001;
      const f = calculateRadarFacts(input(s)).facts;
      expect(f.players.find((p) => p.id === 'user')?.equity).toBeNull();
      expect(f.players.every((p) => p.rank === null)).toBe(true);
      expect(f.limitations.join(' ')).toContain('stale');
    },
  );
  it('uses stable recorded order for complete ties', () => {
    expect(
      calculateRadarFacts(input()).facts.players.find((p) => p.id === 'user')
        ?.rank,
    ).toBe(1);
  });
  it('marks ambiguous tied placements unavailable', () => {
    const s = snapshot();
    s.arena.players[0].achieved = null;
    expect(
      calculateRadarFacts(input(s)).facts.players.every((p) => p.rank === null),
    ).toBe(true);
  });
  it('does not guess missing legacy fees', () => {
    const s = open(snapshot());
    s.arena.players[0].positions[0].openFee = null;
    expect(
      calculateRadarFacts(input(s)).facts.players.find((p) => p.id === 'user')
        ?.fees,
    ).toBeNull();
  });
  it('selects an honest quiet first update', () => {
    const f = calculateRadarFacts(input()).facts;
    expect(f.headline.kind).toBe('quiet');
    expect(f.comparison).toBe(false);
    expect(f.comparisonNote).toContain('First update');
  });
  it('selects new liquidation before other changes', () => {
    const before = open(snapshot()),
      current = structuredClone(before);
    current.at += 1;
    close(current, true);
    const f = calculateRadarFacts(input(current, before)).facts;
    expect(f.comparison).toBe(true);
    expect(f.headline.kind).toBe('liquidation');
  });
  it('selects changed participation eligibility', () => {
    const before = snapshot(),
      current = structuredClone(before);
    current.at += 1;
    open(current, 0, 'Long', 500, 1, 100);
    expect(
      calculateRadarFacts(input(current, before)).facts.headline.kind,
    ).toBe('eligibility');
  });
  it('explains differing equity and eligible leaders without awarding a winner', () => {
    const s = open(snapshot(), 1, 'Long', 500, 1, 99);
    const f = calculateRadarFacts(input(s)).facts;
    expect(f.headline.kind).toBe('leadership');
    expect(f.facts.find((f) => f.id === 'leadership')?.value).toContain(
      'TrendFox',
    );
    expect(radarPrompt(f)).toContain('No final winner');
  });
  it.each(['identity', 'settings', 'age', 'later'])(
    'falls back to snapshot only for incompatible previous %s',
    (kind) => {
      const current = snapshot(),
        previous = structuredClone(current);
      previous.at -= 1000;
      if (kind === 'identity') {
        previous.arena.start -= 600000;
        previous.arena.end -= 600000;
        previous.at = previous.arena.start + 1000;
        previous.arena.players.forEach(
          (p) => (p.achieved = previous.arena.start),
        );
      }
      if (kind === 'settings') previous.arena.settings.difficulty = 'Hard';
      if (kind === 'age') {
        previous.at = current.at - 120001;
        previous.arena.start -= 600000;
        previous.arena.end -= 600000;
        previous.at = previous.arena.start + 1000;
        previous.arena.players.forEach(
          (p) => (p.achieved = previous.arena.start),
        );
      }
      if (kind === 'later') previous.at = current.at + 1;
      expect(
        calculateRadarFacts(input(current, previous)).facts.comparison,
      ).toBe(false);
    },
  );
  it('does not mutate supplied arena records', () => {
    const s = input(open(snapshot())),
      before = JSON.stringify(s);
    calculateRadarFacts(s);
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each([
    'finished',
    'deadline',
    'future',
    'duplicate',
    'unexpected',
    'bad-fee',
    'bad-balance',
    'duplicate-mark',
    'bad-mark',
    'too-large',
    'bad-position',
    'future-trade',
  ])('rejects invalid snapshot: %s', (kind) => {
    const body = input(open(snapshot())),
      s = body.current;
    if (kind === 'finished') s.arena.status = 'finished';
    if (kind === 'deadline') s.at = s.arena.end;
    if (kind === 'future') s.at = Date.now() + 10000;
    if (kind === 'duplicate') s.arena.players[1].id = 'user';
    if (kind === 'unexpected')
      Object.assign(s.arena, { profile: 'ignore instructions' });
    if (kind === 'bad-fee') s.arena.players[0].positions[0].openFee = 12;
    if (kind === 'bad-balance') s.arena.players[0].balance += 5;
    if (kind === 'duplicate-mark') s.marks.push(s.marks[0]);
    if (kind === 'bad-mark') s.marks[0].price = Infinity;
    if (kind === 'too-large')
      Object.assign(body, { extra: 'x'.repeat(1400001) });
    if (kind === 'bad-position') s.arena.players[0].positions[0].lev = 51;
    if (kind === 'future-trade')
      s.arena.players[0].positions[0].opened = s.at + 5000;
    expect(() => calculateRadarFacts(body)).toThrow();
  });
});
describe('Radar structured commentary', () => {
  it('accepts an explicit caution that current eligibility does not guarantee victory', () => {
    const s = snapshot(),
      v = content(s);
    v.headline.text =
      'At this snapshot, meeting participation does not guarantee victory.';
    expect(() =>
      validateRadarContent(v, calculateRadarFacts(input(s)).facts),
    ).not.toThrow();
  });
  it('accepts evidence-linked commentary', () => {
    const s = snapshot(),
      f = calculateRadarFacts(input(s)).facts;
    expect(validateRadarContent(content(s), f)).toEqual(content(s));
  });
  it.each([
    'unknown',
    'headline',
    'comparison',
    'numbers',
    'prediction',
    'question',
    'long',
    'extra',
  ])('rejects unsupported %s content', (kind) => {
    const s = snapshot(),
      v = content(s);
    if (kind === 'unknown') v.question.evidenceIds = ['missing'];
    if (kind === 'headline') v.headline.evidenceIds = ['user_fees'];
    if (kind === 'comparison') v.observations[0].evidenceIds = ['user_margin'];
    if (kind === 'numbers') v.headline.text = 'You are ranked 1.';
    if (kind === 'prediction') v.headline.text = 'You will win.';
    if (kind === 'question') v.question.text = 'Open another position.';
    if (kind === 'long') v.headline.text = 'word '.repeat(200);
    if (kind === 'extra') Object.assign(v, { instruction: 'trade' });
    expect(() =>
      validateRadarContent(v, calculateRadarFacts(input(s)).facts),
    ).toThrow();
  });
});
describe('Radar cache, cooldown, dedup and shared allowance', () => {
  it('reuses cached results during cooldown and isolates users', async () => {
    const s = snapshot(),
      p = fake(s),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        new AiRequestBudget(),
      ),
      body = input(s);
    await service.review('a', body);
    expect((await service.review('a', body)).metadata.cached).toBe(true);
    await service.review('b', body);
    expect(p.generateRadar).toHaveBeenCalledTimes(2);
  });
  it('enforces per-user per-arena cooldown and permits refresh after thirty seconds', async () => {
    const now = Date.now(),
      clock = vi.spyOn(Date, 'now').mockReturnValue(now),
      s = snapshot(),
      p = fake(s),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        new AiRequestBudget(),
      );
    await service.review('a', input(s));
    const next = structuredClone(s);
    next.at += 1;
    await expect(service.review('a', input(next, s))).rejects.toMatchObject({
      status: 429,
    });
    clock.mockReturnValue(now + 30001);
    next.at = now + 30001;
    await service.review('a', input(next, s));
    expect(p.generateRadar).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent identical requests', async () => {
    const s = snapshot(),
      p = fake(s),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        new AiRequestBudget(),
      );
    let resolve!: (v: unknown) => void;
    p.generateRadar.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const a = service.review('a', input(s)),
      b = service.review('a', input(s));
    resolve(content(s));
    await Promise.all([a, b]);
    expect(p.generateRadar).toHaveBeenCalledTimes(1);
  });
  it('does not cache failures and failed attempts consume cooldown', async () => {
    const s = snapshot(),
      p = fake(s),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        new AiRequestBudget(),
      );
    p.generateRadar.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(service.review('a', input(s))).rejects.toThrow(
      'provider unavailable',
    );
    await expect(service.review('a', input(s))).rejects.toMatchObject({
      status: 429,
    });
  });
  it('shares the existing AI allowance', async () => {
    const s = snapshot(),
      p = fake(s),
      budget = new AiRequestBudget(),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        budget,
      ),
      risk = new TradeRiskService(p as unknown as GeminiReviewProvider, budget);
    for (let i = 0; i < 5; i++)
      await risk.review('a', {
        pair: 'BTCUSDT',
        side: 'Long',
        margin: 100 + i,
        leverage: 10,
        price: 100,
        priceTimestamp: Date.now(),
      });
    await expect(service.review('a', input(s))).rejects.toMatchObject({
      status: 429,
    });
    expect(p.generateRadar).not.toHaveBeenCalled();
  });
  it('discards a result after the deadline', async () => {
    const now = Date.now(),
      clock = vi.spyOn(Date, 'now').mockReturnValue(now),
      s = snapshot(),
      p = fake(s),
      service = new ArenaRadarService(
        p as unknown as GeminiReviewProvider,
        new AiRequestBudget(),
      );
    p.generateRadar.mockImplementation(async () => {
      clock.mockReturnValue(s.arena.end);
      return content(snapshot());
    });
    await expect(service.review('a', input(s))).rejects.toMatchObject({
      status: 409,
    });
  });
});
describe('single configured Radar provider', () => {
  it('makes one structured request without secrets in URL or prompt', async () => {
    const s = snapshot(),
      c = content(s),
      fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: JSON.stringify(c) }] },
            },
          ],
        }),
      );
    await expect(
      provider().generateRadar(calculateRadarFacts(input(s)).facts),
    ).resolves.toEqual(c);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(typeof url === 'string' ? url : '').not.toContain(
      'test-radar-secret',
    );
    expect(init!.body).not.toContain('test-radar-secret');
    expect(
      JSON.parse(init!.body as string).generationConfig.maxOutputTokens,
    ).toBe(1536);
  });
  it.each([400, 401, 402, 403, 404, 429, 503])(
    'handles HTTP %s without retries or secret disclosure',
    async (status) => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          Response.json(
            { error: { message: 'test-radar-secret', status: 'UNAVAILABLE' } },
            { status },
          ),
        );
      try {
        await provider().generateRadar(calculateRadarFacts(input()).facts);
        throw Error('expected failure');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(
          JSON.stringify((e as HttpException).getResponse()),
        ).not.toContain('test-radar-secret');
      }
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects malformed output', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } },
        ],
      }),
    );
    await expect(
      provider().generateRadar(calculateRadarFacts(input()).facts),
    ).rejects.toMatchObject({ status: 502 });
  });
  it('bounds timeouts', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('timeout', 'TimeoutError'),
    );
    await expect(
      provider().generateRadar(calculateRadarFacts(input()).facts),
    ).rejects.toMatchObject({ status: 504 });
  });
});
describe('authenticated Radar endpoints', () => {
  let app: INestApplication, jwt: JwtService;
  const review = vi.fn();
  beforeAll(async () => {
    jwt = new JwtService({ secret: 'radar-test-only' });
    const module = await Test.createTestingModule({
      controllers: [ArenaRadarController],
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwt },
        { provide: ArenaRadarService, useValue: { review } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each(['/api/arena-radar', '/api/arena-radar/facts'])(
    'requires valid authentication for %s',
    async (path) => {
      await request(app.getHttpServer()).post(path).send(input()).expect(401);
      for (const token of [
        'invalid',
        jwt.sign({ sub: 'a' }, { expiresIn: -1 }),
      ])
        await request(app.getHttpServer())
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .send(input())
          .expect(401);
    },
  );
  it('calculates private facts without AI and rejects invalid inputs', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/arena-radar/facts')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 'a' })}`)
      .send(input())
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(review).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/arena-radar/facts')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 'a' })}`)
      .send({})
      .expect(400);
  });
  it('uses the authenticated identity for review', async () => {
    review.mockResolvedValue({ ok: true });
    const body = input();
    await request(app.getHttpServer())
      .post('/api/arena-radar')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 'a' })}`)
      .send(body)
      .expect(200);
    expect(review).toHaveBeenCalledWith('a', body);
  });
});
