# WhyYO

<p align="center">
  <img src="./why_yo_logo.png" alt="WhyYO logo" width="220" />
</p>

WhyYO is a DeFi portfolio scanner and recommendation engine for YO vaults. It connects a wallet, normalizes positions from external providers, computes risk and concentration metrics across `USD` / `ETH` / `BTC` buckets, compares the current portfolio with available YO strategies, and highlights where allocation can be simplified or idle capital can be activated.

The recommendation engine is deterministic: metrics and decision rules are computed first, and explanation text is added on top afterward.

Key formulas:

$$
WRS_b = \sum_i \left(\frac{usd_i}{DIV_b}\right) \cdot risk_i
$$

$$
Coverage_b = 1 - URE_b
$$

$$
SPS_b = 100 \cdot (1 - Penalty_b)
$$

## Technical Overview

### Monorepo Layout

- `apps/web` - Next.js UI for wallet connection, scan results, and YO deposit flow
- `apps/api` - Fastify API for the scan pipeline, normalization, metrics, ranking, and persistence
- `apps/worker` - BullMQ worker for async explanations
- `packages/domain` - formulas, bucket metrics, and ranker logic
- `packages/shared` - shared schemas, types, and methodology contracts
- `packages/integrations` - external clients and integration adapters
- `data/risk` - local bootstrap dataset used for risk import

### Stack

- Node.js `>=22`
- `pnpm`
- Next.js 15, React 19
- Fastify
- Postgres 16
- Redis 7
- Docker Compose

### Quick Start

1. Copy `.env.example` to `.env`
2. Fill at least:
   - `DEBANK_ACCESS_KEY`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - `BASE_RPC_URL`
   - `OPENAI_API_KEY` only if you want live explanations
3. Start the stack:

```bash
docker-compose up --build
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:8080`
- Swagger: `http://localhost:8080/docs`

### Dev Commands

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm risk:import
pnpm risk:verify
pnpm db:migrate
```

### Bootstrap Flow

The `bootstrap` service:

1. waits for `postgres` and `redis`
2. runs database migrations
3. seeds canonical protocol aliases
4. imports `data/risk/risk-dataset.json`
5. runs verification in non-fatal mode

After that, `api` and `worker` start.

### Core API Endpoints

- `POST /api/v1/scan/start`
- `POST /api/v1/scan/refresh`
- `GET /api/v1/scan/:scanId`
- `GET /api/v1/system/health`
- `GET /api/v1/system/readiness`
- `GET /api/v1/methodology`

### Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/setup.md](docs/setup.md)
- [docs/api.md](docs/api.md)
- [docs/methodology.md](docs/methodology.md)
- [data/risk/README.md](data/risk/README.md)
