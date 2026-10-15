"use client";
import { useEffect, useRef, useState } from 'react';
import { LIVE_PRICE_MAX_AGE_MS, roundMoney } from '@paperforge/simulation';
import { useAuth } from '@/features/auth/auth-provider';
import { validateOrder } from '@/features/account/engine';
import type { Market } from '@/lib/market-data/markets';
import { fetchRiskFacts, fetchRiskReview } from './trade-risk-api';
import { riskSnapshot, riskSnapshotOutdated, type RiskFacts, type RiskResponse, type RiskSnapshot } from './trade-risk-contract';
type Props = { market: Market; side: 'Long' | 'Short'; margin: number; leverage: number; price: number; priceTimestamp: number; feed: string; balance: number };
export function TradeRiskCheck(props: Props) {
  const { accessToken } = useAuth();
  const [selected, setSelected] = useState<{ snapshot: RiskSnapshot; sequence: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const trigger = useRef<HTMLButtonElement>(null), sequence = useRef(0), previous = useRef<RiskSnapshot | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const current: RiskSnapshot = { pair: props.market.pair, side: props.side, margin: roundMoney(props.margin), leverage: props.leverage, price: props.price, priceTimestamp: props.priceTimestamp };
  const error = validateOrder(props.market, props.feed, props.price, props.margin, props.leverage, props.balance) ||
    (!Number.isFinite(props.price) || props.price < 1e-12 || props.price > 1e9 ? 'A valid live price is required.' : '') ||
    (props.margin < .01 || props.margin > 1e6 ? 'Margin is outside the supported risk-check range.' : '') ||
    (!props.priceTimestamp || now - props.priceTimestamp > LIVE_PRICE_MAX_AGE_MS || props.priceTimestamp > now + 5000 ? 'Wait for a fresh live price to check risk.' : '') ||
    (!accessToken ? 'Sign in to check trade risk.' : '');
  function request(force = false) {
    if (error) return;
    if (!force && selected && !outdated) { document.getElementById("trade-risk-title")?.focus({ preventScroll: true }); return; }
    // Reopening an unchanged fresh snapshot lets the backend reuse the exact fingerprint.
    const saved = previous.current;
    const snapshot = saved && !riskSnapshotOutdated(saved, current, true) ? saved : riskSnapshot(current);
    previous.current = snapshot;
    setSelected({ snapshot, sequence: ++sequence.current });
  }
  function close() { setSelected(null); trigger.current?.focus({ preventScroll: true }); }
  const outdated = selected ? riskSnapshotOutdated(selected.snapshot, current, props.feed === 'live', now) : false;
  return <div className="trade-risk-action">
    <button type="button" ref={trigger} className="trade-risk-button" disabled={Boolean(error)} aria-describedby="trade-risk-help" aria-controls="trade-risk-panel" aria-expanded={Boolean(selected)} onClick={() => request()}>Check trade risk</button>
    <small id="trade-risk-help">{error || 'Optional AI explanation. Checking risk does not place an order.'}</small>
    {selected && <RiskPanel key={selected.sequence} snapshot={selected.snapshot} outdated={outdated} refresh={() => request(true)} refreshDisabled={Boolean(error)} close={close} />}
  </div>;
}
type PanelProps = { snapshot: RiskSnapshot; outdated: boolean; refresh: () => void; refreshDisabled: boolean; close: () => void };
function RiskPanel({ snapshot, outdated, refresh, refreshDisabled, close }: PanelProps) {
  const { accessToken } = useAuth();
  const [facts, setFacts] = useState<RiskFacts | null>(null), [result, setResult] = useState<RiskResponse | null>(null), [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null), closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30_000);
    async function load() {
      try {
        if (!accessToken) throw new Error('Sign in to check trade risk.');
        const calculated = await fetchRiskFacts(snapshot, accessToken, controller.signal);
        if (!active) return;
        setFacts(calculated);
        const response = await fetchRiskReview(snapshot, accessToken, controller.signal);
        if (active) { setResult(response); setStatus('ready'); }
      } catch (cause) {
        if (!active) return;
        setStatus('error');
        setError(controller.signal.aborted ? 'The risk check took too long. Please try again.' : cause instanceof TypeError ? 'Could not reach the risk-check server. Check your connection.' : cause instanceof Error ? cause.message : 'The risk check is unavailable.');
      } finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [snapshot, accessToken]);
  const evidence = new Map(facts?.facts.map(f => [f.id, f]));
  const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
  const price = (n: number) => `$${n.toLocaleString(undefined, { maximumSignificantDigits: 10 })}`;
  return <aside id="trade-risk-panel" className="ai-review-panel trade-risk-panel" role="region" aria-labelledby="trade-risk-title" aria-busy={status === 'loading'}>
    <header className="ai-review-heading"><div><span className="ai-eyebrow">BEFORE YOUR PAPER TRADE</span><h2 ref={heading} id="trade-risk-title" tabIndex={-1}>Understand the risk</h2></div><button type="button" className="ai-review-close" aria-label="Close trade risk check" onClick={close}>&times;</button></header>
    <div className="ai-review-body">
      <div className="ai-trade-context"><b>{snapshot.pair} &middot; {snapshot.side}</b><span>{money(snapshot.margin)} margin &middot; {snapshot.leverage}&times; leverage</span><span>Price snapshot {price(snapshot.price)} &middot; <time dateTime={new Date(snapshot.priceTimestamp).toISOString()}>{new Date(snapshot.priceTimestamp).toLocaleTimeString()}</time></span></div>
      {outdated && <div className="trade-risk-outdated" role="status"><b>This check is outdated</b><p>Your inputs, price or live-feed status changed. Feedback below applies only to the recorded snapshot.</p><button type="button" disabled={refreshDisabled || status === 'loading'} onClick={refresh}>Check current inputs</button></div>}
      {facts && <>
        <h3 className="trade-risk-section-title">Calculated simulation facts</h3>
        <div className="ai-facts-grid">{['notional', 'openingFee', 'liquidationPrice', 'liquidationDistance', 'roundTripFees'].map(id => <div key={id}><span>{evidence.get(id)?.label}</span><b>{evidence.get(id)?.value}</b></div>)}</div>
        <section className="trade-risk-scenarios" aria-label="Hypothetical price move examples"><h3>What if the price moves?</h3><p>Examples, not predictions. Fees include opening and closing.</p>{facts.scenarios.map(s => <article key={s.id} className={s.movePercent > 0 ? 'favourable' : 'adverse'}><h4>{Math.abs(s.movePercent)}% {s.movePercent > 0 ? 'favourable' : 'adverse'} move</h4><p>Hypothetical price {price(s.hypotheticalPrice)}{s.liquidated ? `; liquidates first at ${price(s.executionPrice)}` : ''}</p><dl><div><dt>{s.liquidated ? 'Gross settlement' : 'Gross PnL'}</dt><dd>{money(s.grossPnl)}</dd></div><div><dt>Total fees</dt><dd>{money(s.totalFees)}</dd></div><div><dt>Net PnL</dt><dd>{money(s.netPnl)}</dd></div></dl>{s.liquidated && <small>Liquidation fee is inside the lost margin; it is not deducted again.</small>}</article>)}</section>
      </>}
      {status === 'loading' && <div className="ai-review-loading" role="status"><i aria-hidden="true"/><b>{facts ? 'Gemini is explaining the risk' : 'Calculating your risk snapshot'}</b><p>You can keep using the trading interface.</p></div>}
      {status === 'error' && <div className="ai-review-error" role="alert"><b>AI explanation unavailable</b><p>{error}</p><button type="button" className="primary" disabled={refreshDisabled} onClick={refresh}>Try again with current inputs</button><small>{facts ? 'Calculated facts above remain available. No AI feedback was generated.' : 'No AI feedback was generated.'}</small></div>}
      {result && <div className="ai-review-content"><section><h3>Gemini explanation</h3><p>{result.review.summary}</p>{result.review.observations.map((o, index) => <article className="ai-observation" key={index}><p>{o.text}</p><div className="ai-evidence" aria-label="Supporting calculated facts">{o.evidenceIds.map(id => <span key={id}>{evidence.get(id)?.label}: <b>{evidence.get(id)?.value}</b></span>)}</div></article>)}</section><section className="ai-lesson"><h3>One risk lesson</h3><p>{result.review.lesson}</p></section><section className="ai-exercise"><h3>Before you decide</h3><p>{result.review.question}</p></section><p className="ai-review-timing">{result.metadata.cached ? 'Saved explanation' : 'New explanation'} &middot; Generated in {(result.metadata.generationMs / 1000).toFixed(1)}s</p></div>}
      {facts && <details className="ai-data-details"><summary>Assumptions and limitations</summary><ul>{facts.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>}
    </div><div className="ai-review-footer">Unverified paper-trading snapshot. This check does not approve, place or change an order.</div>
  </aside>;
}
