# API

## `POST /api/v1/scan/start`

Request:

```json
{
  "walletAddress": "0x..."
}
```

Response fields:

- `scanId`
- `status`
- `portfolioOverview`
- `bucketOverview`
- `recommendations`
- `methodology`
- `dataFreshness`
- `warnings`

## `POST /api/v1/scan/refresh`

Starts a new scan for the same wallet and persists it as a new session.

## `GET /api/v1/scan/:scanId`

Returns the persisted scan payload for a previous session.

## `GET /api/v1/system/health`

Simple liveness check.

## `GET /api/v1/system/readiness`

Checks:

- Postgres
- Redis
- active risk dataset version

## `GET /api/v1/methodology`

Machine-readable formulas, thresholds, and defaults used by the deterministic engine.

## Debug endpoints

Debug endpoints are controlled by `ENABLE_DEBUG_ENDPOINTS=true`.
