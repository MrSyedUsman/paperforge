"use client";
import { useEffect, useRef, useState } from 'react';
import type { ClosedPos } from '@/features/account/types';
import { useAuth } from '@/features/auth/auth-provider';
import { fetchTradeReview, type TradeReviewResponse } from './trade-review-api';

type State={status:'loading'}|{status:'error';message:string}|{status:'ready';data:TradeReviewResponse};
type Props={trade:ClosedPos;history:ClosedPos[];onSelect:(trade:ClosedPos)=>void;close:()=>void};
export function TradeReviewPanel({trade,history,onSelect,close}:Props) {
  const {accessToken}=useAuth();
  const [state,setState]=useState<State>({status:'loading'}),[attempt,setAttempt]=useState(0);
  const closeRef=useRef(close);
  useEffect(()=>{closeRef.current=close;},[close]);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    heading.current?.focus({preventScroll:true});
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeRef.current();}};
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[]);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort('timeout'),30_000);
    const load=async()=>{
      try {
        if(!accessToken)throw new Error('Sign in to request an AI review.');
        const data=await fetchTradeReview(trade,accessToken,controller.signal);
        if(active)setState({status:'ready',data});
      }catch(error){
        if(!active)return;
        const message=controller.signal.aborted?'The review took too long. Please try again.':
          error instanceof TypeError?'Could not reach the review server. Check your connection and try again.':
          error instanceof Error?error.message:'The review is unavailable. Please try again.';
        setState({status:'error',message});
      }finally{clearTimeout(timer);}
    };
    void load();
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[trade,accessToken,attempt]);
  const result=state.status==='ready'?state.data:null;
  const evidence=new Map(result?.facts.facts.map(f=>[f.id,f]));
  return <aside id="ai-review-panel" className="ai-review-panel" role="region" aria-labelledby="ai-review-title" aria-busy={state.status==='loading'}>
    <header className="ai-review-heading">
      <div><span className="ai-eyebrow">PAPERFORGE COACH</span><h2 ref={heading} id="ai-review-title" tabIndex={-1}>Your trade, explained</h2></div>
      <button className="ai-review-close" onClick={close} aria-label="Close AI trade review">×</button>
    </header>
    <div className="ai-review-body">
      <div className="ai-trade-context"><b>{trade.pair||`${trade.symbol}USDT`}</b><span>{trade.side} · {trade.lev}× · Closed paper trade</span></div>
      <label className="ai-trade-switch">Review another trade
        <select value={String(trade.id)} onChange={event=>{const selected=history.find(h=>String(h.id)===event.target.value);if(selected)onSelect(selected);}}>
          {history.map(h=><option key={h.id} value={String(h.id)}>{h.pair||`${h.symbol}USDT`} · {h.side} · {h.closed}</option>)}
        </select>
      </label>
      <div className="ai-facts-grid">
        {(result?['margin','leverage','grossPnl','totalFees','netPnl','outcome'].map(id=>({label:evidence.get(id)?.label||({grossPnl:'Gross PnL',totalFees:'Total fees',netPnl:'Net PnL'} as Record<string,string>)[id]||id,value:evidence.get(id)?.value||'Not available'})):[
          {label:'Entry price',value:`$${trade.entry.toLocaleString()}`},
          {label:'Recorded exit',value:trade.exit?`$${trade.exit.toLocaleString()}`:'Not available'},
          {label:'Margin',value:`$${trade.margin.toFixed(2)}`},{label:'Leverage',value:`${trade.lev}×`},
        ]).map(f=><div key={f.label}><span>{f.label}</span><b>{f.value}</b></div>)}
      </div>
      {state.status==='loading'&&<div className="ai-review-loading" role="status" aria-live="polite"><i aria-hidden="true"/><b>Reviewing your trade</b><p>Checking the result, fees and leverage. You can keep using PaperForge while this loads.</p><div className="ai-skeleton" aria-hidden="true"/><div className="ai-skeleton short" aria-hidden="true"/></div>}
      {state.status==='error'&&<div className="ai-review-error" role="alert"><b>Review unavailable</b><p>{state.message}</p><button className="primary" onClick={()=>{setState({status:'loading'});setAttempt(value=>value+1);}}>Try again</button><small>No AI feedback was generated for this request.</small></div>}
      {result&&<div className="ai-review-content" aria-live="polite">
        <section><h3>The outcome</h3><p>{result.review.summary}</p></section>
        <section><h3>What the facts show</h3>{result.review.observations.map((observation,index)=><article className="ai-observation" key={index}><h4>{observation.title}</h4><p>{observation.text}</p><div className="ai-evidence" aria-label="Supporting calculated facts">{observation.evidenceIds.map(id=>{const fact=evidence.get(id);return fact?<span key={id}>{fact.label}: <b>{fact.value}</b></span>:null;})}</div></article>)}</section>
        <section className="ai-lesson"><span className="ai-eyebrow">TAKEAWAY</span><h3>One lesson to keep</h3><p>{result.review.lesson}</p></section>
        <section className="ai-exercise"><span className="ai-eyebrow">YOUR NEXT PRACTICE</span><h3>{result.review.exercise.title}</h3><ol>{result.review.exercise.steps.map((step,index)=><li key={index}>{step}</li>)}</ol></section>
        <details className="ai-data-details"><summary>All calculated facts and data limitations</summary><dl>{result.facts.facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><ul>{result.facts.limitations.map((note,index)=><li key={index}>{note}</li>)}</ul></details>
        <p className="ai-review-timing">{result.metadata.cached?'Saved review':'New review'} · Generated in {(result.metadata.generationMs/1000).toFixed(1)}s</p>
      </div>}
    </div>
    <div className="ai-review-footer">Gemini explains this unverified simulation snapshot. It does not place orders or predict returns.</div>
  </aside>;
}
