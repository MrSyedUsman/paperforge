# Competition bot strategies

Seven rule-based strategies replace the former shared random-direction loop.
There are no Gemini requests, model calls, hidden balance bonuses or changes to
manual trading, eligibility, ranking, awards or final settlement.

## Specialities

Specialities are preferences with three grades: preferred, developing and small exploratory. A bot first looks for its original strongest setup, then accepts weaker evidence consistent with its style. Exploratory opportunities require additional elapsed/idle time or participation lag. All use observed prices, not random directions.

| Bot | Actual entry preference | Exit policy |
| --- | --- | --- |
| TrendFox | Confirmed trends/pullbacks first; smaller developing trend with recent directional support. | Trend invalidation, risk stop, trailing net profit or holding review. |
| NovaQuant | Strong momentum first; modest recent continuation is also acceptable. | Fading momentum, fee-adjusted target, risk stop or review. |
| CandleByte | Confirmed sampled-range breaks first; can make a smaller anticipatory entry near a boundary. | Preferred entries invalidate at the old range; developing entries use their recorded fast-average reference. Risk/trailing/review also apply. |
| RiskRaven | Large recovering deviations first; smaller observed recoveries toward a recent mean can qualify. A truly monotonic path can still offer no entry. | Fee-covered mean return, adverse deviation/trend, risk stop or review. |
| MomentumX | Basic directional agreement with the lowest leverage/exposure and one concurrent position. Stronger agreement is preferred, not compulsory. | Modest fee-adjusted target, trend/risk/trailing exit; short arenas also have an independent bounded exposure-review window. |
| DeltaBot | Confirmed regime rules first; provisional trend, range recovery or boundary evidence while confirmation develops. | Recorded entry regime/reference remains attached; confirmed regime transition, invalidation, risk/trailing/review. |
| AtlasAlgo | Strong volatility expansion first; smaller entries can use moderate measured variation with directional support. | Expansion/direction invalidation, risk stop, fee-adjusted target or review. |

MomentumX keeps its existing name and Conservative trader label. CandleByte
uses sampled ranges, not candle patterns. AtlasAlgo uses standard deviation of
recent percentage returns, not ATR. The existing chart's candle history is not
silently reused as a bot signal, and cumulative 24-hour volume is never treated
as breakout-confirmation volume.

## Modules and data

- `bot-history.ts`: a shared bounded collection, quote freshness, restore and gaps.
- `bot-signals.ts`: averages, returns, slope, mean deviation, ranges and volatility.
- `bot-profiles.ts`: speciality risk policies, cadence and seeded patience.
- `bot-participation.ts`: exact eligibility progress and bounded entry pacing.
- `bot-strategies.ts`: strategy-specific entry, hold and exit rules.
- `bot-scheduler.ts`: pure timestamped decisions and existing-engine execution.
- `bot-state.ts`: safe optional metadata restoration and retention limits.
- `use-competition-bots.ts`: thin React effect connecting the feed and clock.

At most one observed quote per market is sampled in each two-second bucket.
The collector uses the current timestamp and never interpolates missing samples
or backfills prices into earlier buckets. Indicators use only observations at or
before the decision timestamp. Quotes use the existing 45-second freshness rule;
future timestamps are rejected. A sampling gap longer than six seconds requires
a new contiguous tail to warm up. Browser throttling does not replay missed ticks.

Each arena stores at most thirty markets with one hundred twenty samples each. History collected during configuration can be reused. A cold short arena can calculate a provisional signal from five real observations (about eight seconds with two-second sampling); longer arenas require seven. Full preferred windows remain richer: nine basic short observations, twenty for short mean reversion and twelve for preferred volatility. Longer preferred windows use twenty basic and thirty-eight mean observations. Provisional status and sample count are recorded. New timestamps on unchanged latest prices do not create entry evidence.

## Risk and participation

Eligibility remains the existing `eligibilityFor` rule: at least one opened
trade and cumulative margin of half the allocation. Open and closed positions
both contribute once. Leveraged notional does not count. Closing does not remove
a position's qualifying historical margin. A $1,000 arena therefore requires
$500 cumulative margin, potentially across several trades.

The planner starts tracking progress immediately, estimates remaining meaningful
entry opportunities, and aims for the margin milestone by three quarters of the
arena duration. It can increase normal sizing by at most 1.4 times when projected
participation needs it, or 1.8 times when behind (1.9 for the lower-exposure conservative policy), always within the speciality's
per-position and total-margin limits, balance including opening fees, drawdown
reduction and lobby constraints. After eligibility, normal sizing resumes.
Setup quality also reduces sizing and leverage (developing factor 0.85, exploratory 0.65). Projections account for this reduction rather than systematically undershooting the final margin milestone. Orders are sized in cents. Eligibility can widen accepted signal quality after bounded idle time, but never creates direction, waives fees, or forces an exit.

| Bot | Normal margin / allocation | Maximum per-position margin | Total committed margin cap | Base leverage cap |
| --- | --- | --- | --- | --- |
| TrendFox | 12% | 22% | 36% | 5x |
| NovaQuant | 11% | 20% | 40% | 6x |
| CandleByte | 14% | 24% | 38% | 5x |
| RiskRaven | 10% | 20% | 34% | 3x |
| MomentumX | 8% | 15% | 16% | 2x |
| DeltaBot | 12% | 22% | 35% | 5x |
| AtlasAlgo | 10% | 18% | 30% | 4x |

These are caps rather than promises. Lobby leverage/position limits can be lower.
Drawdown reduces sizing; MomentumX also responds to drawdown from its equity
peak. AtlasAlgo reduces sizing and leverage as measured volatility rises. All
preferred setups retain their observed-movement filter. Developing setups no longer require a universal movement estimate above round-trip fees; it cannot establish future fee coverage.
Risk stops may realize losses including fees; profitable exits use fee-adjusted
results. Profitability or qualification is never guaranteed.

One-minute base decision intervals are 3/2.5/2/1.8 seconds for Easy/Medium/Hard/
Expert, adjusted by speciality. Longer arenas use 12/8.5/6/4.5 seconds. Falling
behind can shorten a non-conservative bot's interval modestly. Easy bots can
wait an additional observation using seeded patience; direction is never random.
Higher difficulty does not universally increase leverage. No new entry is made
with fewer than eight seconds remaining, and longer planned holds can require
more time. Holds end by strategy/risk/review rules, not a participation round-trip quota. Entries are capped at five for conservative bots, seven for momentum, and six for the others in a one-minute arena; longer limits scale by duration with a maximum of one hundred twenty. Existing positions are still managed after the entry cap. Recently exited same-side setups require changed price evidence before re-entry. Exceptional observed return volatility above 0.9 percent blocks new entries; individual specialties can have lower limits.

## Metadata, reload and compatibility

Committed next-decision timestamps and sequence numbers survive reload. Identical
inputs produce identical bot decisions and IDs; existing settlement notification
IDs remain cosmetic random values. Active legacy arenas without optional bot
state warm up safely. Corrupted optional metadata is discarded or bounded.
Sampling does not continue while the application is closed, so a long absence
requires fresh history. Competitions remain browser-local simulations; this is
not a secure authoritative multi-client engine or a background trading service.

Each bot retains its last 24 decisions, with timestamps, action, reason, signal
values, before-decision eligibility progress, participation adjustment and data
limitations. Positions carry their original strategy version, reference and entry
reason. Closed trades retain optional signal metadata for the most recent 32
trades per bot. Older financial trades remain intact for exact accounting and
eligibility, while their optional explanation metadata is removed. Open/close
reasons appear in the bounded activity feed; hold decisions do not flood it.
Participant details show the latest check when position visibility is enabled.

## Verification and measured eligibility

Run `npm test`, `npm run typecheck`, and `npm run lint` from the frontend.
The strategy tests cover all seven specialities, fees, stops, liquidation,
sampling, future/stale data, drawdown, participation, bounds, seeded reproducibility,
deadlines, legacy records, reloads and unchanged manual-trading accounting.

The older broad-path benchmark `npm run evaluate:bots -- --write` regenerates `bot-evaluation.json`. It runs six
constructed price paths (trend, range, breakout, reversal, volatility expansion,
and flat), three seeds, all four difficulties, warm/cold one-minute starts and
warm ten-minute starts. The selected scenario mix is deliberately artificial;
reported percentages are not estimates of real-market qualification or returns.
Flat markets deliberately produce no trades. See [Measured eligibility](bot-eligibility-report.md)
for rates by bot, difficulty and warmup condition.

After building, `node --experimental-strip-types scripts/verify-bot-strategies-ui.mjs`
uses an isolated Chrome session and synthetic market feed to configure and finish
an actual one-minute arena with all seven bots. It verifies manual entry/close,
reload, activity reasons, eligibility, mobile details, settlement and an unchanged
normal wallet. No real account, database or AI service is used. Set CHROME_PATH
or BOT_UI_TEST_PORT if needed. Screenshots go to the OS temporary directory.

Further live-market tuning is expected: narrow ranges can be dominated by fees,
selective bots can miss eligibility, cold starts have less usable evidence, and
short noisy signals do not establish predictive skill. No bot has future data or
learns from a model. Arena Radar and Arena Debrief can explain retained recognized reasons; they do not control these decisions. Their prompts, request budgets and authentication are unchanged.

## Meet the bots guide

The competition hub and active arena expose the same Meet the bots dialog.
`bot-guide-catalogue.ts` maps existing names/styles to descriptions keyed by the
implemented strategy kind; it does not duplicate strategy calculations or change
settings. The desktop table becomes labelled mobile cards. During an arena,
participating and absent opponents are explicitly marked.

A native modal dialog makes background controls inert while a keyboard loop
keeps Tab and Shift+Tab within its close controls. Escape closes it, body scroll
styles are restored, and focus returns to the trigger. If the arena finishes,
the guide remains open with a results notice; closing then focuses a valid results
heading because the old arena trigger has been removed. The modal does not stop
the clock, feed, scheduler or settlement. No AI request or dependency is added.

After building, run `node --experimental-strip-types scripts/verify-bot-guide-ui.mjs`
for an isolated synthetic-browser check of both entry points, responsive content,
keyboard/background behaviour and expiry during an open guide. The test uses
port 3021 by default (override BOT_GUIDE_UI_TEST_PORT) and CHROME_PATH if needed.

## Activity comparison

The current before/after acceptance matrix and per-bot measurements are documented in [Bot activity results](bot-activity-results.md). It includes gentle movement, cold/warm one-minute starts, longer durations, all difficulties and restricted custom markets. Flat paths are measured separately. Historical eligibility reports describe the older strict implementation and are retained as reference, not current production predictions.
