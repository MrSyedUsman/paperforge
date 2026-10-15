import { arena, simulateArena } from "../tests/bot-fixtures.mjs";
﻿import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.env.BACKGROUND_UI_TEST_PORT || '3030';
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

 const directory=path.resolve('docs/backgrounds');fs.mkdirSync(directory,{recursive:true});
 let aiCalls=0;
 on('Fetch.requestPaused',m=>{void(async()=>{const {requestId,request}=m.params,url=new URL(request.url);let data={},status=200;
 if(request.method==='OPTIONS')data={};
 else if(url.pathname.includes('/auth/'))data={username:'background-fixture',displayName:'Background fixture'};
 else if(/trade-risk|trade-reviews|arena-radar|arena-debrief|generativelanguage/.test(request.url)){aiCalls++;status=503;data={message:'No AI requests are needed for background verification'};}
 else if(url.searchParams.get('resource')==='exchangeInfo')data={symbols:['BTC','ETH'].map(baseAsset=>({symbol:baseAsset+'USDT',baseAsset,quoteAsset:'USDT',status:'TRADING',contractType:'PERPETUAL',filters:[]}))};
 else if(url.searchParams.get('resource')==='klines')data=Array.from({length:96},(_,i)=>[Date.now()-(96-i)*900000,'100','101','99','100','1000']);
 else if(url.searchParams.get('resource')==='premiumIndex')data=['BTC','ETH'].map(s=>({symbol:s+'USDT',markPrice:'100'}));
 else data=['BTC','ETH'].map(s=>({symbol:s+'USDT',lastPrice:'100',openPrice:'100',priceChangePercent:'0',quoteVolume:'1000',highPrice:'101',lowPrice:'99'}));
 await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Authorization, Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
 })().catch(e=>{if(!e.message.includes('Invalid InterceptionId'))issues.push(e.message)});});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'*auth*'},{urlPattern:'*generativelanguage.googleapis.com*'}]});
 const trade={id:1,symbol:'BTC',pair:'BTCUSDT',side:'Long',margin:100,size:200,entry:100,lev:2,openFee:.1,exit:101,pnl:1.8,closed:'10/15/2026, 10:00:00 AM',opened:'10/15/2026, 9:59:00 AM',reason:'Manual close'};
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`try{if(!localStorage.getItem('background-initialized')){localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:[${JSON.stringify(trade)}]}));localStorage.setItem('background-initialized','true')}}catch{}const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){if(String(args[0]).includes('fstream.binance.com')){const socket={close(){clearInterval(socket.timer)}};setTimeout(()=>socket.onopen?.(),50);socket.timer=setInterval(()=>socket.onmessage?.({data:JSON.stringify(['BTC','ETH'].map(s=>({s:s+'USDT',c:'100',o:'100',P:'0',q:'1000',h:'101',l:'99'})))}),1000);return socket}super(...args)}};`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,label)=>{for(let n=0;n<150;n++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const navigate=async name=>{await evaluate(name==='Profile'?`document.querySelector('.avatar').click()`:`[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);await sleep(180);};
 const toggle=async enabled=>evaluate(`(()=>{document.getElementById('background-baseline')?.remove();${enabled?'':`const s=document.createElement('style');s.id='background-baseline';s.textContent='#main-content{background:none!important}';document.head.append(s);`}})()`);
 const measure=()=>evaluate(`(()=>{const props=['backgroundColor','backgroundImage','borderColor','color','fontSize','padding','position','zIndex'];return [...document.querySelectorAll('#main-content .page,#main-content .terminal,#main-content article,#main-content .advanced-chart,#main-content .top,#main-content button')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [e.className,r.x,r.y,r.width,r.height,...props.map(p=>s[p])]})})()`);
 await call('Animation.enable');
 async function audit(name){await call('Animation.setPlaybackRate',{playbackRate:0});await toggle(false);const before=await measure();await toggle(true);const after=await measure();assert.deepEqual(after,before,`${name}: existing element geometry and surface styling`);assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),`${name}: document overflow`);await call('Animation.setPlaybackRate',{playbackRate:1});}
 async function capture(name){await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);for(const enabled of [false,true]){await toggle(enabled);await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(directory,`${name}-${enabled?'after':'before'}.png`),Buffer.from(r.data,'base64')));}await toggle(true);}
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('.account-controls')`,'fixture shell');await wait(`!!document.querySelector('.sim.live')`,'synthetic live feed');
 for(const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile'],[320,844,'narrow'],[720,450,'zoom-200-equivalent']]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:label.includes('zoom')?2:1,mobile:width<500});
   for(const name of ['Home','Trade','Portfolio','Markets','Competitions','Leaderboards','Profile']){await navigate(name);await audit(`${name}/${label}`);if(name==='Home'&&['desktop','mobile'].includes(label))await capture(`home-${label}`);}
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate('Home');
 await evaluate(`window.scrollTo({top:document.body.scrollHeight,behavior:'instant'})`);await sleep(100);assert.equal(await evaluate(`Math.round(document.querySelector('.top').getBoundingClientRect().top)`),0,'sticky header');await audit('long-page bottom');
 await evaluate(`window.scrollTo({top:0,behavior:'instant'});document.querySelector('.global-search').click()`);await wait(`!!document.querySelector('.market-modal')`,'market dialog');assert.ok(await evaluate(`(()=>{const e=document.querySelector('.modal-search input'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})()`),'dialog not covered');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await wait(`!document.querySelector('.market-modal')`,'dialog keyboard close');
 await navigate('Portfolio');await click('.p3-trade-card-button');await wait(`!!document.querySelector('.trade-card-preview img')`,'share image');await sleep(200);const original=await evaluate(`document.querySelector('.trade-card-preview img').src`);await click('.trade-card-close');await toggle(false);await click('.p3-trade-card-button');await wait(`!!document.querySelector('.trade-card-preview img')`,'baseline share image');await sleep(200);assert.equal(await evaluate(`document.querySelector('.trade-card-preview img').src`),original,'exported PNG byte-for-byte unchanged');await click('.trade-card-close');await toggle(true);
 for(const state of ['active','finished']){let lobby;if(state==='active'){lobby=arena('Medium',10);lobby.start=Date.now()-10000;lobby.end=lobby.start+600000;for(const p of lobby.players)p.achieved=lobby.start;}else lobby=simulateArena();await evaluate(`localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(lobby))})`);await call('Page.reload');await wait(`!!document.querySelector('.account-controls')`,'reload arena');await navigate('Competitions');await wait(state==='active'?`!!document.querySelector('.bc-arena-head')`:`!!document.querySelector('.bc-results-hero')`,state);await audit(`competition ${state}`);await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await audit(`competition ${state} mobile`);await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});}
 await call('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});assert.equal(await evaluate(`getComputedStyle(document.querySelector('#main-content')).backgroundImage`),'none','forced-colour fallback');await call('Emulation.setEmulatedMedia',{features:[]});
 assert.equal(aiCalls,0);assert.equal(issues.length,0,issues.join('\n'));
 console.log('Background checks passed: seven pages at desktop/mobile/320px/200% zoom, active and finished arenas, exact before/after geometry and card surface styles, long scrolling, sticky header, dialog hit testing and Escape, identical share PNG, forced-colour fallback, no AI calls or console errors. Four home screenshots saved in docs/backgrounds.');
 await send('Browser.close');
}finally{ws?.close();if(browser&&browser.exitCode===null)browser.kill();if(server.exitCode===null)server.kill();}
