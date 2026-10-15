// Isolated browser verification with synthetic market prices. No real account or Gemini calls.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = process.env.AI_READABILITY_TEST_PORT || "3026";
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

  // Style fixtures intentionally include all states and extreme values, without any provider requests.
  await call("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/*" },
      { urlPattern: "*generativelanguage.googleapis.com*" },
      { urlPattern: "*binance.com*" },
    ],
  });
  on("Fetch.requestPaused", (m) => {
    void call("Fetch.fulfillRequest", {
      requestId: m.params.requestId,
      responseCode: 503,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from('{"message":"Offline style fixture"}').toString(
        "base64",
      ),
    });
  });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.WebSocket=class{close(){}};`,
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
  await call("Page.navigate", { url: base });
  for (let n = 0; n < 100; n++) {
    if (await evaluate(`!!document.querySelector('h1')`)) break;
    await sleep(100);
  }
  await evaluate(
    `document.getElementById('__next')?.remove();document.body.innerHTML='<div id="fixture-root"></div>'`,
  );
  const paragraph =
    "Both opening and closing fees reduce the result. Compare the recorded net result with your isolated margin before interpreting the outcome.";
  const evidence =
    '<div class="ai-evidence arena-debrief-evidence radar-evidence"><span>Selected user trade: Opening and closing fees for VERYLONGPERPETUALUSDT <b>-$9,999,999.99</b><small>Calculated from recorded simulation evidence</small></span></div>';
  const metrics = (cls) =>
    `<div class="${cls}">${["Gross result before both recorded fees", "Total opening and closing fees", "Net trading result", "Current equity placement"].map((label, i) => `<div><span><small>${label}</small></span><b>${i === 3 ? "Unavailable" : "-$9,999,999.99"}</b></div>`).join("")}</div>`;
  const common = `<section class="ai-review-content"><h3>What the evidence tells you</h3><p>${paragraph}</p>${evidence}<section class="ai-lesson"><h3>One practical lesson</h3><p>${paragraph}</p></section><p class="ai-review-timing">Saved explanation - generated in one second</p></section><div class="ai-review-loading" role="status"><b>Checking your snapshot</b><p>Keep exploring while the request finishes.</p></div><div class="ai-review-error" role="alert"><b>AI explanation unavailable</b><p>The provider is unavailable. Your calculated facts remain visible.</p><small>No AI narrative was generated.</small><button class="primary" disabled>Refresh after cooldown</button><button class="secondary">Try again</button></div><details open class="ai-data-details arena-debrief-limitations"><summary>Evidence and limitations</summary><p>Browser-submitted simulation data is unverified.</p><dl><div><dt>Long recorded evidence label for the liquidation settlement result</dt><dd>-$9,999,999.99</dd></div></dl></details>`;
  let fixtures = {
    review: `<aside class="ai-review-panel"><header class="ai-review-heading"><div><span class="ai-eyebrow">PAPERFORGE COACH</span><h2>Your trade, explained</h2></div><button class="ai-review-close" aria-label="Close review">&times;</button></header><div class="ai-review-body"><div class="ai-trade-context"><b>VERYLONGPERPETUALUSDT</b><span>Long - Completed paper trade</span></div><label class="ai-trade-switch">Review another trade<select><option>VERYLONGPERPETUALUSDT - completed trade</option></select></label>${metrics("ai-facts-grid")}${common}</div><footer class="ai-review-footer">Gemini explains this unverified simulation snapshot. It does not place orders or predict returns.</footer></aside>`,
    risk: `<aside class="ai-review-panel trade-risk-panel"><header class="ai-review-heading"><div><span class="ai-eyebrow">BEFORE YOUR PAPER TRADE</span><h2>Understand the risk</h2></div><button class="ai-review-close" aria-label="Close risk">&times;</button></header><div class="ai-review-body"><div class="trade-risk-outdated"><b>This snapshot is outdated</b><p>The order inputs changed.</p><button>Check updated inputs</button></div>${metrics("ai-facts-grid")}<section class="trade-risk-scenarios"><h3>Hypothetical adverse scenario</h3><article class="adverse"><h4>Adverse price move</h4><p>${paragraph}</p><small>Hypothetical example, not a price prediction.</small><dl>${["Gross PnL before fees", "Opening and estimated closing fees", "Net PnL"].map((label) => `<div><dt>${label}</dt><dd>-$9,999,999.99</dd></div>`).join("")}</dl></article></section>${common}</div><footer class="ai-review-footer">Unverified paper-trading snapshot. This check does not approve, place or change an order.</footer></aside>`,
    debrief: `<aside class="arena-debrief-panel"><header class="arena-debrief-heading"><div><span class="ai-eyebrow">AFTER THE ARENA</span><h2>Your arena, understood</h2><p>Evidence and your next practice goal.</p></div><button class="ai-review-close" aria-label="Close debrief">&times;</button></header><div class="arena-debrief-body">${metrics("arena-debrief-kpis")}<section><span class="arena-debrief-step">YOUR ARENA STORY</span><p>${paragraph}</p>${evidence}</section><section class="arena-debrief-mission"><h3>Your next practice goal</h3><p>${paragraph}</p><div><b>Before the next arena, ask yourself</b><p>How do fees change the interpretation of a profitable price move?</p></div></section>${common}</div><footer class="arena-debrief-footer">Unverified paper-trading competition. This report does not predict future results or change your records.</footer></aside>`,
    radar: `<aside class="arena-radar-panel"><header><div><span class="ai-eyebrow">READ THE ARENA</span><h2>Arena Radar</h2><p>Observe the competition and understand the differences.</p></div><button class="ai-review-close" aria-label="Close Radar">&times;</button></header><div class="arena-radar-body"><div class="radar-controls"><button class="primary" disabled>Refresh in thirty seconds</button><small>Refresh only when you choose.</small></div><div class="radar-snapshot"><b>At this snapshot - 11:59:59 PM</b><span>Five minutes remained</span><p>Live standings may have changed.</p></div>${metrics("radar-metrics")}<section><h3>The arena headline</h3><p>${paragraph}</p>${evidence}</section><section class="radar-question"><h3>Your observation challenge</h3><p>What difference do you notice between participation and current equity?</p></section>${common}</div><footer>Unverified paper-trading snapshots. Educational commentary, not a trading instruction or final result.</footer></aside>`,
  };
  if (process.argv.includes("--captured")) fixtures = Object.fromEntries(
    ["review", "risk", "debrief", "radar"].map(name => [name, fs.readFileSync(path.join(os.tmpdir(), `paperforge-visual-${name}-desktop.html`), "utf8")]),
  );
  const audit = () => {
    const panel = document.querySelector("aside"),
      body = panel.querySelector(
        ".ai-review-body,.arena-debrief-body,.arena-radar-body",
      ),
      close = panel.querySelector(".ai-review-close"),
      r = panel.getBoundingClientRect(),
      c = close.getBoundingClientRect(),
      br = body.getBoundingClientRect();
    const parse = (s) => {
      const n = s.match(/[\d.]+/g)?.map(Number);
      return n && n.length >= 3 ? [n[0], n[1], n[2], n[3] ?? 1] : [0, 0, 0, 0];
    };
    const over = (top, bottom) => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      return [0, 1, 2]
        .map(
          (i) =>
            (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / (a || 1),
        )
        .concat(a);
    };
    const lum = (color) =>
      color
        .slice(0, 3)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const x = lum(a),
        y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const contrast = [];
    let minimum = 99;
    for (const el of panel.querySelectorAll("*")) {
      if (
        ![...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
        ) ||
        el.tagName === "OPTION"
      )
        continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      let layers = [[255, 255, 255, 1]];
      const chain = [];
      for (let node = el; node; node = node.parentElement) chain.unshift(node);
      for (const node of chain) {
        const s = getComputedStyle(node),
          bg = parse(s.backgroundColor),
          stops = s.backgroundImage.match(/rgba?\([^)]+\)/g);
        layers = layers.map((c) => over(bg, c));
        if (stops)
          layers = layers.flatMap((c) =>
            stops.map((stop) => over(parse(stop), c)),
          );
      }
      const color = parse(style.color),
        value = Math.min(...layers.map((bg) => ratio(over(color, bg), bg))),
        size = parseFloat(style.fontSize),
        large =
          size >= 24 || (size >= 18.66 && parseInt(style.fontWeight) >= 700),
        required = large ? 3 : 4.5;
      minimum = Math.min(minimum, value);
      if (value < required - 0.01)
        contrast.push({
          text: el.textContent.slice(0, 65),
          color: style.color,
          ratio: +value.toFixed(2),
          required,
        });
    }
    const tiny = [...panel.querySelectorAll("*")]
      .filter(
        (el) =>
          [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ) && parseFloat(getComputedStyle(el).fontSize) < 12,
      )
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.slice(0, 50),
        size: getComputedStyle(el).fontSize,
      }));
    return {
      bounds: {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: innerWidth,
        height: innerHeight,
      },
      overflow: body.scrollWidth > body.clientWidth + 1,
      overflowElements: [...body.querySelectorAll('*')].filter(el=>el.getClientRects().length && el.getBoundingClientRect().right>br.right+1).slice(0,12).map(el=>({tag:el.tagName,className:el.className,text:el.textContent.slice(0,70),width:el.getBoundingClientRect().width})),
      bodyHeight: br.height,
      close: { width: c.width, height: c.height, bottom: c.bottom },
      tiny,
      contrast,
      minContrast: +minimum.toFixed(2),
      paragraphSize: getComputedStyle(body.querySelector("section>p")).fontSize,
    };
  };
  let checks = 0,
    minContrast = 99;
  for (const [name, html] of Object.entries(fixtures)) {
    for (const [width, height, scale, label] of [
      [320, 844, 1, "mobile-320"],
      [390, 844, 1, "mobile"],
      [768, 1024, 1, "tablet"],
      [1024, 768, 1, "laptop"],
      [1440, 1000, 1, "desktop"],
      [844, 390, 1, "landscape"],
      [720, 450, 2, "zoom-200-equivalent"],
    ]) {
      await call("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: false,
      });
      await evaluate(
        `document.documentElement.style.fontSize='100%';document.getElementById('fixture-root').innerHTML=${JSON.stringify(html)}`,
      );
      await sleep(50);
      const result = await evaluate(`(${audit.toString()})()`);
      const b = result.bounds;
      assert.ok(
        b.left >= -1 &&
          b.right <= b.width + 1 &&
          b.top >= -1 &&
          b.bottom <= b.height + 1,
        `${name}/${label} panel bounds ${JSON.stringify(b)}`,
      );
      assert.ok(!result.overflow, `${name}/${label}: horizontal overflow`);
      assert.ok(
        result.bodyHeight > 45,
        `${name}/${label}: no usable scroll body ${result.bodyHeight}`,
      );
      assert.ok(
        result.close.width >= 44 &&
          result.close.height >= 44 &&
          result.close.bottom <= b.height,
        `${name}/${label}: close target`,
      );
      assert.deepEqual(result.tiny, [], `${name}/${label}: tiny text`);
      assert.deepEqual(result.contrast, [], `${name}/${label}: text contrast`);
      minContrast = Math.min(minContrast, result.minContrast);
      checks++;
      await evaluate(
        `document.querySelector('.ai-review-body,.arena-debrief-body,.arena-radar-body').scrollTop=99999`,
      );
      assert.ok(
        await evaluate(
          `document.querySelector('.ai-review-close').getBoundingClientRect().top>=0`,
        ),
      );
      if (label === "desktop" || label === "mobile") {
        await evaluate(
          `document.querySelector('.ai-review-body,.arena-debrief-body,.arena-radar-body').scrollTop=0`,
        );
        await call("Page.captureScreenshot", { format: "png" }).then((r) =>
          fs.writeFileSync(
            path.join(os.tmpdir(), `paperforge-readable-${name}-${label}.png`),
            Buffer.from(r.data, "base64"),
          ),
        );
      }
    }
    await call("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(
      `document.documentElement.style.fontSize='200%';document.getElementById('fixture-root').innerHTML=${JSON.stringify(html)}`,
    );
    const enlarged = await evaluate(`(${audit.toString()})()`);
    assert.ok(!enlarged.overflow, `${name}: enlarged text overflow ${JSON.stringify(enlarged.overflowElements)}`);
    assert.ok(
      enlarged.bodyHeight > 25,
      `${name}: enlarged text body collapsed`,
    );
    checks++;
  }
  console.log(
    `AI readability checks passed: ${checks} panel/layout combinations; 320/390/768/1024/1440, landscape, 200% equivalent zoom reflow and doubled root text. Minimum measured contrast ${minContrast}:1. No tiny text, clipped panels or horizontal overflow. Eight screenshots saved to the temp directory.`,
  );
  await send("Browser.close");
} finally {
  ws?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
}
