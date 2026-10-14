import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable, HttpException } from '@nestjs/common';
import { GeminiReviewProvider } from '../trade-reviews/gemini-review.provider.js';
import { AiRequestBudget } from '../trade-reviews/ai-request-budget.js';
import { calculateRadarFacts } from './radar-facts.js';
import { RADAR_PROMPT_VERSION } from './radar-output.js';
export type RadarResult = Awaited<ReturnType<ArenaRadarService['generate']>>;
@Injectable()
export class ArenaRadarService {
  private readonly cache = new Map<
    string,
    { expires: number; result: RadarResult }
  >();
  private readonly pending = new Map<string, Promise<RadarResult>>();
  private readonly cooldown = new Map<string, number>();
  constructor(
    @Inject(GeminiReviewProvider) private readonly gemini: GeminiReviewProvider,
    @Inject(AiRequestBudget) private readonly budget: AiRequestBudget,
  ) {}
  async generate(body: unknown) {
    const { facts } = calculateRadarFacts(body),
      start = performance.now(),
      review = await this.gemini.generateRadar(facts);
    if (Date.now() >= facts.end)
      throw new HttpException(
        'The arena ended during generation. View its results instead.',
        409,
      );
    return {
      facts,
      review,
      metadata: {
        model: this.gemini.model,
        promptVersion: RADAR_PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        generationMs: Math.round(performance.now() - start),
        requestMs: 0,
        cached: false,
        cooldownUntil: 0,
      },
    };
  }
  async review(user: string, body: unknown): Promise<RadarResult> {
    const started = performance.now(),
      { facts } = calculateRadarFacts(body),
      model = this.gemini.model,
      key = createHash('sha256')
        .update(
          JSON.stringify([
            user,
            facts.fingerprint,
            facts.previousFingerprint,
            model,
            RADAR_PROMPT_VERSION,
          ]),
        )
        .digest('hex'),
      identity = JSON.stringify([user, facts.arenaKey]),
      now = Date.now();
    for (const [k, v] of this.cache) if (v.expires <= now) this.cache.delete(k);
    for (const [k, v] of this.cooldown) if (v <= now) this.cooldown.delete(k);
    const saved = this.cache.get(key);
    if (saved)
      return {
        ...saved.result,
        metadata: {
          ...saved.result.metadata,
          cached: true,
          requestMs: Math.round(performance.now() - started),
          cooldownUntil: this.cooldown.get(identity) ?? 0,
        },
      };
    const pending = this.pending.get(key);
    if (pending) {
      const result = await pending;
      return {
        ...result,
        metadata: {
          ...result.metadata,
          requestMs: Math.round(performance.now() - started),
        },
      };
    }
    const until = this.cooldown.get(identity) ?? 0;
    if (until > now)
      throw new HttpException(
        {
          code: 'RADAR_COOLDOWN',
          message: 'Please wait before refreshing Arena Radar.',
          retryAfterSeconds: Math.ceil((until - now) / 1000),
          cooldownUntil: until,
        },
        429,
      );
    if (this.cooldown.size >= 2000)
      throw new HttpException(
        'Arena Radar is busy. Please try again later.',
        503,
      );
    const release = this.budget.acquire(user);
    this.cooldown.set(identity, now + 30000);
    const task = (async () => {
      const result = await this.generate(body);
      result.metadata.requestMs = Math.round(performance.now() - started);
      result.metadata.cooldownUntil = now + 30000;
      if (this.cache.size >= 100)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { result, expires: Date.now() + 30000 });
      return result;
    })();
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
      release();
    }
  }
}
