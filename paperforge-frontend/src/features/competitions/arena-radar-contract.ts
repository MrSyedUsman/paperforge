import type { Lobby } from "./types";
import type { Quote } from "../../lib/market-data/markets";
import {
  arenaDebriefSnapshot,
  type DebriefFact,
} from "./arena-debrief-contract.ts";
export function radarSnapshot(
  lobby: Lobby,
  quotes: Record<string, Quote>,
  feed: string,
  at: number,
) {
  const base = arenaDebriefSnapshot(lobby),
    required = new Set(
      lobby.players.flatMap((p) => p.positions.map((pos) => pos.pair)),
    );
  return {
    at,
    arena: {
      ...base,
      status: lobby.status,
      completionReason: "unknown",
      finalized: null,
      players: base.players.map((p) => ({
        ...p,
        positions: lobby.players
          .find((player) => player.id === p.id)!
          .positions.map((pos) => ({
            id: pos.id,
            pair: pos.pair,
            side: pos.side,
            lev: pos.lev,
            margin: pos.margin,
            size: pos.size,
            entry: pos.entry,
            openFee: Number.isFinite(pos.openFee) ? pos.openFee : null,
            opened: pos.opened,
            maintenanceMarginRate: pos.maintenanceMarginRate ?? null,
            liquidationFeeRate: pos.liquidationFeeRate ?? null,
          })),
      })),
    },
    marks:
      feed === "live"
        ? [...required].flatMap((pair) => {
            const q = quotes[pair],
              price = q?.markPrice || q?.price;
            return q &&
              Number.isFinite(price) &&
              price > 0 &&
              Number.isFinite(q.updatedAt)
              ? [{ pair, price, timestamp: q.updatedAt }]
              : [];
          })
        : [],
  };
}
export type RadarSnapshot = ReturnType<typeof radarSnapshot>;
export type RadarRequest = {
  current: RadarSnapshot;
  previous: RadarSnapshot | null;
};
export type RadarPlayer = {
  id: string;
  name: string;
  speciality: string;
  freeBalance: number;
  reservedMargin: number;
  unrealized: number | null;
  equity: number | null;
  realizedNet: number | null;
  fees: number | null;
  exposure: number;
  averageLeverage: number | null;
  opened: number;
  closed: number;
  liquidations: number;
  usedMargin: number;
  requiredMargin: number;
  eligible: boolean;
  rank: number | null;
};
export type RadarFacts = {
  arenaKey: string;
  fingerprint: string;
  previousFingerprint: string | null;
  at: number;
  end: number;
  remainingMs: number;
  comparison: boolean;
  comparisonNote: string;
  headline: { kind: string; title: string; evidenceIds: string[] };
  opponentId: string;
  topic: string;
  players: RadarPlayer[];
  facts: DebriefFact[];
  limitations: string[];
};
export type RadarText = { text: string; evidenceIds: string[] };
export type RadarResult = {
  facts: RadarFacts;
  review: {
    headline: RadarText;
    observations: RadarText[];
    question: RadarText;
  };
  metadata: {
    model: string;
    promptVersion: string;
    generatedAt: string;
    generationMs: number;
    requestMs: number;
    cached: boolean;
    cooldownUntil: number;
  };
};
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max = 700): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const fail = (): never => {
  throw new Error(
    "The radar response does not match the captured arena evidence. Please try again.",
  );
};
export function validateRadarFacts(
  value: unknown,
  input: RadarRequest,
): RadarFacts {
  if (
    !record(value) ||
    value.arenaKey !==
      `${input.current.arena.start}:${input.current.arena.end}` ||
    value.at !== input.current.at ||
    value.end !== input.current.arena.end ||
    !str(value.fingerprint, 64) ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    !num(value.remainingMs) ||
    typeof value.comparison !== "boolean" ||
    !str(value.comparisonNote) ||
    !str(value.topic) ||
    !Array.isArray(value.players) ||
    value.players.length !== input.current.arena.players.length ||
    !Array.isArray(value.facts) ||
    value.facts.length > 60 ||
    !Array.isArray(value.limitations) ||
    value.limitations.length > 10 ||
    value.limitations.some((l) => !str(l))
  )
    return fail();
  const ids = new Set(input.current.arena.players.map((p) => p.id));
  if (
    value.players.some(
      (p) =>
        !record(p) ||
        !str(p.id, 30) ||
        !ids.has(p.id) ||
        !str(p.name, 40) ||
        !str(p.speciality, 200) ||
        typeof p.eligible !== "boolean" ||
        [
          "freeBalance",
          "reservedMargin",
          "exposure",
          "opened",
          "closed",
          "liquidations",
          "usedMargin",
          "requiredMargin",
        ].some((k) => !num(p[k])) ||
        [
          "unrealized",
          "equity",
          "realizedNet",
          "fees",
          "averageLeverage",
          "rank",
        ].some((k) => p[k] !== null && !num(p[k])),
    ) ||
    new Set(value.players.map((p) => p.id)).size !== ids.size ||
    typeof value.opponentId !== "string" ||
    value.opponentId === "user" ||
    !ids.has(value.opponentId)
  )
    return fail();
  if (
    value.facts.some(
      (f) =>
        !record(f) ||
        !str(f.id, 80) ||
        !str(f.label, 180) ||
        !str(f.value, 700) ||
        !["calculated", "recorded", "limitation"].includes(String(f.source)) ||
        (f.participantId !== undefined && !ids.has(String(f.participantId))),
    )
  )
    return fail();
  const evidence = new Set(value.facts.map((f) => f.id));
  if (
    evidence.size !== value.facts.length ||
    !record(value.headline) ||
    !str(value.headline.kind, 40) ||
    !str(value.headline.title, 180) ||
    !Array.isArray(value.headline.evidenceIds) ||
    value.headline.evidenceIds.length < 1 ||
    value.headline.evidenceIds.some((id) => !evidence.has(id))
  )
    return fail();
  return value as unknown as RadarFacts;
}
export function validateRadarResult(
  value: unknown,
  input: RadarRequest,
): RadarResult {
  if (!record(value) || !record(value.review) || !record(value.metadata))
    return fail();
  const facts = validateRadarFacts(value.facts, input),
    v = value.review,
    m = value.metadata,
    ids = new Set(facts.facts.map((f) => f.id));
  const section = (s: unknown, max: number) =>
    record(s) &&
    str(s.text, max) &&
    Array.isArray(s.evidenceIds) &&
    s.evidenceIds.length > 0 &&
    s.evidenceIds.length <= 5 &&
    s.evidenceIds.every((id) => ids.has(id));
  if (
    !section(v.headline, 600) ||
    !Array.isArray(v.observations) ||
    v.observations.length > 2 ||
    v.observations.some((o) => !section(o, 500)) ||
    !section(v.question, 300) ||
    !str(m.model, 101) ||
    !str(m.promptVersion, 80) ||
    !str(m.generatedAt, 80) ||
    !Number.isFinite(Date.parse(m.generatedAt)) ||
    ["generationMs", "requestMs", "cooldownUntil"].some(
      (k) => !num(m[k]) || m[k] < 0,
    ) ||
    typeof m.cached !== "boolean"
  )
    return fail();
  return value as unknown as RadarResult;
}
// Price ticks alone are not activity. Bucket meaningful equity/exposure changes and recorded actions.
export function radarActivityKey(lobby: Lobby, quotes: Record<string, Quote>) {
  return JSON.stringify(
    lobby.players
      .map((p) => ({
        id: p.id,
        status: p.status,
        trades: p.trades.map((t) => t.id),
        positions: p.positions.map((pos) => pos.id),
        margin: Math.round(
          [...p.positions, ...p.trades].reduce((n, t) => n + t.margin, 0),
        ),
        equityBucket: Math.round(
          (p.balance +
            p.positions.reduce(
              (n, pos) =>
                n +
                pos.margin +
                ((pos.size *
                  ((quotes[pos.pair]?.markPrice ||
                    quotes[pos.pair]?.price ||
                    pos.entry) -
                    pos.entry)) /
                  pos.entry) *
                  (pos.side === "Long" ? 1 : -1),
              0,
            )) /
            Math.max(1, lobby.settings.allocation * 0.005),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}
