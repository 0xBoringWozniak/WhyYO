import type { CanonicalProtocolExposure, CanonicalYoVault } from "@whyyo/shared";

import { computeBucketMetrics, inferBucketFromSymbol, matchCanonicalProtocol, normalizeChain, riskGradeToScore } from "@whyyo/domain";

import { getRedis } from "../db/redis";
import { ProtocolRepository } from "../repositories/protocol-repository";
import { RiskRepository } from "../repositories/risk-repository";
import { withRedisCache } from "../utils/cache";
import { RiskDatasetService } from "./risk-dataset-service";

type YoYield = {
  "1d": string | null;
  "7d": string | null;
  "30d": string | null;
};

type YoFormattedValue = {
  raw: string | number;
  formatted: string;
};

type YoProtocolStat = {
  pool: string;
  protocol: string;
  allocation: YoFormattedValue;
  tvlUsd?: YoFormattedValue;
};

type YoVaultStats = {
  id: string;
  name: string;
  type?: string;
  chain: {
    id: number;
    name: string;
  };
  contracts: {
    vaultAddress: string;
  };
  tvl: YoFormattedValue;
  yield: YoYield;
};

type YoVaultSnapshot = {
  protocols?: YoSnapshotProtocol[];
  secondaryVaults?: YoSecondaryVault[];
  chain?: {
    id: number;
    name: string;
  };
  stats: {
    protocolStats?: YoProtocolStat[];
  };
};

type YoSnapshotProtocol = {
  name: string;
  protocol: string;
  network?: string;
  risk?: string;
};

type YoSecondaryVault = {
  chain?: {
    id: number;
    name: string;
  };
};

type YoAllocationTimeseriesPoint = {
  timestamp: number;
  protocols: Record<string, string>;
};

type RuntimeYoClient = {
  getVaults: (options?: { secondary?: boolean }) => Promise<YoVaultStats[]>;
  getVaultSnapshot: (vaultAddress: string) => Promise<YoVaultSnapshot>;
  getVaultAllocationsTimeSeries: (vaultAddress: string) => Promise<YoAllocationTimeseriesPoint[]>;
};

type RuntimeYoModule = {
  createYoClient: (config: { chainId: number }) => RuntimeYoClient;
  getVaultByAddress?: (address: string) => { symbol?: string; name?: string } | undefined;
  VAULTS?: Record<
    string,
    {
      address: string;
      name: string;
      symbol: string;
      network: string;
      underlying: {
        symbol: string;
        decimals: number;
        address: Record<string, string>;
      };
      chains: readonly number[];
    }
  >;
};

const CHAIN_ID_TO_NAME: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
};

const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
};

const YO_TARGET_VAULTS = new Set(["yoUSD", "yoETH", "yoBTC"]);

const parseNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFormattedValue = (value: YoFormattedValue | undefined): number => {
  if (!value) return 0;
  const parsedFormatted = parseNumber(value.formatted);
  if (parsedFormatted > 0) return parsedFormatted;
  return parseNumber(value.raw);
};

const mapYoRiskLabelToGrade = (value?: string | null): "A" | "B" | "C" | "D" | "UNKNOWN" => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "UNKNOWN";

  if (normalized === "lowest" || normalized === "very low") return "A";
  if (normalized === "low") return "B";
  if (normalized === "moderate" || normalized === "medium") return "C";
  if (normalized === "high" || normalized === "very high") return "D";
  if (normalized === "unknown" || normalized === "-") return "UNKNOWN";

  return "UNKNOWN";
};

const extractApyPct = (yieldWindow?: YoYield): number => {
  if (!yieldWindow) return 0;
  return parseNumber(yieldWindow["30d"] ?? yieldWindow["7d"] ?? yieldWindow["1d"]);
};

const normalizeAllocationWeights = (weights: number[]): number[] => {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  const normalizedTotal = total > 1.25 ? total / 100 : total;
  return weights.map((value) => (total > 1.25 ? value / 100 : value) / normalizedTotal);
};

const dedupeVaultsByAddress = (vaults: CanonicalYoVault[]): CanonicalYoVault[] => {
  const bestByAddress = new Map<string, CanonicalYoVault>();

  for (const vault of vaults) {
    const key = vault.vaultAddress.toLowerCase();
    const existing = bestByAddress.get(key);
    if (!existing) {
      bestByAddress.set(key, vault);
      continue;
    }

    const existingScore = existing.tvlUsd + existing.allocation.length;
    const nextScore = vault.tvlUsd + vault.allocation.length;
    if (nextScore > existingScore) {
      bestByAddress.set(key, vault);
    }
  }

  return [...bestByAddress.values()];
};

export class YoVaultReadService {
  constructor(
    private readonly riskRepository = new RiskRepository(),
    private readonly riskDatasetService = new RiskDatasetService(),
    private readonly protocolRepository = new ProtocolRepository(),
  ) {}

  private async buildAllocationFromSnapshot({
    protocolStats,
    snapshotProtocols,
    fallbackTimeseries,
    defaultChain,
    bucket,
    tvlUsd,
    protocolCatalog,
    lookup,
  }: {
    protocolStats: YoProtocolStat[] | undefined;
    snapshotProtocols: YoSnapshotProtocol[] | undefined;
    fallbackTimeseries: YoAllocationTimeseriesPoint[];
    defaultChain: string;
    bucket: CanonicalYoVault["bucket"];
    tvlUsd: number;
    protocolCatalog: Awaited<ReturnType<ProtocolRepository["listCatalog"]>>;
    lookup: Awaited<ReturnType<RiskDatasetService["getLookup"]>>;
  }): Promise<CanonicalProtocolExposure[]> {
    const snapshotProtocolStats = protocolStats ?? [];
    const protocolMetaByName = new Map((snapshotProtocols ?? []).map((item) => [item.name, item]));

    if (snapshotProtocolStats.length > 0) {
      const allocationWeights = normalizeAllocationWeights(
        snapshotProtocolStats.map((item) => parseNumber(item.allocation.raw)),
      );
      const canUseAllocationWeights = allocationWeights.length === snapshotProtocolStats.length && allocationWeights.length > 0;
      const fallbackUsd = snapshotProtocolStats.map((item) => parseFormattedValue(item.tvlUsd));
      const fallbackUsdTotal = fallbackUsd.reduce((sum, value) => sum + value, 0);
      const fallbackWeights = fallbackUsdTotal > 0 ? fallbackUsd.map((value) => value / fallbackUsdTotal) : [];
      const weights = canUseAllocationWeights ? allocationWeights : fallbackWeights;
      const usdValues = weights.map((weight) => weight * tvlUsd);

      return snapshotProtocolStats.map((item, index) => {
        const protocolMeta = protocolMetaByName.get(item.pool);
        const protocolName = item.protocol || item.pool || `YO Allocation ${index + 1}`;
        const chainName = normalizeChain(protocolMeta?.network ?? defaultChain);
        const yoRiskGrade = mapYoRiskLabelToGrade(protocolMeta?.risk);
        const match = matchCanonicalProtocol({
          originalProtocolName: protocolName,
          title: item.pool,
          chain: chainName,
          symbol: bucket,
          parentSymbol: bucket,
          catalog: protocolCatalog,
        });
        const risk = this.riskDatasetService.findBestMatch(
          {
            protocolFamily: match.canonicalProtocolId,
            bucket,
            chain: chainName,
          },
          lookup,
        );
        const resolvedRiskGrade = risk?.riskGrade ?? yoRiskGrade;
        const resolvedRiskScore = risk?.riskNumeric ?? riskGradeToScore(resolvedRiskGrade);

        return {
          canonicalProtocolId: risk?.protocolFamily ?? match.canonicalProtocolId,
          canonicalProtocolName: risk?.title ?? match.canonicalProtocolName,
          originalProtocolName: protocolName,
          chain: chainName,
          bucket,
          strategyType: risk?.strategyType ?? match.strategyType,
          usdValue: usdValues[index] ?? 0,
          weight: tvlUsd > 0 ? (usdValues[index] ?? 0) / tvlUsd : undefined,
          riskGrade: resolvedRiskGrade,
          riskScore: resolvedRiskScore,
          assetSymbols: [bucket],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: risk ? match.matchingConfidence : resolvedRiskGrade !== "UNKNOWN" ? 0.82 : 0.7,
          metadata: {
            allocationFormatted: item.allocation.formatted,
            pool: item.pool,
            yoRiskLabel: protocolMeta?.risk ?? null,
          },
        };
      });
    }

    const latestPoint = [...fallbackTimeseries].sort((left, right) => right.timestamp - left.timestamp)[0];
    if (!latestPoint) return [];
    const entries = Object.entries(latestPoint.protocols ?? {});
    const weights = normalizeAllocationWeights(entries.map(([, value]) => parseNumber(value)));

    return entries.map(([protocolName, rawWeight], index) => {
      const protocolMeta = protocolMetaByName.get(protocolName);
      const chainName = normalizeChain(protocolMeta?.network ?? defaultChain);
      const yoRiskGrade = mapYoRiskLabelToGrade(protocolMeta?.risk);
      const match = matchCanonicalProtocol({
        originalProtocolName: protocolName,
        chain: chainName,
        symbol: bucket,
        parentSymbol: bucket,
        catalog: protocolCatalog,
      });
      const risk = this.riskDatasetService.findBestMatch(
        {
          protocolFamily: match.canonicalProtocolId,
          bucket,
          chain: chainName,
        },
        lookup,
      );
      const weight = weights[index] ?? 0;
      const resolvedRiskGrade = risk?.riskGrade ?? yoRiskGrade;
      const resolvedRiskScore = risk?.riskNumeric ?? riskGradeToScore(resolvedRiskGrade);

      return {
        canonicalProtocolId: risk?.protocolFamily ?? match.canonicalProtocolId,
        canonicalProtocolName: risk?.title ?? match.canonicalProtocolName,
        originalProtocolName: protocolName,
        chain: chainName,
        bucket,
        strategyType: risk?.strategyType ?? match.strategyType,
        usdValue: weight * tvlUsd,
        weight,
        riskGrade: resolvedRiskGrade,
        riskScore: resolvedRiskScore,
        assetSymbols: [bucket],
        tokenAddresses: [],
        source: "yo",
        matchingConfidence: risk ? match.matchingConfidence : resolvedRiskGrade !== "UNKNOWN" ? 0.78 : 0.65,
        metadata: {
          allocationRaw: rawWeight,
          timestamp: latestPoint.timestamp,
          yoRiskLabel: protocolMeta?.risk ?? null,
        },
      };
    });
  }

  private async loadSdkVaults(): Promise<CanonicalYoVault[]> {
    const runtimeModule = (await import("@yo-protocol/core")) as unknown as RuntimeYoModule;
    if (typeof runtimeModule.createYoClient !== "function") {
      throw new Error("YO SDK createYoClient export is unavailable");
    }

    const lookup = await this.riskDatasetService.getLookup();
    const protocolCatalog = await this.protocolRepository.listCatalog();
    const vaults: CanonicalYoVault[] = [];
    const registryVaults = Object.values(runtimeModule.VAULTS ?? {}).filter((vault) => YO_TARGET_VAULTS.has(vault.symbol));
    const clientsByChainId = new Map<number, RuntimeYoClient>();

    for (const registryVault of registryVaults) {
      const vaultAddress = registryVault.address;
      const vaultMeta = runtimeModule.getVaultByAddress?.(vaultAddress);
      const vaultSymbol = vaultMeta?.symbol ?? registryVault.symbol;
      const bucket = inferBucketFromSymbol(vaultSymbol, registryVault.underlying.symbol);
      const preferredChainId = NETWORK_TO_CHAIN_ID[registryVault.network] ?? registryVault.chains[0] ?? 8453;
      const client = clientsByChainId.get(preferredChainId) ?? runtimeModule.createYoClient({ chainId: preferredChainId });
      clientsByChainId.set(preferredChainId, client);

      const rawVaults = await client.getVaults();
      const rawVault = rawVaults.find(
        (candidate) => candidate.contracts?.vaultAddress?.toLowerCase() === vaultAddress.toLowerCase(),
      );
      if (!rawVault) continue;

      const snapshot = await client.getVaultSnapshot(vaultAddress);
      const allocationTimeseries = await client.getVaultAllocationsTimeSeries(vaultAddress);
      const chain = normalizeChain(
        registryVault.network ??
          rawVault.chain?.name ??
          snapshot.chain?.name ??
          CHAIN_ID_TO_NAME[preferredChainId] ??
          "base",
      );
      const tvlUsd = parseFormattedValue(rawVault.tvl);
      const allocation = await this.buildAllocationFromSnapshot({
        protocolStats: snapshot.stats.protocolStats,
        snapshotProtocols: snapshot.protocols,
        fallbackTimeseries: allocationTimeseries,
        defaultChain: chain,
        bucket,
        tvlUsd,
        protocolCatalog,
        lookup,
      });
      const sourceChains = [
        ...new Set(
          [
            ...((snapshot.protocols ?? []).map((item) => normalizeChain(item.network ?? ""))),
            ...((snapshot.secondaryVaults ?? []).map((item) => normalizeChain(item.chain?.name ?? ""))),
            ...registryVault.chains.map((chainId) => normalizeChain(CHAIN_ID_TO_NAME[chainId] ?? "")),
          ].filter(Boolean),
        ),
      ];

      vaults.push({
        vaultId: rawVault.id ?? vaultAddress,
        vaultSymbol: vaultSymbol as CanonicalYoVault["vaultSymbol"],
        vaultAddress,
        chain,
        bucket,
        tvlUsd,
        apyPct: extractApyPct(rawVault.yield),
        riskGrade: "B",
        riskScore: riskGradeToScore("B"),
        allocation,
        metadata: {
          allocationMetrics: computeBucketMetrics(bucket, allocation),
          registryUnderlyingSymbol: registryVault.underlying.symbol,
          registryChains: registryVault.chains,
          sourceChains,
        },
      });
    }

    const dedupedVaults = dedupeVaultsByAddress(vaults);

    if (dedupedVaults.length === 0) {
      throw new Error("YO SDK returned no supported vaults");
    }

    return dedupedVaults;
  }

  private async loadFallbackFromRiskDataset(): Promise<CanonicalYoVault[]> {
    const pools = (await this.riskRepository.listActivePools()).filter((pool) => pool.sourceKind === "yo_pools");
    return pools.map((pool) => ({
      vaultId: pool.sourcePoolId,
      vaultSymbol: pool.primaryAssetSymbol as CanonicalYoVault["vaultSymbol"],
      vaultAddress: (pool.rawJson.address as string | undefined) ?? "0x0000000000000000000000000000000000000000",
      chain: pool.canonicalChain,
      bucket: pool.bucket,
      tvlUsd: pool.tvlUsd ?? 0,
      apyPct: pool.apyPercent ?? 0,
      riskGrade: pool.riskGrade,
      riskScore: pool.riskNumeric,
      allocation: [
        {
          canonicalProtocolId: pool.protocolFamily,
          canonicalProtocolName: pool.title,
          chain: pool.canonicalChain,
          bucket: pool.bucket,
          strategyType: pool.strategyType,
          usdValue: 1,
          riskGrade: pool.riskGrade,
          riskScore: pool.riskNumeric,
          assetSymbols: [pool.primaryAssetSymbol ?? pool.title],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.75,
        },
      ],
      metadata: { degradedMode: true, source: "risk-dataset-fallback" },
    }));
  }

  async listVaults(): Promise<{ vaults: CanonicalYoVault[]; warnings: string[] }> {
    const redis = getRedis();
    try {
      const vaults = await withRedisCache({
        redis,
        key: "yo:vaults:active",
        ttlSec: 45,
        load: async () => this.loadSdkVaults(),
      });
      return { vaults, warnings: [] };
    } catch (error) {
      const fallbackVaults = await this.loadFallbackFromRiskDataset();
      return {
        vaults: fallbackVaults,
        warnings: [`YO SDK degraded: ${(error as Error).message}. Using risk dataset fallback for read path.`],
      };
    }
  }
}
