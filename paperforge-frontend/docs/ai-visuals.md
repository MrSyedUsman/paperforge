# AI panel visual summaries

These are presentation changes to the existing validated responses. Requests, provider configuration, prompts, caching, limits, authentication and simulation calculations are unchanged. No new dependencies or Gemini requests are needed.

- **Check trade risk:** exposure snapshot; long/short entry-to-liquidation schematic with formatted distance; hypothetical scenarios with opening, estimated closing and total fees. Liquidation scenarios retain the existing settlement treatment.
- **Review with AI:** net-result hero, gross/fees/net ledger, and a fee-impact bar only when gross profit and fees are known. The bar caps at gross profit and explicitly labels fees exceeding it. Liquidation has its own explanation, without double-counting its fee.
- **Arena Radar:** snapshot rank, separate margin and minimum-trade requirements, and a same-scale equity comparison against the selected opponent. Headline evidence and Gemini interpretation remain available through a keyboard-accessible disclosure.
- **Arena Debrief:** separate financial and placement facts, eligibility checklist, signed net-trading comparison with the selected bot, and timestamped selected records when available. Recorded moments are not a full history or a causal account.

Widths and scales are presentation geometry only. Missing values are labelled unavailable; there are no fabricated equity curves, risk scores, market predictions or fallback AI explanations. Existing stale-state warnings, cancellation and nonmodal keyboard interactions are retained.

## Screenshots

The screenshots below show the actual production UI with intercepted development fixtures. Every image is labelled accordingly. They do not represent live trades or Gemini-generated output. Desktop captures are 1440 x 1000; mobile captures are 390 x 844. Panels scroll independently to show the remaining sections.

| Feature | Desktop | Mobile |
| --- | --- | --- |
| Check trade risk | [Desktop](ai-visuals/risk-desktop.png) | [Mobile](ai-visuals/risk-mobile.png) |
| Review with AI | [Desktop](ai-visuals/review-desktop.png) | [Mobile](ai-visuals/review-mobile.png) |
| Arena Radar | [Desktop](ai-visuals/radar-desktop.png) | [Mobile](ai-visuals/radar-mobile.png) |
| Arena Debrief | [Desktop](ai-visuals/debrief-desktop.png) | [Mobile](ai-visuals/debrief-mobile.png) |

## Verification

Use the current backend build for the existing calculation functions used by browser fixtures. No backend server, account credentials or Gemini key are required by the fixtures.

```text
npm run lint
npm run typecheck
npm run build
node --experimental-strip-types --test tests/*.test.mjs
node --experimental-strip-types scripts/verify-ai-visuals-ui.mjs
node --experimental-strip-types scripts/verify-trade-risk-ui.mjs
node --experimental-strip-types scripts/verify-arena-radar-ui.mjs
node --experimental-strip-types scripts/verify-arena-debrief-ui.mjs
node scripts/verify-ai-readability.mjs --captured
node scripts/verify-ai-readability.mjs
```

The browser checks cover profit, loss, exact break-even, fees exceeding gross profit, liquidation, missing evidence, loading, errors/retry, keyboard focus, cancellation and financial-record preservation. Existing competition fixtures cover eligible final results and incomplete active participation. The captured-markup audit checks the actual rendered panels at 320/390/768/1024/1440 widths, landscape, 200% equivalent zoom and doubled root text; the original readability fixtures additionally stress long labels, large values and unavailable states.

Screenshot capture stores temporary HTML from the synthetic panels locally for the `--captured` audit. Run all four feature browser checks before that audit. The original audit remains independently runnable.

Manual assistive-technology testing and live-provider testing are outside these presentation checks. Screenshots show one representative state per feature rather than every data variation.

### Results

All 79 frontend tests, lint, TypeScript checks and the production build passed. All four feature browser checks passed. Both readability suites passed (32 rendered-panel combinations plus 32 stress-fixture combinations). Minimum measured contrast was 5.12:1 for captured panels and 6.19:1 for the stress fixtures. The doubled-text audit identified and verified the fix for a wrapping issue in Radar's unavailable-rank label.

No real Gemini/provider request was made. No backend, authentication, trading-engine, bot-strategy, deployment or credential files were changed.
