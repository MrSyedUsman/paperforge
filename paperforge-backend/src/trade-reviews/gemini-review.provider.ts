import { BadGatewayException, GatewayTimeoutException, Inject, Injectable, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TradeFacts } from './trade-facts.js';
import { REVIEW_SCHEMA, reviewPrompt, validateReview, type ReviewContent } from './review-output.js';
export const REVIEW_TIMEOUT_MS=20_000;
@Injectable()
export class GeminiReviewProvider {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  get model(): string {
    const model=this.config.get<string>('GEMINI_MODEL')?.trim()||'gemini-flash-latest';
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(model))throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured correctly.'});
    return model;
  }
  async generate(facts:TradeFacts): Promise<ReviewContent> {
    const key=this.config.get<string>('GEMINI_API_KEY')?.trim();
    if(!key)throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'AI reviews are not configured on the server yet.'});
    try {
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(REVIEW_TIMEOUT_MS),
        body:JSON.stringify({contents:[{role:'user',parts:[{text:reviewPrompt(facts)}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:2048,responseMimeType:'application/json',responseSchema:REVIEW_SCHEMA}}),
      });
      if(!response.ok) {
        if(response.status===429)throw new ServiceUnavailableException({code:'AI_RATE_LIMIT',message:'The AI service is busy or its quota is exhausted. Please try again later.'});
        if(response.status===402)throw new ServiceUnavailableException({code:'AI_BILLING',providerStatus:402,message:'The AI provider requires billing or credits for this key. Please contact the app administrator.'});
        if([400,401,403,404].includes(response.status))throw new ServiceUnavailableException({code:'AI_CONFIGURATION',message:'The AI service could not accept the configured key or model. Please contact the app administrator.'});
        throw new ServiceUnavailableException({code:'AI_UNAVAILABLE',providerStatus:response.status,message:'The AI service is temporarily unavailable. Please try again.'});
      }
      const data=await response.json() as {candidates?:{finishReason?:string;content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
      const candidate=data.candidates?.[0];
      if(!candidate||candidate.finishReason!=='STOP')throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI could not finish a usable review. Please try again.'});
      const output=candidate.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';
      if(output.length>8000)throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI returned an oversized review. Please try again.'});
      let value:unknown;
      try{value=JSON.parse(output);}catch{throw new BadGatewayException({code:'INVALID_REVIEW',message:'The AI returned an unreadable review. Please try again.'});}
      return validateReview(value,facts);
    } catch(cause) {
      if(cause instanceof HttpException)throw cause;
      if(cause instanceof Error&&['TimeoutError','AbortError'].includes(cause.name))throw new GatewayTimeoutException({code:'AI_TIMEOUT',message:'The AI took too long to respond. Please try again.'});
      // Never forward upstream errors: they can contain request headers or provider details.
      throw new ServiceUnavailableException({code:'AI_UNAVAILABLE',message:'The AI service could not be reached. Please try again.'});
    }
  }
}
