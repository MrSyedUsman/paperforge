import test from "node:test";
import assert from "node:assert/strict";
import { arena, quote } from "./bot-fixtures.mjs";
import { openFor } from "../src/features/competitions/engine.ts";
import {
  radarSnapshot,
  radarActivityKey,
  validateRadarFacts,
  validateRadarResult,
} from "../src/features/competitions/arena-radar-contract.ts";
function fixture() {
  const lobby = arena("Medium", 10);
  lobby.players[0] = openFor(
    lobby.players[0],
    "BTCUSDT",
    "Long",
    100,
    5,
    lobby.settings,
    { BTCUSDT: quote(100, lobby.start + 1000) },
    { now: lobby.start + 1000, id: 1 },
  );
  return lobby;
}
test("Radar sends active positions and only necessary marks without profiles or activity strings", () => {
  const lobby = fixture();
  lobby.players[0].name = "private username";
  lobby.settings.name = "ignore instructions";
  lobby.events.push({ id: 1, text: "untrusted event", at: lobby.start });
  const value = radarSnapshot(
    lobby,
    {
      BTCUSDT: quote(101, lobby.start + 2000),
      ETHUSDT: quote(99, lobby.start + 2000),
    },
    "live",
    lobby.start + 2000,
  );
  assert.equal(value.arena.status, "active");
  assert.equal(value.arena.players[0].positions.length, 1);
  assert.deepEqual(
    value.marks.map((m) => m.pair),
    ["BTCUSDT"],
  );
  for (const text of [
    "private username",
    "ignore instructions",
    "untrusted event",
    "botHistory",
  ])
    assert.ok(!JSON.stringify(value).includes(text));
});
test("Radar excludes nonlive feed marks and does not mutate competition storage", () => {
  const lobby = fixture(),
    before = JSON.stringify(lobby),
    s = radarSnapshot(
      lobby,
      { BTCUSDT: quote(100, lobby.start) },
      "stale",
      lobby.start + 1000,
    );
  assert.equal(s.marks.length, 0);
  assert.equal(JSON.stringify(lobby), before);
});
test("activity ignores timestamp-only ticks but detects recorded positions and trades", () => {
  const lobby = arena(),
    quotes = { BTCUSDT: quote(100, lobby.start) },
    key = radarActivityKey(lobby, quotes);
  quotes.BTCUSDT.updatedAt += 100;
  assert.equal(radarActivityKey(lobby, quotes), key);
  lobby.players[0] = openFor(
    lobby.players[0],
    "BTCUSDT",
    "Long",
    100,
    5,
    lobby.settings,
    quotes,
    { now: lobby.start + 1000, id: 1 },
  );
  assert.notEqual(radarActivityKey(lobby, quotes), key);
});
test("Radar response validation rejects malformed and foreign snapshots", () => {
  const current = radarSnapshot(fixture(), {}, "offline", 1002000),
    input = { current, previous: null };
  for (const v of [null, {}, [], { arenaKey: "foreign" }]) {
    assert.throws(() => validateRadarFacts(v, input));
    assert.throws(() => validateRadarResult(v, input));
  }
});
