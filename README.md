# Why YO

Why YO is a DeFi portfolio analysis and recommendation system. It scans a connected wallet, normalizes protocol and token exposure, computes deterministic risk and concentration metrics, compares the portfolio against YO vaults, generates explanations, and supports direct deposit flows from the web app.

## What the system does

- Connects a wallet and starts a portfolio scan from the web app
- Pulls balances, protocol positions, and token exposure from external integrations
- Normalizes raw positions into canonical portfolio data
- Splits exposure into USD, ETH, BTC, and other buckets
- Computes bucket metrics such as risk, coverage, concentration, idle capital, and savings score
- Reads YO vault data and compares each bucket against available vault strategies
- Ranks recommendations with deterministic rules instead of LLM scoring
- Generates human-readable recommendation summaries
- Supports direct YO deposit flows in the same interface
- Persists scans, metrics, recommendations, and explanation jobs

## System layout

- `apps/web`: Next.js frontend for wallet connection, scan results, and deposit flows
- `apps/api`: Fastify API for scanning, normalization, ranking, persistence, and data serving
- `apps/worker`: background worker for async explanation generation
- `packages/domain`: core formulas, normalization, matching, metrics, and ranking logic
- `packages/integrations`: external schemas and HTTP clients
- `packages/shared`: shared types, schemas, constants, and methodology content
- `data/risk`: local risk dataset bootstrap file
- `infrastructure`: Dockerfiles and bootstrap scripts

## Data flow

1. User connects a wallet in the web app.
2. The API loads wallet positions, YO vault data, aliases, and risk dataset rows.
3. Raw data is normalized into canonical exposures.
4. The system computes bucket metrics and compares them with YO vault metrics.
5. The ranker produces recommendation candidates.
6. The API returns deterministic results and optional explanation text.
7. The user can continue into the YO deposit flow from the UI.

## Main capabilities

- Deterministic portfolio scoring and recommendation ranking
- Canonical protocol and token normalization
- Risk dataset import and verification
- Bucket-aware recommendation logic for USD, ETH, and BTC
- Sync or async explanation generation
- Local end-to-end stack with web, API, worker, Postgres, and Redis

## Run locally

1. Copy `.env.example` to `.env`
2. Fill the required environment variables:
   - `DEBANK_ACCESS_KEY`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - `BASE_RPC_URL`
3. Start the stack:

```bash
docker-compose up --build
```

Available services:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:8080](http://localhost:8080)
- Swagger: [http://localhost:8080/docs](http://localhost:8080/docs)

## Development notes

- The active risk bootstrap file is [data/risk/risk-dataset.json](data/risk/risk-dataset.json)
- `pnpm test` runs the project test suite
- `pnpm --filter @whyyo/api risk:verify` validates the active risk dataset
- `RUN_LIVE_BACKEND_E2E=true pnpm test:e2e-live` runs a live backend scan flow

## Documentation

- Architecture: [docs/architecture.md](docs/architecture.md)
- Setup: [docs/setup.md](docs/setup.md)
- API: [docs/api.md](docs/api.md)
