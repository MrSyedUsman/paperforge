// Isolated browser verification with synthetic market prices. No real account or Gemini calls.
import { pairs, simulateArena, quote } from "../tests/bot-fixtures.mjs";
import {
  openFor,
  closePosition,
  rankFinalPlayers,
} from "../src/features/competitions/engine.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { arenaDebriefSnapshot } from "../src/features/competitions/arena-debrief-contract.ts";
import { calculateArenaFacts } from "../../paperforge-backend/dist/arena-debriefs/arena-facts.js";
import { validateDebrief } from "../../paperforge-backend/dist/arena-debriefs/debrief-output.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = process.env.ARENA_DEBRIEF_UI_TEST_PORT || "3023";
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
  let generationCalls = 0,
    factCalls = 0,
    mode = "slow",
    delay = 600;
  const lobby = simulateArena({ difficulty: "Medium", scenario: "trend" });
  for (const p of lobby.players)
    if (p.achieved < lobby.start) p.achieved = lobby.start;
  // Add a manual trade through the real engine; the earlier harness run also verified inactivity.
  lobby.players = lobby.players.map((p) => {
    if (!p.isUser) return p;
    const opened = openFor(
      { ...p, status: "active" },
      "BTCUSDT",
      "Long",
      500,
      2,
      lobby.settings,
      { BTCUSDT: quote(100, lobby.start + 1000) },
      { now: lobby.start + 1000, id: 123 },
    );
    return {
      ...closePosition(opened, opened.positions[0], "Closed", 101, lobby.end),
      status: "finished",
    };
  });
  lobby.players = rankFinalPlayers(
    lobby.players,
    {},
    lobby.settings.allocation,
  );

  const facts = calculateArenaFacts(arenaDebriefSnapshot(lobby)).facts;
  const botPrefix = facts.mirror.participantId.replaceAll("-", "_");
  const review = validateDebrief(
    {
      story: {
        text: "Your recorded participation and equity placement tell different parts of the arena story.",
        evidenceIds: ["arena_outcome", "user_eligibility"],
      },
      observations: [
        {
          text: "Compare cumulative margin before interpreting the awarded placement.",
          evidenceIds: ["user_margin", `${botPrefix}_margin`],
        },
        {
          text: "Recorded fees provide a useful contrast even when you did not open a position.",
          evidenceIds: ["user_fees", `${botPrefix}_fees`],
        },
      ],
      mirror: {
        text: "The configured strategy describes what this opponent seeks. Retained entry reasons do not establish why the result occurred.",
        evidenceIds: ["mirror_style", `${botPrefix}_net`],
        participantId: facts.mirror.participantId,
      },
      highlight: {
        text: "Both entry and closing fees reduce the gross trade result.",
        evidenceIds: ["highlight_gross", "highlight_fees", "highlight_net"],
        tradeId: facts.highlight.trade.id,
      },
      mission: {
        text: "Write down the participation requirement and a risk limit before your next arena.",
        evidenceIds: ["user_margin"],
        question:
          "How will you decide whether a valid opportunity fits your risk limit?",
      },
    },
    facts,
  );
  const response = {
    facts,
    review,
    metadata: {
      model: "synthetic-browser-fixture",
      promptVersion: "arena-debrief-v1",
      generatedAt: new Date().toISOString(),
      generationMs: 300,
      requestMs: 300,
      cached: false,
    },
  };
  on("Fetch.requestPaused", (m) => {
    void (async () => {
      const { requestId, request } = m.params,
        url = new URL(request.url);
      let data = {},
        status = 200;
      if (request.method === "OPTIONS") data = {};
      else if (url.pathname.includes("/auth/"))
        data = { username: "fixture-user", displayName: "Debrief Test" };
      else if (url.pathname.includes("/arena-debriefs/facts")) {
        factCalls++;
        data = facts;
      } else if (url.pathname.includes("/arena-debriefs")) {
        generationCalls++;
        const requestMode = mode;
        await sleep(requestMode === "slow" ? delay : 50);
        if (requestMode === "error") {
          status = 503;
          data = {
            message:
              "The AI quota is currently exhausted. Please try again later.",
          };
        } else if (requestMode === "stale") {
          data = { ...response, facts: { ...facts, arenaKey: "other-arena" } };
        } else
          data = {
            ...response,
            metadata: { ...response.metadata, cached: generationCalls > 1 },
          };
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
          highPrice: "110",
          lowPrice: "90",
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
      if (
        !error.message.includes("Invalid InterceptionId") &&
        !error.message.includes("Invalid InterceptionId.")
      )
        issues.push(error.message);
    });
  });
  await call("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/binance*" },
      { urlPattern: "*auth*" },
      { urlPattern: "*/api/arena-debriefs*" },
    ],
  });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{if(!localStorage.getItem('debrief-initialized')){localStorage.setItem('paperforge-auth-token','layout-fixture');localStorage.setItem('paperforge-v2',JSON.stringify({version:5,balance:1000,positions:[],history:[]}));localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(lobby))});localStorage.setItem('debrief-initialized','true');}}catch{}const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){if(String(args[0]).includes('fstream.binance.com')){const socket={close(){clearInterval(socket.timer)}};setTimeout(()=>socket.onopen?.(),50);socket.timer=setInterval(()=>socket.onmessage?.({data:JSON.stringify(${JSON.stringify(pairs)}.map(s=>({s,c:'100',o:'100',P:'0',q:'1000',h:'110',l:'90'})))}),1000);return socket}super(...args)}};`,
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
  await call("Page.navigate", { url: base });
  await wait(`!!document.querySelector('.account-controls')`, "signed-in app");
  await evaluate(
    `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`,
  );
  await wait(
    `!!document.querySelector('.arena-debrief-button')`,
    "completed arena action",
  );
  const stored = await evaluate(
    `JSON.stringify([localStorage.getItem('paperforge-bot-lobby-v1'),localStorage.getItem('paperforge-v2')])`,
  );
  assert.equal(generationCalls, 0, "no automatic AI requests");
  assert.equal(factCalls, 0);
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.arena-debrief-kpis')`,
    "facts during generation",
  );
  assert.ok(await evaluate(`!!document.querySelector('.ai-review-loading')`));
  await click(".arena-debrief-button");
  assert.equal(generationCalls, 1, "duplicate clicks coalesce");
  await wait(
    `!!document.querySelector('.arena-debrief-mission')`,
    "grounded generated report",
  );
  assert.ok(
    await evaluate(
      `document.querySelector('.arena-debrief-trade').textContent.includes('BTCUSDT')`,
    ),
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.arena-debrief-evidence').length`,
    ),
    6,
  );
  await press("Tab");
  assert.ok(
    await evaluate(`document.activeElement.matches('button')`),
    "keyboard can reach controls",
  );
  await call("Page.captureScreenshot", { format: "png" }).then((r) =>
    fs.writeFileSync(
      path.join(os.tmpdir(), "paperforge-arena-debrief-desktop.png"),
      Buffer.from(r.data, "base64"),
    ),
  );
  await press("Escape");
  await wait(
    `!document.querySelector('.arena-debrief-panel')`,
    "Escape closes",
  );
  assert.ok(
    await evaluate(
      `document.activeElement===document.querySelector('.arena-debrief-button')`,
    ),
    "focus returns",
  );
  mode = "error";
  await click(".arena-debrief-button");
  await wait(`!!document.querySelector('.ai-review-error')`, "provider error");
  assert.ok(
    await evaluate(`!!document.querySelector('.arena-debrief-kpis')`),
    "facts survive",
  );
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-story')`)),
    "no fabricated fallback",
  );
  mode = "success";
  await click(".ai-review-error button");
  await wait(
    `!!document.querySelector('.arena-debrief-mission')`,
    "explicit retry",
  );
  assert.ok(
    await evaluate(
      `document.querySelector('.arena-debrief-timing').textContent.includes('Saved')`,
    ),
  );
  for (const width of [390, 320]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const b = await evaluate(
      `(()=>{const p=document.querySelector('.arena-debrief-panel'),body=document.querySelector('.arena-debrief-body'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:body.scrollWidth>body.clientWidth}})()`,
    );
    assert.ok(
      b.left >= 0 &&
        b.right <= b.width &&
        b.top >= 0 &&
        b.bottom <= b.height &&
        !b.overflow,
      JSON.stringify(b),
    );
    await evaluate(
      `document.querySelector('.arena-debrief-body').scrollTop=99999`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('.ai-review-close').getBoundingClientRect().top>=0`,
      ),
    );
  }
  await call("Page.captureScreenshot", { format: "png" }).then((r) =>
    fs.writeFileSync(
      path.join(os.tmpdir(), "paperforge-arena-debrief-mobile.png"),
      Buffer.from(r.data, "base64"),
    ),
  );
  await click(".ai-review-close");
  mode = "slow";
  delay = 1500;
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.arena-debrief-kpis')`,
    "pending facts",
  );
  await click(".ai-review-close");
  await sleep(1700);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-panel')`)),
    "late response never reopens",
  );
  mode = "stale";
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.ai-review-error')`,
    "foreign arena response rejected",
  );
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-story')`)),
  );
  await click(".ai-review-close");
  mode = "slow";
  delay = 1500;
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.arena-debrief-kpis')`,
    "pending before navigation",
  );
  await evaluate(
    `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent==='Home').click()`,
  );
  await sleep(1700);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-panel')`)),
    "navigation cancels report",
  );
  assert.equal(
    await evaluate(
      `JSON.stringify([localStorage.getItem('paperforge-bot-lobby-v1'),localStorage.getItem('paperforge-v2')])`,
    ),
    stored,
    "debrief leaves results and normal wallet unchanged",
  );
  await evaluate(
    `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`,
  );
  await wait(
    `!!document.querySelector('.arena-debrief-button')`,
    "return to results",
  );
  await evaluate(
    `window.debriefNativeTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.debriefNativeTimeout(fn,ms===30000?200:ms,...args)`,
  );
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.ai-review-error')`,
    "overall request deadline",
  );
  assert.ok(
    await evaluate(
      `document.querySelector('.ai-review-error').textContent.includes('too long')`,
    ),
  );
  await click(".ai-review-close");
  await evaluate(`window.setTimeout=window.debriefNativeTimeout`);
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.arena-debrief-kpis')`,
    "pending before rematch",
  );
  await evaluate(
    `[...document.querySelectorAll('.bc-results-actions button')].find(b=>b.textContent.includes('Rematch')).click()`,
  );
  await wait(`!!document.querySelector('.bc-confirm')`, "rematch ready check");
  await click(".bc-confirm .primary");
  await wait(`!!document.querySelector('.bc-timer')`, "new arena");
  await sleep(1700);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-panel')`)),
    "new competition never receives old review",
  );
  await evaluate(
    `localStorage.setItem('paperforge-bot-lobby-v1',${JSON.stringify(JSON.stringify(lobby))})`,
  );
  await call("Page.reload");
  await wait(
    `!!document.querySelector('.account-controls')`,
    "reload completed fixture",
  );
  await evaluate(
    `[...document.querySelectorAll('nav[aria-label="Primary navigation"] button')].find(b=>b.textContent.includes('Competitions')).click()`,
  );
  await wait(
    `!!document.querySelector('.arena-debrief-button')`,
    "completed fixture",
  );
  await click(".arena-debrief-button");
  await wait(
    `!!document.querySelector('.arena-debrief-kpis')`,
    "pending before signout",
  );
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign out').click()`,
  );
  await sleep(1700);
  assert.ok(
    !(await evaluate(`!!document.querySelector('.arena-debrief-panel')`)),
    "signout cancels review",
  );
  assert.equal(issues.length, 0, issues.join("\n"));
  console.log(
    "Arena Debrief browser checks passed: desktop, mobile 390/320, keyboard/Escape/focus, explicit requests, slow loading, dedup, retry/cache, provider failure with facts, foreign response rejection, close/navigation/switching/signout cancellation, request deadlines and unchanged competition/wallet data.",
  );
  await send("Browser.close");
} finally {
  ws?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
}
