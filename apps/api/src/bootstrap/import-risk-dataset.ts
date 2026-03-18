import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Pool } from "pg";

import { inferBucketFromSymbol, inferStrategyType, normalizeChain, normalizeString, riskGradeToScore } from "@whyyo/domain";
import { normalizeRiskDatasetInput, riskDatasetSchema } from "@whyyo/integrations";
import type { StrategyType } from "@whyyo/shared";

import { getEnv } from "../config/env";
import { getDb } from "../db/pool";

export type RiskImportSummary = {
  checksum: string;
  datasetVersionId: string;
  rawPoolCount: number;
  yoPoolCount: number;
  uniqueProtocolFamilies: number;
  uniqueBlockchains: number;
  unknownBucketCount: number;
  duplicateSlugWarnings: string[];
  duplicateTitleWarnings: string[];
};

const resolveDatasetPath = (datasetPath: string): string =>
  path.isAbsolute(datasetPath) ? datasetPath : path.resolve(process.cwd(), datasetPath);

const inferProtocolFamily = (slug: string, title: string): string => {
  const normalized = normalizeString(`${slug} ${title}`);
  if (normalized.includes("aave")) return "aave";
  if (normalized.includes("morpho")) return "morpho";
  if (normalized.includes("uniswap")) return "uniswap";
  if (normalized.includes("lido")) return "lido";
  if (normalized.includes("rocket pool")) return "rocket_pool";
  if (normalized.includes("maple")) return "maple";
  if (normalized.includes("yield optimizer")) return "yo";
  return normalized.split(" ")[0] ?? "unknown";
};

const buildLogicalPoolKey = ({
  protocolFamily,
  canonicalChain,
  bucket,
  strategyType,
  primaryAssetSymbol,
}: {
  protocolFamily: string;
  canonicalChain: string;
  bucket: string;
  strategyType: StrategyType;
  primaryAssetSymbol: string | null;
}): string => `${protocolFamily}|${canonicalChain}|${bucket}|${strategyType}|${primaryAssetSymbol ?? "unknown"}`;

export const importRiskDataset = async (db: Pool = getDb()): Promise<RiskImportSummary> => {
  const env = getEnv();
  const datasetPath = resolveDatasetPath(env.RISK_DATASET_FILE);
  const raw = await readFile(datasetPath, "utf8");
  const checksum = createHash("sha256").update(raw).digest("hex");
  const parsed = normalizeRiskDatasetInput(riskDatasetSchema.parse(JSON.parse(raw)));
  const existing = await db.query<{ id: string }>(
    "SELECT id FROM risk_dataset_versions WHERE checksum_sha256 = $1 LIMIT 1",
    [checksum],
  );

  const duplicateSlugWarnings = new Set<string>();
  const duplicateTitleWarnings = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenTitles = new Set<string>();
  const uniqueProtocolFamilies = new Set<string>();
  const uniqueChains = new Set<string>();
  let unknownBucketCount = 0;

  for (const pool of [...parsed.data.pools, ...parsed.data.yo_pools]) {
    if (seenSlugs.has(pool.slug)) duplicateSlugWarnings.add(pool.slug);
    if (seenTitles.has(pool.title)) duplicateTitleWarnings.add(pool.title);
    seenSlugs.add(pool.slug);
    seenTitles.add(pool.title);
    uniqueProtocolFamilies.add(inferProtocolFamily(pool.slug, pool.title));
    uniqueChains.add(normalizeChain(pool.blockchain.name));
    const primaryAsset = pool.assets[0];
    if (inferBucketFromSymbol(primaryAsset?.symbol, primaryAsset?.parent_symbol) === "OTHER") {
      unknownBucketCount += 1;
    }
  }

  const client = await db.connect();
  let datasetVersionId = existing.rows[0]?.id;
  try {
    await client.query("BEGIN");

    if (!datasetVersionId) {
      const insertResult = await client.query<{ id: string }>(
        `INSERT INTO risk_dataset_versions
         (version_label, checksum_sha256, source_type, source_path, payload_jsonb, pools_count, yo_pools_count, meta_jsonb, is_active)
         VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, TRUE)
         RETURNING id`,
        [
          env.RISK_DATASET_VERSION,
          checksum,
          datasetPath,
          JSON.stringify(parsed),
          parsed.data.pools.length,
          parsed.data.yo_pools.length,
          JSON.stringify({
            total_count: parsed.data.total_count,
            count: parsed.data.count,
          }),
        ],
      );
      datasetVersionId = insertResult.rows[0]?.id;
      if (!datasetVersionId) {
        throw new Error("Failed to create risk dataset version");
      }
    } else {
      await client.query(
        `UPDATE risk_dataset_versions
         SET version_label = $2,
             source_path = $3,
             payload_jsonb = $4,
             pools_count = $5,
             yo_pools_count = $6,
             meta_jsonb = $7
         WHERE id = $1`,
        [
          datasetVersionId,
          env.RISK_DATASET_VERSION,
          datasetPath,
          JSON.stringify(parsed),
          parsed.data.pools.length,
          parsed.data.yo_pools.length,
          JSON.stringify({
            total_count: parsed.data.total_count,
            count: parsed.data.count,
          }),
        ],
      );
    }

    await client.query("UPDATE risk_dataset_versions SET is_active = FALSE");
    await client.query("UPDATE risk_dataset_versions SET is_active = TRUE WHERE id = $1", [datasetVersionId]);

    await client.query(
      "DELETE FROM risk_pool_assets WHERE pool_id IN (SELECT id FROM risk_pools WHERE dataset_version_id = $1)",
      [datasetVersionId],
    );
    await client.query("DELETE FROM risk_blockchains WHERE dataset_version_id = $1", [datasetVersionId]);
    await client.query("DELETE FROM risk_pools WHERE dataset_version_id = $1", [datasetVersionId]);

    const blockchainRows = new Map<
      string,
      { id: string; name: string; canonicalChain: string; imageUrl: string | null; rawJson: unknown }
    >();

    for (const pool of [...parsed.data.pools, ...parsed.data.yo_pools]) {
      if (!blockchainRows.has(pool.blockchain.id)) {
        blockchainRows.set(pool.blockchain.id, {
          id: pool.blockchain.id,
          name: pool.blockchain.name,
          canonicalChain: normalizeChain(pool.blockchain.name),
          imageUrl: pool.blockchain.image_url ?? null,
          rawJson: pool.blockchain,
        });
      }
    }

    for (const blockchain of blockchainRows.values()) {
      await client.query(
        `INSERT INTO risk_blockchains
         (dataset_version_id, source_blockchain_id, raw_name, canonical_chain, image_url, raw_jsonb)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (dataset_version_id, source_blockchain_id)
         DO UPDATE SET raw_name = EXCLUDED.raw_name,
                       canonical_chain = EXCLUDED.canonical_chain,
                       image_url = EXCLUDED.image_url,
                       raw_jsonb = EXCLUDED.raw_jsonb`,
        [
          datasetVersionId,
          blockchain.id,
          blockchain.name,
          blockchain.canonicalChain,
          blockchain.imageUrl,
          JSON.stringify(blockchain.rawJson),
        ],
      );
    }

    for (const [sourceKind, pools] of [
      ["pools", parsed.data.pools],
      ["yo_pools", parsed.data.yo_pools],
    ] as const) {
      for (const pool of pools) {
        const primaryAsset = pool.assets[0];
        const bucket = inferBucketFromSymbol(primaryAsset?.symbol, primaryAsset?.parent_symbol);
        const strategyType = inferStrategyType(pool.title, pool.slug, bucket);
        const protocolFamily = inferProtocolFamily(pool.slug, pool.title);
        const canonicalChain = normalizeChain(pool.blockchain.name);
        const logicalPoolKey = buildLogicalPoolKey({
          protocolFamily,
          canonicalChain,
          bucket,
          strategyType,
          primaryAssetSymbol: primaryAsset?.symbol ?? null,
        });

        const poolInsert = await client.query<{ id: string }>(
          `INSERT INTO risk_pools
           (dataset_version_id, source_kind, source_pool_id, slug, title, protocol_family, canonical_chain,
            raw_blockchain_name, risk_grade, risk_numeric, apy_percent, tvl_usd, bucket, strategy_type,
            primary_asset_symbol, primary_parent_symbol, logical_pool_key, raw_jsonb)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING id`,
          [
            datasetVersionId,
            sourceKind,
            pool.id,
            pool.slug,
            pool.title,
            protocolFamily,
            canonicalChain,
            pool.blockchain.name,
            pool.risk,
            riskGradeToScore(pool.risk),
            Number(pool.yield),
            Number(pool.tvl),
            bucket,
            strategyType,
            primaryAsset?.symbol ?? null,
            primaryAsset?.parent_symbol ?? null,
            logicalPoolKey,
            JSON.stringify(pool),
          ],
        );
        const poolId = poolInsert.rows[0]?.id;
        if (!poolId) {
          throw new Error(`Failed to create risk pool for ${pool.slug}`);
        }

        const seenAssetIds = new Set<string>();
        for (const asset of pool.assets) {
          if (seenAssetIds.has(asset.id)) {
            continue;
          }
          seenAssetIds.add(asset.id);
          await client.query(
            `INSERT INTO risk_pool_assets
             (pool_id, source_asset_id, symbol, parent_symbol, asset_funding_group_id, raw_jsonb)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (pool_id, source_asset_id)
             DO UPDATE SET symbol = EXCLUDED.symbol,
                           parent_symbol = EXCLUDED.parent_symbol,
                           asset_funding_group_id = EXCLUDED.asset_funding_group_id,
                           raw_jsonb = EXCLUDED.raw_jsonb`,
            [
              poolId,
              asset.id,
              asset.symbol,
              asset.parent_symbol,
              asset.asset_funding_group_id,
              JSON.stringify(asset),
            ],
          );
        }
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    checksum,
    datasetVersionId: datasetVersionId!,
    rawPoolCount: parsed.data.pools.length,
    yoPoolCount: parsed.data.yo_pools.length,
    uniqueProtocolFamilies: uniqueProtocolFamilies.size,
    uniqueBlockchains: uniqueChains.size,
    unknownBucketCount,
    duplicateSlugWarnings: [...duplicateSlugWarnings],
    duplicateTitleWarnings: [...duplicateTitleWarnings],
  };
};
