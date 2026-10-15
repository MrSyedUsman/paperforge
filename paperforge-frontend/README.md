# PaperForge

PaperForge is a crypto futures practice application built with Next.js, React,
and TypeScript. Trade with virtual funds, explore live markets, track performance,
and compete against simulated opponents. No real-money orders are placed.

## Features

- Live Binance USDT perpetual market catalogue, quotes, search, and favorites.
- Long and Short paper market orders with leverage, fees, and isolated liquidation.
- Interactive price charts with multiple styles and time ranges.
- Portfolio, trade history, activity, and downloadable trade cards.
- Optional pre-trade risk checks with calculated scenarios and concise Gemini explanations.
- On-demand Gemini reviews of completed normal trades, with evidence, a lesson, and a practice exercise.
- Timed competitions against seven distinct rule-based bot strategies, with eligibility-aware pacing, decision explanations, separate wallets, standings, and result cards.
- Optional [Arena Radar](docs/arena-radar.md) explains active competition snapshots, with explicit refresh and a generation cooldown.
- On-demand [Arena Debrief](docs/arena-debrief.md) for completed competitions, with calculated evidence, bot comparisons, and a next-arena mission.
- Browser-local profiles and leaderboards with sample benchmark participants.
- Virtual starting balance of $1,000 and a $50 faucet every six hours.

## Getting started

Use Node.js 22.13.0 or newer. Keep the frontend, backend, and `paperforge-shared`
sibling directories together. Start the backend using its README, then run
from the frontend directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000 or the address printed in your terminal. Stop the
server with Ctrl+C. In Windows PowerShell, use `npm.cmd` if script execution
policy prevents running `npm`.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build and package the standalone production server |
| `npm run start` | Run the production server after a build |
| `npm run typecheck` | Validate TypeScript |
| `npm run lint` | Check application code, tests, and scripts |
| `npm run test:unit` | Run simulation, account, and competition tests |
| `npm test` | Build and run all domain and production HTTP tests |

Tests use Node's built-in runner and TypeScript support. They do not require
Binance access. Use `npm ci` for reproducible installs and `npm install` when
intentionally updating dependencies.

## Project structure

```text
src/app/          Pages, metadata, error screens, and API routes
src/features/     Account, trading, markets, portfolio, competitions, and profiles
src/components/   Shared chart, slider, and coin icon components
src/lib/          Trading calculations, market data, and browser storage
src/styles/       Application styles
public/           Coin icons and their license information
scripts/          Standalone server packaging
tests/            Domain regression and production HTTP tests
docs/             Architecture documentation
```

See [Architecture](docs/architecture.md) for module boundaries, persistence,
and current limitations.

## Data and simulation

Balances, trades, profiles, favorites, and competition records are stored in
this browser's local storage. They do not sync between devices. A different
hostname or port uses a separate browser store. Refreshing on the same origin
retains saved data when browser storage is available.

Live market data requires internet access and Binance availability. Trading
fees and isolated liquidation are simulated. Funding, slippage, advanced orders,
shared accounts, and human multiplayer are not implemented. Leaderboards compare
local results with sample participants; they are not verified global rankings.

## Production server

```sh
npm run build
npm run start
```

The build packages the standalone server, static bundles, and public assets.
The server lives under `.next/standalone/paperforge-frontend/` for this monorepo;
the packaging and start scripts resolve that location automatically. `PORT` and `HOSTNAME` configure the listening address. Deployment
configuration is not included; the Node.js server can be packaged for Cloud Run.

## Completed-trade AI review

In Portfolio, select **Review with AI** on a closed position. The non-blocking
review panel explains server-calculated facts and displays Gemini observations,
a risk lesson, and a practical exercise. It supports switching trades, retry,
Escape to close, and desktop/mobile layouts.

Configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL` on the NestJS backend.
The key stays server-side. Reviews require an authenticated session and are
cached per user and trade; failures display a retry state rather than fabricated
feedback. The frontend sends only the necessary trade snapshot, not profile
information or recorded PnL. Both apps use `paperforge-shared` for accounting.

Browser-local trade records remain unverified. Funding, slippage, intentions,
and market history are not inferred. Missing exit prices or opening fees are
acknowledged. Competition AI, pre-trade coaching, and automatic trading are not
included. See [AI review architecture](docs/ai-trade-review.md).

See [Pre-trade risk checks](docs/ai-trade-risk.md) for behaviour, limits and verification.

See [Competition bot strategies](docs/bot-strategies.md) for rules, participation planning and reproducible evaluation.
