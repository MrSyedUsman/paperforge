# Completed-trade AI reviews

## Flow

Portfolio action -> authenticated NestJS `POST /api/trade-reviews` -> validated
trade snapshot -> shared accounting formulas -> Gemini structured response ->
validated, evidence-linked feedback -> responsive non-blocking review panel.

The backend never trusts client PnL or forwards profile information. The shared
`@paperforge/simulation` package contains the original fee, rounding, notional,
PnL and isolated-liquidation formulas. The frontend exports those same functions
through its existing modules, preserving trading and competition behavior.

For normal closes, net PnL subtracts entry and exit fees from the price-move
result. For liquidation, the entire isolated margin is exhausted; the closing
liquidation fee is already within that loss. Net PnL is negative margin minus
opening fee, not negative margin minus both fees again. Gross settlement before
fees differs from PnL computed solely from the liquidation price move.

Missing opening fees are not assumed to be zero. Missing exit prices are not
assumed to equal entry. Calculations that need those values are unavailable and
the reviewer is told why. Client-supplied records remain unverified.

## Module boundaries

- `paperforge-shared`: dependency-free accounting primitives and TypeScript types.
- Backend `src/trade-reviews/trade-facts.ts`: bounded input validation and facts.
- `gemini-review.provider.ts`: private API key, bounded request, safe errors.
- `review-output.ts`: prompt, schema and evidence/text validation.
- `trade-reviews.service.ts`: per-user cache, deduplication and rate limits.
- `trade-reviews.controller.ts`: existing bearer-token guard and HTTP contract.
- Frontend `trade-review-contract.ts`: minimal snapshot and response validation.
- `trade-review-api.ts`: authenticated, abortable HTTP request.
- `trade-review-panel.tsx`: loading, retry, evidence, lesson and exercise UI.

Numerical values appear in calculated fact cards. Gemini prose cannot contain
numeric figures and observations must cite available facts about fees and
exposure. This reduces invented numeric claims but does not prove every semantic
statement from an LLM is correct. Evidence and limitations remain visible.

## UI and reliability

The panel is a region, not a blocking modal; background navigation remains
available. Escape closes it and returns focus to the triggering history action.
Selecting another trade remounts request state. Cleanup aborts obsolete requests
and suppresses late responses. Closing or leaving Portfolio unmounts the panel.
A request begins only after the user asks for a review. Mobile history uses cards
so review actions stay reachable without scrolling across a wide table.

The server has a 20-second provider deadline, the client a 30-second deadline.
Successful cache entries last 24 hours and use user, facts, model and prompt
version. Concurrent identical requests share one operation. Limits are process-
local: five new attempts per user per minute shared with pre-trade checks, two concurrent distinct generations per user, and ten concurrent operations globally per process.
Cache hits do not consume new-generation allowance. Failed reviews are not cached.

## Verification

Domain and HTTP tests cover authentication, facts, missing data, provider errors,
output validation, user isolation, cache reuse/expiry, deduplication and limits.
Frontend tests cover payload privacy and malformed response rejection. Browser
checks use isolated synthetic accounts and deterministic provider responses for
slow requests, retries, stale responses, closure, deadlines and mobile layouts.
The separate backend live verification script uses only a synthetic trade.
