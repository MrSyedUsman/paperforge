import type { BotEvidence } from './bot-types.ts';
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const deviation = (values: number[]) => { const m = mean(values); return Math.sqrt(mean(values.map(v => (v - m) ** 2))); };
const change = (a: number, b: number) => (a / b - 1) * 100;
export type Signals = { price: number; previous: number; fast: number; slow: number; trend: number; slope: number; shortReturn: number; longReturn: number; acceleration: number; lastReturn: number; volatility: number; movement: number; volatilityRatio: number; rangeHigh: number; rangeLow: number; rangeWidth: number; z: number; previousZ: number; referenceMean: number; meanSlope: number; meanReady: boolean; volatilityReady: boolean; breakout: number; pullback: boolean; evidence: BotEvidence };
export function signalsFor(prices: number[], shortArena: boolean): Signals | null {
  const fastLength = shortArena ? 3 : 6, slowLength = shortArena ? 7 : 18;
  const length = Math.max(slowLength + 2, 9);
  if (prices.length < length) return null;
  const values = prices.slice(-Math.max(length, 40)), price = values.at(-1)!, previous = values.at(-2)!;
  const fast = mean(values.slice(-fastLength)), slow = mean(values.slice(-slowLength)), oldSlow = mean(values.slice(-slowLength - 1, -1));
  const returns = values.slice(1).map((v, i) => change(v, values[i])), recent = returns.slice(-5), earlier = returns.slice(-10, -5);
  const volatility = deviation(recent), movement = Math.sqrt(mean(recent.map(v => v * v)));
  const volatilityRatio = volatility / Math.max(.005, deviation(earlier));
  const range = values.slice(-slowLength - 2, -2), rangeHigh = Math.max(...range), rangeLow = Math.min(...range), rangeWidth = change(rangeHigh, rangeLow);
  const meanLength = shortArena ? 18 : 36;
  const meanValues = values.slice(-meanLength - 1, -1), refMean = mean(meanValues);
  const sd = Math.max(price * .00005, deviation(meanValues));
  const meanSlope = change(refMean, mean(values.slice(-meanLength - 2, -2)));
  const meanReady = prices.length >= meanLength + 2;
  const z = (price - refMean) / sd, previousZ = (previous - refMean) / sd;
  const buffer = Math.max(.015, movement * .35) / 100;
  const breakout = previous > rangeHigh * (1 + buffer) && price > rangeHigh * (1 + buffer) ? 1 : previous < rangeLow * (1 - buffer) && price < rangeLow * (1 - buffer) ? -1 : 0;
  const trend = change(fast, slow), slope = change(slow, oldSlow), shortReturn = change(price, values.at(-4)!), longReturn = change(price, values.at(-slowLength)!);
  const oldShort = change(values.at(-4)!, values.at(-7)!);
  const pullback = returns.slice(-5, -1).some(r => Math.sign(r) !== Math.sign(trend)) && Math.sign(returns.at(-1)!) === Math.sign(trend);
  const evidence = { fastAverage: fast, slowAverage: slow, trendPercent: trend, slopePercent: slope, shortReturnPercent: shortReturn, longReturnPercent: longReturn, volatilityPercent: volatility, volatilityRatio, zScore: z, referenceMean: refMean, meanSlopePercent: meanSlope, rangeHigh, rangeLow };
  return { price, previous, fast, slow, trend, slope, shortReturn, longReturn, acceleration: shortReturn - oldShort, lastReturn: returns.at(-1)!, volatility, movement, volatilityRatio, rangeHigh, rangeLow, rangeWidth, z, previousZ, referenceMean: refMean, meanSlope, meanReady, volatilityReady: prices.length >= 12, breakout, pullback, evidence };
}
