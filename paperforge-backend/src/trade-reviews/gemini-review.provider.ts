import { BadGatewayException, GatewayTimeoutException, Inject, Injectable, Logger, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TradeFacts } from './trade-facts.js';
import { REVIEW_SCHEMA, reviewPrompt, validateReview, type ReviewContent } from './review-output.js';
export const REVIEW_TIMEOUT_MS=20_000;
/** Default model when GEMINI_MODEL is unset. Known to work on the AI Studio free tier. */
const DEFAULT_MODEL='gemini-2.5-flash';
const MODEL_PATTERN=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/;
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
  private supportsStructuredOutput(model:string): boolean { return !model.startsWith('gemma'); }
  get structuredOutput(): boolean { return this.supportsStructuredOutput(this.model); }
  /** Tolerates pasted quotes, whitespace and a leading "models/" (a common cause of 404 NOT_FOUND). */
  private normalizeModel(raw:string|undefined,fallback:string):string {
    const model=(raw??'').trim().replace(/^["']+|["']+$/g,'').trim().replace(/^models\//,'').trim()||fallback;
    if(!MODEL_PATTERN.test(model))throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured correctly.'});
    return model;
  }
  get model(): string { return this.normalizeModel(this.config.get<string>('GEMINI_MODEL'),DEFAULT_MODEL); }
  /** Used once if the primary model returns 404. Set GEMINI_FALLBACK_MODEL to override. */
  get fallbackModel(): string { return this.normalizeModel(this.config.get<string>('GEMINI_FALLBACK_MODEL'),DEFAULT_MODEL); }
  /** Google's machine-readable error code (e.g. API_KEY_INVALID); never the raw body, which may echo request data. */
  private async providerReason(response:Response):Promise<string|undefined> {
    try {
      const body=await response.json() as {error?:{status?:unknown;details?:{reason?:unknown}[]}};
      const pick=[body.error?.details?.find(d=>typeof d?.reason==='string')?.reason,body.error?.status]
        .find((v):v is string=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(v));
      return pick;
    } catch { return undefined; }
  }
  /** Logs the model IDs this key can actually call, so a 404 tells you which GEMINI_MODEL to set. Names only. */
  private async logAvailableModels(key:string):Promise<void> {
    try {
      const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(5_000)});
      if(!res.ok){this.logger.warn(`ListModels failed: HTTP ${res.status}`);return;}
      const body=await res.json() as {models?:{name?:string;supportedGenerationMethods?:string[]}[]};
      const names=(body.models??[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent'))
        .map(m=>m.name?.replace(/^models\//,'')).filter((n):n is string=>typeof n==='string'&&n.length>0);
      this.logger.warn(`Models available to this key for generateContent: ${names.join(', ')||'none'}`);
    } catch { this.logger.warn('ListModels request failed'); }
  }
  private request(model:string,key:string,facts:TradeFacts): Promise<Response> {
    const structured=this.supportsStructuredOutput(model);
    const prompt=structured?reviewPrompt(facts):reviewPrompt(facts)+JSON_ONLY_SUFFIX;
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(REVIEW_TIMEOUT_MS),
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0.2,maxOutputTokens:2048,
          // Gemma models reject JSON mode and response schemas; they are asked for JSON in the prompt instead.
          ...(structured?{responseMimeType:'application/json',responseSchema:REVIEW_SCHEMA}:{}),
          // 2.5 Flash "thinks" by default; thinking tokens would eat the small output budget.
          ...(model.startsWith('gemini-2.5-flash')?{thinkingConfig:{thinkingBudget:0}}:{})}}),
    });
  }
  async generate(facts:TradeFacts): Promise<ReviewContent> {
    const key=this.config.get<string>('GEMINI_API_KEY')?.trim().replace(/^["']+|["']+$/g,'').trim();
    if(!key)throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured on the server yet.'});
    try {
      let model=this.model;
      let response=await this.request(model,key,facts);
      if(response.status===404) {
        this.logger.warn(`Model "${model}" returned 404 (not found, or not supported for generateContent on this key)`);
        await this.logAvailableModels(key);
        const fallback=this.fallbackModel;
        if(fallback!==model) {
          this.logger.warn(`Retrying once with fallback model "${fallback}"`);
          model=fallback;
          response=await this.request(model,key,facts);
        }
      }
      if(!response.ok) {
        const reason=await this.providerReason(response);
        this.logger.warn(`Gemini request failed: HTTP ${response.status}${reason?` (${reason})`:''}, model ${model}`);
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
