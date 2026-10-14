# Competition bot strategies

Seven rule-based strategies replace the former shared random-direction loop.
There are no Gemini requests, model calls, hidden balance bonuses or changes to
manual trading, eligibility, ranking, awards or final settlement.

## Specialities

| Bot | Actual entry policy | Exit policy |
| --- | --- | --- |
| TrendFox | Aligned fast/slow sampled-price averages and slow-average slope; favours recovery after a pullback and rejects stretched entries. | Trend weakness/reversal, risk stop, trailing net profit or a completed holding review. |
| NovaQuant | Recent and broader returns agree; rejects fading acceleration and extreme extension; ranks normalized momentum. | Momentum fades/reverses, a fee-adjusted target, risk stop or holding review. |
| CandleByte | Two observations confirm a buffered move beyond a prior sampled-price range. The range excludes both confirming observations. | Return inside the original range, risk stop, trailing profit or holding review. |
| RiskRaven | A sufficiently large deviation starts recovering toward a longer reference mean while the mean slope is weak. | Fee-covered return to the entry reference mean, an expanding adverse deviation, a new adverse trend, risk stop or holding review. |
| MomentumX | Stronger trend/momentum agreement, low realized volatility and observed movement beyond fees. Lowest normal margin, leverage and position count. | Modest net-profit target, trend weakness, risk stop, trailing profit or holding review. |
| DeltaBot | Selects trend, range/reversion or breakout rules from a measured regime. Confirmation and minimum regime lifetime prevent rapid switching. | Original entry rules remain attached to each position; confirmed regime changes are explicit exit reasons. |
| AtlasAlgo | Realized-volatility expansion plus independent directional confirmation; ranks expansion and uses valid quote-volume liquidity as a small ranking factor. | Expansion/direction fades, volatility-aware stop, net-profit target, trailing profit or holding review. |

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

Each arena stores at most 30 markets with 120 samples each. History collected
while configuring an arena can be reused. A cold one-minute arena needs nine
observations for basic signals (about sixteen seconds from its first sample),
twenty for mean reversion (about thirty-eight seconds), and twelve for volatility
(about twenty-two seconds). Longer arenas use slower windows: basic signals need
twenty observations and mean reversion thirty-eight. Missing history causes a
hold with an explicit limitation, never a fabricated signal.

## Risk and participation

Eligibility remains the existing `eligibilityFor` rule: at least one opened
trade and cumulative margin of half the allocation. Open and closed positions
both contribute once. Leveraged notional does not count. Closing does not remove
a position's qualifying historical margin. A $1,000 arena therefore requires
$500 cumulative margin, potentially across several trades.

The planner starts tracking progress immediately, estimates remaining meaningful
entry opportunities, and aims for the margin milestone by three quarters of the
arena duration. It can increase normal sizing by at most 1.4 times when projected
participation needs it, or 1.8 times when behind, always within the speciality's
per-position and total-margin limits, balance including opening fees, drawdown
reduction and lobby constraints. After eligibility, normal sizing resumes.
Eligibility never creates a signal or a forced exit, and does not waive fees.

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
bots require observed room beyond the estimated round-trip fee plus a buffer.
Risk stops may realize losses including fees; profitable exits use fee-adjusted
results. Profitability or qualification is never guaranteed.

One-minute base decision intervals are 4.5/3/2.5/2 seconds for Easy/Medium/Hard/
Expert, adjusted by speciality. Longer arenas use 12/8.5/6/4.5 seconds. Falling
behind can shorten a non-conservative bot's interval modestly. Easy bots can
wait an additional observation using seeded patience; direction is never random.
Higher difficulty does not universally increase leverage. No new entry is made
with fewer than eight seconds remaining, and longer planned holds can require
more time. Holds end by strategy/risk rules, not a participation round-trip quota.

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

`npm run evaluate:bots -- --write` regenerates `bot-evaluation.json`. It runs six
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
learns from a model. Gemini strategies and Arena Debrief remain separate future work.

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
