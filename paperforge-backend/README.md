# PaperForge backend

NestJS API for PaperForge sign-in, Firestore-backed user records, and Gemini
reviews of completed normal paper trades optional pre-trade risk checks, and completed-competition Arena Debrief. The default API address is
http://localhost:4000/api.

## Local setup

Keep `paperforge-backend`, `paperforge-frontend`, and `paperforge-shared` together.
The shared package provides the same accounting formulas to both applications.

```sh
npm ci
```

Create `.env` using `.env.example` and configure Firebase, JWT signing, and the
initial account. Add the Gemini settings locally:

```env
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-flash-latest
```

`.env` is ignored by Git. Never put this key in frontend variables. Restart the
backend after changing environment settings.

```sh
npm run start:dev
```

In PowerShell use `npm.cmd` if script execution policy blocks `npm`.

## Endpoints

- `POST /api/auth/login`: sign in with username and password.
- `GET /api/auth/me`: retrieve the signed-in user with a bearer token.
- `POST /api/trade-risk/facts`: calculate a proposed-trade snapshot without Gemini.
- `POST /api/trade-risk`: explain proposed-trade risk using Gemini.
- `POST /api/arena-radar/facts`: calculate an active arena snapshot without Gemini.
- `POST /api/arena-radar`: generate optional Arena Radar commentary.
- `POST /api/arena-debriefs/facts`: calculate completed-competition evidence without Gemini.
- `POST /api/arena-debriefs`: generate a personalized, evidence-linked arena learning report.
- `POST /api/trade-reviews`: request a completed-trade AI review with a bearer token.

The review endpoint accepts only pair, direction, entry/exit, isolated margin,
leverage, optional notional/opening fee, closing reason, and optional simulation
margin/fee rates. It excludes profile information, account identifiers, recorded
PnL, and credentials from the Gemini prompt. Values are validated and numerical
facts are recalculated using `@paperforge/simulation`.

Responses contain calculated facts, data limitations, validated Gemini feedback,
and generation/request timings. Feedback includes evidence-linked observations,
one lesson, and one practice exercise. Prose contains no numeric figures; the UI
renders calculated numbers separately. Reviews explain unverified, user-submitted
simulation snapshots and do not certify balances or account history.

## Limits and failures

- Generation happens only on a review request; no automatic trading.
- All four AI features share five new attempts per user per minute, at most two concurrent distinct generations per user and ten concurrent operations per process.
- Concurrent identical requests share one Gemini operation.
- Up to 500 successful reviews cached in process memory for 24 hours, keyed by
  authenticated user, normalized trade data, configured model, and prompt version.
- Completed-trade provider requests time out after 25 seconds for Gemma and 20 seconds for Gemini models. A timeout, a 5xx, or a 404 retries once with `GEMINI_FALLBACK_MODEL`; the frontend deadline is 60 seconds.
- Invalid input returns 400; missing/expired authentication returns 401; local
  rate limits return 429. Provider failures use sanitized 502/503/504 responses.
- Failed responses are never cached or replaced with invented AI content.

Caches and limits are per-process and reset on restart. Shared persistence and
rate limiting would be needed for coordination across multiple server instances.

## Verification

```sh
npm run lint
npm test
npm run build
npm run verify:gemini
```

`verify:gemini` makes one live request using only a synthetic paper trade. It may
consume provider quota; it prints sanitized results and never prints the key.
The automated tests mock Gemini and do not access a live database or AI service.

Production startup is `npm run start:prod` after building. Deployment is not part
of this feature. Live AI bot decisions are not implemented. Arena Debrief is documented in [Arena Debrief](../paperforge-frontend/docs/arena-debrief.md). Pre-trade checks are documented in [AI trade risk](../paperforge-frontend/docs/ai-trade-risk.md).

`npm run verify:gemini:risk` makes a single synthetic risk request to the configured model, without automatic fallback or credential logging. Risk caches expire within 30 seconds; limits remain process-local.

`npm run verify:gemini:debrief` makes one synthetic competition request without fallback. Debriefs cache up to one hundred successful reports for twenty-four hours, with a twenty-second provider timeout and a thirty-second frontend deadline. Limits and cache are process-local.

[Arena Radar](../paperforge-frontend/docs/arena-radar.md) adds a thirty-second per-user/arena cooldown and short successful-result caching. `npm run verify:gemini:radar` makes one synthetic live request without fallback. All limits remain process-local.
