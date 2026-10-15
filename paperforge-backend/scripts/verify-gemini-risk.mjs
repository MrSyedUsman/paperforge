import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { GeminiReviewProvider } from '../dist/trade-reviews/gemini-review.provider.js';
import { calculateRiskFacts } from '../dist/trade-risk/risk-facts.js';
for (const [name, value] of Object.entries(parse(readFileSync(new URL('../.env', import.meta.url))))) if (process.env[name] === undefined) process.env[name] = value;
const provider = new GeminiReviewProvider(new ConfigService());
const facts = calculateRiskFacts({ pair: 'BTCUSDT', side: 'Long', margin: 100, leverage: 10, price: 100, priceTimestamp: Date.now() });
const start = performance.now();
try {
  await provider.generateRisk(facts);
  console.log(JSON.stringify({ verified: true, model: provider.model, latencyMs: Math.round(performance.now() - start), structuredResponse: true, evidenceValidated: true, syntheticTradeOnly: true }));
} catch (error) {
  console.log(JSON.stringify({ verified: false, model: provider.model, latencyMs: Math.round(performance.now() - start), status: typeof error?.getStatus === 'function' ? error.getStatus() : null, detail: typeof error?.getResponse === 'function' ? error.getResponse() : { message: 'Verification could not complete.' } }));
  process.exitCode = 1;
}
