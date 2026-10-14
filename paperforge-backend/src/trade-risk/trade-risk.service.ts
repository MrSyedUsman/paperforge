import { LIVE_PRICE_MAX_AGE_MS } from '@paperforge/simulation';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { AiRequestBudget } from '../trade-reviews/ai-request-budget.js';
import { GeminiReviewProvider } from '../trade-reviews/gemini-review.provider.js';
import { calculateRiskFacts, type RiskFacts } from './risk-facts.js';
import { RISK_PROMPT_VERSION, type RiskContent } from './risk-output.js';
export type RiskResult = { facts: RiskFacts; review: RiskContent; metadata: { model: string; promptVersion: string; generatedAt: string; generationMs: number; requestMs: number; cached: boolean } };
export const RISK_CACHE_TTL_MS = 30_000;
@Injectable()
export class TradeRiskService {
  private readonly cache = new Map<string, { expires: number; result: RiskResult }>();
  private readonly pending = new Map<string, Promise<RiskResult>>();
  constructor(@Inject(GeminiReviewProvider) private readonly gemini: GeminiReviewProvider, @Inject(AiRequestBudget) private readonly budget: AiRequestBudget) {}
  async review(username: string, input: unknown): Promise<RiskResult> {
    const start = performance.now(), facts = calculateRiskFacts(input), model = this.gemini.model;
    const key = createHash('sha256').update(JSON.stringify([username, facts.snapshot, model, RISK_PROMPT_VERSION])).digest('hex');
    for (const [id, row] of this.cache) if (row.expires <= Date.now()) this.cache.delete(id);
    const saved = this.cache.get(key);
    if (saved) return { ...saved.result, metadata: { ...saved.result.metadata, cached: true, requestMs: Math.round(performance.now() - start) } };
    const running = this.pending.get(key);
    if (running) return running;
    const release = this.budget.acquire(username);
    const task = (async () => {
      const review = await this.gemini.generateRisk(facts);
      const result: RiskResult = { facts, review, metadata: { model, promptVersion: RISK_PROMPT_VERSION, generatedAt: new Date().toISOString(), generationMs: Math.round(performance.now() - start), requestMs: Math.round(performance.now() - start), cached: false } };
      if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { result, expires: Math.min(Date.now() + RISK_CACHE_TTL_MS, facts.snapshot.priceTimestamp + LIVE_PRICE_MAX_AGE_MS) });
      return result;
    })();
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); release(); }
  }
}
