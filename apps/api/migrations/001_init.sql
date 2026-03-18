CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS canonical_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  strategy_type_default TEXT NOT NULL,
  bucket_hints_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocol_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_protocol_id UUID NOT NULL REFERENCES canonical_protocols(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  chain_nullable TEXT NOT NULL DEFAULT '',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alias, chain_nullable)
);

CREATE TABLE IF NOT EXISTS risk_dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  payload_jsonb JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pools_count INTEGER NOT NULL DEFAULT 0,
  yo_pools_count INTEGER NOT NULL DEFAULT 0,
  meta_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS risk_blockchains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id UUID NOT NULL REFERENCES risk_dataset_versions(id) ON DELETE CASCADE,
  source_blockchain_id TEXT NOT NULL,
  raw_name TEXT NOT NULL,
  canonical_chain TEXT NOT NULL,
  image_url TEXT NULL,
  raw_jsonb JSONB NOT NULL,
  UNIQUE (dataset_version_id, source_blockchain_id)
);

CREATE TABLE IF NOT EXISTS risk_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id UUID NOT NULL REFERENCES risk_dataset_versions(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_pool_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  protocol_family TEXT NOT NULL,
  canonical_chain TEXT NOT NULL,
  raw_blockchain_name TEXT NOT NULL,
  risk_grade TEXT NOT NULL,
  risk_numeric DOUBLE PRECISION NOT NULL,
  apy_percent DOUBLE PRECISION NULL,
  tvl_usd DOUBLE PRECISION NULL,
  bucket TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  primary_asset_symbol TEXT NULL,
  primary_parent_symbol TEXT NULL,
  logical_pool_key TEXT NOT NULL,
  raw_jsonb JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_version_id, source_kind, source_pool_id)
);

CREATE TABLE IF NOT EXISTS risk_pool_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES risk_pools(id) ON DELETE CASCADE,
  source_asset_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  parent_symbol TEXT NULL,
  asset_funding_group_id TEXT NULL,
  raw_jsonb JSONB NOT NULL,
  UNIQUE (pool_id, source_asset_id)
);

CREATE TABLE IF NOT EXISTS scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  total_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  analyzed_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  coverage_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_bucket_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  total_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  weighted_risk DOUBLE PRECISION NULL,
  high_risk_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  unknown_risk_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_score DOUBLE PRECISION NULL,
  positions_count INTEGER NOT NULL DEFAULT 0,
  protocol_count INTEGER NOT NULL DEFAULT 0,
  chain_count INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scan_id, bucket)
);

CREATE TABLE IF NOT EXISTS scan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  vault_symbol TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  strength TEXT NOT NULL,
  confidence TEXT NOT NULL,
  suggested_usd DOUBLE PRECISION NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS explanation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS external_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  key TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  subject_id TEXT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocol_aliases_alias ON protocol_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_risk_dataset_versions_active ON risk_dataset_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_risk_pools_dataset_version ON risk_pools(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_risk_pools_slug ON risk_pools(slug);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_wallet_created ON scan_sessions(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_recommendations_scan ON scan_recommendations(scan_id);
CREATE INDEX IF NOT EXISTS idx_explanation_cache_hash_expiry ON explanation_cache(input_hash, expires_at);
