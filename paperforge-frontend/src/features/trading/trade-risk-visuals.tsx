import { aiMoney, InsightIcon } from "@/components/ai-visuals";
import type { RiskFacts } from "./trade-risk-contract";
const price = (n: number) => `$${n.toLocaleString(undefined, {maximumSignificantDigits: 10})}`;
export function RiskVisualSummary({ facts }: { facts: RiskFacts }) {
  const { snapshot: s } = facts;
  const distance = facts.liquidationDistancePercent.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const endpoints = s.side === "Long"
    ? [{label: "Liquidation", value: facts.liquidationPrice}, {label: "Entry", value: s.price}]
    : [{label: "Entry", value: s.price}, {label: "Liquidation", value: facts.liquidationPrice}];
  return <section className="ai-risk-visual" aria-label="Calculated exposure and liquidation">
    <div className="ai-exposure-strip"><span><small>Direction</small><b>{s.side}</b></span><span><small>Margin</small><b>{aiMoney(s.margin)}</b></span><span><small>Leverage</small><b>{s.leverage}x</b></span><span><small>Exposure</small><b>{aiMoney(facts.notional)}</b></span></div>
    <div className="ai-price-map"><div className="ai-visual-section-title"><InsightIcon/><h3>Entry to liquidation</h3></div>
      <div className="ai-price-endpoints">{endpoints.map(p => <div className={p.label === "Liquidation" ? "is-liquidation" : ""} key={p.label}><span>{p.label}</span><b>{price(p.value)}</b></div>)}</div>
      <svg className="ai-price-rail" viewBox="0 0 400 34" role="img" aria-label={`${s.side} position: liquidation is ${distance}% ${s.side === "Long" ? "below" : "above"} entry; schematic, not to scale`}><path d="M16 17h368" stroke="#526e66" strokeWidth="2"/><circle cx="16" cy="17" r="6" fill={s.side === "Long" ? "#ff9b9f" : "#69e3b6"}/><circle cx="384" cy="17" r="6" fill={s.side === "Short" ? "#ff9b9f" : "#69e3b6"}/><path d="m375 11 9 6-9 6" fill="none" stroke="#c4d8ce" strokeWidth="2"/></svg>
      <p><b>{distance}% {s.side === "Long" ? "below" : "above"} entry</b><span>Price increases left to right. Schematic spacing, not to scale.</span></p>
    </div>
    <p className="ai-visual-note">Estimated opening fee <b>{aiMoney(facts.openingFee)}</b>. Applies to the price snapshot above.</p>
  </section>;
}
