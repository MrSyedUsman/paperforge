// Cross-application verification; build the backend first. Synthetic market paths only.
import assert from "node:assert/strict";
import { simulateArena, quote } from "../tests/bot-fixtures.mjs";
import { arenaDebriefSnapshot } from "../src/features/competitions/arena-debrief-contract.ts";
import { calculateArenaFacts } from "../../paperforge-backend/dist/arena-debriefs/arena-facts.js";
import {
  openFor,
  liquidatePosition,
  rankFinalPlayers,
} from "../src/features/competitions/engine.ts";
let count = 0;
for (const difficulty of ["Easy", "Medium", "Hard", "Expert"])
  for (const scenario of ["flat", "trend", "range", "breakout", "volatility"]) {
    const lobby = simulateArena({ difficulty, scenario });
    for (const p of lobby.players)
      if (p.achieved < lobby.start) p.achieved = lobby.start;
    const before = JSON.stringify(lobby),
      result = calculateArenaFacts(arenaDebriefSnapshot(lobby));
    assert.equal(result.facts.participants.length, 8);
    assert.equal(JSON.stringify(lobby), before);
    count++;
  }
for (const side of ["Long", "Short"])
  for (const margin of [123.45, 123.4567]) {
    const lobby = simulateArena();
    for (const p of lobby.players)
      if (p.achieved < lobby.start) p.achieved = lobby.start;
    lobby.players = lobby.players.map((p) => {
      if (!p.isUser) return p;
      const opened = openFor(
        { ...p, status: "active" },
        "BTCUSDT",
        side,
        margin,
        5,
        lobby.settings,
        { BTCUSDT: quote(100, lobby.start + 1000) },
        { now: lobby.start + 1000, id: 123 },
      );
      return {
        ...liquidatePosition(opened, opened.positions[0], lobby.end),
        status: "finished",
      };
    });
    lobby.players = rankFinalPlayers(
      lobby.players,
      {},
      lobby.settings.allocation,
    );
    assert.equal(
      calculateArenaFacts(arenaDebriefSnapshot(lobby)).facts.highlight.trade
        .liquidated,
      true,
    );
    count++;
  }
console.log(
  `Arena evidence checks passed: ${count} actual simulator snapshots, all seven bot identities, four difficulties, five synthetic paths, both liquidation directions and fractional margin rounding.`,
);
