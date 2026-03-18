import { describe, expect, it } from "vitest";

import type { CanonicalYoVault } from "@whyyo/shared";

import { computeBucketMetrics } from "./metrics";
import { buildRankedRecommendations, buildRecommendation } from "./ranker";

describe("ranker", () => {
  it("produces a positive recommendation when YO improves bucket risk", () => {
    const userMetrics = computeBucketMetrics("USD", [
      {
        canonicalProtocolId: "maple",
        canonicalProtocolName: "Maple",
        chain: "ethereum",
        bucket: "USD",
        strategyType: "synthetic_yield",
        usdValue: 2000,
        riskGrade: "C",
        riskScore: 3,
        assetSymbols: ["USDC"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 0.9,
      },
    ]);

    const vault: CanonicalYoVault = {
      vaultId: "yo-usd",
      vaultSymbol: "yoUSD",
      vaultAddress: "0x0000000000000000000000000000000000000001",
      chain: "base",
      bucket: "USD",
      tvlUsd: 1000000,
      apyPct: 10,
      riskGrade: "B",
      riskScore: 2,
      allocation: [
        {
          canonicalProtocolId: "aave",
          canonicalProtocolName: "Aave",
          chain: "base",
          bucket: "USD",
          strategyType: "lending",
          usdValue: 1,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["USDC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
      ],
    };

    const recommendation = buildRecommendation({
      userMetrics,
      vault,
      vaultMetrics: computeBucketMetrics("USD", vault.allocation),
    });

    expect(recommendation.score).toBeGreaterThan(0);
    expect(recommendation.strength).not.toBe("none");
    expect(recommendation.primaryIntent).toBe("risk_improvement");
    expect(recommendation.actionability).not.toBe("suppressed");
    expect(recommendation.reasonCodes).toContain("LOWER_WEIGHTED_RISK");
  });

  it("treats a concentrated productive bucket as diversification improvement", () => {
    const userMetrics = computeBucketMetrics("BTC", [
      {
        canonicalProtocolId: "solv",
        canonicalProtocolName: "Solv",
        chain: "other",
        bucket: "BTC",
        strategyType: "unknown",
        usdValue: 5000,
        riskGrade: "UNKNOWN",
        riskScore: 3.5,
        assetSymbols: ["WBTC"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 0.6,
      },
    ]);

    const vault: CanonicalYoVault = {
      vaultId: "yo-btc",
      vaultSymbol: "yoBTC",
      vaultAddress: "0x0000000000000000000000000000000000000003",
      chain: "base",
      bucket: "BTC",
      tvlUsd: 250000,
      apyPct: 4.2,
      riskGrade: "B",
      riskScore: 2,
      allocation: [
        {
          canonicalProtocolId: "aave",
          canonicalProtocolName: "Aave",
          chain: "base",
          bucket: "BTC",
          strategyType: "lending",
          usdValue: 0.7,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["WBTC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
        {
          canonicalProtocolId: "across",
          canonicalProtocolName: "Across",
          chain: "base",
          bucket: "BTC",
          strategyType: "unknown",
          usdValue: 0.2,
          riskGrade: "UNKNOWN",
          riskScore: 3.5,
          assetSymbols: ["WBTC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.6,
        },
        {
          canonicalProtocolId: "stake",
          canonicalProtocolName: "Stake",
          chain: "base",
          bucket: "BTC",
          strategyType: "lending",
          usdValue: 0.1,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["WBTC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.8,
        },
      ],
    };

    const recommendation = buildRecommendation({
      userMetrics,
      vault,
      vaultMetrics: computeBucketMetrics("BTC", vault.allocation),
    });

    expect(recommendation.primaryIntent).toBe("diversification_improvement");
    expect(recommendation.benefitFlags.improvesDiversification).toBe(true);
    expect(recommendation.reasonCodes).toContain("LOWER_PROTOCOL_CONCENTRATION");
    expect(recommendation.strength).not.toBe("none");
    expect(recommendation.actionability).not.toBe("suppressed");
  });

  it("treats a fully idle bucket as idle deployment", () => {
    const userMetrics = computeBucketMetrics("ETH", [
      {
        canonicalProtocolId: "wallet",
        canonicalProtocolName: "Wallet",
        chain: "ethereum",
        bucket: "ETH",
        strategyType: "spot_idle",
        usdValue: 2500,
        riskGrade: "A",
        riskScore: 1,
        assetSymbols: ["ETH"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 1,
      },
    ]);

    const vault: CanonicalYoVault = {
      vaultId: "yo-eth",
      vaultSymbol: "yoETH",
      vaultAddress: "0x0000000000000000000000000000000000000004",
      chain: "base",
      bucket: "ETH",
      tvlUsd: 750000,
      apyPct: 3.6,
      riskGrade: "B",
      riskScore: 2,
      allocation: [
        {
          canonicalProtocolId: "lido",
          canonicalProtocolName: "Lido",
          chain: "base",
          bucket: "ETH",
          strategyType: "staking",
          usdValue: 0.85,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["ETH"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
        {
          canonicalProtocolId: "aave",
          canonicalProtocolName: "Aave",
          chain: "base",
          bucket: "ETH",
          strategyType: "lending",
          usdValue: 0.15,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["ETH"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
      ],
    };

    const recommendation = buildRecommendation({
      userMetrics,
      vault,
      vaultMetrics: computeBucketMetrics("ETH", vault.allocation),
    });

    expect(recommendation.primaryIntent).toBe("idle_deployment");
    expect(recommendation.benefitFlags.deploysIdleCapital).toBe(true);
    expect(recommendation.showBeforeAfterBars).toBe(false);
    expect(recommendation.reasonCodes).toContain("UNLOCK_IDLE_CAPITAL");
    expect(recommendation.actionability).not.toBe("suppressed");
  });

  it("deduplicates recommendations by bucket and vault address", () => {
    const userMetrics = computeBucketMetrics("USD", [
      {
        canonicalProtocolId: "maple",
        canonicalProtocolName: "Maple",
        chain: "ethereum",
        bucket: "USD",
        strategyType: "synthetic_yield",
        usdValue: 2000,
        riskGrade: "C",
        riskScore: 3,
        assetSymbols: ["USDC"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 0.9,
      },
    ]);

    const vault: CanonicalYoVault = {
      vaultId: "yo-usd",
      vaultSymbol: "yoUSD",
      vaultAddress: "0x0000000000000000000000000000000000000001",
      chain: "base",
      bucket: "USD",
      tvlUsd: 1000000,
      apyPct: 10,
      riskGrade: "B",
      riskScore: 2,
      allocation: [
        {
          canonicalProtocolId: "aave",
          canonicalProtocolName: "Aave",
          chain: "base",
          bucket: "USD",
          strategyType: "lending",
          usdValue: 1,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["USDC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
      ],
    };

    const recommendations = buildRankedRecommendations({
      bucketMetrics: {
        USD: userMetrics,
        ETH: computeBucketMetrics("ETH", []),
        BTC: computeBucketMetrics("BTC", []),
        OTHER: computeBucketMetrics("OTHER", []),
      },
      vaults: [vault, { ...vault, vaultId: "yo-usd-duplicate", chain: "ethereum" }],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.vaultAddress).toBe(vault.vaultAddress);
  });

  it("does not claim simplification when a partial move does not reduce position count", () => {
    const userMetrics = computeBucketMetrics("USD", [
      {
        canonicalProtocolId: "maple",
        canonicalProtocolName: "Maple",
        chain: "ethereum",
        bucket: "USD",
        strategyType: "synthetic_yield",
        usdValue: 1000,
        riskGrade: "C",
        riskScore: 3,
        assetSymbols: ["USDC"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 0.9,
      },
      {
        canonicalProtocolId: "aave",
        canonicalProtocolName: "Aave",
        chain: "ethereum",
        bucket: "USD",
        strategyType: "lending",
        usdValue: 1000,
        riskGrade: "B",
        riskScore: 2,
        assetSymbols: ["USDC"],
        tokenAddresses: [],
        source: "debank",
        matchingConfidence: 0.9,
      },
    ]);

    const vault: CanonicalYoVault = {
      vaultId: "yo-usd",
      vaultSymbol: "yoUSD",
      vaultAddress: "0x0000000000000000000000000000000000000002",
      chain: "base",
      bucket: "USD",
      tvlUsd: 1000000,
      apyPct: 10,
      riskGrade: "B",
      riskScore: 2,
      allocation: [
        {
          canonicalProtocolId: "aave",
          canonicalProtocolName: "Aave",
          chain: "base",
          bucket: "USD",
          strategyType: "lending",
          usdValue: 1,
          riskGrade: "B",
          riskScore: 2,
          assetSymbols: ["USDC"],
          tokenAddresses: [],
          source: "yo",
          matchingConfidence: 0.9,
        },
      ],
    };

    const recommendation = buildRecommendation({
      userMetrics,
      vault,
      vaultMetrics: computeBucketMetrics("USD", vault.allocation),
    });

    expect(recommendation.metrics.positionsBefore).toBe(2);
    expect(recommendation.metrics.positionsAfter).toBe(2);
    expect(recommendation.reasonCodes).not.toContain("SIMPLER_STRUCTURE");
  });
});
