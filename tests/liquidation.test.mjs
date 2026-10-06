import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLiquidationPrice,
  findLiquidatedPositions,
  isLiquidated,
  liquidationDistancePercent,
  liquidationRiskStatus,
  settleIsolatedLiquidation,
} from "../src/lib/simulation/liquidation.ts";

test("long and short liquidation thresholds move in the correct direction", () => {
  const common = { entry: 100, leverage: 50, margin: 100, notional: 5000 };
  assert.ok(calculateLiquidationPrice({ ...common, side: "Long" }) < 100);
  assert.ok(calculateLiquidationPrice({ ...common, side: "Short" }) > 100);
});

test("higher leverage places liquidation closer to entry", () => {
  const low = calculateLiquidationPrice({ entry: 100, side: "Long", leverage: 5, margin: 100, notional: 500 });
  const high = calculateLiquidationPrice({ entry: 100, side: "Long", leverage: 50, margin: 100, notional: 5000 });
  assert.ok(high > low);
});

test("threshold detection handles both directions and multiple positions", () => {
  assert.equal(isLiquidated(98, 98.6, "Long"), true);
  assert.equal(isLiquidated(102, 101.4, "Short"), true);
  const hit = findLiquidatedPositions([
    { pair: "BTCUSDT", side: "Long", liquidation: 98.6 },
    { pair: "ETHUSDT", side: "Short", liquidation: 101.4 },
    { pair: "SOLUSDT", side: "Long", liquidation: 90 },
  ], { BTCUSDT: 98, ETHUSDT: 102, SOLUSDT: 95 });
  assert.equal(hit.length, 2);
});

test("isolated liquidation exhausts margin without taking wallet balance", () => {
  const result = settleIsolatedLiquidation({ margin: 100, notional: 5000, openFee: 2.5, liquidationPrice: 98.6 });
  assert.equal(result.marginLost, 100);
  assert.equal(result.walletCredit, 0);
  assert.equal(result.netPnl, -102.5);
  assert.equal(result.executionPrice, 98.6);
  assert.ok(result.liquidationFee > 0 && result.liquidationFee <= 100);
});

test("distance and risk states are directional", () => {
  assert.ok(liquidationDistancePercent(100, 95, "Long") > 0);
  assert.ok(liquidationDistancePercent(100, 105, "Short") > 0);
  assert.equal(liquidationRiskStatus(0.5), "Critical");
  assert.equal(liquidationRiskStatus(2), "High");
  assert.equal(liquidationRiskStatus(5), "Elevated");
  assert.equal(liquidationRiskStatus(9), "Safe");
});
