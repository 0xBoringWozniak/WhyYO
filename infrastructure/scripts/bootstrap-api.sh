#!/bin/sh
set -eu

./infrastructure/scripts/wait-for-deps.sh postgres 5432
./infrastructure/scripts/wait-for-deps.sh redis 6379

pnpm --filter @whyyo/api migrate
pnpm --filter @whyyo/api seed:aliases

if [ "${RISK_DATASET_IMPORT_ON_BOOT:-true}" = "true" ]; then
  pnpm --filter @whyyo/api risk:import
  pnpm --filter @whyyo/api risk:verify || true
fi

if [ "${BOOTSTRAP_ONLY:-false}" = "true" ]; then
  exit 0
fi

exec pnpm --filter @whyyo/api start
