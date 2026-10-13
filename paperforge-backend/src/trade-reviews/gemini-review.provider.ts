import { BadGatewayException, GatewayTimeoutException, Inject, Injectable, Logger, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TradeFacts } from './trade-facts.js';
import { REVIEW_SCHEMA, reviewPrompt, validateReview, type ReviewContent } from './review-output.js';
export const REVIEW_TIMEOUT_MS=20_000;
const JSON_ONLY_SUFFIX=`

Respond with ONE JSON object and nothing else (no markdown fences, no commentary), exactly in this shape:
{"summary":string,"observations":[{"title":string,"text":string,"evidenceIds":[string]}],"lesson":string,"exercise":{"title":string,"steps":[string]}}`;
/** Gemma sometimes wraps JSON in markdown fences; tolerate that, nothing else. */
function stripJsonFence(text:string):string {
  const match=/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
  return (match?match[1]:text).trim();
}
@Injectable()
export class GeminiReviewProvider {
  private readonly logger=new Logger(GeminiReviewProvider.name);
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  /** Gemma models cannot use JSON mode or response schemas. */
  get structuredOutput(): boolean { return !this.model.startsWith('gemma'); }
  get model(): string {
    const model=this.config.get<string>('GEMINI_MODEL')?.trim()||'gemma-3-27b-it';
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(model))throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured correctly.'});
    return model;
  }
  /** Google's machine-readable error code (e.g. API_KEY_INVALID); never the raw body, which may echo request data. */
  private async providerReason(response:Response):Promise<string|undefined> {
    try {
      const body=await response.json() as {error?:{status?:unknown;details?:{reason?:unknown}[]}};
      const pick=[body.error?.details?.find(d=>typeof d?.reason==='string')?.reason,body.error?.status]
        .find((v):v is string=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(v));
      return pick;
    } catch { return undefined; }
  }
  async generate(facts:TradeFacts): Promise<ReviewContent> {
    const key=this.config.get<string>('GEMINI_API_KEY')?.trim().replace(/^["']+|["']+$/g,'').trim();
    if(!key)throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured on the server yet.'});
    try {
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(REVIEW_TIMEOUT_MS),
        body:JSON.stringify({contents:[{role:'user',parts:[{text:this.structuredOutput?reviewPrompt(facts):reviewPrompt(facts)+JSON_ONLY_SUFFIX}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:2048,
            // Gemma models reject JSON mode and response schemas; they are asked for JSON in the prompt instead.
            ...(this.structuredOutput?{responseMimeType:'application/json',responseSchema:REVIEW_SCHEMA}:{}),
            // 2.5 Flash "thinks" by default; thinking tokens would eat the small output budget.
            ...(this.model.startsWith('gemini-2.5-flash')?{thinkingConfig:{thinkingBudget:0}}:{})}}),
      });
      if(!response.ok) {
        const reason=await this.providerReason(response);
        this.logger.warn(`Gemini request failed: HTTP ${response.status}${reason?` (${reason})`:''}, model ${this.model}`);
        if(response.status===429)throw new ServiceUnavailableException({code:'AI_RATE_LIMIT',message:'The AI service is busy or its quota is exhausted. Please try again later.'});
        if(response.status===402)throw new ServiceUnavailableException({code:'AI_BILLING',providerStatus:402,message:'The AI provider requires billing or credits for this key. Please contact the app administrator.'});
        if([400,401,403,404].includes(response.status))throw new ServiceUnavailableException({code:'AI_CONFIGURATION',providerStatus:response.status,...(reason?{providerReason:reason}:{}),message:'The AI service could not accept the configured key or model. Please contact the app administrator.'});
        throw new ServiceUnavailableException({code:'AI_UNAVAILABLE',providerStatus:response.status,message:'The AI service is temporarily unavailable. Please try again.'});
      }
      const data=await response.json() as {candidates?:{finishReason?:string;content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
      const candidate=data.candidates?.[0];
      if(!candidate||candidate.finishReason!=='STOP')throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI could not finish a usable review. Please try again.'});
      const output=candidate.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';
      if(output.length>8000)throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI returned an oversized review. Please try again.'});
      let value:unknown;
      try{value=JSON.parse(stripJsonFence(output));}catch{throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI returned an unreadable review. Please try again.'});}
      return validateReview(value,facts);
    } catch(cause) {
      if(cause instanceof HttpException)throw cause;
      if(cause instanceof Error&&['TimeoutError','AbortError'].includes(cause.name))throw new GatewayTimeoutException({code:'AI_TIMEOUT',message:'The AI took too long to respond. Please try again.'});
      // Never forward upstream errors: they can contain request headers or provider details.
      throw new ServiceUnavailableException({code:'AI_UNAVAILABLE',message:'The AI service could not be reached. Please try again.'});
    }
  }
}
