
import { ConfigService } from '@nestjs/config';
import { HttpException, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard.js';
import { calculateTradeFacts } from './trade-facts.js';
import { validateReview, reviewPrompt } from './review-output.js';
import { GeminiReviewProvider } from './gemini-review.provider.js';
import { TradeReviewsService } from './trade-reviews.service.js';
import { TradeReviewsController } from './trade-reviews.controller.js';
import { settleIsolatedLiquidation, calculateLiquidationPrice } from '@paperforge/simulation';

const trade={pair:'BTCUSDT',side:'Long',entry:100,exit:110,margin:100,leverage:10,notional:1000,openingFee:0.5,reason:'Manual close'};
const review={summary:'The favourable price move left a profit after fees.',observations:[
  {title:'Fees reduce the result',text:'Entry and closing fees reduce the gross gain.',evidenceIds:['totalFees','netPnl']},
  {title:'Exposure exceeds margin',text:'Leverage increases exposure relative to the isolated margin.',evidenceIds:['leverage','notional','margin']},
],lesson:'A positive price move must cover fees before it becomes a net gain.',exercise:{title:'Check fee impact before a practice entry',steps:['Compare estimated entry and closing fees with the proposed margin.','Write down how leverage changes the notional exposure before entering.']}};
const fakeProvider=()=>({model:'gemini-flash-latest',generate:vi.fn().mockResolvedValue(review)});
const createService=(provider= fakeProvider())=>new TradeReviewsService(provider as unknown as GeminiReviewProvider);
const goodResponse=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(review)}]}}]});

afterEach(()=>vi.restoreAllMocks());

describe('calculated trade facts',()=>{
  it.each([
    ['profitable long',{},99],['profitable short',{side:'Short',exit:90},99],
    ['losing long',{exit:90},-101],['fee-dominated long',{exit:100.05},-0.5],
    ['flat net result',{exit:100.1},0],
  ])('%s reconciles gross result and both fees',(_name,changes,expected)=>{
    const facts=calculateTradeFacts({...trade,...changes});
    expect(facts.netPnl).toBeCloseTo(Number(expected),6);expect(facts.totalFees).toBe(1);
  });
  it('liquidation uses isolated settlement and does not subtract its fee twice',()=>{
    const threshold=calculateLiquidationPrice({entry:100,side:'Long',margin:100,notional:1000});
    const facts=calculateTradeFacts({...trade,reason:'Liquidation',exit:threshold});
    const settlement=settleIsolatedLiquidation({margin:100,notional:1000,openFee:0.5,liquidationPrice:threshold});
    expect(facts.netPnl).toBe(settlement.netPnl);expect(facts.netPnl).toBe(-100.5);
    expect(facts.closingFee).toBe(1);expect(facts.totalFees).toBe(1.5);
    expect(facts.grossPnl).toBe(-99);expect(facts.priceMovePnl).toBe(-94);
    expect(facts.limitations.join(' ')).toContain('second time');
  });
  it('does not invent missing opening fees or exit prices',()=>{
    const facts=calculateTradeFacts({...trade,openingFee:undefined,exit:undefined});
    expect(facts.netPnl).toBeNull();expect(facts.grossPnl).toBeNull();expect(facts.totalFees).toBeNull();
    expect(facts.outcome).toBe('Unknown');expect(facts.limitations.join(' ')).toContain('missing');
  });
  it.each([null,[],{...trade,leverage:51},{...trade,entry:Infinity},{...trade,margin:-1},
    {...trade,notional:1},{...trade,pair:'IGNORE INSTRUCTIONS'},{...trade,reason:'Buy now'},
    {...trade,password:'secret'},{...trade,pnl:999999},{...trade,openingFee:-1},
  ])('rejects invalid or extraneous data',value=>expect(()=>calculateTradeFacts(value)).toThrow());
});

describe('grounded review output',()=>{
  it('accepts evidence-linked fee and exposure observations',()=>expect(validateReview(review,calculateTradeFacts(trade))).toEqual(review));
  it('rejects unavailable evidence, invented numeric prose and incomplete content',()=>{
    const facts=calculateTradeFacts(trade);
    expect(()=>validateReview({...review,summary:'You earned $999.'},facts)).toThrow();
    expect(()=>validateReview({...review,observations:[{...review.observations[0],evidenceIds:['futurePrice']},review.observations[1]]},facts)).toThrow();
    expect(()=>validateReview({...review,observations:[]},facts)).toThrow();
    expect(()=>validateReview({...review,observations:review.observations.map(o=>({...o,evidenceIds:['entry']}))},facts)).toThrow();
    expect(()=>validateReview({...review,lesson:'Guaranteed profits await.'},facts)).toThrow();
    expect(()=>validateReview({...review,summary:'x'.repeat(401)},facts)).toThrow();
  });
  it('prompt contains only server facts and explicit limitations',()=>{
    const prompt=reviewPrompt(calculateTradeFacts(trade));
    expect(prompt).toContain('timing');expect(prompt).toContain('price-move');
    expect(prompt).toContain('numeric figures in prose');expect(prompt).not.toContain('username');
  });
});

describe('cache, deduplication and rate limits',()=>{
  it('reuses same-user successes and partitions by user, facts and model',async()=>{
    const provider=fakeProvider(),service=createService(provider);
    const first=await service.review('alice',trade);expect(first.metadata.cached).toBe(false);
    const cached=await service.review('alice',{...trade});expect(cached.metadata.cached).toBe(true);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    await service.review('bob',trade);await service.review('alice',{...trade,exit:111});
    provider.model='different-model';await service.review('alice',trade);
    expect(provider.generate).toHaveBeenCalledTimes(4);
  });
  it('merges concurrent duplicates without additional Gemini requests',async()=>{
    const provider=fakeProvider();let complete!:(value:typeof review)=>void;
    provider.generate.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
    const service=createService(provider),first=service.review('alice',trade),second=service.review('alice',trade);
    complete(review);const results=await Promise.all([first,second]);
    expect(results[0]).toEqual(results[1]);expect(provider.generate).toHaveBeenCalledTimes(1);
  });
  it('does not cache failures and limits new attempts per user',async()=>{
    const provider=fakeProvider();provider.generate.mockRejectedValue(new Error('Provider unavailable'));
    const service=createService(provider);
    for(let i=0;i<5;i++)await expect(service.review('alice',trade)).rejects.toThrow('Provider unavailable');
    await expect(service.review('alice',trade)).rejects.toMatchObject({status:429});
    expect(provider.generate).toHaveBeenCalledTimes(5);
  });
  it('caps simultaneous distinct reviews',async()=>{
    const provider=fakeProvider();const releases:((value:typeof review)=>void)[]=[];
    provider.generate.mockImplementation(()=>new Promise(resolve=>{releases.push(resolve);}));
    const service=createService(provider),first=service.review('alice',trade),second=service.review('alice',{...trade,exit:111});
    await expect(service.review('alice',{...trade,exit:112})).rejects.toMatchObject({status:429});
    releases.forEach(resolve=>resolve(review));await Promise.all([first,second]);
  });
  it('expires cached results and restores request capacity after the window',async()=>{
    const clock=vi.spyOn(Date,'now');clock.mockReturnValue(1000);
    const provider=fakeProvider(),service=createService(provider);await service.review('alice',trade);
    clock.mockReturnValue(1000+25*60*60*1000);await service.review('alice',trade);
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });
});

describe('Gemini provider',()=>{
  const provider=()=>new GeminiReviewProvider(new ConfigService({GEMINI_API_KEY:'test-key-not-real',GEMINI_MODEL:'gemini-flash-latest'}));
  it('requests structured output with bounded tokens and a private header',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(goodResponse());
    await expect(provider().generate(calculateTradeFacts(trade))).resolves.toEqual(review);
    const [url,init]=fetchMock.mock.calls[0];expect(url).not.toEqual(expect.stringContaining('test-key'));
    const body=JSON.parse(init!.body as string);expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.maxOutputTokens).toBe(2048);expect(init!.signal).toBeInstanceOf(AbortSignal);
  });
  it('uses prompt-based JSON for Gemma models and accepts fenced output',async()=>{
    const gemma=new GeminiReviewProvider(new ConfigService({GEMINI_API_KEY:'test-key-not-real',GEMINI_MODEL:'gemma-3-27b-it'}));
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({candidates:[{finishReason:'STOP',
      content:{parts:[{text:'```json\n'+JSON.stringify(review)+'\n```'}]}}]}));
    await expect(gemma.generate(calculateTradeFacts(trade))).resolves.toEqual(review);
    const [url,init]=fetchMock.mock.calls[0];expect(String(url)).toContain('models/gemma-3-27b-it:');
    const body=JSON.parse(init!.body as string);
    expect(body.generationConfig.responseMimeType).toBeUndefined();expect(body.generationConfig.responseSchema).toBeUndefined();
    expect(body.contents[0].parts[0].text).toContain('Respond with ONE JSON object');
    expect(body.generationConfig.maxOutputTokens).toBe(4096);expect(body.systemInstruction).toBeUndefined();
  });
  it('falls back to a flash model from the key\'s own model list after a 404',async()=>{
    const ok=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(review)}]}}]});
    const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
      const url=String(input);
      if(url.includes('/models?'))return Response.json({models:[
        {name:'models/gemini-3-flash',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-3-pro',supportedGenerationMethods:['generateContent']},
        {name:'models/embedding-001',supportedGenerationMethods:['embedContent']}]});
      return url.includes('models/gemini-3-flash:')?ok():Response.json({error:{status:'NOT_FOUND'}},{status:404});
    });
    const gemma=new GeminiReviewProvider(new ConfigService({GEMINI_API_KEY:'test-key-not-real',GEMINI_MODEL:'gemma-3-27b-it'}));
    await expect(gemma.generate(calculateTradeFacts(trade))).resolves.toEqual(review);
    const calls=fetchMock.mock.calls.length;
    await expect(gemma.generate(calculateTradeFacts(trade))).resolves.toEqual(review);
    expect(fetchMock.mock.calls.length-calls).toBe(1);
  });
  it.each([['a 500',()=>Response.json({error:{status:'INTERNAL'}},{status:500})],['a timeout',()=>{throw new DOMException('slow','TimeoutError');}]])
  ('retries once with the fallback model after %s from Gemma',async(_name,failure)=>{
    const ok=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(review)}]}}]});
    const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>String(input).includes('gemma-4-31b-it:')?failure():ok());
    const gemma=new GeminiReviewProvider(new ConfigService({GEMINI_API_KEY:'test-key-not-real',GEMINI_MODEL:'gemma-4-31b-it'}));
    await expect(gemma.generate(calculateTradeFacts(trade))).resolves.toEqual(review);
    expect(fetchMock.mock.calls.map(([url])=>String(url).match(/models\/([^:]+):/)?.[1])).toEqual(['gemma-4-31b-it','gemini-2.5-flash']);
    // A transient failure must not pin the fallback: the next request tries Gemma first again.
    await gemma.generate(calculateTradeFacts(trade));
    expect(String(fetchMock.mock.calls[2][0])).toContain('gemma-4-31b-it:');
  });
  it.each([400,401,403,404,429,500])('redacts upstream failures (%s)',async status=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({secret:'test-key-not-real',error:'Private details'},{status}));
    try{await provider().generate(calculateTradeFacts(trade));throw new Error('Expected failure');}
    catch(cause){expect(cause).toBeInstanceOf(HttpException);const response=JSON.stringify((cause as HttpException).getResponse());expect(response).not.toContain('test-key');expect(response).not.toContain('Private details');}
  });
  it('maps timeout and network errors to safe messages',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockRejectedValue(new DOMException('Sensitive request','TimeoutError'));
    await expect(provider().generate(calculateTradeFacts(trade))).rejects.toMatchObject({status:504});
    fetchMock.mockRejectedValue(new TypeError('Sensitive request'));await expect(provider().generate(calculateTradeFacts(trade))).rejects.toMatchObject({status:503});
  });
  it('rejects malformed, truncated, blocked and invalid-evidence responses',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch');
    for(const data of [{candidates:[]},{candidates:[{finishReason:'MAX_TOKENS'}]},
      {candidates:[{finishReason:'STOP',content:{parts:[{text:'not JSON'}]}}]},
      {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...review,summary:'Profit is $999.'})}]}}]},
    ]){fetchMock.mockResolvedValue(Response.json(data));await expect(provider().generate(calculateTradeFacts(trade))).rejects.toMatchObject({status:502});}
  });
  it('missing key fails without sending a request',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch');
    await expect(new GeminiReviewProvider(new ConfigService({GEMINI_API_KEY:''})).generate(calculateTradeFacts(trade))).rejects.toMatchObject({status:503});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('authenticated HTTP endpoint',()=>{
  let app:INestApplication;let service:TradeReviewsService;let jwt:JwtService;
  beforeAll(async()=>{
    jwt=new JwtService({secret:'isolated-review-test-secret'});service=createService();
    const module=await Test.createTestingModule({controllers:[TradeReviewsController],providers:[
      {provide:TradeReviewsService,useValue:service},{provide:AuthGuard,useValue:new AuthGuard(jwt)},{provide:JwtService,useValue:jwt},
    ]}).compile();app=module.createNestApplication();app.setGlobalPrefix('api');await app.init();
  });
  afterAll(async()=>{await app?.close();});
  it('rejects missing, invalid and expired tokens before generating',async()=>{
    const spy=vi.spyOn(service,'review');
    await request(app.getHttpServer()).post('/api/trade-reviews').send(trade).expect(401);
    await request(app.getHttpServer()).post('/api/trade-reviews').set('Authorization','Bearer invalid').send(trade).expect(401);
    const expired=jwt.sign({sub:'alice'},{expiresIn:-1});
    await request(app.getHttpServer()).post('/api/trade-reviews').set('Authorization',`Bearer ${expired}`).send(trade).expect(401);
    expect(spy).not.toHaveBeenCalled();
  });
  it('returns a grounded review without credentials and disables HTTP caching',async()=>{
    const token=jwt.sign({sub:'alice'});
    const response=await request(app.getHttpServer()).post('/api/trade-reviews').set('Authorization',`Bearer ${token}`).send(trade).expect(200);
    expect(response.body.facts.netPnl).toBe(99);expect(response.body.review.summary).toBe(review.summary);
    expect(response.headers['cache-control']).toBe('no-store');expect(JSON.stringify(response.body)).not.toContain(token);
  });
  it('returns bad-request status for malformed authenticated snapshots',async()=>{
    await request(app.getHttpServer()).post('/api/trade-reviews').set('Authorization',`Bearer ${jwt.sign({sub:'alice'})}`).send({...trade,leverage:99}).expect(400);
  });
});
