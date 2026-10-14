import { BOT_CATALOG, BOT_REASON_CODES } from "@paperforge/simulation/bots";
import type { Lobby } from "./types";
export type DebriefFact = {
  id: string;
  label: string;
  value: string;
  participantId?: string;
  tradeId?: number;
  source: "calculated" | "recorded" | "limitation";
};
export type ParticipantMetric = {
  id: string;
  name: string;
  isUser: boolean;
  style: string;
  equity: number;
  equityChange: number;
  tradingNet: number | null;
  fees: number | null;
  usedMargin: number;
  requiredMargin: number;
  eligible: boolean;
  trades: number;
  liquidations: number;
  averageLeverage: number | null;
  rawRank: number | null;
  awardedRank: number | null;
  reconciled: boolean;
  forfeited: number | null;
};
export type HighlightTrade = {
  id: number;
  pair: string;
  side: string;
  leverage: number;
  margin: number;
  gross: number;
  net: number | null;
  fees: number | null;
  liquidated: boolean;
  opened: number;
  closed: number;
};
export type ArenaFacts = {
  arenaKey: string;
  fingerprint: string;
  completionReason: string;
  allocation: number;
  userId: string;
  winnerId: string | null;
  outcome: string;
  participants: ParticipantMetric[];
  mirror: {
    participantId: string;
    selection: string;
    speciality: string;
    looksFor: string;
    recordedReason: string | null;
    recordedAt: number | null;
  } | null;
  highlight: {
    participantId: string;
    selection: string;
    trade: HighlightTrade;
  } | null;
  highlightUnavailable: string | null;
  facts: DebriefFact[];
  promptEvidenceIds: string[];
  limitations: string[];
};
type EvidenceText = { text: string; evidenceIds: string[] };
export type ArenaDebriefResponse = {
  facts: ArenaFacts;
  review: {
    story: EvidenceText;
    observations: EvidenceText[];
    mirror: (EvidenceText & { participantId: string }) | null;
    highlight: (EvidenceText & { tradeId: number }) | null;
    mission: EvidenceText & { question: string };
  };
  metadata: {
    model: string;
    promptVersion: string;
    generatedAt: string;
    generationMs: number;
    requestMs: number;
    cached: boolean;
  };
};
const finiteOrNull = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export function arenaDebriefSnapshot(lobby: Lobby) {
  const quit =
    lobby.players.some((p) =>
      p.trades.some((t) =>
        ["Quit settlement", "Opponent win settlement"].includes(t.reason),
      ),
    ) ||
    lobby.events.some((e) => / quit\..*wins by abandonment\.$/.test(e.text));
  const completionReason =
    lobby.completionReason ??
    (quit
      ? "abandonment"
      : lobby.finalized && lobby.finalized >= lobby.end
        ? "time"
        : lobby.settings.elimination &&
            lobby.players.filter((p) => p.status !== "eliminated").length <= 1
          ? "elimination"
          : "unknown");
  const s = lobby.settings;
  return {
    version: 1,
    status: lobby.status,
    completionReason,
    start: lobby.start,
    end: lobby.end,
    finalized: finiteOrNull(lobby.finalized),
    settings: {
      duration: s.duration,
      spots: s.spots,
      allocation: s.allocation,
      maxLeverage: s.maxLeverage,
      maxPositions: s.maxPositions,
      difficulty: s.difficulty,
      elimination: s.elimination,
      marketMode: s.marketMode,
      custom: [...s.custom],
      repeats: s.repeats,
    },
    players: lobby.players.map((p, order) => {
      const bot = p.isUser
        ? undefined
        : BOT_CATALOG[Number(p.id.replace("bot-", ""))];
      const retained = !p.isUser
        ? [...p.trades]
            .sort((a, b) => b.closed - a.closed || a.id - b.id)
            .find(
              (t) =>
                t.botEntry?.version === 1 &&
                t.botEntry.kind === bot?.kind &&
                Object.values(BOT_REASON_CODES).includes(t.botEntry.reason),
            )
        : undefined;
      const entry = retained?.botEntry;
      const reasonCode = entry
        ? Object.keys(BOT_REASON_CODES).find(
            (k) => BOT_REASON_CODES[k] === entry.reason,
          )
        : undefined;
      return {
        id: p.id,
        isUser: p.isUser,
        botName: p.isUser ? null : (bot?.name ?? null),
        order,
        balance: p.balance,
        realized: finiteOrNull(p.realized),
        fees: finiteOrNull(p.fees),
        achieved: finiteOrNull(p.achieved),
        rank: finiteOrNull(p.rank),
        status: p.status,
        positions: p.positions.map((pos) => ({ id: pos.id })),
        trades: p.trades.map((t) => ({
          id: t.id,
          pair: t.pair,
          side: t.side,
          lev: t.lev,
          margin: t.margin,
          size: t.size,
          entry: t.entry,
          exit: t.exit,
          openFee: finiteOrNull(t.openFee),
          fee: finiteOrNull(t.fee),
          pnl: finiteOrNull(t.pnl),
          opened: t.opened,
          closed: t.closed,
          reason:
            t.reason === "Liquidation"
              ? "liquidation"
              : t.reason === "Quit settlement"
                ? "quit"
                : t.reason === "Opponent win settlement"
                  ? "opponent"
                  : t.reason === "Time settlement"
                    ? "time"
                    : "normal",
          maintenanceMarginRate: finiteOrNull(t.maintenanceMarginRate),
          liquidationFeeRate: finiteOrNull(t.liquidationFeeRate),
        })),
        decision:
          retained && entry && reasonCode
            ? {
                tradeId: retained.id,
                version: entry.version,
                kind: entry.kind,
                regime: entry.regime,
                at: entry.at,
                reasonCode,
                signals: { ...entry.signals },
              }
            : null,
      };
    }),
  };
}
export type ArenaPayload = ReturnType<typeof arenaDebriefSnapshot>;
function record(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}
function text(v: unknown, max = 600): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function number(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
const fail = (): never => {
  throw new Error(
    "The debrief response could not be checked. Please try again.",
  );
};
export function validateArenaFacts(
  value: unknown,
  input: ArenaPayload,
): ArenaFacts {
  if (
    !record(value) ||
    value.arenaKey !== `${input.start}:${input.end}` ||
    typeof value.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    !text(value.outcome, 80) ||
    !text(value.completionReason, 30) ||
    value.allocation !== input.settings.allocation ||
    value.completionReason !== input.completionReason ||
    value.userId !== "user" ||
    !Array.isArray(value.participants) ||
    value.participants.length !== input.players.length
  )
    return fail();
  const participantIds = new Set(input.players.map((p) => p.id));
  if (
    value.participants.some(
      (p) =>
        !record(p) ||
        typeof p.id !== "string" ||
        !participantIds.has(p.id) ||
        !text(p.name, 40) ||
        !text(p.style, 80) ||
        p.isUser !== (p.id === "user") ||
        typeof p.eligible !== "boolean" ||
        typeof p.reconciled !== "boolean" ||
        [
          "equity",
          "equityChange",
          "usedMargin",
          "requiredMargin",
          "trades",
          "liquidations",
        ].some((k) => !number(p[k])) ||
        [
          "tradingNet",
          "fees",
          "averageLeverage",
          "rawRank",
          "awardedRank",
          "forfeited",
        ].some((k) => p[k] !== null && !number(p[k])),
    ) ||
    new Set(value.participants.map((p) => p.id)).size !== participantIds.size ||
    value.participants.filter((p) => p.isUser).length !== 1
  )
    return fail();
  if (
    value.winnerId !== null &&
    (typeof value.winnerId !== "string" || !participantIds.has(value.winnerId))
  )
    return fail();
  if (
    !Array.isArray(value.facts) ||
    value.facts.length > 140 ||
    value.facts.length < 10 ||
    value.facts.some(
      (f) =>
        !record(f) ||
        !text(f.id, 80) ||
        !text(f.label, 180) ||
        !text(f.value, 400) ||
        !["calculated", "recorded", "limitation"].includes(String(f.source)) ||
        (f.participantId !== undefined &&
          (typeof f.participantId !== "string" ||
            !participantIds.has(f.participantId))),
    )
  )
    return fail();
  const ids = new Set(value.facts.map((f) => f.id));
  if (
    ids.size !== value.facts.length ||
    !Array.isArray(value.promptEvidenceIds) ||
    value.promptEvidenceIds.some((id) => !ids.has(id)) ||
    !Array.isArray(value.limitations) ||
    value.limitations.length > 10 ||
    value.limitations.some((l) => !text(l, 700))
  )
    return fail();
  if (value.mirror !== null) {
    const m = value.mirror;
    if (
      !record(m) ||
      typeof m.participantId !== "string" ||
      m.participantId === "user" ||
      !participantIds.has(m.participantId) ||
      !text(m.selection) ||
      !text(m.speciality) ||
      !text(m.looksFor) ||
      (m.recordedReason !== null && !text(m.recordedReason)) ||
      (m.recordedAt !== null && !number(m.recordedAt))
    )
      return fail();
  }
  if (value.highlight !== null) {
    const h = value.highlight;
    if (
      !record(h) ||
      h.participantId !== "user" ||
      !text(h.selection) ||
      !record(h.trade) ||
      !number(h.trade.id) ||
      !input.players
        .find((p) => p.id === "user")
        ?.trades.some(
          (t) => t.id === (h.trade as Record<string, unknown>).id,
        ) ||
      !text(h.trade.pair, 30) ||
      !["Long", "Short"].includes(String(h.trade.side)) ||
      typeof h.trade.liquidated !== "boolean" ||
      ["leverage", "margin", "gross", "opened", "closed"].some(
        (k) => !number((h.trade as Record<string, unknown>)[k]),
      ) ||
      ["net", "fees"].some(
        (k) =>
          (h.trade as Record<string, unknown>)[k] !== null &&
          !number((h.trade as Record<string, unknown>)[k]),
      )
    )
      return fail();
  }
  if (value.highlightUnavailable !== null && !text(value.highlightUnavailable))
    return fail();
  return value as unknown as ArenaFacts;
}
export function validateArenaDebrief(
  value: unknown,
  input: ArenaPayload,
): ArenaDebriefResponse {
  if (!record(value) || !record(value.review) || !record(value.metadata))
    return fail();
  const facts = validateArenaFacts(value.facts, input),
    r = value.review,
    m = value.metadata,
    known = new Set(facts.promptEvidenceIds);
  const section = (v: unknown, max: number) =>
    record(v) &&
    text(v.text, max) &&
    Array.isArray(v.evidenceIds) &&
    v.evidenceIds.length >= 1 &&
    v.evidenceIds.length <= 5 &&
    v.evidenceIds.every((id) => typeof id === "string" && known.has(id));
  if (
    !section(r.story, 750) ||
    !Array.isArray(r.observations) ||
    r.observations.length < 2 ||
    r.observations.length > 3 ||
    r.observations.some((o) => !section(o, 600)) ||
    !section(r.mission, 450) ||
    !record(r.mission) ||
    !text(r.mission.question, 260)
  )
    return fail();
  if (
    facts.mirror
      ? !section(r.mirror, 750) ||
        !record(r.mirror) ||
        r.mirror.participantId !== facts.mirror.participantId
      : r.mirror !== null
  )
    return fail();
  if (
    facts.highlight
      ? !section(r.highlight, 650) ||
        !record(r.highlight) ||
        r.highlight.tradeId !== facts.highlight.trade.id
      : r.highlight !== null
  )
    return fail();
  if (
    !text(m.model, 101) ||
    !text(m.promptVersion, 80) ||
    !text(m.generatedAt, 80) ||
    !Number.isFinite(Date.parse(m.generatedAt)) ||
    !number(m.generationMs) ||
    m.generationMs < 0 ||
    !number(m.requestMs) ||
    m.requestMs < 0 ||
    typeof m.cached !== "boolean"
  )
    return fail();
  return value as unknown as ArenaDebriefResponse;
}
