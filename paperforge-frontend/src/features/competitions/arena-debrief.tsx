"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/features/auth/auth-provider";
import type { Lobby } from "./types";
import {
  arenaDebriefSnapshot,
  type ArenaPayload,
  type ArenaFacts,
  type ArenaDebriefResponse,
} from "./arena-debrief-contract";
import { fetchArenaFacts, fetchArenaDebrief } from "./arena-debrief-api";
export function ArenaDebrief({ lobby }: { lobby: Lobby }) {
  const current = arenaDebriefSnapshot(lobby),
    currentKey = JSON.stringify(current);
  const [selected, setSelected] = useState<{
      snapshot: ArenaPayload;
      key: string;
      attempt: number;
    } | null>(null),
    trigger = useRef<HTMLButtonElement>(null),
    attempt = useRef(0);
  const { accessToken } = useAuth();
  function open() {
    if (selected && selected.key === currentKey) {
      document.getElementById("arena-debrief-title")?.focus();
      return;
    }
    setSelected({
      snapshot: current,
      key: currentKey,
      attempt: ++attempt.current,
    });
  }
  function close() {
    setSelected(null);
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="arena-debrief-button"
        disabled={!accessToken || lobby.status !== "finished"}
        aria-controls="arena-debrief-panel"
        aria-expanded={Boolean(selected)}
        onClick={open}
      >
        <span aria-hidden="true">&#10023;</span> Debrief with AI
      </button>
      {selected &&
        accessToken &&
        createPortal(
          <DebriefPanel
            key={selected.attempt}
            snapshot={selected.snapshot}
            outdated={selected.key !== currentKey}
            refresh={() =>
              setSelected({
                snapshot: current,
                key: currentKey,
                attempt: ++attempt.current,
              })
            }
            close={close}
          />,
          document.body,
        )}
    </>
  );
}
type PanelProps = {
  snapshot: ArenaPayload;
  outdated: boolean;
  refresh: () => void;
  close: () => void;
};
function DebriefPanel({ snapshot, outdated, refresh, close }: PanelProps) {
  const { accessToken } = useAuth(),
    [facts, setFacts] = useState<ArenaFacts | null>(null),
    [result, setResult] = useState<ArenaDebriefResponse | null>(null),
    [status, setStatus] = useState<"loading" | "ready" | "error">("loading"),
    [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null),
    closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    if (outdated) return;
    let active = true;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    async function load() {
      try {
        if (!accessToken)
          throw new Error("Sign in to request an arena debrief.");
        const calculated = await fetchArenaFacts(
          snapshot,
          accessToken,
          controller.signal,
        );
        if (!active) return;
        setFacts(calculated);
        const data = await fetchArenaDebrief(
          snapshot,
          accessToken,
          controller.signal,
        );
        if (data.facts.fingerprint !== calculated.fingerprint)
          throw new Error(
            "The arena evidence changed while the debrief was loading. Please try again.",
          );
        if (active) {
          setResult(data);
          setStatus("ready");
        }
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(
          controller.signal.aborted
            ? "The debrief took too long. Please try again."
            : error instanceof TypeError
              ? "Could not reach the debrief server. Check your connection."
              : error instanceof Error
                ? error.message
                : "The debrief is unavailable.",
        );
      } finally {
        clearTimeout(timer);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [snapshot, accessToken, outdated]);
  const user = facts?.participants.find((p) => p.isUser),
    mirror = facts?.participants.find(
      (p) => p.id === facts.mirror?.participantId,
    ),
    evidence = new Map(facts?.facts.map((f) => [f.id, f]));
  const money = (n: number | null) =>
    n === null
      ? "Unavailable"
      : `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
  function citations(ids: string[]) {
    return (
      <div
        className="arena-debrief-evidence"
        aria-label="Supporting arena evidence"
      >
        {ids.map((id) => {
          const fact = evidence.get(id);
          return fact ? (
            <span key={id}>
              {fact.label}: <b>{fact.value}</b>
              <small>
                {fact.source === "recorded"
                  ? "Recorded snapshot"
                  : fact.source === "limitation"
                    ? "Data limitation"
                    : "Calculated"}
              </small>
            </span>
          ) : null;
        })}
      </div>
    );
  }
  return (
    <aside
      id="arena-debrief-panel"
      className="arena-debrief-panel"
      role="region"
      aria-labelledby="arena-debrief-title"
      aria-busy={status === "loading"}
    >
      <div className="arena-debrief-heading">
        <div>
          <span className="ai-eyebrow">AFTER THE ARENA</span>
          <h2 id="arena-debrief-title" ref={heading} tabIndex={-1}>
            Your arena, understood
          </h2>
          <p>Evidence. Perspective. Your next practice goal.</p>
        </div>
        <button
          type="button"
          className="ai-review-close"
          aria-label="Close arena debrief"
          onClick={close}
        >
          &times;
        </button>
      </div>
      <div className="arena-debrief-body">
        {outdated && (
          <div className="ai-review-error" role="status">
            <b>This debrief is outdated</b>
            <p>The underlying competition snapshot changed.</p>
            <button type="button" onClick={refresh}>
              Debrief the updated result
            </button>
          </div>
        )}
        {facts && user && (
          <>
            <div className="arena-debrief-context">
              <span>{facts.outcome}</span>
              <small>
                {facts.completionReason === "abandonment"
                  ? "Abandonment settlement"
                  : facts.completionReason === "time"
                    ? "Timed settlement"
                    : facts.completionReason === "elimination"
                      ? "Early elimination settlement"
                      : "Legacy completion type unavailable"}
              </small>
            </div>
            <div className="arena-debrief-kpis">
              <div>
                <span>Net trading PnL</span>
                <b>{money(user.tradingNet)}</b>
                <small>Separate from forfeiture or rewards</small>
              </div>
              <div>
                <span>Entry + closing fees</span>
                <b>{money(user.fees)}</b>
                <small>Both sides of recorded trades</small>
              </div>
              <div>
                <span>Equity placement</span>
                <b>
                  {user.rawRank === null ? "Unavailable" : `#${user.rawRank}`}
                </b>
                <small>Final equity {money(user.equity)}</small>
              </div>
              <div>
                <span>
                  {facts.completionReason === "abandonment"
                    ? "Abandonment placement"
                    : "Eligible placement"}
                </span>
                <b>
                  {user.awardedRank === null
                    ? "Not awarded"
                    : `#${user.awardedRank}`}
                </b>
                <small>
                  {user.eligible
                    ? "Participation requirement met"
                    : "Participation requirement not met"}
                </small>
              </div>
            </div>
            {user.forfeited !== null && user.forfeited > 0 && (
              <p className="arena-debrief-adjustment">
                <b>
                  {facts.completionReason === "abandonment"
                    ? "Wallet forfeited on abandonment"
                    : "Elimination balance adjustment"}
                  : {money(user.forfeited)}
                </b>
                <br />
                This is separate from the net trading result above.
              </p>
            )}
            <div className="arena-debrief-participation">
              <b>
                Participation: {money(user.usedMargin)} /{" "}
                {money(user.requiredMargin)}
              </b>
              <span>
                {user.trades} opened trade{user.trades === 1 ? "" : "s"}{" "}
                &middot; cumulative margin, not leveraged notional
              </span>
            </div>
            <details className="arena-debrief-scoreboard">
              <summary>
                Calculated arena scoreboard{" "}
                <span>{facts.participants.length} participants</span>
              </summary>
              <div>
                {[...facts.participants]
                  .sort((a, b) => (a.rawRank ?? 99) - (b.rawRank ?? 99))
                  .map((p) => (
                    <article
                      key={p.id}
                      className={
                        p.isUser
                          ? "is-user"
                          : p.id === mirror?.id
                            ? "is-mirror"
                            : ""
                      }
                    >
                      <div>
                        <b>
                          {p.name}
                          {p.isUser
                            ? " (you)"
                            : p.id === mirror?.id
                              ? " (bot mirror)"
                              : ""}
                        </b>
                        <small>{p.style}</small>
                      </div>
                      <dl>
                        <div>
                          <dt>Trading net</dt>
                          <dd>{money(p.tradingNet)}</dd>
                        </div>
                        <div>
                          <dt>Fees</dt>
                          <dd>{money(p.fees)}</dd>
                        </div>
                        <div>
                          <dt>Margin used</dt>
                          <dd>{money(p.usedMargin)}</dd>
                        </div>
                        <div>
                          <dt>Equity place</dt>
                          <dd>
                            {p.rawRank === null
                              ? "Unavailable"
                              : `#${p.rawRank}`}
                          </dd>
                        </div>
                      </dl>
                      <span>
                        {p.eligible ? "Eligible" : "Not eligible"} &middot;{" "}
                        {p.reconciled
                          ? "Ledger reconciled"
                          : "Incomplete fee records"}
                      </span>
                    </article>
                  ))}
              </div>
            </details>
          </>
        )}
        {status === "loading" && !outdated && (
          <div className="ai-review-loading" role="status">
            <i aria-hidden="true" />
            <b>
              {facts
                ? "Gemini is connecting the evidence"
                : "Checking the completed arena"}
            </b>
            <p>Keep exploring your results while the debrief loads.</p>
            <div className="ai-skeleton" />
            <div className="ai-skeleton short" />
          </div>
        )}
        {status === "error" && (
          <div className="ai-review-error" role="alert">
            <b>AI debrief unavailable</b>
            <p>{message}</p>
            <button type="button" className="primary" onClick={refresh}>
              Try again
            </button>
            <small>
              {facts
                ? "Application-calculated facts remain above. No AI narrative was generated."
                : "No AI narrative was generated. Your competition records are unchanged."}
            </small>
          </div>
        )}
        {result && (
          <section className="arena-debrief-story">
            <span className="arena-debrief-step">01 / YOUR ARENA STORY</span>
            <p>{result.review.story.text}</p>
            {citations(result.review.story.evidenceIds)}
          </section>
        )}
        {result && (
          <section className="arena-debrief-contrasts">
            <span className="arena-debrief-step">
              02 / WHAT SEPARATED THE FIELD
            </span>
            {result.review.observations.map((o, index) => (
              <article key={index}>
                <p>{o.text}</p>
                {citations(o.evidenceIds)}
              </article>
            ))}
          </section>
        )}
        {facts?.mirror && mirror && (
          <section className="arena-debrief-mirror">
            <span className="arena-debrief-step">03 / YOUR BOT MIRROR</span>
            <h3>
              {mirror.name} <small>{mirror.style}</small>
            </h3>
            <p className="arena-debrief-selection">{facts.mirror.selection}</p>
            <p>
              <b>Configured speciality:</b> {facts.mirror.speciality}.{" "}
              {facts.mirror.looksFor}
            </p>
            <p>
              <b>Recorded actions:</b> {mirror.trades} trades &middot;{" "}
              {mirror.liquidations} liquidations &middot; average leverage{" "}
              {mirror.averageLeverage === null
                ? "unavailable"
                : `${mirror.averageLeverage}x`}
            </p>
            <p className="arena-debrief-recorded">
              <b>Available recorded entry reason:</b>{" "}
              {facts.mirror.recordedReason ??
                "No retained entry explanation is available for this bot."}
            </p>
            {result?.review.mirror && (
              <>
                <p>{result.review.mirror.text}</p>
                {citations(result.review.mirror.evidenceIds)}
              </>
            )}
          </section>
        )}
        {facts && (
          <section className="arena-debrief-trade">
            <span className="arena-debrief-step">
              04 / THE TRADE WORTH REVISITING
            </span>
            {facts.highlight ? (
              <>
                <h3>
                  {facts.highlight.trade.pair} &middot;{" "}
                  {facts.highlight.trade.side}
                </h3>
                <p className="arena-debrief-selection">
                  Selection rule: {facts.highlight.selection}
                </p>
                <div className="arena-debrief-trade-numbers">
                  <span>
                    {facts.highlight.trade.liquidated
                      ? "Gross settlement"
                      : "Gross PnL"}
                    <b>{money(facts.highlight.trade.gross)}</b>
                  </span>
                  <span>
                    Both fees<b>{money(facts.highlight.trade.fees)}</b>
                  </span>
                  <span>
                    Net PnL<b>{money(facts.highlight.trade.net)}</b>
                  </span>
                </div>
                {result?.review.highlight && (
                  <>
                    <p>{result.review.highlight.text}</p>
                    {citations(result.review.highlight.evidenceIds)}
                  </>
                )}
              </>
            ) : (
              <p>{facts.highlightUnavailable}</p>
            )}
          </section>
        )}
        {result && (
          <section className="arena-debrief-mission">
            <span className="arena-debrief-step">
              05 / YOUR NEXT ARENA MISSION
            </span>
            <h3>One process goal</h3>
            <p>{result.review.mission.text}</p>
            <div>
              <b>Before the next arena, ask yourself</b>
              <p>{result.review.mission.question}</p>
            </div>
            {citations(result.review.mission.evidenceIds)}
          </section>
        )}
        {facts && (
          <details className="arena-debrief-limitations">
            <summary>Evidence and data limitations</summary>
            <ul>
              {facts.limitations.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <dl>
              {facts.facts.map((f) => (
                <div key={f.id}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {result && (
          <p className="arena-debrief-timing">
            {result.metadata.cached ? "Saved debrief" : "New debrief"} &middot;
            Generated in {(result.metadata.generationMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
      <div className="arena-debrief-footer">
        Unverified paper-trading competition. This report does not predict
        future results or change your records.
      </div>
    </aside>
  );
}
