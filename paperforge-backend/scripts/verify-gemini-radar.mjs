import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { GeminiReviewProvider } from '../dist/trade-reviews/gemini-review.provider.js';
import { calculateRadarFacts } from '../dist/arena-radar/radar-facts.js';
for (const [name, value] of Object.entries(
  parse(readFileSync(new URL('../.env', import.meta.url))),
))
  if (process.env[name] === undefined) process.env[name] = value;
const at = Date.now(),
  start = at - 1000,
  arena = {
    version: 1,
    status: 'active',
    completionReason: 'unknown',
    finalized: null,
    start,
    end: start + 60000,
    settings: {
      duration: 1,
      spots: 2,
      allocation: 1000,
      maxLeverage: 10,
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
      id,
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
  };
const provider = new GeminiReviewProvider(new ConfigService()),
  began = performance.now();
try {
  await provider.generateRadar(
    calculateRadarFacts({ current: { arena, at, marks: [] }, previous: null })
      .facts,
  );
  console.log(
    JSON.stringify({
      verified: true,
      model: provider.model,
      latencyMs: Math.round(performance.now() - began),
      structuredResponse: true,
      evidenceValidated: true,
      syntheticArenaOnly: true,
      requests: 1,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      verified: false,
      model: provider.model,
      latencyMs: Math.round(performance.now() - began),
      status: typeof error?.getStatus === 'function' ? error.getStatus() : null,
      detail:
        typeof error?.getResponse === 'function'
          ? error.getResponse()
          : { message: 'Verification could not complete.' },
      requests: 1,
    }),
  );
  process.exitCode = 1;
}
