# Risk Dataset

`risk-dataset.json` is the local bootstrap file that the API imports into Postgres during environment startup.

## Supported Formats

The importer accepts:

1. a wrapped object shaped like this

```json
{
  "code": "1",
  "error": null,
  "data": {
    "pools": [],
    "yo_pools": [],
    "total_count": 0,
    "count": 0
  }
}
```

2. or a flat top-level array of pool rows

In the second case, the importer deterministically splits rows into `pools` and `yo_pools`.

## How It Is Used

During `docker-compose up --build`, the bootstrap flow does the following:

1. runs database migrations
2. seeds dev aliases for canonical protocols
3. runs `risk:import`
4. runs `risk:verify` in non-fatal mode

The default active path is configured through:

```env
RISK_DATASET_SOURCE=file
RISK_DATASET_FILE=/app/data/risk/risk-dataset.json
RISK_DATASET_IMPORT_ON_BOOT=true
```

After import, the data is stored in:

- `risk_dataset_versions`
- `risk_pools`
- `risk_pool_assets`
- `risk_blockchains`

At runtime, the API reads the imported and normalized data from Postgres rather than from the raw JSON file directly.

## Updating the Dataset

1. Replace `risk-dataset.json`
2. Restart the stack or run `pnpm risk:import` manually
3. Validate the result with `pnpm risk:verify`

If the checksum changed, the importer creates a new dataset version.
