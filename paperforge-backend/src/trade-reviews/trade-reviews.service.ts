import { AiRequestBudget } from './ai-request-budget.js';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { GeminiReviewProvider } from './gemini-review.provider.js';
import { calculateTradeFacts, type TradeFacts } from './trade-facts.js';
import { PROMPT_VERSION, type ReviewContent } from './review-output.js';
export type ReviewResult = {
  facts:TradeFacts; review:ReviewContent;
  metadata:{model:string;promptVersion:string;generatedAt:string;generationMs:number;requestMs:number;cached:boolean};
};
const CACHE_TTL=24*60*60*1000;
@Injectable()
export class TradeReviewsService {
  private readonly cache=new Map<string,{expires:number;result:ReviewResult}>();
  private readonly pending=new Map<string,Promise<ReviewResult>>();
  constructor(@Inject(GeminiReviewProvider) private readonly gemini:GeminiReviewProvider, @Inject(AiRequestBudget) private readonly budget:AiRequestBudget = new AiRequestBudget()) {}
  async review(username:string,input:unknown):Promise<ReviewResult> {
    const start=performance.now(),facts=calculateTradeFacts(input),model=this.gemini.model;
    const key=createHash('sha256').update(JSON.stringify([username,facts.trade,model,PROMPT_VERSION])).digest('hex');
    const now=Date.now();
    for(const [id,entry]of this.cache)if(entry.expires<=now)this.cache.delete(id);
    const cached=this.cache.get(key);
    if(cached)return {...cached.result,metadata:{...cached.result.metadata,cached:true,requestMs:Math.round(performance.now()-start)}};
    const running=this.pending.get(key);
    if(running)return running;
    const release=this.budget.acquire(username);
    const task=(async()=>{
      const review=await this.gemini.generate(facts);
      const result:ReviewResult={facts,review,metadata:{model,promptVersion:PROMPT_VERSION,generatedAt:new Date().toISOString(),generationMs:Math.round(performance.now()-start),requestMs:Math.round(performance.now()-start),cached:false}};
      if(this.cache.size>=500)this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key,{result,expires:Date.now()+CACHE_TTL});
      return result;
    })();
    this.pending.set(key,task);
    try{return await task;}finally{this.pending.delete(key);release();}
  }
}
