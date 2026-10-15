import { ConfigService } from '@nestjs/config';
import { HttpException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { grossPnl, roundMoney, tradingFee, positionSize, calculateLiquidationPrice, settleIsolatedLiquidation } from '@paperforge/simulation';
import { AuthGuard } from '../auth/auth.guard.js';
import { AiRequestBudget } from '../trade-reviews/ai-request-budget.js';
import { TradeReviewsService } from '../trade-reviews/trade-reviews.service.js';
import { GeminiReviewProvider } from '../trade-reviews/gemini-review.provider.js';
import { calculateRiskFacts } from './risk-facts.js';
import { riskPrompt, validateRiskContent } from './risk-output.js';
import { TradeRiskService } from './trade-risk.service.js';
import { TradeRiskController } from './trade-risk.controller.js';
const snapshot = () => ({ pair: 'BTCUSDT', side: 'Long', margin: 100, leverage: 10, price: 100, priceTimestamp: Date.now() });
const content = { summary: 'These examples show how fees and leverage affect a proposed paper position.', observations: [
  { text: 'Opening and closing fees reduce the result even when the price moves favourably.', evidenceIds: ['openingFee', 'roundTripFees'] },
  { text: 'Leverage makes the position more sensitive to adverse price moves.', evidenceIds: ['leverage', 'liquidationDistance'] },
], lesson: 'Compare the potential loss with the isolated margin before deciding.', question: 'How would reducing leverage change the loss in an adverse example?' };
const fake = () => ({ model: 'gemini-3.5-flash-lite', generateRisk: vi.fn().mockResolvedValue(content), generate: vi.fn().mockResolvedValue({}) });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('pre-trade numeric grounding', () => {
  it.each(['Long', 'Short'])('reconciles %s favourable and adverse scenarios using simulator formulas', side => {
    const facts = calculateRiskFacts({ ...snapshot(), side });
    expect(facts.notional).toBe(positionSize(100, 10)); expect(facts.openingFee).toBe(tradingFee(1000));
    expect(facts.liquidationPrice).toBe(calculateLiquidationPrice({ entry: 100, side: side as 'Long' | 'Short', margin: 100, notional: 1000 }));
    for (const s of facts.scenarios) {
      const gross = grossPnl(1000, 100, s.executionPrice, side as 'Long' | 'Short');
      expect(s.grossPnl).toBe(roundMoney(gross)); expect(s.netPnl).toBe(roundMoney(gross - 1)); expect(s.totalFees).toBe(1);
      expect(s.movePercent > 0 ? s.netPnl > 0 : s.netPnl < 0).toBe(true);
    }
  });
  it.each(['Long', 'Short'])('%s liquidation stops at threshold without double-charging fees', side => {
    const f = calculateRiskFacts({ ...snapshot(), side, leverage: 50 });
    const s = f.scenarios.find(row => row.movePercent === -2)!;
    const settlement = settleIsolatedLiquidation({ margin: 100, notional: 5000, openFee: 2.5, liquidationPrice: f.liquidationPrice });
    expect(s.liquidated).toBe(true); expect(s.executionPrice).toBe(f.liquidationPrice);
    expect(s.netPnl).toBe(settlement.netPnl); expect(s.netPnl).toBe(-102.5);
    expect(s.grossPnl - s.totalFees).toBe(s.netPnl); expect(s.grossPnl).not.toBe(s.priceMovePnl);
    expect(f.scenarios.find(row => row.movePercent === -1)?.liquidated).toBe(false);
  });
  it('rounds margin exactly as position creation and estimates penny-sized fees', () => {
    const f = calculateRiskFacts({ ...snapshot(), margin: 1.235, leverage: 1 });
    expect(f.snapshot.margin).toBe(1.24); expect(f.notional).toBe(1.24); expect(f.openingFee).toBe(0);
  });
  it.each([null, [], { leverage: 51 }, { leverage: 1.5 }, { margin: 0 }, { margin: Infinity }, { margin: .001 }, { price: NaN }, { price: 0 }, { pair: 'PROMPT INJECTION' }, { side: 'Buy' }, { balance: 10 }, { priceTimestamp: 0 }, { priceTimestamp: Date.now() - 46_000 }, { priceTimestamp: Date.now() + 60_000 }])('rejects missing, invalid, extraneous or stale inputs', changes => {
    expect(() => calculateRiskFacts(changes === null || Array.isArray(changes) ? changes : { ...snapshot(), ...changes })).toThrow();
  });
  it('labels simulations and excludes identity and unverified client calculations', () => {
    const f = calculateRiskFacts(snapshot()); expect(f.limitations.join(' ')).toContain('not predictions');
    const prompt = riskPrompt(f); expect(prompt).not.toContain('username'); expect(prompt).toContain('not a trade recommendation'); expect(prompt).toContain('already inside');
  });
});
describe('risk response validation', () => {
  it('accepts bounded evidence-linked feedback', () => expect(validateRiskContent(content, calculateRiskFacts(snapshot()))).toEqual(content));
  it.each([{ summary: 'Guaranteed returns await.' }, { summary: 'The price will rise.' }, { summary: 'You should buy.' }, { question: 'Expect $123 profit?' }, { futurePrice: 200 }, { observations: [] }, { observations: content.observations.map(o => ({ ...o, evidenceIds: ['missing'] })) }, { observations: content.observations.map(o => ({ ...o, evidenceIds: ['entry'] })) }])('rejects unsupported claims and invalid evidence', change => expect(() => validateRiskContent({ ...content, ...change }, calculateRiskFacts(snapshot()))).toThrow());
});
describe('risk cache and shared allowance', () => {
  it('isolates cache by user, snapshot and model and expires after thirty seconds', async () => {
    const now = Date.now(), clock = vi.spyOn(Date, 'now').mockReturnValue(now), p = fake(), service = new TradeRiskService(p as unknown as GeminiReviewProvider, new AiRequestBudget()), input = snapshot();
    expect((await service.review('a', input)).metadata.cached).toBe(false);
    expect((await service.review('a', input)).metadata.cached).toBe(true);
    await service.review('b', input); await service.review('a', { ...input, side: 'Short' }); p.model = 'other-model'; await service.review('a', input);
    expect(p.generateRisk).toHaveBeenCalledTimes(4); clock.mockReturnValue(now + 31_000); await service.review('a', input); expect(p.generateRisk).toHaveBeenCalledTimes(5);
  });
  it('deduplicates pending requests and does not cache failures', async () => {
    const p = fake(), service = new TradeRiskService(p as unknown as GeminiReviewProvider, new AiRequestBudget()), input = snapshot();
    let resolve!: (v: typeof content) => void; p.generateRisk.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const first = service.review('a', input), second = service.review('a', input); resolve(content); await Promise.all([first, second]); expect(p.generateRisk).toHaveBeenCalledTimes(1);
    p.generateRisk.mockRejectedValueOnce(new Error('unavailable')); await expect(service.review('a', { ...input, side: 'Short' })).rejects.toThrow('unavailable');
    await service.review('a', { ...input, side: 'Short' }); expect(p.generateRisk).toHaveBeenCalledTimes(3);
  });
  it('completed and pre-trade reviews share the same five-attempt allowance', async () => {
    const p = fake(), budget = new AiRequestBudget(), risk = new TradeRiskService(p as unknown as GeminiReviewProvider, budget), completed = new TradeReviewsService(p as unknown as GeminiReviewProvider, budget);
    for (let i = 0; i < 3; i++) await completed.review('a', { pair: 'BTCUSDT', side: 'Long', entry: 100, exit: 101 + i, margin: 100, leverage: 10, openingFee: .5 });
    await risk.review('a', snapshot()); await risk.review('a', { ...snapshot(), side: 'Short' });
    await expect(risk.review('a', { ...snapshot(), leverage: 20 })).rejects.toMatchObject({ status: 429 });
  });
  it('bounds global concurrent requests and releases capacity', () => {
    const budget = new AiRequestBudget(), releases = Array.from({ length: 10 }, (_, i) => budget.acquire(`user${i}`));
    expect(() => budget.acquire('extra')).toThrow(); releases[0](); const release = budget.acquire('extra'); release(); releases.forEach(r => r());
  });
  it('counts failures toward the shared allowance', async () => {
    const p = fake(), service = new TradeRiskService(p as unknown as GeminiReviewProvider, new AiRequestBudget()); p.generateRisk.mockRejectedValue(new Error('failure'));
    for (let i = 0; i < 5; i++) await expect(service.review('a', snapshot())).rejects.toThrow('failure');
    await expect(service.review('a', snapshot())).rejects.toMatchObject({ status: 429 });
  });
});
describe('single-request risk provider', () => {
  const provider = () => new GeminiReviewProvider(new ConfigService({ GEMINI_API_KEY: 'not-a-real-key', GEMINI_MODEL: 'gemini-3.5-flash-lite' }));
  it('uses the configured model and structured output without credentials in its URL', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(content) }] } }] }));
    await expect(provider().generateRisk(calculateRiskFacts(snapshot()))).resolves.toEqual(content);
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0]; expect((url instanceof Request ? url.url : url.toString())).toContain('gemini-3.5-flash-lite'); expect((url instanceof Request ? url.url : url.toString())).not.toContain('not-a-real-key');
    const body = JSON.parse(init!.body as string); expect(body.generationConfig.maxOutputTokens).toBe(2048); expect(body.generationConfig.responseMimeType).toBe('application/json'); expect(init!.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([400, 401, 402, 403, 404, 429, 503])('does not retry or switch models on HTTP %s and redacts secrets', async status => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: { status: 'UNAVAILABLE', message: 'not-a-real-key' } }, { status }));
    try { await provider().generateRisk(calculateRiskFacts(snapshot())); throw new Error('expected failure'); } catch (error) { expect(error).toBeInstanceOf(HttpException); expect(JSON.stringify((error as HttpException).getResponse())).not.toContain('not-a-real-key'); }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('handles missing keys, timeout, malformed and truncated output', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch'); await expect(new GeminiReviewProvider(new ConfigService({})).generateRisk(calculateRiskFacts(snapshot()))).rejects.toMatchObject({ status: 503 }); expect(fetch).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new DOMException('secret', 'TimeoutError')); await expect(provider().generateRisk(calculateRiskFacts(snapshot()))).rejects.toMatchObject({ status: 504 });
    for (const data of [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'invalid json' }] } }] }]) { fetch.mockResolvedValueOnce(Response.json(data)); await expect(provider().generateRisk(calculateRiskFacts(snapshot()))).rejects.toMatchObject({ status: 502 }); }
  });
});
describe('authenticated risk endpoint', () => {
  let app: INestApplication; const jwt = new JwtService({ secret: 'test-secret' });
  beforeEach(async () => {
    const module = await Test.createTestingModule({ controllers: [TradeRiskController], providers: [AuthGuard, { provide: JwtService, useValue: jwt }, { provide: TradeRiskService, useValue: new TradeRiskService(fake() as unknown as GeminiReviewProvider, new AiRequestBudget()) }] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api'); await app.init();
  });
  afterEach(async () => { await app.close(); });
  it.each(['/api/trade-risk', '/api/trade-risk/facts'])('rejects absent, invalid and expired tokens on %s', async path => {
    await request(app.getHttpServer()).post(path).send(snapshot()).expect(401);
    await request(app.getHttpServer()).post(path).set('Authorization', 'Bearer invalid').send(snapshot()).expect(401);
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${jwt.sign({ sub: 'a' }, { expiresIn: -1 })}`).send(snapshot()).expect(401);
  });
  it('returns numeric facts without generating feedback and validates authenticated inputs', async () => {
    const token = jwt.sign({ sub: 'a' }); const res = await request(app.getHttpServer()).post('/api/trade-risk/facts').set('Authorization', `Bearer ${token}`).send(snapshot()).expect(200);
    expect(res.body.scenarios).toHaveLength(6); expect(res.body.review).toBeUndefined(); expect(res.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer()).post('/api/trade-risk').set('Authorization', `Bearer ${token}`).send({ ...snapshot(), pnl: 999 }).expect(400);
    const review = await request(app.getHttpServer()).post('/api/trade-risk').set('Authorization', `Bearer ${token}`).send(snapshot()).expect(200); expect(review.body.review.question).toBe(content.question);
  });
});
