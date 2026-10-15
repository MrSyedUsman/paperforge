# Pre-trade risk checks

The normal-trading order form offers an optional **Check trade risk** action.
It never approves, places, closes or changes orders. Order confirmation and all
existing simulation behaviour remain unchanged.

## Flow and accounting

An explicit click captures market, direction, rounded margin, leverage, price
and price timestamp. Authenticated `POST /api/trade-risk/facts` validates the
snapshot and returns calculated facts without an AI request. The panel then
calls authenticated `POST /api/trade-risk` for a concise Gemini explanation.
Both endpoints reject unexpected fields and stale prices. The shared live-price
freshness threshold is 45 seconds, matching the existing market feed. Client
order validation also checks market availability, balance and exchange quantity
constraints before enabling the action; these browser checks do not establish
server-verified balances or quotes.

The backend uses the same shared position-size, fee, PnL and isolated-liquidation
formulas as position creation and settlement. Margin is rounded as for actual
position creation. Examples use favourable and adverse moves of 0.5%, 1% and 2%.
Normal closes subtract entry and closing fees. A scenario crossing liquidation
executes at the threshold and uses isolated settlement: the closing liquidation
fee is already within the exhausted margin. Gross settlement then differs from
price-move PnL. Funding, slippage and the intervening price path are not simulated.

All records, prices and timestamps remain unverified browser-submitted data.
Scenarios are hypothetical examples, not forecasts. The price timestamp, inputs
and assumptions remain visible. Missing required values are rejected.

## AI and reliability

The existing backend GEMINI_API_KEY and GEMINI_MODEL are reused. This feature
makes one structured-output generateContent request to the configured model,
with a 20-second provider deadline and 2,048-token output cap. It never retries,
discovers or switches models automatically. Unsupported structured-output models
produce a configuration error. Credentials are not sent to the frontend or logged.
The response validator enforces short prose, available evidence, fee and exposure
citations, no numerical prose, and at most 170 words. This reduces unsupported
claims but cannot prove every semantic statement from an LLM.

Both AI features share five new attempts per authenticated user per minute,
two concurrent distinct generations per user, and ten global concurrent
operations per backend process. Duplicate pending snapshots share a request.
Successful risk results are cached for at most 30 seconds and never beyond
snapshot freshness. Cache keys include user, normalized snapshot (including
price timestamp), configured model and prompt version. Failed attempts consume
the allowance and are not cached. Maximum risk cache size is 200 entries.

The UI has a 30-second overall deadline. Closing or leaving Trade aborts client
requests and suppresses late responses; an already-started backend generation
can still finish within its provider timeout and consume quota. Input changes
mark feedback as outdated without generating again. Explicit refresh captures
current inputs. Reopening unchanged fresh inputs reuses their fingerprint.
Computed facts remain visible when Gemini fails; no fabricated feedback is shown.

**Caches and limits are process-local and reset on restart.** They do not enforce
a Google Cloud deployment-wide budget across multiple instances. Shared storage
and coordinated limits are required before claiming deployment-wide enforcement.

## Verification

Backend: `npm test`, `npm run lint`, `npm run build`.
Frontend: `npm test`, `npm run lint`, `npm run typecheck`.
Tests cover JWT authentication, bounded/stale inputs, both directions, fees,
liquidation, evidence validation, user/model/snapshot cache separation, expiry,
deduplication, shared limits, provider errors and frontend response validation.

After building both applications, from the frontend run:

```sh
node scripts/verify-trade-risk-ui.mjs
```

This uses an isolated production server (port 3017 by default) and Chrome with a
temporary synthetic account. All AI, authentication and market calls are mocked
inside the test browser. No real key or account is used. Set CHROME_PATH if Chrome
is installed elsewhere and RISK_UI_TEST_PORT if the default port is occupied.
Screenshots are written to the operating-system temporary directory. The checks
cover slow requests, cancellation, duplicate clicks, stale responses, changed
inputs, error/retry, cache reuse, keyboard focus, desktop/mobile bounds, stale
prices and unchanged trading storage. The temporary browser and server are stopped.

From the backend, `npm run verify:gemini:risk` builds and makes one minimal live
synthetic risk request using existing local configuration. It prints only safe
status/model/latency metadata, never the key. Provider failures are reported
without changing the configured key or model.
