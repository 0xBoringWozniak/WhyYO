# Risk Dataset

`risk-dataset.json` is the active local bootstrap file used by the API and worker startup scripts.

Expected top-level shape:

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

The importer also accepts a flat top-level array of pool rows and will automatically split it into `pools` and `yo_pools` using deterministic YO pool heuristics.

Startup flow:

1. `bootstrap-api.sh` runs migrations.
2. `import-risk-dataset.ts` validates and imports the JSON into Postgres.
3. `verify-risk-dataset.ts` can be run manually or in non-fatal debug mode.

To replace the dataset:

1. Replace `risk-dataset.json`.
2. Restart `docker-compose`.
3. The importer creates a new dataset version if the checksum changed.
