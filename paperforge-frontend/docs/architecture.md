# PaperForge architecture

PaperForge uses the Next.js App Router, React, and strict TypeScript. The
application provides browser-local futures paper trading and bot competitions.
Its server exposes a market-data proxy; trading state stays in the browser.

## Source map

```text
src/
  app/                    Routes, metadata, root layout, and error screens
    api/binance/          Validated server proxy for Binance futures data
    icon.svg              Application icon
  components/             Shared chart, slider, and coin icon components
  features/
    application/          Navigation and screen coordination
    account/              Account types, trading engine, and persistence hook
    home/                 Home screen
    markets/              Market discovery and search
    trading/              Terminal, order preview, and confirmation UI
    portfolio/            Portfolio, trade journal, and share cards
    profile/              Browser-local profile editor and statistics
    competitions/         Bot decisions, wallets, settlement, and arena UI
    leaderboards/         Local rankings and sample benchmark repository
  lib/
    simulation/           Fee, quantity, PnL, and liquidation calculations
    market-data/          Market normalization, feed/chart hooks, and cache
    storage/              Browser storage boundary
  styles/                 Application styles in a defined cascade order
public/coin-icons/        Coin assets with source and license information
scripts/                  Standalone production asset packaging
tests/                    Domain regressions and production HTTP tests
```

## Application and account

`src/app/page.tsx` renders `PaperForgeApp`, which coordinates navigation and
account actions. `useStoredAccount` handles hydration, persistence, and cross-tab
storage events. The account engine creates and settles positions and computes
account metrics. UI components access persistence through hooks and repositories.

Shared trading formulas live in `lib/simulation`. The account and competition
engines use these formulas for fees, PnL, and isolated liquidation. UI previews
and completed trades use the same calculations.

## Market data

Browser REST requests use `/api/binance`. The route validates resources and
market parameters, retries Binance futures endpoints, and applies Next.js
caching. Browser clients do not request Binance REST endpoints directly.

`useMarketFeed` loads the catalogue and initial quotes, receives ticker updates
through the Binance WebSocket, polls the server as a fallback, and tracks
connection status. `useMarketChart` loads historical candles. The competition
arena has its own historical-candle polling effect in `bot-competition.tsx`.

## Competitions

Each participant has a wallet separate from the normal trading account. The
competition engine enforces wallet and order constraints. `settlement.ts` closes
participants' positions using one quote snapshot and records final statistics.

Lobby state is saved immediately. Finalization and result recording are
idempotent, so revisiting a completed session does not award it twice. Bot
decisions currently use shared difficulty-based rules and random variation;
strategy labels do not yet select distinct decision algorithms.

## Persistence

Browser storage keys:

- `paperforge-v2`: account schema version 5
- `paperforge-market-cache`: eligible market catalogue
- `paperforge-bot-lobby-v1`: active or completed competition
- `paperforge-bot-stats-v1`: competition statistics
- `paperforge-competition-order-width`: arena panel preference

Repositories validate stored values and restore safe defaults for malformed
fields. Account and competition readers support earlier fee-accounting and
liquidation schemas. Hydration guards prevent initial defaults from overwriting
saved state. Storage access handles unavailable or restricted browser storage.

Storage belongs to the browser origin. Changing hostname or port creates a
separate store; copying source files does not transfer saved account data.

## Production runtime

`next.config.ts` enables standalone output and strict CSS chunk ordering. The
build produces `.next/standalone/server.js`. `scripts/prepare-standalone.mjs`
copies public assets and client bundles into that directory. `npm run start`
launches the packaged Node.js server. `PORT` and `HOSTNAME` set its address.

Cloud hosting and AI integration are not configured. Deployment scripts and
shared server-side account persistence are future work.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm test`. Tests cover liquidation,
account reconciliation, stored-data validation and compatibility, competition
constraints, eligibility, settlement, page metadata, CSS, icons, 404 responses,
and API input validation. HTTP tests start and stop an isolated production
server. The automated test suite does not depend on Binance availability.

## Current limitations

- Funding, slippage, advanced orders, shared accounts, and human multiplayer
  are not implemented.
- Leaderboards use local results and sample benchmark participants.
- Profile privacy and display-currency preferences do not enforce server-side
  privacy or perform currency conversion.
- The competition "All eligible" setting currently selects major markets.
- The chart's "EMA 20" label currently represents a rolling simple average.
- Live data depends on Binance connectivity; local results are unverified.
