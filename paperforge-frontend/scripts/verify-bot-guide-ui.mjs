// Isolated browser verification with synthetic market prices. No real account or Gemini calls.
import { scenarioPrice, pairs, arena } from '../tests/bot-fixtures.mjs';
import { seededRandom } from '../src/features/competitions/bot-profiles.ts';
﻿import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.env.BOT_GUIDE_UI_TEST_PORT || '3021';
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
 const readLobby=()=>evaluate(`JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1'))`);
 const press=async(key,modifiers=0)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,modifiers,windowsVirtualKeyCode:key==='Tab'?9:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,modifiers});};
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('.account-controls')`,'authenticated app');
 await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`);await wait(`!!document.querySelector('.bc-hero .bot-guide-button')`,'hub guide action');
 await evaluate(`document.body.style.overflow='auto'`);await click('.bc-hero .bot-guide-button');await wait(`!!document.querySelector('.bot-guide-dialog[open]')`,'native modal');
 assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-table tbody tr').length`),7);assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-table thead th').length`),5);assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-presence').length`),0,'hub is not an arena');
 await click('.bc-hero .bot-guide-button');assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-dialog[open]').length`),1,'duplicate open');
 for(let i=0;i<5;i++){await press('Tab');assert.ok(await evaluate(`document.querySelector('.bot-guide-dialog').contains(document.activeElement)`),'Tab focus containment');}
 await press('Tab',8);assert.ok(await evaluate(`document.querySelector('.bot-guide-dialog').contains(document.activeElement)`),'reverse Tab containment');
 await evaluate(`document.querySelector('.bc-hero .primary').focus()`);assert.ok(await evaluate(`document.querySelector('.bot-guide-dialog').contains(document.activeElement)`),'background must be inert');
 assert.equal(await evaluate(`document.body.style.overflow`),'hidden');assert.ok(await evaluate(`document.querySelector('.bot-guide-body').scrollHeight>document.querySelector('.bot-guide-body').clientHeight`),'independent scroll');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-bot-guide-desktop.png'),Buffer.from(r.data,'base64')));
 await press('Escape');await wait(`!document.querySelector('.bot-guide-dialog')`,'Escape close');assert.ok(await evaluate(`document.activeElement===document.querySelector('.bc-hero .bot-guide-button')`),'hub focus return');assert.equal(await evaluate(`document.body.style.overflow`),'auto');
 // A real one-minute arena already forty seconds into its lifetime, using only synthetic observed history.
 const now=Date.now(), lobby=arena('Medium',1);lobby.start=now-35000;lobby.end=lobby.start+60000;lobby.settings.spots=4;lobby.players=lobby.players.slice(0,4);
 lobby.botHistory=Object.fromEntries(pairs.map((pair,marketIndex)=>[pair,Array.from({length:25},(_,i)=>{const at=now-(24-i)*2000;return {at,sourceAt:at,price:scenarioPrice(patterns[marketIndex],Math.floor((at-fixtureOrigin)/2000)+24,marketIndex,1)}})]));
 await evaluate(`localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(lobby))})`);
 await call('Page.reload');await wait(`!!document.querySelector('.account-controls')`,'reload session');await evaluate(`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`);await wait(`!!document.querySelector('.bc-arena-actions .bot-guide-button')`,'arena guide action');
 await wait(`JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1')).players.some(p=>p.botState?.sequence>0)`,'bot scheduling');
 const before=await readLobby(), arenaOverflow=await evaluate(`document.body.style.overflow`);await click('.bc-arena-actions .bot-guide-button');await wait(`!!document.querySelector('.bot-guide-dialog[open]')`,'arena guide');
 assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-present').length`),3);assert.equal(await evaluate(`document.querySelectorAll('.bot-guide-absent').length`),4);assert.ok(await evaluate(`document.querySelector('.bot-guide-count').textContent.includes('3 of 7')`));
 await sleep(3500);const after=await readLobby();assert.ok(after.players.some(p=>p.botState?.sequence>(before.players.find(b=>b.id===p.id)?.botState?.sequence||0)),'bots keep deciding');assert.ok(after.botHistory.BTCUSDT.at(-1).at>before.botHistory.BTCUSDT.at(-1).at,'price history keeps updating');assert.ok(await evaluate(`document.querySelector('.bc-timer b').textContent!=='00:25'`),'clock keeps running');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('.bot-guide-body').scrollTop=0`);
 const bounds=await evaluate(`(()=>{const d=document.querySelector('.bot-guide-dialog'),b=document.querySelector('.bot-guide-body'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:b.scrollWidth>b.clientWidth}})()`);assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height&&!bounds.overflow,'mobile fits without horizontal scrolling');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bot-guide-table tbody tr')).display`),'grid','mobile cards');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(os.tmpdir(),'paperforge-bot-guide-mobile.png'),Buffer.from(r.data,'base64')));
 await evaluate(`document.querySelector('.bot-guide-body').scrollTop=99999`);assert.ok(await evaluate(`document.querySelector('.bot-guide-close').getBoundingClientRect().top>=0`),'close stays reachable while scrolling');
 console.log('Guide checks passed for hub, table/cards, participant highlighting, focus, inert background and continuing bot/price updates. Waiting for arena expiry while open.');
 for(let i=0;i<35;i++){if((await readLobby()).status==='finished')break;await sleep(1000);}
 await wait(`!!document.querySelector('.bc-results-hero') && !!document.querySelector('.bot-guide-finished')`,'results behind open guide');assert.ok(await evaluate(`document.querySelector('.bot-guide-dialog').open`),'guide survives expiry');
 await press('Escape');await wait(`!document.querySelector('.bot-guide-dialog')`,'close after expiry');assert.ok(await evaluate(`document.activeElement.matches('main h1, main h2, main')`),'focus returns to a valid result element');assert.equal(await evaluate(`document.body.style.overflow`),arenaOverflow);
 const final=await readLobby();assert.equal(final.events.filter(e=>e.text.startsWith('Timer reached zero')).length,1);assert.ok(final.players.every(p=>p.positions.length===0));assert.equal(aiRequests,0);assert.equal(issues.length,0,issues.join('\n'));
 console.log('Bot guide browser verification passed: both entry points, seven profiles, desktop table/mobile cards, participating/absent bots, Tab/Shift+Tab, Escape, background inertness, focus return, scroll cleanup, uninterrupted scheduling and settlement through expiry; zero console errors or AI calls.');
 await send('Browser.close');
}finally{ws?.close();if(browser&&browser.exitCode===null)browser.kill();if(server.exitCode===null)server.kill();}
