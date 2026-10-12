import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
for(const [name,value] of Object.entries(parse(readFileSync(new URL('../.env',import.meta.url))))) { if(process.env[name]===undefined)process.env[name]=value; }
import { ConfigService } from '@nestjs/config';
import { GeminiReviewProvider } from '../dist/trade-reviews/gemini-review.provider.js';
import { calculateTradeFacts } from '../dist/trade-reviews/trade-facts.js';
const provider=new GeminiReviewProvider(new ConfigService());
const facts=calculateTradeFacts({pair:'BTCUSDT',side:'Long',entry:100,exit:100.05,margin:100,leverage:10,notional:1000,openingFee:0.5,reason:'Manual close'});
const started=performance.now();
try {
  const result=await provider.generate(facts);
  console.log(JSON.stringify({verified:true,model:provider.model,latencyMs:Math.round(performance.now()-started),structuredResponse:true,evidenceValidated:true,syntheticTradeOnly:true,netPnl:facts.netPnl,summary:result.summary}));
} catch(error) {
  // Provider errors are sanitized; never log the raw cause or environment.
  console.log(JSON.stringify({verified:false,model:provider.model,latencyMs:Math.round(performance.now()-started),status:typeof error?.getStatus==='function'?error.getStatus():null,detail:typeof error?.getResponse==='function'?error.getResponse():{message:'Verification could not complete.'}}));
  process.exitCode=1;
}
