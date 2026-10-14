# Arena Radar

During an active bot competition, select **Arena Radar** above standings. Opening the nonmodal panel makes no request. Select **Generate radar** or **Refresh radar** to capture evidence and request one short Gemini commentary. Reopening retains the displayed update without generating again. Competition controls, timers, price feeds and bots continue normally.

## Snapshot and accounting

Authenticated `POST /api/arena-radar/facts` calculates evidence without Gemini; `POST /api/arena-radar` generates validated commentary. Both accept `{current, previous}`; each snapshot contains a minimized active arena, timestamp and only marks required by open positions. Previous is the last successfully displayed update, never a failed attempt. Profiles, arbitrary lobby names, activity messages and sampled price histories are excluded.

Shared simulation formulas calculate free balance, reserved margin, unrealized PnL, equity, realized net trading PnL, charged fees, open exposure, average open leverage and cumulative qualifying margin. Equity matches the engine: free balance + margin + unrealized PnL, with no hypothetical closing fee deduction. Opening fees are already charged; liquidation fees are inside lost isolated margin. Missing legacy fees remain unavailable. Rounded stored margins allow simulator rounding tolerance when checking liquidation thresholds.

Records are checked for expected fields, canonical identities, settings, bounds, deadlines, fees, financial totals, contradictory balances, overlapping positions, and provably unfunded openings. Equal millisecond timestamps allow closes before subsequent opens because their exact order is unavailable. All records remain **unverified browser simulation data** after these checks.

Marks use the existing forty-five-second freshness rule and must not be future-dated beyond clock tolerance. If any required mark is stale or missing, do not present a complete arena ranking. Recorded facts remain usable. Missing tie-break data makes affected placements unavailable. Current eligibility is not a predicted final award.

## Deterministic selection

Headline priority: newly recorded user liquidation; changed user participation eligibility; differing equity/eligible leadership; user placement change; user exposure change of at least ten percent or one dollar; a supported opponent contrast; otherwise a quiet snapshot. First snapshots never establish a change.

Select the opponent nearest the user's equity placement when all needed placements are available; otherwise use canonical bot identity. Identity breaks selection ties. The shared bot catalogue supplies the configured speciality. At most one retained recognized closed-trade entry reason is included per selected bot; it is recorded explanation metadata, not proof of strategy causation or continuous AI reasoning. Open-position entry metadata and complete exit histories are not reconstructed in this version.

Comparisons require matching arena identity, settings and participants, strictly increasing timestamps, no altered/disappearing prior closed-trade records, and at most two minutes between snapshots. Structurally or financially invalid previous records are rejected. Valid but incompatible/old snapshots produce current-only commentary with an explicit limitation. Differences show recorded endpoints, not unseen events between them.

The local **New activity since this update** indicator uses position/trade identities, status, qualifying margin and equity buckets of half a percent of allocation (minimum one dollar). Timestamp-only price ticks do not count. It does not request AI, update displayed facts or establish a causal event history.

## Gemini and usage limits

Use existing backend `GEMINI_API_KEY` and `GEMINI_MODEL`. One configured-model request, no fallback, no automatic retries, no tools/history. Structured output includes a headline, up to two comparisons and one observation question. The backend validates evidence IDs, required headline references, selected comparison identities, lengths, maximum one hundred ninety words and obvious unsupported numeric/predictive claims. Natural-language validation cannot prove every semantic claim; the prompt restricts output to prepared facts.

- Provider timeout: twenty seconds; maximum 1,536 output tokens; target 100?160 generated words.
- Frontend deadline: thirty seconds. Closing, navigation, sign-out, arena switching and settlement invalidate pending work. Settlement/abandonment replaces the report with a completion state and results action. Debrief stays separate.
- Backend cooldown: thirty seconds per authenticated user and arena, measured from acceptance of a new generation attempt. Provider failures/timeouts consume cooldown and the shared allowance. Input-validation, cooldown and capacity rejections do not start a new cooldown. Cache hits and identical pending requests bypass a new generation allowance.
- Shared allowance across all four AI features: five new attempts per user per minute, two simultaneous distinct generations per user and ten per process.
- Cache: at most one hundred successful updates, thirty-second expiry, keyed by authenticated user, normalized current and previous fingerprints, configured model and prompt version. Cache keys retain previous identity even when comparison is unavailable. Failures are never cached.
- Bounds: two to eight participants, ten positions per participant subject to lobby limits, five hundred closed trades per participant and two thousand five hundred total, thirty marks, at most 700,000 bytes per snapshot arena and 1,400,000 bytes per request. Oversized input is rejected.

Caches, cooldowns, deduplication and allowances are **process-local** and reset on restart. They do not enforce a deployment-wide Google Cloud budget. Aborting the browser request ignores its eventual response; an accepted provider operation may still consume quota and fill the cache. The backend independently rejects responses that finish after the recorded deadline; browser-observed early settlement/abandonment is canceled in the client.

## Verification

Backend: `npm test`, `npm run lint`, `npm run build`. Frontend: `npm test`, `npm run typecheck`, `npm run lint`. After building both applications, run `node --experimental-strip-types scripts/verify-arena-radar-ui.mjs` from the frontend for isolated Chrome verification with synthetic market/auth/provider responses. The fixture uses the real simulation engine and backend facts calculator. Its shortened mocked cooldown is for UI test speed; backend tests verify the actual thirty-second policy.

Backend `npm run verify:gemini:radar` performs one minimal synthetic live request without printing secrets. Implementation verification received provider HTTP 402 / RESOURCE_EXHAUSTED, returned as a sanitized 503 billing/credit limitation. No key/model switch was made; local live generated commentary remains unverified until that provider restriction is resolved.
