# PaperForge

PaperForge is a crypto futures practice application built with Next.js, React,
and TypeScript. Trade with virtual funds, explore live markets, track performance,
and compete against simulated opponents. No real-money orders are placed.

## Features

- Live Binance USDT perpetual market catalogue, quotes, search, and favorites.
- Long and Short paper market orders with leverage, fees, and isolated liquidation.
- Interactive price charts with multiple styles and time ranges.
- Portfolio, trade history, activity, and downloadable trade cards.
- Timed bot competitions with separate wallets, standings, and result cards.
- Browser-local profiles and leaderboards with sample benchmark participants.
- Virtual starting balance of $1,000 and a $50 faucet every six hours.

## Getting started

Use Node.js 22.13.0 or newer. From the project directory:

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

The build packages `.next/standalone/server.js`, static bundles, and public
assets. `PORT` and `HOSTNAME` configure the listening address. Deployment
configuration is not included; the Node.js server can be packaged for Cloud Run.
