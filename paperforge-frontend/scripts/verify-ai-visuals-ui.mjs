import { captureAiPanel } from "./capture-ai-panel.mjs";
﻿import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.env.AI_VISUAL_TEST_PORT || '3028';
const base=`http://localhost:${port}`,root=process.cwd();
const {calculateTradeFacts}=await import(pathToFileURL(path.resolve(root,'../paperforge-backend/dist/trade-reviews/trade-facts.js')).href);
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

 let mode='success',delay=0, providerCalls=0;
 const cases=[['profit',102],['loss',98],['flat',100.1],['fee-dominated',100.05],['liquidation',50],['missing-evidence',null]];
 const history=cases.map(([name,exit],i)=>({id:i+1,symbol:'BTC',pair:'BTCUSDT',side:'Long',margin:100,size:1000,entry:100,lev:10,openFee:name==='missing-evidence'?undefined:.5,exit:exit??undefined,pnl:0,closed:'10/15/2026, 10:00:00 AM',opened:'10/15/2026, 9:59:00 AM',reason:name==='liquidation'?'Liquidation':'Manual close'}));
 on('Fetch.requestPaused',m=>{void(async()=>{const {requestId,request}=m.params,url=new URL(request.url);let data={},status=200;
 if(url.hostname.includes('generativelanguage')){providerCalls++;throw Error('Real provider request is forbidden');}
 if(request.method==='OPTIONS')data={};
 else if(url.pathname.includes('/auth/'))data={username:'fixture-user',displayName:'Visual Fixture'};
 else if(url.pathname.includes('/trade-reviews')) {
   const snapshot=JSON.parse(request.postData),facts=calculateTradeFacts(snapshot); if(delay)await sleep(delay);
   if(mode==='error'){status=503;data={message:'Development fixture: provider unavailable'};}
   else data={facts,review:{summary:'Development fixture: compare the net result with gross PnL and both fees to understand this completed trade.',observations:[{title:'Fees count on both sides',text:'Use the recorded opening and calculated closing fees when reading the net outcome.',evidenceIds:['closingFee']},{title:'Exposure changes the result',text:'Leverage changes exposure for the same margin. This record cannot reveal your intentions or market conditions.',evidenceIds:['leverage']}],lesson:'Evaluate the net result after both fees.',exercise:{title:'Compare two position sizes',steps:['Keep the same price move and compare the recorded fees.','Write down what the trade record cannot tell you.']}},metadata:{model:'development-fixture',promptVersion:'trade-review-v1',generatedAt:new Date().toISOString(),generationMs:350,requestMs:350,cached:false}};
 }
 else if(url.searchParams.get('resource')==='exchangeInfo')data={symbols:[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',contractType:'PERPETUAL',filters:[]}]};
 else if(url.searchParams.get('resource')==='klines')data=Array.from({length:96},(_,i)=>[Date.now()-(96-i)*900000,'100','101','99','100','1000']);
 else if(url.searchParams.get('resource')==='premiumIndex')data=[{symbol:'BTCUSDT',markPrice:'100'}];
 else data=[{symbol:'BTCUSDT',lastPrice:'100',openPrice:'100',priceChangePercent:'0',quoteVolume:'1000',highPrice:'101',lowPrice:'99'}];
 await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Authorization, Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
 })().catch(e=>{if(!e.message.includes('Invalid InterceptionId'))issues.push(e.message)});});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'*auth*'},{urlPattern:'*generativelanguage.googleapis.com*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:${JSON.stringify(history)}}));window.WebSocket=class{close(){}};`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,label)=>{for(let n=0;n<150;n++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label+' '+await evaluate('document.body.innerText'))};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('.account-controls')`,'fixture shell');
 await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Portfolio')).click()`);
 await wait(`!!document.querySelector('.p3-ai-review-button')`,'completed trades');
 const financial=await evaluate(`JSON.stringify((({balance,positions,history})=>({balance,positions,history}))(JSON.parse(localStorage.getItem('paperforge-v2'))))`);
 await click('.p3-ai-review-button');await wait(`!!document.querySelector('.ai-result-visual')`,'result visual');
 async function audit(){const result=await evaluate(`(()=>{const p=document.querySelector('#ai-review-panel'),b=p.querySelector('.ai-review-body'),r=p.getBoundingClientRect();return {overflow:b.scrollWidth>b.clientWidth+1,bounds:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,fee:!!p.querySelector('.ai-fee-track'),text:p.innerText}})()`);assert.equal(result.overflow,false,'horizontal overflow');assert.equal(result.bounds,true,'panel bounds');return result;}
 for(const [i,[name]] of cases.entries()){
   await evaluate(`(()=>{const e=document.querySelector('.ai-trade-switch select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(String(i+1))});e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   await wait(`!!document.querySelector('.ai-result-visual') && document.querySelector('.ai-trade-switch select').value==='${i+1}'`,'selected result');
   const a=await audit();assert.equal(a.fee,['profit','flat','fee-dominated'].includes(name),`fee chart: ${name}`);
   if(name==='liquidation')assert.ok(a.text.includes('not deducted a second time'));
   if(name==='missing-evidence')assert.ok(a.text.includes('cannot be reconstructed'));
 }
 await evaluate(`(()=>{const e=document.querySelector('.ai-trade-switch select');e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await wait(`!!document.querySelector('.ai-result-visual')`,'profit fixture');
 await captureAiPanel(call,'.ai-review-body','review-desktop');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await audit();await captureAiPanel(call,'.ai-review-body','review-mobile');
 // 200% browser-zoom equivalent: halve CSS viewport while preserving physical screenshot dimensions.
 await call('Emulation.setDeviceMetricsOverride',{width:720,height:500,deviceScaleFactor:2,mobile:false});await audit();
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});assert.ok(await evaluate(`document.activeElement.matches('button,select,summary')`));
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await wait(`!document.querySelector('#ai-review-panel')`,'keyboard close');assert.ok(await evaluate(`document.activeElement.classList.contains('p3-ai-review-button')`));
 delay=600;mode='error';await click('.p3-ai-review-button');await wait(`!!document.querySelector('.ai-review-loading')`,'loading');await wait(`!!document.querySelector('.ai-review-error')`,'failure');assert.equal(await evaluate(`!!document.querySelector('.ai-result-visual')`),false);
 mode='success';await click('.ai-review-error button');await wait(`!!document.querySelector('.ai-result-visual')`,'retry');await click('.ai-review-close');await click('.p3-ai-review-button');await wait(`!!document.querySelector('.ai-review-loading')`,'pending');await click('.ai-review-close');await sleep(800);assert.equal(await evaluate(`!!document.querySelector('#ai-review-panel')`),false);
 assert.equal(await evaluate(`JSON.stringify((({balance,positions,history})=>({balance,positions,history}))(JSON.parse(localStorage.getItem('paperforge-v2'))))`),financial);
 assert.equal(providerCalls,0);assert.equal(issues.length,0,issues.join('\n'));
 console.log('Trade visual browser checks passed: six financial outcomes, missing evidence, desktop/mobile/200% layout, keyboard, loading, failure/retry, late response, unchanged trading records. No Gemini calls.');
 await send('Browser.close');
}finally{ws?.close();if(browser&&browser.exitCode===null)browser.kill();if(server.exitCode===null)server.kill();}
