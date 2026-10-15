import test from 'node:test';
import assert from 'node:assert/strict';
import { riskSnapshot, riskSnapshotOutdated, validateRiskFacts, validateRiskResponse } from '../src/features/trading/trade-risk-contract.ts';
const snapshot = { pair: 'BTCUSDT', side: 'Long', margin: 100, leverage: 10, price: 100, priceTimestamp: 1000 };
const facts = { snapshot, notional: 1000, openingFee: .5, liquidationPrice: 90.6, liquidationDistancePercent: 9.4,
  scenarios: [.5, -.5, 1, -1, 2, -2].map((movePercent, index) => ({ id: `scenario${index}`, movePercent, hypotheticalPrice: 100 + movePercent, executionPrice: 100 + movePercent, liquidated: false, priceMovePnl: movePercent * 10, grossPnl: movePercent * 10, closingFee: .5, totalFees: 1, netPnl: movePercent * 10 - 1 })),
  facts: ['openingFee', 'roundTripFees', 'leverage', 'notional', 'liquidationPrice', 'liquidationDistance', 'margin', 'entry'].map(id => ({ id, label: id, value: 'Example value' })), limitations: ['Hypothetical examples, not predictions.'] };
const response = { facts, review: { summary: 'Fees and leverage change the examples.', observations: [{ text: 'Fees reduce returns.', evidenceIds: ['openingFee'] }, { text: 'Exposure changes sensitivity.', evidenceIds: ['leverage'] }], lesson: 'Compare the isolated margin with potential loss.', question: 'How would lower leverage change this example?' }, metadata: { model: 'configured-model', promptVersion: 'trade-risk-v1', generatedAt: '2026-10-14T00:00:00Z', generationMs: 100, requestMs: 110, cached: false } };
test('risk payload excludes credentials, profile and client-derived numeric facts', () => {
  assert.deepEqual(riskSnapshot({ ...snapshot, token: 'secret', username: 'user', balance: 1000, liquidationPrice: 999 }), snapshot);
});
test('risk snapshot detects changed inputs, prices, unavailable feeds and expiry', () => {
  assert.equal(riskSnapshotOutdated(snapshot, { ...snapshot, priceTimestamp: 2000 }, true, 2000), false);
  for (const change of [{ pair: 'ETHUSDT' }, { side: 'Short' }, { margin: 101 }, { leverage: 20 }, { price: 101 }]) assert.equal(riskSnapshotOutdated(snapshot, { ...snapshot, ...change }, true, 2000), true);
  assert.equal(riskSnapshotOutdated(snapshot, snapshot, false, 2000), true);
  assert.equal(riskSnapshotOutdated(snapshot, snapshot, true, 46_001), true);
});
test('validated risk responses preserve backend facts and evidence', () => {
  assert.deepEqual(validateRiskResponse(response, snapshot), response);
  assert.deepEqual(validateRiskFacts(facts, snapshot), facts);
});
test('malformed and mismatched snapshots cannot reach the risk UI', () => {
  for (const invalid of [null, { ...response, facts: { ...facts, snapshot: { ...snapshot, side: 'Short' } } }, { ...response, facts: { ...facts, scenarios: [] } }, { ...response, facts: { ...facts, openingFee: NaN } }, { ...response, review: { ...response.review, observations: [null, null] } }, { ...response, review: { ...response.review, observations: response.review.observations.map(o => ({ ...o, evidenceIds: ['invented'] })) } }, { ...response, metadata: { ...response.metadata, generationMs: -1 } }]) assert.throws(() => validateRiskResponse(invalid, snapshot));
});
