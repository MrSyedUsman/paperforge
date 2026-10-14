// Synthetic cross-application verification. Build the backend before running.
import assert from 'node:assert/strict';
import {simulateArena,pairs,quote,scenarioPrice} from '../tests/bot-fixtures.mjs';
import {radarSnapshot} from '../src/features/competitions/arena-radar-contract.ts';
import {calculateRadarFacts} from '../../paperforge-backend/dist/arena-radar/radar-facts.js';
import {equityFor,eligibilityFor} from '../src/features/competitions/engine.ts';
let checks=0;
for(const difficulty of ['Easy','Medium','Hard','Expert'])for(const scenario of ['flat','trend','range','breakout','volatility']){
 simulateArena({difficulty,scenario,reload(lobby){const at=lobby.start+30000;for(const p of lobby.players)if(p.achieved<lobby.start)p.achieved=lobby.start;const quotes=Object.fromEntries(pairs.map((pair,i)=>[pair,quote(scenarioPrice(scenario,15,i,1),at)])),snapshot=radarSnapshot(lobby,quotes,'live',at),savedNow=Date.now;
 try{Date.now=()=>at;const result=calculateRadarFacts({current:snapshot,previous:null}).facts;for(const p of lobby.players){const metric=result.players.find(row=>row.id===p.id);assert.equal(metric.equity,equityFor(p,quotes));assert.equal(metric.eligible,eligibilityFor(p,lobby.settings.allocation).eligible);}const next=structuredClone(snapshot);next.at+=1;assert.equal(calculateRadarFacts({current:next,previous:snapshot}).facts.comparison,true);checks++;return lobby;}finally{Date.now=savedNow;}
 }});
}
console.log(`Arena Radar evidence checks passed: ${checks} active engine snapshots, all seven bots, four difficulties, five synthetic paths, live equity/eligibility agreement and compatible comparisons.`);
