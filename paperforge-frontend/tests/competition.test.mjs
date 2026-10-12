import assert from "node:assert/strict";
import test from "node:test";
import { defaults } from "../src/features/competitions/constants.ts";
import { closePosition, openFor, equityFor, eligibilityFor, liquidatePosition, rankFinalPlayers } from "../src/features/competitions/engine.ts";
import { safeLobby } from "../src/features/competitions/lobby-migration.ts";
import { settleLobby, recordSettlement } from "../src/features/competitions/settlement.ts";
import { emptyStats } from "../src/features/competitions/constants.ts";
import { restoreStats } from "../src/features/competitions/competition-repository.ts";

const quote = price => ({ price, markPrice: price, change: 0, volume: 0, baseVolume: 0, high: price, low: price, open: price, updatedAt: 1 });
const quotes = { BTCUSDT: quote(100) };
const settings = { ...defaults, allocation: 1000 };
const player = (id = "user") => ({ id, name: id, isUser: id === "user", strategy: "Manual trader", avatar: "PF", balance: 1000, realized: 0, fees: 0, positions: [], trades: [], status: "active", rank: 1, previousRank: 1, achieved: 1 });

test("corrupted competition stats retain valid totals and allow subsequent settlement", () => {
  const stats = restoreStats({ ...emptyStats, entered: 3, wins: null, trades: "bad", results: null, pnl: -50 });
  assert.equal(stats.entered, 3);
  assert.equal(stats.wins, 0);
  assert.equal(stats.trades, 0);
  assert.equal(stats.pnl, -50);
  assert.deepEqual(stats.results, []);
  const final = settleLobby({ version: 1, status: "active", settings, start: 1, end: 1000, players: [player(), player("bot")], events: [] }, quotes);
  assert.equal(recordSettlement(stats, final).results.length, 1);
  assert.deepEqual(restoreStats(null), emptyStats);
  assert.deepEqual(restoreStats({ results: [null, {}, { rank: 1 }] }).results, []);
});

test("saved arenas reject missing participants, invalid settings and duplicate identities", () => {
  const saved = { version: 1, status: "active", settings, start: 1, end: 1000, players: [player(), player("bot")], events: [] };
  assert.ok(safeLobby(JSON.stringify(saved)));
  for (const changes of [{ players: [] }, { players: [player("bot")] }, { players: [player(), player()] }, { settings: null }, { settings: { ...settings, custom: null } }]) {
    assert.equal(safeLobby(JSON.stringify({ ...saved, ...changes })), null);
  }
});

test("competition open and close charge the same fees as normal trading", () => {
  const opened = openFor(player(), "BTCUSDT", "Long", 100, 10, settings, quotes);
  assert.equal(opened.balance, 899.5);
  assert.equal(equityFor(opened, quotes), 999.5);
  const closed = closePosition(opened, opened.positions[0], "Manual close", 110);
  assert.equal(closed.balance, 1099);
  assert.equal(closed.realized, 99);
  assert.equal(closed.fees, 1);
  assert.equal(closed.positions.length, 0);
});

test("competition engine enforces leverage, balance and position limits", () => {
  const user = player();
  assert.equal(openFor(user, "BTCUSDT", "Long", 100, 11, settings, quotes), user);
  assert.equal(openFor(user, "BTCUSDT", "Long", 1000, 10, settings, quotes), user);
  const opened = openFor(user, "BTCUSDT", "Long", 100, 10, settings, quotes);
  assert.equal(openFor(opened, "BTCUSDT", "Long", 100, 10, { ...settings, maxPositions: 1 }, quotes), opened);
  assert.equal(openFor(opened, "BTCUSDT", "Long", 100, 10, { ...settings, repeats: false }, quotes), opened);
});

test("competition liquidation loses isolated margin without taking available balance", () => {
  const opened = openFor(player(), "BTCUSDT", "Long", 100, 10, settings, quotes);
  const liquidated = liquidatePosition(opened, opened.positions[0]);
  assert.equal(liquidated.balance, opened.balance);
  assert.equal(liquidated.realized, -100.5);
  assert.equal(liquidated.positions.length, 0);
  assert.equal(liquidated.trades[0].reason, "Liquidation");
});

test("final awards require a trade and cumulative margin of half the allocation", () => {
  const idle = player("idle");
  const opened = openFor(player(), "BTCUSDT", "Long", 500, 1, settings, quotes);
  assert.equal(eligibilityFor(idle, 1000).eligible, false);
  assert.equal(eligibilityFor(opened, 1000).eligible, true);
  const ranked = rankFinalPlayers([idle, opened], quotes, 1000);
  assert.equal(ranked[0].id, "user");
});

test("saved competition trades retain their fields when legacy fees migrate", () => {
  const opened = openFor(player(), "BTCUSDT", "Long", 100, 10, settings, quotes);
  const closed = closePosition(opened, opened.positions[0], "Manual close", 110);
  const legacy = { ...closed, realized: 99.5, trades: [{ ...closed.trades[0], pnl: 99.5 }] };
  const lobby = safeLobby(JSON.stringify({ version: 1, status: "finished", settings, start: 0, end: 1000, players: [legacy], events: [] }));
  assert.equal(lobby.feeAccounting, 2);
  assert.equal(lobby.players[0].realized, 99);
  assert.equal(lobby.players[0].trades[0].pnl, 99);
  assert.equal(lobby.players[0].trades[0].exit, 110);
  assert.equal(safeLobby("invalid JSON"), null);
});

test("time settlement closes all players at one price snapshot and records the result once", () => {
  const user = openFor(player(), "BTCUSDT", "Long", 500, 1, settings, quotes);
  const bot = openFor(player("bot"), "BTCUSDT", "Short", 500, 1, settings, quotes);
  const current = { version: 1, feeAccounting: 2, status: "active", settings, start: 1, end: 1000, players: [user, bot], events: [] };
  const final = settleLobby(current, { BTCUSDT: quote(110) });
  assert.equal(final.status, "finished");
  assert.equal(final.players[0].id, "user");
  for (const participant of final.players) {
    assert.equal(participant.positions.length, 0);
    assert.equal(participant.trades[0].exit, 110);
    assert.equal(participant.trades[0].reason, "Time settlement");
  }
  assert.equal(current.players[0].positions.length, 1, "Input remains unchanged");
  assert.equal(settleLobby(final, quotes), final, "A finalized lobby is not settled again");
  const stats = recordSettlement({ ...emptyStats, entered: 1 }, final);
  assert.equal(stats.wins, 1);
  assert.equal(stats.podiums, 1);
  assert.equal(stats.pnl, 49.5);
  assert.equal(stats.results.length, 1);
  assert.equal(recordSettlement(stats, final), stats, "Replaying a saved result does not count it again");
});
