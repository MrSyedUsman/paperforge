"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Canceling a request on lifecycle transitions must reset its UI state. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/features/auth/auth-provider";
import type { Quote } from "@/lib/market-data/markets";
import type { Lobby } from "./types";
import {
  radarSnapshot,
  radarActivityKey,
  type RadarSnapshot,
  type RadarFacts,
  type RadarResult,
} from "./arena-radar-contract";
import { fetchRadarFacts, fetchRadar, RadarError } from "./arena-radar-api";
import { RadarVisualSummary } from "./arena-visuals";
import { Takeaway, InsightIcon } from "@/components/ai-visuals";
export function ArenaRadar({
  lobby,
  quotes,
  feed,
  open,
  close,
  trigger,
}: {
  lobby: Lobby;
  quotes: Record<string, Quote>;
  feed: string;
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const { accessToken } = useAuth(),
    [facts, setFacts] = useState<RadarFacts | null>(null),
    [result, setResult] = useState<RadarResult | null>(null),
    [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
      "idle",
    ),
    [message, setMessage] = useState(""),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(0),
    [activity, setActivity] = useState("");
  const successful = useRef<RadarSnapshot | null>(null),
    request = useRef<{ id: number; controller: AbortController } | null>(null),
    sequence = useRef(0),
    heading = useRef<HTMLHeadingElement>(null),
    closeRef = useRef(close),
    latest = useRef({ lobby, quotes, feed, accessToken, open });
  useEffect(() => {
    latest.current = { lobby, quotes, feed, accessToken, open };
  }, [lobby, quotes, feed, accessToken, open]);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  const cancelRequest = useCallback(() => {
    request.current?.controller.abort();
    request.current = null;
    sequence.current++;
  }, []);
  const finished = lobby.status !== "active";
  function dismiss() {
    request.current?.controller.abort();
    request.current = null;
    sequence.current++;
    setStatus((value) => (value === "loading" ? "idle" : value));
    close();
    const fallback = document.querySelector<HTMLElement>(
      "main h1,main h2,main",
    );
    if (fallback && !trigger.current?.isConnected) fallback.tabIndex = -1;
    (trigger.current?.isConnected ? trigger.current : fallback)?.focus({
      preventScroll: true,
    });
  }
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });
  useEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissRef.current();
      }
    };
    window.addEventListener("keydown", escape);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  useEffect(() => {
    if (!open || finished || !accessToken) {
      cancelRequest();
      setStatus((value) => (value === "loading" ? "idle" : value));
    }
    return cancelRequest;
  }, [open, finished, accessToken, cancelRequest]);
  async function generate() {
    if (request.current || !accessToken || finished || Date.now() < until)
      return;
    const snapshot = radarSnapshot(lobby, quotes, feed, Date.now()),
      input = { current: snapshot, previous: successful.current },
      controller = new AbortController(),
      id = ++sequence.current;
    request.current = { id, controller };
    setStatus("loading");
    setMessage("");
    const capturedActivity = radarActivityKey(lobby, quotes),
      timer = setTimeout(() => controller.abort(), 30000);
    const valid = () =>
      id === sequence.current &&
      latest.current.open &&
      latest.current.lobby.status === "active" &&
      latest.current.accessToken === accessToken &&
      latest.current.lobby.start === snapshot.arena.start;
    try {
      const calculated = await fetchRadarFacts(
        input,
        accessToken,
        controller.signal,
      );
      if (!valid()) return;
      setFacts(calculated);
      setResult(null);
      setActivity(capturedActivity);
      setUntil(Date.now() + 30000);
      const response = await fetchRadar(input, accessToken, controller.signal);
      if (!valid()) return;
      if (response.facts.fingerprint !== calculated.fingerprint)
        throw new Error("The radar evidence changed during generation.");
      setFacts(response.facts);
      setResult(response);
      setUntil(response.metadata.cooldownUntil);
      successful.current = snapshot;
      setStatus("ready");
    } catch (error) {
      if (!valid()) return;
      setStatus("error");
      if (error instanceof RadarError && error.cooldownUntil)
        setUntil(error.cooldownUntil);
      setMessage(
        controller.signal.aborted
          ? "Radar took too long. Refresh after the cooldown."
          : error instanceof Error
            ? error.message
            : "Radar is unavailable.",
      );
    } finally {
      clearTimeout(timer);
      if (request.current?.id === id) request.current = null;
    }
  }
  if (!open || !accessToken) return null;
  const user = facts?.players.find((p) => p.id === "user"),
    opponent = facts?.players.find((p) => p.id === facts.opponentId),
    seconds = Math.max(0, Math.ceil((until - now) / 1000)),
    changed = Boolean(facts && activity !== radarActivityKey(lobby, quotes)),
    money = (v: number | null) =>
      v === null
        ? "Unavailable"
        : `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`,
    evidence = new Map(facts?.facts.map((f) => [f.id, f]));
  const citations = (ids: string[]) => (
    <div className="radar-evidence" aria-label="Supporting snapshot evidence">
      {ids.map((id) => {
        const fact = evidence.get(id);
        return fact ? (
          <span key={id}>
            {fact.label}: <b>{fact.value}</b>
            <small>
              {fact.source === "recorded"
                ? "Recorded"
                : "Calculated snapshot / limitation"}
            </small>
          </span>
        ) : null;
      })}
    </div>
  );
  return createPortal(
    <aside
      className="arena-radar-panel"
      role="region"
      aria-labelledby="arena-radar-title"
    >
      <header>
        <div>
          <span className="ai-eyebrow">READ THE ARENA</span>
          <h2 id="arena-radar-title" tabIndex={-1} ref={heading}>
            Arena Radar
          </h2>
          <p>Observe the competition. Understand the differences.</p>
        </div>
        <button
          type="button"
          className="ai-review-close"
          aria-label="Close Arena Radar"
          onClick={dismiss}
        >
          &times;
        </button>
      </header>
      <div className="arena-radar-body">
        {finished ? (
          <section className="radar-complete" role="status">
            <h3>This arena has ended</h3>
            <p>
              Active-arena commentary is no longer being generated. View results
              and request Arena Debrief for a separate final review.
            </p>
            <button type="button" className="primary" onClick={dismiss}>
              Close Radar and view results
            </button>
          </section>
        ) : (
          <>
            <div className="radar-controls">
              <button
                type="button"
                className="primary"
                disabled={status === "loading" || seconds > 0}
                onClick={() => void generate()}
              >
                {status === "loading"
                  ? "Reading snapshot..."
                  : !facts
                    ? "Generate radar"
                    : seconds > 0
                      ? `Refresh in ${seconds}s`
                      : "Refresh radar"}
              </button>
              <small>
                One update per thirty seconds. Refresh only when you choose.
              </small>
            </div>
            <p className="radar-availability" role="status">
              {seconds > 0
                ? "Radar refresh is cooling down."
                : "Radar is ready when you choose to generate."}
            </p>
            {!facts && status === "idle" && (
              <p>
                Capture a short, evidence-linked explanation of the current
                arena. Opening this panel does not request AI commentary.
              </p>
            )}
            {facts && user && (
              <>
                <div className="radar-snapshot">
                  <b>
                    At this snapshot &middot;{" "}
                    {new Date(facts.at).toLocaleTimeString()}
                  </b>
                  <span>
                    {Math.ceil(facts.remainingMs / 1000)} seconds remained
                    &middot;{" "}
                    {facts.comparison
                      ? "Compared with an earlier snapshot"
                      : "Current snapshot only"}
                  </span>
                  <p>{facts.comparisonNote} Live standings may have changed.</p>
                  {changed && <strong>New activity since this update</strong>}
                </div>
                <Takeaway title="The arena headline / calculated"><h3>{facts.headline.title}</h3><details><summary>Headline evidence and explanation</summary>{citations(facts.headline.evidenceIds)}{result && <><span className="ai-visual-note">Gemini interpretation</span><p>{result.review.headline.text}</p></>}</details></Takeaway>
                <RadarVisualSummary user={user} opponent={opponent}/>
                <details className="radar-facts"><summary>Balance and PnL details</summary>
                  <span className="arena-debrief-step">
                    APPLICATION CALCULATIONS
                  </span>
                  <div className="radar-metrics">
                    {[
                      ["Equity", money(user.equity)],
                      ["Free balance", money(user.freeBalance)],
                      ["Reserved margin", money(user.reservedMargin)],
                      ["Unrealized PnL", money(user.unrealized)],
                      ["Realized net PnL", money(user.realizedNet)],
                      ["Fees already charged", money(user.fees)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <small>{label}</small>
                        <b>{value}</b>
                      </div>
                    ))}
                  </div>
                  <small>
                    Equity includes unrealized PnL; hypothetical closing fees
                    are not deducted. Current participation does not guarantee a
                    final award.
                  </small>
                </details>
              </>
            )}
            {status === "loading" && (
              <div className="ai-review-loading" role="status">
                <i aria-hidden="true" />
                <b>
                  {facts
                    ? "Gemini is explaining the selected evidence"
                    : "Checking the active arena snapshot"}
                </b>
                <p>The timer, opponents and order controls remain active.</p>
              </div>
            )}
            {status === "error" && (
              <div className="ai-review-error" role="alert">
                <b>Radar commentary unavailable</b>
                <p>{message}</p>
                <small>
                  Calculated facts remain separate. No replacement AI narrative
                  was invented.
                </small>
                <button
                  type="button"
                  disabled={seconds > 0}
                  onClick={() => void generate()}
                >
                  {seconds > 0 ? "Retry after cooldown" : "Try again"}
                </button>
              </div>
            )}
            {result && (
              <>
                <section>
                  <span className="arena-debrief-step">WHAT STANDS OUT</span>
                  {result.review.observations.length ? (
                    result.review.observations.map((o, i) => (
                      <article key={i}>
                        <p>{o.text}</p>
                        {citations(o.evidenceIds)}
                      </article>
                    ))
                  ) : (
                    <p>No additional supported comparison was selected.</p>
                  )}
                  {opponent && (
                    <p className="radar-bot">
                      <b>{opponent.name} &middot; configured speciality</b>
                      <br />
                      {opponent.speciality}. These are rule-based actions, not
                      continuous Gemini reasoning.
                    </p>
                  )}
                </section>
                <section className="radar-question">
                  <span className="arena-debrief-step">
                    <InsightIcon kind="practice"/> YOUR OBSERVATION CHALLENGE
                  </span>
                  <p>{result.review.question.text}</p>
                  {citations(result.review.question.evidenceIds)}
                </section>
                <small className="radar-timing">
                  {result.metadata.cached ? "Reused update" : "New commentary"}{" "}
                  &middot; Generated in{" "}
                  {(result.metadata.generationMs / 1000).toFixed(1)}s
                </small>
              </>
            )}
            {facts && (
              <details>
                <summary>Evidence and limitations</summary>
                {facts.limitations.map((l) => (
                  <p key={l}>{l}</p>
                ))}
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
          </>
        )}
      </div>
      <footer>
        Unverified paper-trading snapshots. Educational commentary, not a
        trading instruction or final result.
      </footer>
    </aside>,
    document.body,
  );
}
