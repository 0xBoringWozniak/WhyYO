# Setup

## Prerequisites

- Docker Desktop with Compose
- `.env` copied from `.env.example`
- Valid secrets for:
  - `DEBANK_ACCESS_KEY` for real portfolio data
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for wallet UX
  - `BASE_RPC_URL` and other RPCs for YO read path
  - `OPENAI_API_KEY` only if you want live explanation generation

## Start locally

1. Copy `.env.example` to `.env`.
2. Fill required secrets.
3. Optionally replace [risk-dataset.json](../data/risk/risk-dataset.json).
4. Run:

```bash
docker-compose up --build
```

## Service URLs

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:8080](http://localhost:8080)
- Swagger UI: [http://localhost:8080/docs](http://localhost:8080/docs)

## Bootstrap sequence

The `bootstrap` service runs:

1. DB migrations
2. protocol alias seeding
3. risk dataset import
4. risk dataset verification

Only after that do `api` and `worker` start.

## Explanation modes

- `ENABLE_ASYNC_EXPLANATIONS=true`: API returns deterministic fallback or cached explanation immediately and enqueues richer text for the worker.
- `ENABLE_ASYNC_EXPLANATIONS=false`: API generates explanations inline.

## Manual dataset verification

Inside the API container:

```bash
pnpm --filter @whyyo/api risk:verify
pnpm --filter @whyyo/api risk:verify yield-optimizer-usd-base
```

Or via debug endpoints:

- `GET /api/v1/debug/risk/version`
- `GET /api/v1/debug/risk/pools?limit=20`
- `GET /api/v1/debug/risk/pools/:slug`
- `GET /api/v1/debug/risk/summary`
- `GET /api/v1/debug/matching/protocols?query=aave`
