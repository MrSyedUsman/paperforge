import { captureAiPanel } from "./capture-ai-panel.mjs";
// Isolated browser verification with synthetic market prices. No real account or Gemini calls.
import { pairs, arena, quote } from "../tests/bot-fixtures.mjs";
import { openFor } from "../src/features/competitions/engine.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { calculateRadarFacts } from "../../paperforge-backend/dist/arena-radar/radar-facts.js";
import { validateRadarContent } from "../../paperforge-backend/dist/arena-radar/radar-output.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = process.env.ARENA_RADAR_UI_TEST_PORT || "3024";
const base = `http://localhost:${port}`,
  root = process.cwd();
const server = spawn(process.execPath, ["scripts/start-standalone.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: port, HOSTNAME: "127.0.0.1" },
  windowsHide: true,
  stdio: "ignore",
});
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), "paperforge-ai-browser-"),
);
let browser, ws;
try {
  for (let n = 0; n < 120; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await sleep(100);
  }
  browser = spawn(
    process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--in-process-gpu",
      "--disable-software-rasterizer",
      "--no-sandbox",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${temporary}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let endpoint;
  for (let n = 0; n < 100; n++) {
    try {
      endpoint = fs
        .readFileSync(path.join(temporary, "DevToolsActivePort"), "utf8")
        .trim()
        .split(/\r?\n/);
      break;
    } catch {}
    await sleep(100);
  }
  if (!endpoint) throw Error("Browser startup failed");
  ws = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map(),
    handlers = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (p) {
        if (m.error) p.reject(Error(JSON.stringify(m.error)));
        else p.resolve(m.result);
      }
    } else {
      for (const fn of handlers.get(m.method) || []) fn(m);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(
        JSON.stringify({
          id: n,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  const on = (m, f) => handlers.set(m, [...(handlers.get(m) || []), f]);
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const call = (m, p = {}) => send(m, p, sessionId);
  const issues = [];
  on("Runtime.exceptionThrown", (m) =>
    issues.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text,
    ),
  );
  on("Runtime.consoleAPICalled", (m) => {
    if (["error", "warning"].includes(m.params.type))
      issues.push(m.params.args.map((x) => x.value || x.description).join(" "));
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let calls = 0,
    factCalls = 0,
    mode = "success",
    delay = 1200;
  const lobby = arena("Medium", 10),
    origin = Date.now();
  lobby.start = origin - 20000;
  lobby.end = lobby.start + 600000;
  lobby.settings.spots = 4;
  lobby.players = lobby.players.slice(0, 4);
  for (const p of lobby.players) p.achieved = lobby.start;
  lobby.players[0] = openFor(
    lobby.players[0],
    "BTCUSDT",
    "Long",
    100,
    2,
    lobby.settings,
    { BTCUSDT: quote(100, origin - 1000) },
    { now: origin - 1000, id: 123 },
  );
  on("Fetch.requestPaused", (m) => {
    void (async () => {
      const { requestId, request } = m.params,
        url = new URL(request.url);
      let data = {},
        status = 200;
      if (request.method === "OPTIONS") data = {};
      else if (url.pathname.includes("/auth/"))
        data = { username: "fixture-user", displayName: "Radar Test" };
      else if (url.pathname.includes("/arena-radar")) {
        const input = JSON.parse(request.postData);
        const facts = calculateRadarFacts(input).facts;
        if (url.pathname.endsWith("/facts")) {
          factCalls++;
          data = facts;
        } else {
          calls++;
          const state = mode;
          if (state === "slow") await sleep(delay);
          if (state === "error") {
            status = 503;
            data = {
              message: "Synthetic provider unavailable",
              cooldownUntil: Date.now() + 300,
            };
          } else {
            const review = validateRadarContent(
              {
                headline: {
                  text: "At this snapshot, participation and equity describe different aspects of the arena.",
                  evidenceIds: facts.headline.evidenceIds,
                },
                observations: [
                  {
                    text: "Compare recorded margin participation with the selected opponent.",
                    evidenceIds: [
                      "user_margin",
                      `${facts.opponentId.replaceAll("-", "_")}_margin`,
                    ],
                  },
                ],
                question: {
                  text: "What difference do you notice between equity and free balance?",
                  evidenceIds: ["user_equity", "user_free"],
                },
              },
              facts,
            );
            data = {
              facts: state === "stale" ? { ...facts, at: facts.at - 1 } : facts,
              review,
              metadata: {
                model: "synthetic-ui-fixture",
                promptVersion: "arena-radar-v1",
                generatedAt: new Date().toISOString(),
                generationMs: 400,
                requestMs: 420,
                cached: false,
                cooldownUntil: Date.now() + 500,
              },
            };
          }
        }
      } else if (url.searchParams.get("resource") === "exchangeInfo")
        data = {
          symbols: pairs.map((pair) => ({
            symbol: pair,
            baseAsset: pair.slice(0, -4),
            quoteAsset: "USDT",
            status: "TRADING",
            contractType: "PERPETUAL",
            filters: [],
          })),
        };
      else if (url.searchParams.get("resource") === "klines")
        data = Array.from({ length: 96 }, (_, i) => [
          Date.now() - (96 - i) * 900000,
          "100",
          "101",
          "99",
          "100",
          "1000",
        ]);
      else if (url.searchParams.get("resource") === "premiumIndex")
        data = pairs.map((symbol) => ({ symbol, markPrice: "100" }));
      else
        data = pairs.map((symbol) => ({
          symbol,
          lastPrice: "100",
          openPrice: "100",
          priceChangePercent: "0",
          quoteVolume: "1000",
          highPrice: "101",
          lowPrice: "99",
        }));
      await call("Fetch.fulfillRequest", {
        requestId,
        responseCode: status,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
          {
            name: "Access-Control-Allow-Headers",
            value: "Authorization, Content-Type",
          },
          { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        ],
        body: Buffer.from(JSON.stringify(data)).toString("base64"),
      });
    })().catch((error) => {
      if (!error.message.includes("Invalid InterceptionId"))
        issues.push(error.message);
    });
  });
  await call("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/binance*" },
      { urlPattern: "*auth*" },
      { urlPattern: "*/api/arena-radar*" },
    ],
  });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{if(!localStorage.getItem('radar-initialized')){localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:[]}));localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(lobby))});localStorage.setItem('radar-initialized','true');}}catch{}const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){if(String(args[0]).includes('fstream.binance.com')){const socket={close(){clearInterval(socket.timer)}};setTimeout(()=>socket.onopen?.(),50);socket.timer=setInterval(()=>socket.onmessage?.({data:JSON.stringify(${JSON.stringify(pairs)}.map(s=>({s,c:String(window.radarFixturePrice||100),o:'100',P:'0',q:'1000',h:'101',l:'99'})))}),1000);return socket}super(...args)}};`,
  });
  const evaluate = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  };
  const wait = async (expression, label) => {
    for (let n = 0; n < 150; n++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw Error(
      "Timed out: " + label + " " + (await evaluate("document.body.innerText")),
    );
  };
  const click = (selector) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const press = async (key) => {
    await call("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      windowsVirtualKeyCode: key === "Tab" ? 9 : 27,
    });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
  };
  const enter = async () => {
    await wait(`!!document.querySelector('.account-controls')`, "auth");
    await evaluate(
      `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`,
    );
    await wait(
      `!!document.querySelector('.arena-radar-trigger')`,
      "active arena",
    );
  };
  const finances = () =>
    evaluate(
      `JSON.stringify([JSON.parse(localStorage.getItem('paperforge-bot-lobby-v1')).players.map(p=>({id:p.id,balance:p.balance,realized:p.realized,fees:p.fees,positions:p.positions,trades:p.trades})).sort((a,b)=>a.id.localeCompare(b.id)),localStorage.getItem('paperforge-v2')])`,
    );
  await call("Page.navigate", { url: base });
  await enter();
  const before = await finances();
  await wait(`!!document.querySelector(".sim.live")`, "fresh synthetic market feed");
  await click(".arena-radar-trigger");
  await wait(`!!document.querySelector('.arena-radar-panel')`, "open");
  assert.equal(calls, 0);
  assert.equal(factCalls, 0, "opening never generates");
  mode = "slow";
  await click(".radar-controls button");
  await wait(`!!document.querySelector('.radar-metrics')`, "facts while slow");
  assert.ok(await evaluate(`!!document.querySelector('.ai-review-loading')`));
  await click(".radar-controls button");
  assert.equal(calls, 1);
  await wait(
    `!!document.querySelector('.radar-question')`,
    "generated commentary",
  );
  assert.ok(
    await evaluate(`document.querySelector('.radar-controls button').disabled`),
    "cooldown visible",
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('.radar-metrics>div').length`),
    6,
  );
  assert.ok(
    await evaluate(
      `document.querySelector('.radar-snapshot').textContent.includes('Live standings may have changed')`,
    ),
  );
  await press("Tab");
  assert.ok(await evaluate(`document.activeElement.matches('button')`));
  await evaluate(`document.querySelector('.bc-quit').focus()`);
  assert.ok(
    await evaluate(`document.activeElement.matches('.bc-quit')`),
    "background usable",
  );
  await captureAiPanel(call, ".arena-radar-body", "radar-desktop");
  await call("Page.captureScreenshot", { format: "png" }).then((r) =>
    fs.writeFileSync(
      path.join(os.tmpdir(), "paperforge-arena-radar-desktop.png"),
      Buffer.from(r.data, "base64"),
    ),
  );
  await press("Escape");
  await wait(`!document.querySelector('.arena-radar-panel')`, "Escape close");
  assert.ok(
    await evaluate(
      `document.activeElement===document.querySelector('.arena-radar-trigger')`,
    ),
  );
  const count = calls;
  await click(".arena-radar-trigger");
  assert.equal(calls, count, "reopen preserves update without generating");
  assert.ok(await evaluate(`!!document.querySelector('.radar-question')`));
  for (const width of [390, 320]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const b = await evaluate(
      `(()=>{const p=document.querySelector('.arena-radar-panel'),body=document.querySelector('.arena-radar-body'),r=p.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight,overflow:body.scrollWidth>body.clientWidth}})()`,
    );
    assert.ok(
      b.l >= 0 && b.r <= b.w && b.t >= 0 && b.b <= b.h && !b.overflow,
      JSON.stringify(b),
    );
    await evaluate(
      `document.querySelector('.arena-radar-body').scrollTop=99999`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('.ai-review-close').getBoundingClientRect().top>=0`,
      ),
    );
  }
  await call("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await captureAiPanel(call, ".arena-radar-body", "radar-mobile");
  await call("Page.captureScreenshot", { format: "png" }).then((r) =>
    fs.writeFileSync(
      path.join(os.tmpdir(), "paperforge-arena-radar-mobile.png"),
      Buffer.from(r.data, "base64"),
    ),
  );
  await wait(
    `!document.querySelector('.radar-controls button').disabled`,
    "cooldown expires",
  );
  mode = "error";
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.ai-review-error')`,
    "provider unavailable",
  );
  assert.ok(await evaluate(`!!document.querySelector('.radar-metrics')`));
  assert.ok(!(await evaluate(`!!document.querySelector('.radar-question')`)));
  await wait(
    `!document.querySelector('.radar-controls button').disabled`,
    "error cooldown",
  );
  mode = "success";
  await click(".radar-controls button");
  await wait(`!!document.querySelector('.radar-question')`, "retry");
  assert.ok(
    await evaluate(
      `document.querySelector('.radar-snapshot').textContent.includes('Compared with an earlier snapshot')`,
    ),
    "compares last successful snapshot",
  );
  await wait(
    `!document.querySelector('.radar-controls button').disabled`,
    "ready again",
  );
  mode = "slow";
  await click(".radar-controls button");
  await wait(`!!document.querySelector('.ai-review-loading')`, "pending");
  await click(".ai-review-close");
  await sleep(delay + 200);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-radar-panel')`)),
    "late result cannot reopen",
  );
  assert.equal(
    await finances(),
    before,
    "radar leaves financial records unchanged",
  );
  await click(".arena-radar-trigger");
  mode = "success";
  await call("Page.reload");
  await enter();
  await click(".arena-radar-trigger");
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.radar-question')`,
    "snapshot before new activity",
  );
  const activityCalls = calls;
  await evaluate(`window.radarFixturePrice=109`);
  await wait(
    `document.querySelector('.radar-snapshot').textContent.includes('New activity since this update')`,
    "local meaningful activity indicator",
  );
  assert.equal(
    calls,
    activityCalls,
    "activity does not generate automatically",
  );
  await evaluate(`window.radarFixturePrice=100`);
  await click(".ai-review-close");
  // Reload the same active arena resets the synthetic UI session without touching financial records.
  await call("Page.reload");
  await enter();
  await click(".arena-radar-trigger");
  mode = "stale";
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.ai-review-error')`,
    "obsolete response rejected",
  );
  await click(".ai-review-close");
  await call("Page.reload");
  await enter();
  await click(".arena-radar-trigger");
  mode = "slow";
  delay = 2000;
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.radar-metrics')`,
    "pending before navigation",
  );
  await evaluate(
    `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent==='Home').click()`,
  );
  await sleep(delay + 200);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-radar-panel')`)),
    "navigation cancels",
  );
  await enter();
  await click(".arena-radar-trigger");
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.radar-metrics')`,
    "pending before abandonment",
  );
  await click(".bc-quit");
  await click(".bc-quit-dialog .bc-danger");
  await wait(
    `!!document.querySelector('.radar-complete')`,
    "abandonment completion state",
  );
  await sleep(delay + 200);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.radar-question')`)),
    "abandoned arena ignores pending commentary",
  );
  await click(".radar-complete button");
  assert.ok(
    await evaluate(`document.activeElement.matches('main h1,main h2,main')`),
    "focus returns to results when trigger disappears",
  );
  // Actual timed settlement while generation is pending.
  const expiring = structuredClone(lobby),
    at = Date.now();
  expiring.start = at - 55000;
  expiring.end = expiring.start + 60000;
  expiring.settings.duration = 1;
  expiring.players.forEach((p) => {
    p.achieved = expiring.start;
    p.positions.forEach((pos) => (pos.opened = expiring.start + 1000));
  });
  await evaluate(
    `localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(expiring))})`,
  );
  await call("Page.reload");
  await enter();
  await evaluate(`document.querySelector('.bc-final-toast button')?.click()`);
  await click(".arena-radar-trigger");
  delay = 7000;
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.radar-metrics')`,
    "pending before expiry",
  );
  await wait(
    `!!document.querySelector('.radar-complete')`,
    "timed expiry completion",
  );
  await sleep(1500);
  assert.ok(!(await evaluate(`!!document.querySelector('.radar-question')`)));
  await click(".radar-complete button");
  const fresh = structuredClone(lobby),
    shift = Date.now() - origin;
  fresh.start += shift;
  fresh.end += shift;
  fresh.players.forEach((p) => {
    p.achieved += shift;
    p.positions.forEach((pos) => (pos.opened += shift));
  });
  await evaluate(
    `localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(fresh))})`,
  );
  await call("Page.reload");
  await enter();
  await click(".arena-radar-trigger");
  delay = 1500;
  await click(".radar-controls button");
  await wait(
    `!!document.querySelector('.radar-metrics')`,
    "pending before signout",
  );
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign out').click()`,
  );
  await sleep(delay + 200);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-radar-panel')`)),
    "signout cancels",
  );
  assert.equal(issues.length, 0, issues.join("\n"));
  console.log(
    "Arena Radar browser checks passed: explicit-only generation, facts during slow requests, cooldown, retry, last-successful comparison, desktop/mobile 390/320, keyboard/focus, nonmodal controls, reopen without requests, unchanged financial storage, stale response rejection, close/navigation/signout cancellation, abandonment and timed settlement.",
  );
  await send("Browser.close");
} finally {
  ws?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
}
