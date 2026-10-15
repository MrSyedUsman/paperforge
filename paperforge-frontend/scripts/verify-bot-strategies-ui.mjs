// Isolated browser verification with synthetic market prices. No real account or Gemini calls.
import { scenarioPrice, pairs } from '../tests/bot-fixtures.mjs';
import { seededRandom } from '../src/features/competitions/bot-profiles.ts';
﻿import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.env.BOT_UI_TEST_PORT || '3019';
const base=`http://localhost:${port}`,root=process.cwd();
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
 const fixtureOrigin=Date.now(), patterns=['trend','range','breakout','range','trend','volatility','reversal','volatility'];let aiRequests=0;
 const price=(i)=>scenarioPrice(patterns[i],Math.floor((Date.now()-fixtureOrigin)/2000)+24,i,1);
 on('Fetch.requestPaused',m=>{void(async()=>{const {requestId,request}=m.params,url=new URL(request.url);let data={},status=200;
 if(request.method==='OPTIONS')data={};
 else if(url.pathname.includes('/auth/'))data={username:'fixture-user',displayName:'Bot Test'};
 else if(url.pathname.includes('trade-risk')||url.pathname.includes('trade-reviews')||url.hostname.includes('generativelanguage')){aiRequests++;status=503;data={message:'AI must not be called by rule-based bots'};}
 else if(url.searchParams.get('resource')==='exchangeInfo')data={symbols:pairs.map(pair=>({symbol:pair,baseAsset:pair.slice(0,-4),quoteAsset:'USDT',status:'TRADING',contractType:'PERPETUAL',filters:[]}))};
 else if(url.searchParams.get('resource')==='klines')data=Array.from({length:96},(_,i)=>[Date.now()-(96-i)*900000,'100','101','99','100','1000']);
 else if(url.searchParams.get('resource')==='premiumIndex')data=pairs.map((symbol,i)=>({symbol,markPrice:String(price(i))}));
 else data=pairs.map((symbol,i)=>({symbol,lastPrice:String(price(i)),openPrice:'100',priceChangePercent:'1',quoteVolume:'1000',highPrice:'110',lowPrice:'90'}));
 await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Authorization, Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
 })().catch(error=>{if(!error.message.includes('Invalid InterceptionId'))issues.push(error.message)});});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/binance*'},{urlPattern:'*auth*'},{urlPattern:'*/api/trade-risk*'},{urlPattern:'*/api/trade-reviews*'},{urlPattern:'*generativelanguage.googleapis.com*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`const seededRandom=${seededRandom.toString()};const scenarioPrice=${scenarioPrice.toString()};const pairs=${JSON.stringify(pairs)},patterns=${JSON.stringify(patterns)},fixtureOrigin=${fixtureOrigin};try{if(!localStorage.getItem('bot-fixture-initialized')){localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:[]}));localStorage.setItem('bot-fixture-initialized','true');}}catch{}const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){if(String(args[0]).includes('fstream.binance.com')){const socket={close(){clearInterval(socket.timer)}};setTimeout(()=>socket.onopen?.(),50);socket.timer=setInterval(()=>socket.onmessage?.({data:JSON.stringify(pairs.map((s,i)=>({s,c:String(scenarioPrice(patterns[i],Math.floor((Date.now()-fixtureOrigin)/2000)+24,i,1)),o:'100',P:'1',q:'1000',h:'110',l:'90'})))}),1000);return socket}super(...args)}};`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,label)=>{for(let n=0;n<150;n++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label+' '+await evaluate('document.body.innerText'))};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const input=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const readLobby=()=>evaluate(`JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1'))`);
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('.account-controls')`,'authenticated app');
 await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`);await wait(`!!document.querySelector('.bc-hero')`,'competition hub');
 await click('.bc-hero .primary');await wait(`!!document.querySelector('.dev-duration')`,'configuration');await click('.dev-duration');await input('input[aria-label="Total competition participants"]','8');
 await evaluate(`[...document.querySelectorAll('.bc-options button')].find(b=>b.textContent.trim()==='$1,000').click()`);
 console.log('Browser arena configured: one minute, seven distinct bots, allocation 1000. Warming observed prices before start.');
 await sleep(24000);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Review Lobby')).click()`);await wait(`!!document.querySelector('.bc-confirm')`,'confirmation');await click('.bc-confirm .primary');await wait(`!!document.querySelector('.bc-arena-head')`,'arena start');
 const original=await readLobby();assert.equal(original.settings.duration,1);assert.equal(original.players.length,8);assert.equal(original.settings.allocation,1000);
 const financial = value => {const {balance,positions,history,activity}=JSON.parse(value);return {balance,positions,history,activity}};
 const normalBefore=financial(await evaluate(`localStorage.getItem('paperforge-v2')`));
 await input('input[aria-label="Competition margin"]','500');await evaluate(`[...document.querySelectorAll('.bc-arena-grid button')].find(b=>b.textContent.trim().startsWith('Open Long')).click()`);
 await wait(`JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1')).players.find(p=>p.isUser).positions.length===1`,'manual order');
 const opened=await readLobby();assert.equal(opened.players.find(p=>p.isUser).positions[0].margin,500);
 console.log('Manual trade opened normally; waiting for strategy decisions and checking live eligibility.');
 await sleep(14000);
 const mid=await readLobby();assert.ok(mid.players.filter(p=>!p.isUser).every(p=>p.botState?.sequence>0));assert.ok(mid.players.filter(p=>!p.isUser).some(p=>p.positions.length+p.trades.length>0));
 const names=mid.players.filter(p=>!p.isUser).map(p=>p.name);assert.equal(new Set(mid.players.filter(p=>!p.isUser).map(p=>p.strategy)).size,7);
 assert.ok(await evaluate(`document.querySelector('.bc-table').textContent.includes('Eligibility progress')`));
 await evaluate(`[...document.querySelectorAll('.bc-stand')].find(row=>row.textContent.includes('TrendFox')).click()`);await wait(`!!document.querySelector('.bc-bot-reason')`,'strategy detail');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-bots-detail-desktop.png'),Buffer.from(r.data,'base64')));await click('.bc-backdrop section > button');
 await call('Page.reload');await wait(`!!document.querySelector('.account-controls')`,'authenticated reload');await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`);await wait(`!!document.querySelector('.bc-arena-head')`,'resume after reload');await sleep(1500);
 assert.equal((await readLobby()).players.find(p=>p.isUser).positions.length,1,'reload must not duplicate manual orders');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate(`[...document.querySelectorAll('.bc-stand')].find(row=>row.textContent.includes('RiskRaven')).click()`);await wait(`!!document.querySelector('.bc-bot-reason')`,'mobile strategy detail');
 const box=await evaluate(`(()=>{const r=document.querySelector('.bc-backdrop > section').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth}})()`);assert.ok(box.left>=0&&box.right<=box.width,'mobile dialog bounds');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-bots-detail-mobile.png'),Buffer.from(r.data,'base64')));await click('.bc-backdrop section > button');
 await evaluate(`document.querySelector('.bc-position-actions button').click()`);await wait(`JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1')).players.find(p=>p.isUser).trades.length===1`,'manual close');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 let finished=false;for(let second=0;second<65;second++){const current=await readLobby();if(current?.status==='finished'){finished=true;break;}if(second===20)console.log('Arena still running: eligibility and strategy activity are updating; manual trade closed correctly.');await sleep(1000);}
 assert.ok(finished,'shortest arena must finish at its actual deadline');await wait(`!!document.querySelector('.bc-results-hero')`,'results');
 const final=await readLobby(), bots=final.players.filter(p=>!p.isUser);assert.ok(final.players.every(p=>p.positions.length===0));assert.equal(final.players.find(p=>p.isUser).trades.length,1);assert.ok(bots.some(p=>p.trades.length));
 for(const p of bots){assert.ok(p.botState.decisions.length<=24);for(const t of p.trades)assert.ok(t.opened<final.end);}
 assert.equal(final.events.filter(e=>e.text.startsWith('Timer reached zero')).length,1);
 assert.deepEqual(financial(await evaluate(`localStorage.getItem('paperforge-v2')`)),normalBefore,'normal wallet stays separate');assert.equal(aiRequests,0,'rule-based bots must not call AI');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-bots-results.png'),Buffer.from(r.data,'base64')));
 const balances=final.players.map(p=>({id:p.id,balance:p.balance,trades:p.trades.length}));await sleep(1500);assert.deepEqual((await readLobby()).players.map(p=>({id:p.id,balance:p.balance,trades:p.trades.length})),balances,'no duplicate settlement');
 assert.equal(issues.length,0,issues.join('\n'));
 console.log(JSON.stringify({browserVerified:true,durationMinutes:1,bots:names,botResults:bots.map(p=>({name:p.name,trades:p.trades.length,marginUsed:+p.trades.reduce((sum,t)=>sum+t.margin,0).toFixed(2)})),manualTradeOpenedAndClosed:true,reloadSafe:true,mobileDetails:true,normalWalletUnchanged:true,aiRequests,consoleErrors:issues.length}));
 await send('Browser.close');
}finally{ws?.close();if(browser&&browser.exitCode===null)browser.kill();if(server.exitCode===null)server.kill();}
