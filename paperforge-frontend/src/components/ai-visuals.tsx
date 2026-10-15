import type { ReactNode } from "react";
import { progressWidth, signedWidth } from "./ai-visual-geometry";
export const aiMoney = (value: number | null) => value === null ? "Unavailable" : `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function InsightIcon({ kind = "insight" }: { kind?: "insight" | "lesson" | "practice" | "arena" }) {
  const paths = {
    insight: <><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9z"/><path d="M12 4v3"/></>,
    lesson: <><path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15"/><path d="M6 8h3M15 8h3M6 12h3M15 12h3"/></>,
    practice: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8M16 4h4v4"/></>,
    arena: <><path d="M8 3h8v6a4 4 0 0 1-8 0zM12 13v6M8 21h8M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4"/></>,
  };
  return <svg className="ai-insight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
export function Takeaway({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ai-visual-takeaway"><InsightIcon/><div><h3>{title}</h3>{children}</div></section>;
}
export function ParticipationVisual({ used, required, opened, eligible }: { used: number; required: number; opened: number; eligible: boolean }) {
  const width = progressWidth(used, required);
  return <section className="ai-participation-visual" aria-label="Participation requirements">
    <div className="ai-visual-section-title"><InsightIcon kind="arena"/><h3>Participation checklist</h3><span className="ai-state-tag">{eligible ? "Requirements met" : "Not yet eligible"}</span></div>
    <div className="ai-progress-label"><span>Cumulative margin</span><b>{aiMoney(used)} / {aiMoney(required)}</b></div>
    {width !== null && <div className="ai-progress-track" role="progressbar" aria-label="Cumulative margin requirement" aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(used, required)} aria-valuetext={`${aiMoney(used)} used; ${aiMoney(required)} required`}><span style={{width: `${width}%`}}/></div>}
    <div className="ai-check-row"><span aria-hidden="true">{opened >= 1 ? "\u2713" : "\u25cb"}</span><span>At least one opened trade</span><b>{opened} opened</b></div>
    <p className="ai-visual-note">Margin, not leveraged notional. Eligibility does not guarantee placement or a reward.</p>
  </section>;
}
export type VisualParticipant = { id: string; name: string; value: number | null; fees: number | null; margin: number; isUser: boolean };
export function ParticipantComparison({ rows, label }: { rows: VisualParticipant[]; label: string }) {
  const maximum = Math.max(0, ...rows.map(r => Math.abs(r.value ?? 0)));
  return <section className="ai-comparison" aria-label={`${label} comparison`}><h3>{label} comparison</h3><p className="ai-visual-note">Same metric and scale for each participant. Centre line is zero.</p>
    {rows.map(row => <article key={row.id} className={row.isUser ? "is-you" : ""}><div className="ai-comparison-label"><b>{row.name}{row.isUser ? " (you)" : ""}</b><strong>{aiMoney(row.value)}</strong></div>
      <div className="ai-signed-track" aria-hidden="true"><i/><span className={(row.value ?? 0) < 0 ? "is-negative" : "is-positive"} style={{width: `${signedWidth(row.value, maximum)}%`, left: `${(row.value ?? 0) < 0 ? 50 - signedWidth(row.value, maximum) : 50}%`}}/></div>
      <p className="ai-comparison-detail">Fees {aiMoney(row.fees)} <span aria-hidden="true">/</span> Margin used {aiMoney(row.margin)}</p>
    </article>)}
  </section>;
}
