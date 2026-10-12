import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { standaloneDirectory } from "../scripts/standalone-path.mjs";

let child, baseUrl;
let output = "";
const root = fileURLToPath(new URL("../", import.meta.url));

before(async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(standaloneDirectory, "server.js")], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before startup: ${output}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Next.js startup timed out: ${output}`);
});

after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  await exited;
});

test("renders the authenticated application shell, metadata and styles through the production server", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>PaperForge Futures<\/title>/);
  assert.match(html, /<meta[^>]*name="description"[^>]*content="Practise crypto futures trading with virtual funds, live market data, and bot competitions\."/);
  assert.match(html, /PaperForge/);
  assert.match(html, /Loading|Sign in/);
  assert.doesNotMatch(html, /Portfolio overview/);
  assert.match(html, /rel="icon"[^>]*href="\/icon\.svg/);
  const cssUrls = [...html.matchAll(/href="([^"\s]+\.css(?:\?[^"\s]*)?)"/g)].map(match => match[1]);
  assert.ok(cssUrls.length, "Application styles are bundled");
  for (const url of cssUrls) {
    const asset = await fetch(new URL(url.replaceAll("&amp;", "&"), baseUrl));
    assert.equal(asset.status, 200);
  }
});

test("standalone server serves application icons, coin assets and the 404 screen", async () => {
  const icon = await fetch(`${baseUrl}/icon.svg`);
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const coin = await fetch(`${baseUrl}/coin-icons/btc.svg`);
  assert.equal(coin.status, 200);
  assert.match(await coin.text(), /<svg/);
  const missing = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /This PaperForge screen does not exist/);
});

test("Binance route validates requests before calling the provider", async () => {
  for (const query of ["resource=unsupported", "resource=klines&symbol=BAD&interval=1h", "resource=klines&symbol=BTCUSDT&interval=invalid"]) {
    const response = await fetch(`${baseUrl}/api/binance?${query}`);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});
