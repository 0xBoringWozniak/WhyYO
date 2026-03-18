import type { PoolClient } from "pg";

import type { CanonicalBucket, CanonicalChain, RiskGrade, StrategyType } from "@whyyo/shared";

import { getDb } from "../db/pool";

export type RiskPoolRecord = {
  id: string;
  datasetVersionId: string;
  sourceKind: "pools" | "yo_pools";
  sourcePoolId: string;
  slug: string;
  title: string;
  protocolFamily: string;
  canonicalChain: CanonicalChain;
  rawBlockchainName: string;
  riskGrade: RiskGrade;
  riskNumeric: number;
  apyPercent: number | null;
  tvlUsd: number | null;
  bucket: CanonicalBucket;
  strategyType: StrategyType;
  primaryAssetSymbol: string | null;
  primaryParentSymbol: string | null;
  logicalPoolKey: string;
  rawJson: Record<string, unknown>;
  importedAt: string;
};

type RiskVersionRow = {
  id: string;
  version_label: string;
  checksum_sha256: string;
  imported_at: string;
  meta_jsonb: Record<string, unknown>;
};

type RiskPoolRow = {
  id: string;
  dataset_version_id: string;
  source_kind: "pools" | "yo_pools";
  source_pool_id: string;
  slug: string;
  title: string;
  protocol_family: string;
  canonical_chain: CanonicalChain;
  raw_blockchain_name: string;
  risk_grade: RiskGrade;
  risk_numeric: number;
  apy_percent: number | null;
  tvl_usd: number | null;
  bucket: CanonicalBucket;
  strategy_type: StrategyType;
  primary_asset_symbol: string | null;
  primary_parent_symbol: string | null;
  logical_pool_key: string;
  raw_jsonb: Record<string, unknown>;
  imported_at: string;
};

export class RiskRepository {
  async getActiveVersion(client?: PoolClient): Promise<RiskVersionRow | null> {
    const executor = client ?? getDb();
    const result = await executor.query<RiskVersionRow>(
      `SELECT id, version_label, checksum_sha256, imported_at, meta_jsonb
       FROM risk_dataset_versions
       WHERE is_active = TRUE
       ORDER BY imported_at DESC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  }

  async listActivePools(client?: PoolClient): Promise<RiskPoolRecord[]> {
    const executor = client ?? getDb();
    const version = await this.getActiveVersion(client);
    if (!version) return [];
    const result = await executor.query<RiskPoolRow>(
      `SELECT id, dataset_version_id, source_kind, source_pool_id, slug, title, protocol_family,
              canonical_chain, raw_blockchain_name, risk_grade, risk_numeric, apy_percent,
              tvl_usd, bucket, strategy_type, primary_asset_symbol, primary_parent_symbol,
              logical_pool_key, raw_jsonb, imported_at
       FROM risk_pools
       WHERE dataset_version_id = $1
       ORDER BY source_kind, slug ASC`,
      [version.id],
    );
    return result.rows.map((row) => ({
      id: row.id,
      datasetVersionId: row.dataset_version_id,
      sourceKind: row.source_kind,
      sourcePoolId: row.source_pool_id,
      slug: row.slug,
      title: row.title,
      protocolFamily: row.protocol_family,
      canonicalChain: row.canonical_chain,
      rawBlockchainName: row.raw_blockchain_name,
      riskGrade: row.risk_grade,
      riskNumeric: row.risk_numeric,
      apyPercent: row.apy_percent,
      tvlUsd: row.tvl_usd,
      bucket: row.bucket,
      strategyType: row.strategy_type,
      primaryAssetSymbol: row.primary_asset_symbol,
      primaryParentSymbol: row.primary_parent_symbol,
      logicalPoolKey: row.logical_pool_key,
      rawJson: row.raw_jsonb,
      importedAt: row.imported_at,
    }));
  }

  async searchPoolsBySlug(slug: string): Promise<RiskPoolRecord[]> {
    const result = await getDb().query<RiskPoolRow>(
      `SELECT id, dataset_version_id, source_kind, source_pool_id, slug, title, protocol_family,
              canonical_chain, raw_blockchain_name, risk_grade, risk_numeric, apy_percent,
              tvl_usd, bucket, strategy_type, primary_asset_symbol, primary_parent_symbol,
              logical_pool_key, raw_jsonb, imported_at
       FROM risk_pools
       WHERE slug = $1
       ORDER BY imported_at DESC`,
      [slug],
    );
    return result.rows.map((row) => ({
      id: row.id,
      datasetVersionId: row.dataset_version_id,
      sourceKind: row.source_kind,
      sourcePoolId: row.source_pool_id,
      slug: row.slug,
      title: row.title,
      protocolFamily: row.protocol_family,
      canonicalChain: row.canonical_chain,
      rawBlockchainName: row.raw_blockchain_name,
      riskGrade: row.risk_grade,
      riskNumeric: row.risk_numeric,
      apyPercent: row.apy_percent,
      tvlUsd: row.tvl_usd,
      bucket: row.bucket,
      strategyType: row.strategy_type,
      primaryAssetSymbol: row.primary_asset_symbol,
      primaryParentSymbol: row.primary_parent_symbol,
      logicalPoolKey: row.logical_pool_key,
      rawJson: row.raw_jsonb,
      importedAt: row.imported_at,
    }));
  }
}
