import type { CanonicalBucket, CanonicalChain, RiskGrade, StrategyType } from "@whyyo/shared";
import { buildProtocolFamilyKeys, toProtocolFamilyKey } from "@whyyo/domain";

import { RiskRepository, type RiskPoolRecord } from "../repositories/risk-repository";

export type RiskLookup = {
  byLogicalKey: Map<string, RiskPoolRecord>;
  bySlug: Map<string, RiskPoolRecord[]>;
  byProtocolBucketChain: Map<string, RiskPoolRecord>;
  activeVersion: Awaited<ReturnType<RiskRepository["getActiveVersion"]>>;
  pools: RiskPoolRecord[];
};

export class RiskDatasetService {
  constructor(private readonly repository = new RiskRepository()) {}

  async getLookup(): Promise<RiskLookup> {
    const activeVersion = await this.repository.getActiveVersion();
    const pools = await this.repository.listActivePools();
    const byLogicalKey = new Map<string, RiskPoolRecord>();
    const bySlug = new Map<string, RiskPoolRecord[]>();
    const byProtocolBucketChain = new Map<string, RiskPoolRecord>();

    for (const pool of pools) {
      byLogicalKey.set(pool.logicalPoolKey, pool);
      const familyAliases = buildProtocolFamilyKeys(pool.protocolFamily, pool.slug, pool.title);
      for (const alias of familyAliases) {
        const key = `${alias}|${pool.bucket}|${pool.canonicalChain}`;
        const current = byProtocolBucketChain.get(key);
        if (!current || (pool.tvlUsd ?? 0) > (current.tvlUsd ?? 0)) {
          byProtocolBucketChain.set(key, pool);
        }
      }
      const slugPools = bySlug.get(pool.slug) ?? [];
      slugPools.push(pool);
      bySlug.set(pool.slug, slugPools);
    }

    return { byLogicalKey, bySlug, byProtocolBucketChain, activeVersion, pools };
  }

  findBestMatch({
    protocolFamily,
    bucket,
    chain,
  }: {
    protocolFamily: string;
    bucket: CanonicalBucket;
    chain: CanonicalChain;
  }, lookup: RiskLookup): RiskPoolRecord | null {
    const familyAliases = buildProtocolFamilyKeys(protocolFamily);
    const normalizedFamily = toProtocolFamilyKey(protocolFamily);

    for (const familyAlias of familyAliases.length > 0 ? familyAliases : [normalizedFamily]) {
      const exact =
        lookup.byProtocolBucketChain.get(`${familyAlias}|${bucket}|${chain}`) ??
        lookup.byProtocolBucketChain.get(`${familyAlias}|${bucket}|other`);
      if (exact) return exact;
    }

    return (
      lookup.byProtocolBucketChain.get(`${normalizedFamily}|${bucket}|${chain}`) ??
      lookup.byProtocolBucketChain.get(`${normalizedFamily}|${bucket}|other`) ??
      null
    );
  }

  summarizePool(pool: RiskPoolRecord): {
    riskGrade: RiskGrade;
    riskScore: number;
    strategyType: StrategyType;
    bucket: CanonicalBucket;
  } {
    return {
      riskGrade: pool.riskGrade,
      riskScore: pool.riskNumeric,
      strategyType: pool.strategyType,
      bucket: pool.bucket,
    };
  }
}
