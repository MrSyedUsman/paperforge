# Arena Debrief

Completed bot competitions offer **Debrief with AI**. The nonmodal report keeps results usable while calculations and Gemini run. It includes the arena story, evidence-linked comparisons, a bot mirror, a selected user trade (or an explicit unavailable state), and a practice mission with a reflection question. Calculated facts remain visible when generation fails. No debrief operation writes competition or account storage.

## Boundaries and accounting

The browser submits a privacy-minimized, unverified simulation snapshot to authenticated `POST /api/arena-debriefs/facts`, then `POST /api/arena-debriefs`. No profile, arbitrary lobby name, activity text, sampled market history, credentials, or free-form strategy explanations are sent. The backend rejects unexpected fields and checks settings, canonical bot identities, timestamps, completed status, empty positions, exposure, fees, net PnL, wallet reconciliation and reconstructable standings.

Both engines share simulation formulas and eligibility rules through `@paperforge/simulation`. Qualifying participation counts cumulative isolated margin, not notional. Both entry and closing fees are included. Isolated liquidation loses margin plus the previously paid opening fee; liquidation fees are already inside lost margin. Equity return includes any forfeiture and is distinct from net trading return. The normal wallet and rewards are excluded.

Timed/elimination awards require at least one opened trade and cumulative margin of half the allocation. Equity ranking uses equity, realized result, lower fees, earlier achievement, then stable recorded order. Abandonment preserves the existing separate outcome: bots rank by final equity and stable order, the user is last and forfeits their wallet, irrespective of the normal eligibility threshold. Legacy endings without a reliable completion marker do not establish an awarded winner. Missing fees are unavailable, never assumed zero. Missing liquidation rates use simulator defaults; this assumption is disclosed. Threshold consistency allows the original simulator margin rounding range. Missing tie-breaks leave affected placements unavailable.

## Deterministic selection and retained evidence

The bot mirror is the closest eligible bot by equity placement, then equity gap and canonical identity. If no bot qualifies, use all bots. If required placements are unavailable, compare equity gaps consistently across the pool. This is a useful comparison, not proof that a strategy caused a result.

Select a fully grounded user trade by liquidation, positive gross outweighed by fees, net loss, then any other result. Within each group use largest absolute net result, earliest closing time and trade identity. Missing fee records are excluded from selection. Inactivity produces a participation explanation rather than an invented trade.

The shared typed bot catalogue supplies actual specialties. Only one latest retained recognized entry explanation per bot is submitted. The simulator retains explanation metadata on thirty-two recent bot trades; financial records remain available independently. Missing entry/exit history is not reconstructed. Activity is not a complete chronology; price samples are not candles; drawdown and causal turning points are not inferred.

## Gemini and limits

Use backend-only `GEMINI_API_KEY` and configured `GEMINI_MODEL`. Debriefs make one request without model fallback or automatic retries. Structured output is checked for section lengths, evidence IDs, selected identities, comparison references, forbidden numerical prose and obvious unsupported claims. Schema validation does not mathematically prove every natural-language interpretation; the prompt restricts explanations to supplied evidence.

- Input: 700,000 bytes, two to eight participants, at most five hundred trades per participant and two thousand five hundred total. Oversized arenas are unavailable without modifying records.
- Provider: twenty-second timeout, 3,072 maximum output tokens, brief narrative target around 250?350 words, maximum 380 validated words.
- Frontend: thirty-second overall deadline; cancellation and obsolete-response protection on close, navigation, sign-out and changed snapshots. New arena identity remounts the report. Changed snapshots are marked outdated and require an explicit refresh.
- Shared allowance across completed reviews, risk checks and debriefs: five new attempts per user per minute, two concurrent distinct requests per user, ten per process. Failures count; identical pending requests are deduplicated.
- Successful debriefs: at most one hundred, twenty-four-hour expiry, keyed by authenticated user, normalized fingerprint, configured model and prompt version. Failures are not cached. Generation and request durations are measured separately.

Caches, deduplication and budgets are **process-local**, reset on restart, and do not enforce a deployment-wide Google Cloud quota across instances. Browser cancellation suppresses responses; an already accepted server/provider request can still consume quota and populate the server cache.

## Verification

Run backend `npm test`, `npm run lint`, `npm run build`; frontend `npm test`, `npm run typecheck`, `npm run lint`. After building both applications, run frontend `node --experimental-strip-types scripts/verify-arena-debrief-ui.mjs` for synthetic, isolated Chrome checks. Run `node --experimental-strip-types scripts/verify-arena-evidence.mjs` for cross-application checks on actual engine records. Browser tests mock authenticated API and Gemini responses using real simulator output and the actual backend evidence calculator; they do not certify live generation.

Backend `npm run verify:gemini:debrief` makes exactly one minimal synthetic live request using existing local configuration and prints sanitized status/latency without credentials. The implementation verification received provider HTTP 402 / RESOURCE_EXHAUSTED (billing/credit limit), exposed as a safe 503. No key or model was switched. Live generated content remains unverified locally until that provider restriction is resolved.
