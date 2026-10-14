import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { AiRequestBudget } from '../trade-reviews/ai-request-budget.js';
import { GeminiReviewProvider } from '../trade-reviews/gemini-review.provider.js';
import { calculateArenaFacts, type ArenaFacts } from './arena-facts.js';
import {
  DEBRIEF_PROMPT_VERSION,
  type DebriefContent,
} from './debrief-output.js';
export type DebriefResult = {
  facts: ArenaFacts;
  review: DebriefContent;
  metadata: {
    model: string;
    promptVersion: string;
    generatedAt: string;
    generationMs: number;
    requestMs: number;
    cached: boolean;
  };
};
@Injectable()
export class ArenaDebriefsService {
  private readonly cache = new Map<
    string,
    { expires: number; result: DebriefResult }
  >();
  private readonly pending = new Map<string, Promise<DebriefResult>>();
  constructor(
    @Inject(GeminiReviewProvider) private readonly gemini: GeminiReviewProvider,
    @Inject(AiRequestBudget) private readonly budget: AiRequestBudget,
  ) {}
  async review(username: string, input: unknown): Promise<DebriefResult> {
    const start = performance.now(),
      { facts } = calculateArenaFacts(input),
      model = this.gemini.model;
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          username,
          facts.fingerprint,
          model,
          DEBRIEF_PROMPT_VERSION,
        ]),
      )
      .digest('hex');
    for (const [id, row] of this.cache)
      if (row.expires <= Date.now()) this.cache.delete(id);
    const saved = this.cache.get(key);
    if (saved)
      return {
        ...saved.result,
        metadata: {
          ...saved.result.metadata,
          cached: true,
          requestMs: Math.round(performance.now() - start),
        },
      };
    const running = this.pending.get(key);
    if (running) {
      const result = await running;
      return {
        ...result,
        metadata: {
          ...result.metadata,
          requestMs: Math.round(performance.now() - start),
        },
      };
    }
    const release = this.budget.acquire(username);
    const task = (async () => {
      const generationStart = performance.now();
      const review = await this.gemini.generateDebrief(facts);
      const result: DebriefResult = {
        facts,
        review,
        metadata: {
          model,
          promptVersion: DEBRIEF_PROMPT_VERSION,
          generatedAt: new Date().toISOString(),
          generationMs: Math.round(performance.now() - generationStart),
          requestMs: Math.round(performance.now() - start),
          cached: false,
        },
      };
      if (this.cache.size >= 100)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, {
        result,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
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
