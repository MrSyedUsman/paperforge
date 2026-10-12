import assert from 'node:assert/strict';
import test from 'node:test';
import { tradeReviewSnapshot, validateTradeReviewResponse } from '../src/features/portfolio/trade-review-contract.ts';
const trade={id:1,symbol:'BTC',side:'Long',entry:100,exit:110,margin:100,size:1000,lev:10,openFee:0.5,opened:'opened',closed:'closed',pnl:99,email:'private@example.com'};
const response={facts:{grossPnl:100,netPnl:99,totalFees:1,outcome:'Profit',facts:[{id:'totalFees',label:'Fees',value:'$1.00'},{id:'leverage',label:'Leverage',value:'10x'}],limitations:['Unverified simulation.']},review:{summary:'The result was profitable after fees.',observations:[{title:'Fees',text:'Fees reduce the gross result.',evidenceIds:['totalFees']},{title:'Exposure',text:'Leverage increases exposure.',evidenceIds:['leverage']}],lesson:'Review fees and leverage.',exercise:{title:'Practise reviewing exposure',steps:['Check estimated fees.','Compare notional with margin.']}},metadata:{model:'gemini-flash-latest',promptVersion:'trade-review-v1',generatedAt:'2026-10-12T00:00:00.000Z',generationMs:1200,requestMs:1200,cached:false}};
test('AI request sends trade facts without profile information, recorded PnL or identifiers',()=>{
 const snapshot=tradeReviewSnapshot(trade);
 assert.equal(snapshot.pair,'BTCUSDT');assert.equal(snapshot.leverage,10);
 for(const key of ['email','id','pnl','opened','closed'])assert.equal(key in snapshot,false);
 assert.equal(snapshot.openingFee,0.5);
});
test('complete grounded AI responses are accepted',()=>assert.deepEqual(validateTradeReviewResponse(response),response));
test('malformed responses cannot reach the review UI',()=>{
 for(const invalid of [null,{}, {...response,review:{...response.review,observations:[null]}},{...response,review:{...response.review,observations:[{...response.review.observations[0],evidenceIds:['futurePrice']},response.review.observations[1]]}}, {...response,metadata:{...response.metadata,generationMs:NaN}},{...response,facts:{...response.facts,facts:[null]}},{...response,review:{...response.review,exercise:{steps:null}}}])assert.throws(()=>validateTradeReviewResponse(invalid),/incomplete/);
});
