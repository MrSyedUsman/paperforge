import { captureAiPanel } from "./capture-ai-panel.mjs";
﻿import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.env.RISK_UI_TEST_PORT || '3017';
const base=`http://localhost:${port}`,root=process.cwd();
const {calculateRiskFacts}=await import(pathToFileURL(path.resolve(root,'../paperforge-backend/dist/trade-risk/risk-facts.js')).href);
const server=spawn(process.execPath,['scripts/start-standalone.mjs'],{cwd:root,env:{...process.env,PORT:port,HOSTNAME:'127.0.0.1'},windowsHide:true,stdio:'ignore'});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'paperforge-ai-browser-'));
let browser,ws;
try {
 for(let n=0;n<120;n++){try{if((await fetch(base)).ok)break}catch{}await sleep(100)}
 browser=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--in-process-gpu','--disable-software-rasterizer','--no-sandbox','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${temporary}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let endpoint;for(let n=0;n<100;n++){try{endpoint=fs.readFileSync(path.join(temporary,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);break}catch{}await sleep(100)}
 if(!endpoint)throw Error('Browser startup failed');
 ws=new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),handlers=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p){if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}}else{for(const fn of handlers.get(m.method)||[])fn(m)}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}))});
 const on=(m,f)=>handlers.set(m,[...(handlers.get(m)||[]),f]);
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p={})=>send(m,p,sessionId);
 const issues=[];on('Runtime.exceptionThrown',m=>issues.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));on('Runtime.consoleAPICalled',m=>{if(['error','warning'].includes(m.params.type))issues.push(m.params.args.map(x=>x.value||x.description).join(' '))});
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 let mode='success';const requests=[];const cache=new Map();
 const content=()=>({summary:'Hypothetical price moves show how fees and leverage affect this proposed paper position.',observations:[{text:'Fees reduce the result of both favourable and adverse examples.',evidenceIds:['openingFee','roundTripFees']},{text:'Leverage increases exposure and brings liquidation closer to entry.',evidenceIds:['leverage','liquidationDistance']}],lesson:'Compare the potential loss with your isolated margin.',question:'How would reducing leverage change the adverse example?'});
 on('Fetch.requestPaused',m=>{void(async()=>{const {requestId,request}=m.params;const url=new URL(request.url);let data,status=200;
 if(request.method==='OPTIONS')data={};
 else if(url.pathname.includes('/auth/'))data={username:'fixture-user',displayName:'Risk Test'};
 else if(url.pathname.includes('/trade-risk')) {
  const snapshot=JSON.parse(request.postData||'{}');assert.equal(request.headers.Authorization||request.headers.authorization,'Bearer layout-fixture');assert.deepEqual(Object.keys(snapshot).sort(),['pair','side','margin','leverage','price','priceTimestamp'].sort());
  const facts=calculateRiskFacts(snapshot);
  if(url.pathname.endsWith('/facts'))data=facts;
  else {requests.push(snapshot);
   if(mode==='error'){status=503;data={message:'The AI service is temporarily unavailable. Please try again.'};}
   else {
    if(mode==='slow'||mode==='hang')await sleep(1200);
    const key=JSON.stringify(snapshot),saved=cache.has(key);
    data={facts,review:content(),metadata:{model:'configured-model',promptVersion:'trade-risk-v1',generatedAt:new Date().toISOString(),generationMs:1200,requestMs:saved?5:1200,cached:saved}};cache.set(key,data);
   }
  }
 }
 else if(url.searchParams.get('resource')==='exchangeInfo')data={symbols:['BTC','ETH'].map(baseAsset=>({symbol:baseAsset+'USDT',baseAsset,quoteAsset:'USDT',status:'TRADING',contractType:'PERPETUAL',filters:[]}))};
 else if(url.searchParams.get('resource')==='klines')data=Array.from({length:96},(_,i)=>[Date.now()-(96-i)*900000,'100','101','99','100','1000']);
 else if(url.searchParams.get('resource')==='premiumIndex')data=['BTC','ETH'].map(s=>({symbol:s+'USDT',markPrice:'100'}));
 else data=['BTC','ETH'].map(s=>({symbol:s+'USDT',lastPrice:'100',openPrice:'100',priceChangePercent:'1',quoteVolume:'1000',highPrice:'101',lowPrice:'99'}));
 await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Authorization, Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
 })().catch(error=>{if(!error.message.includes('Invalid InterceptionId'))issues.push(error.message)});});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/binance*'},{urlPattern:'*auth*'},{urlPattern:'*/api/trade-risk*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:[]}));}catch{}window.__fixturePrice=100;window.__fixtureEmit=true;const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){if(String(args[0]).includes('fstream.binance.com')){const socket={close(){clearInterval(socket.timer)}};setTimeout(()=>socket.onopen?.(),50);socket.timer=setInterval(()=>{if(window.__fixtureEmit)socket.onmessage?.({data:JSON.stringify(['BTC','ETH'].map(s=>({s:s+'USDT',c:String(window.__fixturePrice),o:'100',P:'1',q:'1000',h:'101',l:'99'})))})},1000);return socket}super(...args)}};`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,label)=>{for(let n=0;n<120;n++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label+' '+await evaluate('document.body.innerText'))};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const input=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('.account-controls')`,'authenticated app');
 await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.trim()==='Trade').click()`);
 await wait(`!!document.querySelector('.trade-risk-button')`,'risk action');await input('#margin-input','100');await wait(`!document.querySelector('.trade-risk-button').disabled`,'fresh valid order');
 const initialStorage=await evaluate(`localStorage.getItem('paperforge-v2')`);
 assert.equal(requests.length,0,'AI must not run automatically');
 mode='slow';await click('.trade-risk-button');await click('.trade-risk-button');await wait(`!!document.querySelector('.trade-risk-scenarios')`,'facts while AI loads');await sleep(100);assert.equal(requests.length,1,'duplicate click');
 assert.ok(await evaluate(`!!document.querySelector('.ai-review-loading')`));
 assert.ok(await evaluate(`(()=>{const input=document.querySelector('#margin-input'),r=input.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===input})()`),'order inputs must remain reachable beside panel');
 await input('#margin-input','200');await wait(`!!document.querySelector('.trade-risk-outdated')`,'changed margin warning');assert.equal(requests.length,1,'input changes must not generate');
 await wait(`!!document.querySelector('.ai-review-content')`,'slow result');assert.ok(await evaluate(`document.querySelector('.ai-trade-context').innerText.includes('$100.00')`),'result retains original snapshot');
 mode='success';await click('.trade-risk-outdated button');await wait(`document.querySelector('.ai-trade-context')?.innerText.includes('$200.00') && !!document.querySelector('.ai-review-content')`,'explicit refresh');
 await click('.side-tabs button:nth-child(2)');await wait(`!!document.querySelector('.trade-risk-outdated')`,'changed direction');assert.equal(requests.length,2);
 await click('.trade-risk-outdated button');await wait(`document.querySelector('.ai-trade-context')?.innerText.includes('Short') && !!document.querySelector('.ai-review-content')`,'short snapshot');
 await input('input[aria-label="Leverage"]','50');await wait(`!!document.querySelector('.trade-risk-outdated')`,'changed leverage');await click('.trade-risk-outdated button');await wait(`document.querySelector('.trade-risk-scenarios')?.innerText.includes('liquidates first') && !!document.querySelector('.ai-review-content')`,'liquidation example');
 await captureAiPanel(call, ".ai-review-body", "risk-desktop");
  await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-risk-desktop.png'),Buffer.from(r.data,'base64')));
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await wait(`!document.querySelector('#trade-risk-panel')`,'Escape close');assert.ok(await evaluate(`document.activeElement?.classList.contains('trade-risk-button')`),'focus return');
 mode='error';await click('.trade-risk-button');await wait(`!!document.querySelector('.ai-review-error')`,'error');assert.ok(await evaluate(`!!document.querySelector('.trade-risk-scenarios')`),'facts survive failure');assert.equal(await evaluate(`!!document.querySelector('.ai-review-content')`),false,'no fabricated feedback');
 mode='success';await click('.ai-review-error button');await wait(`!!document.querySelector('.ai-review-content')`,'retry');await click('.ai-review-close');await click('.trade-risk-button');await wait(`document.querySelector('.ai-review-timing')?.innerText.includes('Saved explanation')`,'cache reuse');await click('.ai-review-close');
 mode='slow';await click('.trade-risk-button');await wait(`!!document.querySelector('.ai-review-loading')`,'close pending');await click('.ai-review-close');await sleep(1400);assert.equal(await evaluate(`!!document.querySelector('#trade-risk-panel')`),false,'late response cannot reopen');
 await evaluate(`window.__nativeTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.__nativeTimeout(fn,ms===30000?200:ms,...args)`);
 mode='hang';await click('.trade-risk-button');await wait(`document.querySelector('.ai-review-error')?.innerText.includes('too long')`,'deadline');await click('.ai-review-close');await evaluate(`window.setTimeout=window.__nativeTimeout`);
 mode='success';await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await click('.trade-risk-button');await wait(`!!document.querySelector('.ai-review-content')`,'mobile result');
 const box=await evaluate(`(()=>{const r=document.querySelector('#trade-risk-panel').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()`);assert.ok(box.left>=0&&box.right<=box.width&&box.top>=0&&box.bottom<=box.height,'mobile bounds');
 await evaluate(`document.querySelector('.ai-review-body').scrollTop=99999`);await captureAiPanel(call, ".ai-review-body", "risk-mobile");
  await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-risk-mobile.png'),Buffer.from(r.data,'base64')));
 await evaluate(`window.__fixtureEmit=false;window.__nativeNow=Date.now;Date.now=()=>window.__nativeNow()+46000`);await wait(`document.querySelector('.trade-risk-button').disabled && !!document.querySelector('.trade-risk-outdated')`,'stale price disabled');
 await evaluate(`Date.now=window.__nativeNow;window.__fixtureEmit=true`);await wait(`!document.querySelector('.trade-risk-button').disabled`,'price freshness recovery');
 await evaluate(`window.__fixturePrice=101`);await wait(`!!document.querySelector('.trade-risk-outdated')`,'changed price warning');
 await click('.ai-review-close');await input('#margin-input','not-a-number');await wait(`document.querySelector('.trade-risk-button').disabled`,'invalid margin');await input('#margin-input','100');
 await click('.pair-select');await wait(`!!document.querySelector('.modal-pair')`,'market picker');await evaluate(`[...document.querySelectorAll('.modal-pair')].find(b=>b.textContent.includes('ETHUSDT')).click()`);await wait(`document.querySelector('.pair-select')?.innerText.includes('ETHUSDT')`,'market switch');
 const financial = value => { const {balance,positions,history,activity}=JSON.parse(value);return {balance,positions,history,activity}; };
 assert.deepEqual(financial(await evaluate(`localStorage.getItem('paperforge-v2')`)),financial(initialStorage),'risk checks must not mutate balances, positions, history or activity');
 mode='slow';await click('.trade-risk-button');await wait(`!!document.querySelector('.ai-review-loading')`,'navigation pending');await evaluate(`document.querySelector('.mobile-nav button').click()`);await wait(`!!document.querySelector('.p3-hero')`,'background navigation');await sleep(1300);assert.equal(await evaluate(`!!document.querySelector('#trade-risk-panel')`),false);
 assert.equal(issues.length,0,issues.join('\n'));
 console.log('Risk UI checks passed: authenticated minimal payload, on-demand only, duplicate click, server facts, slow requests, input/direction/leverage/price changes, explicit refresh, liquidation, Escape/focus return, failure/retry, cache, close/stale response, deadline, mobile bounds, stale-price disable, market switching, unchanged trading storage and non-blocking navigation.');
 await send('Browser.close');
}finally{ws?.close();if(browser&&browser.exitCode===null)browser.kill();if(server.exitCode===null)server.kill();}
