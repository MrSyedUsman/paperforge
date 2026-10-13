import { BadGatewayException, GatewayTimeoutException, Inject, Injectable, Logger, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TradeFacts } from './trade-facts.js';
import { REVIEW_SCHEMA, reviewPrompt, validateReview, type ReviewContent } from './review-output.js';
export const REVIEW_TIMEOUT_MS=20_000;
/** Gemma is much slower than Gemini Flash, so it gets longer before we switch to the fallback model. */
export const GEMMA_TIMEOUT_MS=25_000;
/** Default model when GEMINI_MODEL is unset (free tier on AI Studio, fast, supports structured JSON output). */
const DEFAULT_MODEL='gemini-3.5-flash-lite';
/** Default for the retry after a failure on the primary model: an alias that tracks Google's current Flash model. */
const DEFAULT_FALLBACK_MODEL='gemini-flash-latest';
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
  /** A working model discovered after the configured one returned 404; reused so later requests skip the failed attempt. */
  private resolvedModel?:string;
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
  get fallbackModel(): string { return this.normalizeModel(this.config.get<string>('GEMINI_FALLBACK_MODEL'),DEFAULT_FALLBACK_MODEL); }
  /** Google's machine-readable error code (e.g. API_KEY_INVALID); never the raw body, which may echo request data. */
  private async providerReason(response:Response):Promise<string|undefined> {
    try {
      const body=await response.json() as {error?:{status?:unknown;details?:{reason?:unknown}[]}};
      const pick=[body.error?.details?.find(d=>typeof d?.reason==='string')?.reason,body.error?.status]
        .find((v):v is string=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(v));
      return pick;
    } catch { return undefined; }
  }
  /** Model IDs this key can call with generateContent. A 404 logs them so the right GEMINI_MODEL is visible. Names only. */
  private async listModels(key:string):Promise<string[]> {
    try {
      const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(5_000)});
      if(!res.ok){this.logger.warn(`ListModels failed: HTTP ${res.status}`);return [];}
      const body=await res.json() as {models?:{name?:string;supportedGenerationMethods?:string[]}[]};
      const names=(body.models??[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent'))
        .map(m=>m.name?.replace(/^models\//,'')).filter((n):n is string=>typeof n==='string'&&n.length>0);
      this.logger.warn(`Models available to this key for generateContent: ${names.join(', ')||'none'}`);
      return names;
    } catch { this.logger.warn('ListModels request failed'); return []; }
  }
  /** Best stable Flash model from the key's own list: the "latest" alias, else the highest versioned flash. */
  private pickFlashModel(names:string[]):string[] {
    if(names.includes('gemini-flash-latest'))return ['gemini-flash-latest'];
    const version=(n:string)=>Number(/^gemini-(\d+(?:\.\d+)?)-flash(?:-lite)?$/.exec(n)?.[1]);
    return names.filter(n=>Number.isFinite(version(n))).sort((x,y)=>version(y)-version(x)||(x.includes('lite')?1:0)-(y.includes('lite')?1:0)).slice(0,2);
  }
  private request(model:string,key:string,facts:TradeFacts): Promise<Response> {
    const timeoutMs=model.startsWith('gemma')?GEMMA_TIMEOUT_MS:REVIEW_TIMEOUT_MS;
    const structured=this.supportsStructuredOutput(model);
    const prompt=structured?reviewPrompt(facts):reviewPrompt(facts)+JSON_ONLY_SUFFIX;
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(timeoutMs),
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0.2,
          // Gemma and Gemini 3 models may spend output tokens on reasoning before the JSON, so give them more room.
          maxOutputTokens:structured&&!model.startsWith('gemini-3')?2048:4096,
          // Gemma models reject JSON mode and response schemas; they are asked for JSON in the prompt instead.
          ...(structured?{responseMimeType:'application/json',responseSchema:REVIEW_SCHEMA}:{}),
          // 2.5 Flash "thinks" by default; thinking tokens would eat the small output budget.
          ...(model.startsWith('gemini-2.5-flash')?{thinkingConfig:{thinkingBudget:0}}:{})}}),
    });
  }
  /** Never throws: a timeout or network error is returned so the caller can try another model. */
  private async attempt(model:string,key:string,facts:TradeFacts): Promise<Response|Error> {
    try { return await this.request(model,key,facts); }
    catch(cause) { return cause instanceof Error?cause:new Error('request failed'); }
  }
  /** Worth trying another model: not found, a server error from Google, a timeout or a network failure. */
  private shouldTryAnotherModel(outcome:Response|Error): boolean {
    return outcome instanceof Error||outcome.status===404||outcome.status>=500;
  }
  async generate(facts:TradeFacts): Promise<ReviewContent> {
    const key=this.config.get<string>('GEMINI_API_KEY')?.trim().replace(/^["']+|["']+$/g,'').trim();
    if(!key)throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured on the server yet.'});
    try {
      let model=this.resolvedModel??this.model;
      let outcome=await this.attempt(model,key,facts);
      let notFoundResolved=false;
      if(this.shouldTryAnotherModel(outcome)) {
        const notFound=!(outcome instanceof Error)&&outcome.status===404;
        this.logger.warn(outcome instanceof Error
          ?`Model "${model}" failed (${outcome.name}); trying a fallback model`
          :`Model "${model}" returned HTTP ${outcome.status}${notFound?' (not found, or not supported for generateContent on this key)':''}; trying a fallback model`);
        // Only a 404 means the model name itself is wrong, so only then look up what the key can use.
        notFoundResolved=notFound;
        const available=notFound?await this.listModels(key):[];
        const candidates=[...new Set([this.fallbackModel,...this.pickFlashModel(available)])].filter(m=>m!==model&&(!available.length||available.includes(m)));
        for(const candidate of candidates) {
          this.logger.warn(`Retrying with model "${candidate}"`);
          model=candidate;
          outcome=await this.attempt(model,key,facts);
          if(!this.shouldTryAnotherModel(outcome))break;
        }
      }
      if(outcome instanceof Error)throw outcome;
      const response=outcome;
      if(response.ok&&notFoundResolved&&model!==this.resolvedModel&&model!==this.model) {
        this.resolvedModel=model;
        this.logger.warn(`Using model "${model}" instead of the configured "${this.model}". Set GEMINI_MODEL=${model} to make this permanent.`);
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
