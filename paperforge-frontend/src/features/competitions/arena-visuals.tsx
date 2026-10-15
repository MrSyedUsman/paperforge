import { ParticipantComparison, ParticipationVisual, aiMoney, InsightIcon } from "@/components/ai-visuals";
import type { ArenaFacts, ParticipantMetric } from "./arena-debrief-contract";
import type { RadarPlayer } from "./arena-radar-contract";
export function RadarVisualSummary({ user, opponent }: { user: RadarPlayer; opponent?: RadarPlayer }) {
  return <div className="ai-radar-visual"><div className="ai-rank-banner"><InsightIcon kind="arena"/><div><span>Equity rank at this snapshot</span><strong>{user.rank === null ? "Unavailable" : `#${user.rank}`}</strong></div><div><span>Current equity</span><b>{aiMoney(user.equity)}</b></div></div>
    <ParticipationVisual used={user.usedMargin} required={user.requiredMargin} opened={user.opened} eligible={user.eligible}/>
    {opponent && <ParticipantComparison label="Snapshot equity" rows={[user,opponent].map((p,i) => ({id:p.id,name:p.name,value:p.equity,fees:p.fees,margin:p.usedMargin,isUser:i===0}))}/>}
  </div>;
}
export function DebriefVisualSummary({ facts, user, mirror }: { facts: ArenaFacts; user: ParticipantMetric; mirror?: ParticipantMetric }) {
  return <div className="ai-debrief-visual">
    <ParticipationVisual used={user.usedMargin} required={user.requiredMargin} opened={user.trades} eligible={user.eligible}/>
    {mirror && <ParticipantComparison label="Final net trading PnL" rows={[user,mirror].map(p => ({id:p.id,name:p.name,value:p.tradingNet,fees:p.fees,margin:p.usedMargin,isUser:p.isUser}))}/>}
    <ArenaMoments facts={facts}/>
  </div>;
}
function ArenaMoments({facts}: {facts:ArenaFacts}) {
  const moments: {key:string; title:string; at:number; text:string; ids:string[]}[]=[];
  if(facts.mirror?.recordedAt != null && facts.mirror.recordedReason) moments.push({key:"bot",title:"Recorded bot entry",at:facts.mirror.recordedAt,text:facts.mirror.recordedReason,ids:facts.facts.filter(f=>f.participantId===facts.mirror!.participantId && f.source==="recorded").map(f=>f.id)});
  if(facts.highlight) moments.push({key:"trade",title:"Selected trade closed",at:facts.highlight.trade.closed,text:`${facts.highlight.trade.pair} / ${facts.highlight.trade.side}: net ${aiMoney(facts.highlight.trade.net)}. ${facts.highlight.selection}`,ids:facts.facts.filter(f=>f.tradeId===facts.highlight!.trade.id).map(f=>f.id)});
  const valid=moments.filter(m=>Number.isFinite(m.at)&&m.at>0).sort((a,b)=>a.at-b.at).slice(0,3);
  if(!valid.length)return null;
  return <section className="ai-arena-moments"><h3>Recorded moments</h3><p className="ai-visual-note">Selected records, not a full history or an explanation of what caused the result.</p><ol>{valid.map(m=><li key={m.key}><span className="ai-moment-dot" aria-hidden="true"/><time dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString()}</time><b>{m.title}</b><p>{m.text}</p>{m.ids.length>0&&<details><summary>Source evidence</summary><ul>{m.ids.map(id=>{const f=facts.facts.find(f=>f.id===id)!;return <li key={id}>{f.label}: {f.value}</li>})}</ul></details>}</li>)}</ol></section>;
}
