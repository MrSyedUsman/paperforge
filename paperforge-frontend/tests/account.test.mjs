import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultProfile, defaultAccount, parseAccount, accountRepository } from "../src/features/account/account-repository.ts";
import { accountMetrics, createPosition, closePosition, liquidatePosition, validateOrder } from "../src/features/account/engine.ts";
import { fallbackMarkets } from "../src/lib/market-data/markets.ts";
import { browserStorage } from "../src/lib/storage/browser-storage.ts";
import { restoreMarketCache } from "../src/lib/market-data/market-repository.ts";

const market = fallbackMarkets()[0];
const profile = createDefaultProfile(1_700_000_000_000);
const quote = price => ({ price, markPrice: price, change: 0, volume: 0, baseVolume: 0, high: price, low: price, open: price, updatedAt: 1 });

test("corrupted cached markets cannot break the offline market catalogue", () => {
  assert.deepEqual(restoreMarketCache({ markets: [null, {}, { ...market, pair: 42 }, { ...market, pricePrecision: 1000 }, market] }), [market]);
  assert.deepEqual(restoreMarketCache(null), []);
  assert.deepEqual(restoreMarketCache({ markets: "bad" }), []);
});

test("a profitable long round trip reconciles equity and both fees", () => {
  const position = createPosition(market, 100, 100, 10, "Long", 1);
  const available = 1000 - position.margin - position.openFee;
  const openMetrics = accountMetrics(available, [position], [], [], { BTCUSDT: quote(110) });
  assert.equal(openMetrics.equity, 1099.5);
  const { record, walletCredit } = closePosition(position, 110, "closed");
  assert.equal(record.pnl, 99);
  assert.equal(record.totalFees, 1);
  assert.equal(available + walletCredit, 1000 + record.pnl);
});

test("short settlement and isolated liquidation preserve wallet accounting", () => {
  const position = createPosition(market, 100, 100, 10, "Short", 1);
  assert.equal(closePosition(position, 90, "closed").record.pnl, 99);
  const loss = liquidatePosition(position, "liquidated");
  assert.equal(loss.pnl, -100.5);
  const available = 1000 - position.margin - position.openFee;
  assert.equal(accountMetrics(available, [], [loss], [], {}).equity, 1000 + loss.pnl);
  assert.equal(loss.reason, "Liquidation");
});

test("order validation requires live prices and balance including entry fees", () => {
  assert.match(validateOrder(market, "offline", 100, 100, 10, 1000), /live price/);
  assert.match(validateOrder(market, "live", 100, 100, 10, 100), /opening fee/);
  assert.match(validateOrder(market, "live", 100, NaN, 10, 1000), /valid margin/);
  assert.match(validateOrder(market, "live", 100, 100, 51, 1000), /Leverage/);
  assert.equal(validateOrder(market, "live", 100, 100, 10, 1000), "");
});

test("current saved accounts retain balance, profile, trades and selections", () => {
  const position = createPosition(market, 100, 100, 10, "Long", 1);
  const saved = { ...defaultAccount(profile), balance: 899.5, positions: [position], favorites: ["BTCUSDT"], selectedPair: "ETHUSDT", claimAt: 20000 };
  assert.deepEqual(parseAccount(JSON.stringify(saved), profile, 10000), saved);
});

test("legacy saved data migrates fees, liquidation and base-symbol favorites", () => {
  const position = createPosition(market, 100, 100, 10, "Long", 1);
  const closed = { ...position, pnl: 100, closed: "closed", liquidation: 0 };
  const saved = parseAccount(JSON.stringify({ version: 3, favorites: ["BTC"], positions: [{ ...position, liquidation: 0 }], history: [closed], selectedPair: "ETH" }), profile, 10000);
  assert.equal(saved.history[0].pnl, 99.5);
  assert.equal(saved.history[0].roi, 99.5);
  assert.equal(saved.positions[0].liquidation, position.liquidation);
  assert.deepEqual(saved.favorites, ["BTCUSDT"]);
  assert.equal(saved.selectedPair, "ETHUSDT");
});

test("partially corrupted account fields cannot break profile or portfolio rendering", () => {
  const position = createPosition(market, 100, 100, 10, "Long", 1);
  const saved = parseAccount(JSON.stringify({
    ...defaultAccount(profile), balance: 899.5,
    profile: { ...profile, name: "Paper Forge", bio: null, username: null, showStats: null },
    favorites: ["BTCUSDT", null], recent: [null, "ETHUSDT"],
    positions: [null, {}, position], history: [null, {}], activity: [null, {}],
  }), profile);
  assert.equal(saved.balance, 899.5);
  assert.equal(saved.profile.name, "Paper Forge");
  assert.equal(saved.profile.bio, profile.bio);
  assert.equal(saved.profile.username, profile.username);
  assert.equal(saved.profile.showStats, profile.showStats);
  assert.deepEqual(saved.favorites, ["BTCUSDT"]);
  assert.deepEqual(saved.recent, ["ETHUSDT"]);
  assert.deepEqual(saved.positions, [position]);
  assert.deepEqual(saved.history, []);
  assert.deepEqual(saved.activity, []);
});

test("storage is safe during SSR and when browser storage is blocked", () => {
  assert.deepEqual(accountRepository.load(profile), defaultAccount(profile));
  assert.equal(browserStorage.write("paperforge-v2", {}), false);
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("Blocked"); } } });
  try {
    assert.deepEqual(accountRepository.load(profile), defaultAccount(profile));
    assert.equal(browserStorage.write("paperforge-v2", {}), false);
    assert.doesNotThrow(() => browserStorage.remove("paperforge-v2"));
  } finally {
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else delete globalThis.window;
  }
});
