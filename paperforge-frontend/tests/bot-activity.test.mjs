import test from "node:test";
import assert from "node:assert/strict";
import {
  entrySignal,
  exitDecision,
} from "../src/features/competitions/bot-strategies.ts";
import { signalsFor } from "../src/features/competitions/bot-signals.ts";
import { planParticipation } from "../src/features/competitions/bot-participation.ts";
import {
  BOT_POLICIES,
  entryLimit,
} from "../src/features/competitions/bot-profiles.ts";
import {
  newBotState,
  restoreBotEntry,
} from "../src/features/competitions/bot-state.ts";
import { runBotRound } from "../src/features/competitions/bot-scheduler.ts";
import {
  observedPrices,
  sampleMarkets,
} from "../src/features/competitions/bot-history.ts";
import {
  BOT_REASON_CODES,
  BOT_REASON_KINDS,
} from "@paperforge/simulation/bots";
import { arena, player, quote, markets } from "./bot-fixtures.mjs";
import { activityArena, activityScenarios } from "./bot-activity-fixtures.mjs";
const options = { level: 1, durationMs: 60000 };
const s = (changes) => ({
  price: 100.04,
  previous: 100.03,
  fast: 100.025,
  slow: 100,
  trend: 0.025,
  slope: -0.001,
  shortReturn: 0.025,
  longReturn: 0.04,
  acceleration: 0.002,
  lastReturn: 0.01,
  volatility: 0.006,
  movement: 0.007,
  volatilityRatio: 1.2,
  rangeHigh: 100.04,
  rangeLow: 99.99,
  rangeWidth: 0.05,
  z: 0.8,
  previousZ: 0.7,
  referenceMean: 100,
  meanSlope: 0.01,
  meanReady: false,
  volatilityReady: false,
  breakout: 0,
  pullback: false,
  sampleCount: 5,
  provisional: true,
  evidence: {},
  ...changes,
});
test("developing setups keep directional specialties without requiring every strong confirmation", () => {
  for (const kind of [
    "trend",
    "momentum",
    "breakout",
    "conservative",
    "adaptive",
    "volatility",
  ]) {
    const result = entrySignal(
      kind,
      s(),
      "Medium",
      false,
      "uncertain",
      options,
    );
    assert.ok(result, kind);
    assert.equal(result.side, "Long");
    assert.equal(result.quality, "developing");
    assert.equal(result.reason, BOT_REASON_CODES[`${kind}_developing`]);
  }
  assert.equal(entrySignal("trend", s(), "Medium"), null);
});
test("RiskRaven still needs an actual recovery toward its mean", () => {
  const recovering = s({
    price: 99.96,
    previous: 99.95,
    referenceMean: 100,
    z: -0.8,
    previousZ: -1.1,
    longReturn: -0.04,
    shortReturn: 0.015,
    trend: -0.02,
  });
  assert.equal(
    entrySignal("reversion", recovering, "Medium", false, "uncertain", options)
      ?.side,
    "Long",
  );
  assert.equal(
    entrySignal(
      "reversion",
      { ...recovering, lastReturn: -0.01 },
      "Medium",
      true,
      "range",
      { ...options, level: 2 },
    ),
    null,
  );
});
test("exploratory activity widens evidence modestly rather than inventing a direction", () => {
  const variation = s({ volatilityRatio: 0.8 });
  assert.equal(
    entrySignal("volatility", variation, "Medium", false, "uncertain", options),
    null,
  );
  assert.equal(
    entrySignal("volatility", variation, "Medium", true, "uncertain", {
      ...options,
      level: 2,
    })?.quality,
    "exploratory",
  );
  for (const kind of Object.values(BOT_POLICIES).map((p) => p.kind))
    assert.equal(
      entrySignal(
        kind,
        s({
          shortReturn: 0,
          longReturn: 0,
          trend: 0,
          lastReturn: 0,
          movement: 0,
          volatility: 0,
        }),
        "Hard",
        true,
        "uncertain",
        { ...options, level: 2 },
      ),
      null,
    );
});
test("fresh timestamps on unchanged marks cannot unlock new entries", () => {
  for (const kind of Object.values(BOT_POLICIES).map((p) => p.kind))
    assert.equal(
      entrySignal(kind, s({ previous: 100.04 }), "Hard", true, "trend", {
        ...options,
        level: 2,
      }),
      null,
    );
});
test("exceptional volatility and nonfinite weak signals remain blocked", () => {
  for (const volatility of [1, NaN, Infinity])
    for (const kind of Object.values(BOT_POLICIES).map((p) => p.kind))
      assert.equal(
        entrySignal(kind, s({ volatility }), "Hard", true, "uncertain", {
          ...options,
          level: 2,
        }),
        null,
      );
});
test("cold provisional indicators require five real observations and expose their limitations", () => {
  assert.equal(signalsFor([100, 100.01, 100.02, 100.03], true, true), null);
  const signal = signalsFor([100, 100.01, 100.02, 100.03, 100.04], true, true);
  assert.ok(signal.provisional);
  assert.equal(signal.sampleCount, 5);
  assert.ok(Object.values(signal.evidence).every(Number.isFinite));
  assert.equal(signalsFor([100, NaN, 100, 100, 100], true, true), null);
});
test("participation widens with idle time but is bounded by deadlines, balance and entry counts", () => {
  const lobby = arena(),
    bot = player("TrendFox"),
    policy = BOT_POLICIES.TrendFox;
  assert.equal(
    planParticipation(bot, lobby, lobby.start, policy, 5).opportunityLevel,
    1,
  );
  assert.equal(
    planParticipation(bot, lobby, lobby.start + 14000, policy, 5)
      .opportunityLevel,
    2,
  );
  assert.equal(
    planParticipation(bot, lobby, lobby.end - 1000, policy, 5).entryAllowed,
    false,
  );
  assert.equal(
    planParticipation(
      { ...bot, balance: 0 },
      lobby,
      lobby.start + 20000,
      policy,
      5,
    ).entryAllowed,
    false,
  );
  const final = activityArena();
  for (const p of final.players.filter((p) => !p.isUser))
    assert.ok(p.trades.length <= entryLimit(60000, BOT_POLICIES[p.name]));
});
test("weaker setups reduce leverage and remain inside each bot exposure and position caps", () => {
  activityArena({
    scenario: "range",
    observe(lobby) {
      for (const p of lobby.players.filter((p) => !p.isUser)) {
        const policy = BOT_POLICIES[p.name];
        assert.ok(
          p.positions.length <=
            Math.min(policy.maxPositions, lobby.settings.maxPositions),
        );
        assert.ok(
          p.positions.reduce((n, pos) => n + pos.margin, 0) <=
            1000 * policy.totalMargin + 0.011,
        );
        for (const pos of p.positions)
          if (pos.botEntry?.quality !== "preferred")
            assert.ok(
              pos.lev <= Math.max(1, Math.floor(policy.leverage * 0.85)),
            );
      }
    },
  });
});
test("cold first entries follow real warmup and remain early across ordinary movement", () => {
  const lobby = activityArena({ scenario: "gentleTrend" });
  for (const p of lobby.players.filter(
    (p) => !p.isUser && p.name !== "RiskRaven",
  )) {
    assert.ok(p.trades.length, p.name);
    const first = Math.min(...p.trades.map((t) => t.opened)) - lobby.start;
    assert.ok(first >= 8000 && first <= 20000, `${p.name}: ${first}`);
  }
  assert.equal(
    lobby.players.find((p) => p.name === "RiskRaven").trades.length,
    0,
  );
});
test("custom market lobbies constrain all new entry modes", () => {
  for (const scenario of ["gentleTrend", "range", "volatility"])
    for (const p of activityArena({ scenario, custom: true }).players)
      for (const trade of p.trades)
        assert.ok(["ETHUSDT", "SOLUSDT"].includes(trade.pair));
});
test("all-fresh completely flat paths stay inactive at every difficulty", () => {
  for (const difficulty of ["Easy", "Medium", "Hard", "Expert"])
    for (const p of activityArena({ scenario: "flat", difficulty }).players) {
      assert.equal(p.trades.length, 0);
      assert.equal(p.fees, 0);
    }
});
test("reconnect gaps require a new contiguous provisional history", () => {
  const lobby = arena(),
    now = lobby.start + 20000;
  let history = {
    BTCUSDT: [{ at: lobby.start, sourceAt: lobby.start, price: 99 }],
  };
  for (let i = 0; i < 4; i++)
    history = sampleMarkets(
      history,
      markets,
      { BTCUSDT: quote(100 + i * 0.01, now + i * 2000) },
      now + i * 2000,
      true,
    );
  assert.equal(observedPrices(history, "BTCUSDT", now + 6000).length, 4);
  const next = runBotRound(
    lobby,
    history,
    markets,
    { BTCUSDT: quote(100.03, now + 6000) },
    now + 6000,
    true,
  );
  assert.ok(next.players.every((p) => p.positions.length === 0));
});
test("entry grades survive reloads and old metadata remains compatible", () => {
  const old = {
    version: 1,
    kind: "trend",
    regime: "trend",
    reason: BOT_REASON_CODES.trend_confirmed,
    reference: 100,
    at: 1,
    signals: {},
  };
  assert.equal(restoreBotEntry(old).quality, undefined);
  for (const quality of ["preferred", "developing", "exploratory"])
    assert.equal(restoreBotEntry({ ...old, quality }).quality, quality);
  for (const [code, kinds] of Object.entries(BOT_REASON_KINDS)) {
    assert.equal(typeof BOT_REASON_CODES[code], "string");
    assert.ok(kinds.length > 0);
  }
});
test("conservative exposure-review exits are independent of eligibility and preserve immediate risk exits", () => {
  const pos = {
    id: 1,
    pair: "BTCUSDT",
    side: "Long",
    lev: 1,
    margin: 100,
    size: 100,
    entry: 100,
    liquidation: 1,
    openFee: 0.05,
    opened: 1000,
    botEntry: {
      version: 1,
      kind: "conservative",
      regime: "trend",
      reason: "test",
      reference: 100,
      at: 1000,
      signals: {},
      quality: "developing",
    },
  };
  assert.equal(
    exitDecision(
      pos,
      s(),
      100.01,
      9000,
      BOT_POLICIES.MomentumX,
      newBotState(1000),
      60000,
    )?.reason,
    "The conservative short-arena exposure review window ended",
  );
  assert.equal(
    exitDecision(
      pos,
      s(),
      80,
      2000,
      BOT_POLICIES.MomentumX,
      newBotState(1000),
      60000,
    )?.reason,
    "Position loss reached the strategy risk limit",
  );
});
test("synthetic activity remains reproducible with the updated participation rules", () => {
  const a = activityArena({ scenario: "range", custom: true }),
    b = activityArena({ scenario: "range", custom: true });
  assert.deepEqual(a.players, b.players);
  assert.ok(activityScenarios.includes("flat"));
});
