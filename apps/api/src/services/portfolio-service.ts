import {
  buildRankedRecommendations,
  computeBucketMetrics,
  inferBucketFromSymbol,
  matchCanonicalProtocol,
  normalizeChain,
} from "@whyyo/domain";
import type {
  BucketMetrics,
  CanonicalProtocolExposure,
  CanonicalTokenExposure,
  CanonicalUserPortfolio,
  CanonicalYoVault,
  ScanResponse,
} from "@whyyo/shared";
import { DUST_THRESHOLD_USD, defaultMethodologyResponse } from "@whyyo/shared";
import type { DebankUserBundle } from "@whyyo/integrations";

import { ProtocolRepository } from "../repositories/protocol-repository";
import { RiskDatasetService } from "./risk-dataset-service";

const CANONICAL_BUCKET_ORDER = ["USD", "ETH", "BTC", "OTHER"] as const;
const MIN_TOKEN_EXPOSURE_USD = DUST_THRESHOLD_USD;
const CORE_BUCKET_SYMBOLS: Record<string, Set<string>> = {
  USD: new Set(["USD", "USDC", "USDT", "USDS", "DAI", "USDE", "USDBC"]),
  ETH: new Set(["ETH", "WETH", "STETH", "WSTETH", "WEETH", "CBETH", "EETH"]),
  BTC: new Set(["BTC", "WBTC", "CBBTC", "TBTC", "SOLVBTC", "SOLVBTC.JUP"]),
  OTHER: new Set<string>(),
};

const getCoreBucketSymbols = (bucket: string): Set<string> => {
  const symbols = CORE_BUCKET_SYMBOLS[bucket];
  if (symbols) return symbols;
  return new Set<string>();
};

export class PortfolioService {
  constructor(
    private readonly riskDatasetService = new RiskDatasetService(),
    private readonly protocolRepository = new ProtocolRepository(),
  ) {}

  async buildScanResponse({
    scanId,
    walletAddress,
    debank,
    vaults,
    yoWarnings,
  }: {
    scanId: string;
    walletAddress: string;
    debank: DebankUserBundle;
    vaults: CanonicalYoVault[];
    yoWarnings: string[];
  }): Promise<ScanResponse> {
    const warnings = [...yoWarnings];
    const lookup = await this.riskDatasetService.getLookup();
    const protocolCatalog = await this.protocolRepository.listCatalog();
    const tokenExposures: CanonicalTokenExposure[] = debank.tokens
      .map((token) => ({
        chain: normalizeChain(token.chain),
        tokenAddress: token.id,
        logoUrl: token.logo_url ?? null,
        symbol: token.optimized_symbol ?? token.symbol,
        parentSymbol: token.symbol,
        bucket: inferBucketFromSymbol(token.optimized_symbol ?? token.symbol, token.symbol),
        usdValue: (token.price ?? 0) * token.amount,
        amount: token.amount,
        source: "debank" as const,
      }))
      .filter((token) => token.usdValue >= MIN_TOKEN_EXPOSURE_USD);

    const protocolExposures: CanonicalProtocolExposure[] = [];
    const protocolTokenIds = new Set<string>();

    for (const complex of debank.complexProtocols) {
      for (const item of complex.portfolio_item_list) {
        if (item.stats.net_usd_value < DUST_THRESHOLD_USD) {
          continue;
        }
        const supplyTokens = item.detail.supply_token_list ?? [];
        const borrowTokens = item.detail.borrow_token_list ?? [];
        const rewardTokens = item.detail.reward_token_list ?? [];
        const relatedTokens = [...supplyTokens, ...borrowTokens, ...rewardTokens];
        for (const token of relatedTokens) {
          protocolTokenIds.add(token.id);
        }
        const primaryTokens = supplyTokens.length > 0 ? supplyTokens : rewardTokens.length > 0 ? rewardTokens : borrowTokens;
        const symbol = primaryTokens[0]?.optimized_symbol ?? primaryTokens[0]?.symbol ?? complex.name;
        const parentSymbol = primaryTokens[0]?.symbol ?? symbol;
        const match = matchCanonicalProtocol({
          originalProtocolId: complex.id,
          originalProtocolName: complex.name,
          chain: complex.chain,
          title: item.name,
          symbol,
          parentSymbol,
          catalog: protocolCatalog,
        });
        const risk = this.riskDatasetService.findBestMatch(
          {
            protocolFamily: match.canonicalProtocolId,
            bucket: match.bucket,
            chain: normalizeChain(complex.chain),
          },
          lookup,
        );
        protocolExposures.push({
          canonicalProtocolId: match.canonicalProtocolId,
          canonicalProtocolName: match.canonicalProtocolName,
          originalProtocolId: complex.id,
          originalProtocolName: complex.name,
          logoUrl: complex.logo_url ?? null,
          chain: normalizeChain(complex.chain),
          bucket: match.bucket,
          strategyType: risk?.strategyType ?? match.strategyType,
          usdValue: item.stats.net_usd_value,
          riskGrade: risk?.riskGrade ?? "UNKNOWN",
          riskScore: risk?.riskNumeric ?? 3.5,
          assetSymbols: relatedTokens.map((token) => token.optimized_symbol ?? token.symbol),
          tokenAddresses: relatedTokens.map((token) => token.id),
          source: "debank",
          matchingConfidence: risk ? match.matchingConfidence : 0.5,
          metadata: {
            positionName: item.name,
            detailTypes: item.detail_types,
          },
        });
      }
    }

    const spotExposures = debank.tokens
      .map((token) => {
        const symbol = token.optimized_symbol ?? token.symbol;
        const bucket = inferBucketFromSymbol(symbol, token.symbol);
        const usdValue = (token.price ?? 0) * token.amount;
        return {
          token,
          symbol,
          bucket,
          usdValue,
        };
      })
      .filter(({ token, bucket, usdValue }) => {
        if (bucket === "OTHER" || usdValue < DUST_THRESHOLD_USD) return false;
        const normalizedSymbol = (token.symbol ?? token.optimized_symbol ?? "").toUpperCase();
        const normalizedOptimizedSymbol = (token.optimized_symbol ?? token.symbol ?? "").toUpperCase();
        const bucketSymbols = getCoreBucketSymbols(bucket);
        const isCoreBucketAsset =
          bucketSymbols.has(normalizedSymbol) || bucketSymbols.has(normalizedOptimizedSymbol);

        if (token.is_wallet === true || token.is_core === true) return true;
        if (!token.protocol_id) return true;
        if (protocolTokenIds.has(token.id)) return false;
        if (isCoreBucketAsset) return true;
        if (token.protocol_id) return false;
        return false;
      })
      .map<CanonicalProtocolExposure>(({ token, symbol, bucket, usdValue }) => ({
        canonicalProtocolId: "wallet",
        canonicalProtocolName: "Wallet",
        originalProtocolId: token.protocol_id ?? undefined,
        originalProtocolName: "Wallet",
        logoUrl: token.logo_url ?? null,
        chain: normalizeChain(token.chain),
        bucket,
        strategyType: "spot_idle",
        usdValue,
        riskGrade: "A",
        riskScore: 1,
        assetSymbols: [symbol],
        tokenAddresses: [token.id],
        source: "debank",
        matchingConfidence: 1,
        metadata: {
          isCore: token.is_core ?? false,
          isWallet: token.is_wallet ?? false,
        },
      }));

    protocolExposures.push(...spotExposures);

    const totalUsd = debank.totalBalance.total_usd_value;
    const analyzedUsd = protocolExposures.reduce((sum, exposure) => sum + exposure.usdValue, 0);
    const riskCoveredUsd = protocolExposures
      .filter((exposure) => exposure.riskGrade !== "UNKNOWN")
      .reduce((sum, exposure) => sum + exposure.usdValue, 0);
    const coveragePct = analyzedUsd > 0 ? riskCoveredUsd / analyzedUsd : 0;

    if (coveragePct < 0.6) {
      warnings.push("Public risk coverage is incomplete for a meaningful part of the portfolio.");
    }

    const bucketMetrics = Object.fromEntries(
      CANONICAL_BUCKET_ORDER.map((bucket) => [bucket, computeBucketMetrics(bucket, protocolExposures)]),
    ) as Record<(typeof CANONICAL_BUCKET_ORDER)[number], ReturnType<typeof computeBucketMetrics>>;

    const recommendations = buildRankedRecommendations({
      bucketMetrics,
      vaults,
      tokenExposures,
    });

    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => recommendation),
    );

    const portfolioOverview: CanonicalUserPortfolio = {
      ownerAddress: walletAddress.toLowerCase(),
      totalUsd,
      analyzedUsd,
      riskCoveredUsd,
      coveragePct: coveragePct * 100,
      tokenExposures,
      protocolExposures,
      bucketTotals: {
        USD: tokenExposures.filter((item) => item.bucket === "USD").reduce((sum, item) => sum + item.usdValue, 0),
        ETH: tokenExposures.filter((item) => item.bucket === "ETH").reduce((sum, item) => sum + item.usdValue, 0),
        BTC: tokenExposures.filter((item) => item.bucket === "BTC").reduce((sum, item) => sum + item.usdValue, 0),
        OTHER: tokenExposures.filter((item) => item.bucket === "OTHER").reduce((sum, item) => sum + item.usdValue, 0),
      },
      protocolCount: new Set(protocolExposures.map((item) => item.canonicalProtocolId)).size,
      positionCount: protocolExposures.length,
      chainCount: new Set(protocolExposures.map((item) => item.chain)).size,
      warnings,
    };

    return {
      scanId,
      status: warnings.length > 0 ? "partial" : "completed",
      portfolioOverview,
      bucketOverview: Object.values(bucketMetrics) as BucketMetrics[],
      recommendations: enrichedRecommendations,
      methodology: defaultMethodologyResponse,
      dataFreshness: {
        debankFetchedAt: new Date().toISOString(),
        yoFetchedAt: new Date().toISOString(),
        riskDatasetImportedAt: lookup.activeVersion?.imported_at ?? null,
      },
      warnings,
    };
  }
}
