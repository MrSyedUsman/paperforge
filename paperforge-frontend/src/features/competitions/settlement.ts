import type { Lobby, Stats, Status, Event } from "./types.ts";
import type { Quote } from "../../lib/market-data/markets.ts";
import { closePosition, pricesFor, finite, rankFinalPlayers, equityFor, eligibilityFor } from "./engine.ts";
import { roundMoney } from "../../lib/simulation/trading.ts";
import { money, resultLabel } from "./constants.ts";

export function event(text: string, tone: Event["tone"] = "info") {
  return { id: Date.now() + Math.random(), text, at: Date.now(), tone };
}


export function settleLobby(current: Lobby, quotes: Record<string, Quote>): Lobby {
    if (current.status === "finished") return current;
    const finalQuotes = { ...quotes },
      finalMarks = Object.fromEntries(
        current.players.flatMap((p) =>
          p.positions.map((pos) => [
            pos.pair,
            pricesFor(finalQuotes, pos.pair) || pos.entry,
          ]),
        ),
      );
    let players = current.players.map((p) =>
      p.positions.reduce(
        (x, pos) =>
          closePosition(
            x,
            pos,
            "Time settlement",
            finite(finalMarks[pos.pair], pos.entry),
          ),
        p,
      ),
    );
    players = rankFinalPlayers(
      players,
      finalQuotes,
      current.settings.allocation,
    ).map((p) => ({
      ...p,
      status: p.status === "eliminated" ? "eliminated" : ("finished" as Status),
    }));
    const user = players.find((p) => p.isUser)!,
      eligibility = eligibilityFor(user, current.settings.allocation),
      winner = players.find(
        (p) => eligibilityFor(p, current.settings.allocation).eligible,
      ),
      winnerEvent = winner
        ? event(
            `${winner.name} wins with ${money(equityFor(winner, finalQuotes))} virtual equity`,
            "up",
          )
        : event(
            `No participant met winner eligibility. The competition ended without an awarded winner.`,
            "down",
          ),
      userEligibilityEvent = !eligibility.eligible
        ? event(
            `${user.name} was not winner-eligible: ${eligibility.reason} ${winner ? `${winner.name} takes the win instead.` : "No winner was awarded."}`,
            "down",
          )
        : null;
    const next = {
      ...current,
      status: "finished" as const,
      finalized: Date.now(),
      players,
      events: [
        event(
          `Timer reached zero: all positions settled at the same final mark snapshot with closing fees deducted.`,
          "info",
        ),
        winnerEvent,
        ...(userEligibilityEvent ? [userEligibilityEvent] : []),
        ...current.events,
      ],
    };

    return next;
}

export function recordSettlement(v: Stats, current: Lobby): Stats {
  if (v.lastFinalizedLobby === current.start) return v;
  const user = current.players.find(p => p.isUser)!;
  const eligibility = eligibilityFor(user, current.settings.allocation);
  const userEq = equityFor(user, {}), rank = user.rank;
  const result = resultLabel(rank, eligibility.eligible);
  return {
      ...v,
      lastFinalizedLobby: current.start,
      wins: v.wins + (eligibility.eligible && rank === 1 ? 1 : 0),
      podiums: v.podiums + (eligibility.eligible && rank <= 3 ? 1 : 0),
      streak: eligibility.eligible && rank === 1 ? v.streak + 1 : 0,
      bestRank: v.bestRank ? Math.min(v.bestRank, rank) : rank,
      bestDifficulty:
        eligibility.eligible && rank === 1
          ? current.settings.difficulty
          : v.bestDifficulty,
      pnl: roundMoney(v.pnl + userEq - current.settings.allocation),
      trades: v.trades + user.trades.length,
      results: [
        {
          name: current.settings.name,
          difficulty: current.settings.difficulty,
          duration: current.settings.duration,
          rank,
          equity: userEq,
          result,
          at: Date.now(),
        },
        ...v.results,
      ].slice(0, 12),
    };
}
