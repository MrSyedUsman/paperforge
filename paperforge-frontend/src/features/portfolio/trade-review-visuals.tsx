import { aiMoney } from "@/components/ai-visuals";
import { feeWidth } from "@/components/ai-visual-geometry";
import type { TradeReviewResponse } from "./trade-review-contract";
export function TradeResultVisual({ facts, liquidated }: { facts: TradeReviewResponse["facts"]; liquidated: boolean }) {
  const evidence = new Map(facts.facts.map(f => [f.id, f]));
  const width = liquidated ? null : feeWidth(facts.grossPnl, facts.totalFees);
  return <section className="ai-result-visual" aria-label="Calculated completed-trade result">
    <div className={`ai-result-hero ${facts.netPnl !== null && facts.netPnl < 0 ? "is-loss" : ""}`}><span>{liquidated ? "Liquidated / isolated settlement" : facts.outcome === "Flat" ? "Break-even after fees" : `${facts.outcome} / after fees`}</span><strong>{aiMoney(facts.netPnl)}</strong><small>Net simulation result</small></div>
    <div className="ai-result-ledger">{[
      [liquidated ? "Gross settlement" : "Gross PnL", aiMoney(facts.grossPnl)],
      ["Opening fee", evidence.get("openingFee")?.value ?? "Not recorded"],
      [liquidated ? "Liquidation fee (inside margin)" : "Closing fee", evidence.get("closingFee")?.value ?? "Unavailable"],
      ["Net PnL", aiMoney(facts.netPnl)],
    ].map(([label,value],i) => <div key={label}><span className="ai-ledger-symbol" aria-hidden="true">{i === 0 ? "+/-" : i === 3 ? "=" : "-"}</span><span>{label}</span><b>{value}</b></div>)}</div>
    {width !== null && <div className="ai-fee-impact"><div className="ai-fee-track" aria-hidden="true"><span style={{width: `${width}%`}}/></div><p><b>Fees {aiMoney(facts.totalFees)}</b> against gross profit {aiMoney(facts.grossPnl)}.{facts.totalFees! > facts.grossPnl! ? " Fees exceed gross profit; the bar is capped at the gross-profit width." : " Amber shows the part of gross profit consumed by fees."}</p></div>}
    {liquidated && <p className="ai-liquidation-note">Isolated margin was exhausted, including the liquidation fee. That fee is not deducted a second time.</p>}
    {facts.netPnl === null && <p className="ai-visual-note">Net result cannot be reconstructed from the available records. See the data limitations.</p>}
  </section>;
}
