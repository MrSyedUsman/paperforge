import type { ClosedPos } from '@/features/account/types';
export type TradeReviewResponse = {
  facts: {
    grossPnl:number|null;netPnl:number|null;totalFees:number|null;outcome:string;
    facts:{id:string;label:string;value:string}[];limitations:string[];
  };
  review:{summary:string;observations:{title:string;text:string;evidenceIds:string[]}[];lesson:string;exercise:{title:string;steps:string[]}};
  metadata:{model:string;generatedAt:string;generationMs:number;requestMs:number;cached:boolean;promptVersion:string};
};
export function tradeReviewSnapshot(trade:ClosedPos) {
  return {
    pair:trade.pair||`${trade.symbol}USDT`,side:trade.side,entry:trade.entry,exit:trade.exit,
    margin:trade.margin,leverage:trade.lev,notional:trade.size,openingFee:trade.openFee,
    reason:trade.reason==='Liquidation'?'Liquidation':trade.reason==='Manual close'?'Manual close':'Closed',
    maintenanceMarginRate:trade.maintenanceMarginRate,liquidationFeeRate:trade.liquidationFeeRate,
  };
}

function record(value:unknown):value is Record<string,unknown> { return Boolean(value&&typeof value==='object'&&!Array.isArray(value)); }
function text(value:unknown,max=500):value is string { return typeof value==='string'&&value.length>0&&value.length<=max; }
function finite(value:unknown):value is number { return typeof value==='number'&&Number.isFinite(value); }
export function validateTradeReviewResponse(value:unknown):TradeReviewResponse {
  const fail=()=>{throw new Error('The review response was incomplete. Please try again.');};
  if(!record(value)||!record(value.facts)||!record(value.review)||!record(value.metadata))return fail();
  const facts=value.facts,review=value.review,metadata=value.metadata;
  if(!Array.isArray(facts.facts)||facts.facts.length<1||facts.facts.length>20||
    facts.facts.some(f=>!record(f)||!text(f.id,40)||!text(f.label,100)||!text(f.value,200))||
    !Array.isArray(facts.limitations)||facts.limitations.length>8||facts.limitations.some(n=>!text(n,500))||
    !text(facts.outcome,30)||!['Profit','Loss','Flat','Unknown'].includes(facts.outcome)||
    ['grossPnl','netPnl','totalFees'].some(key=>facts[key]!==null&&!finite(facts[key])))return fail();
  const known=new Set(facts.facts.map(f=>(f as Record<string,string>).id));
  if(known.size!==facts.facts.length||!text(review.summary,400)||!text(review.lesson,300)||
    !Array.isArray(review.observations)||review.observations.length<2||review.observations.length>3||
    review.observations.some(o=>!record(o)||!text(o.title,65)||!text(o.text,350)||!Array.isArray(o.evidenceIds)||
      o.evidenceIds.length<1||o.evidenceIds.length>4||o.evidenceIds.some(id=>typeof id!=='string'||!known.has(id)))||
    !record(review.exercise)||!text(review.exercise.title,80)||!Array.isArray(review.exercise.steps)||
    review.exercise.steps.length<2||review.exercise.steps.length>3||review.exercise.steps.some(s=>!text(s,180)))return fail();
  if(!text(metadata.model,101)||!text(metadata.promptVersion,80)||!text(metadata.generatedAt,80)||
    !Number.isFinite(Date.parse(metadata.generatedAt))||!finite(metadata.generationMs)||metadata.generationMs<0||
    !finite(metadata.requestMs)||metadata.requestMs<0||typeof metadata.cached!=='boolean')return fail();
  return value as unknown as TradeReviewResponse;
}
