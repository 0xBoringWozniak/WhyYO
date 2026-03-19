import { describe, expect, it } from "vitest";
import type { CanonicalProtocolExposure, CanonicalTokenExposure, RankedRecommendation } from "@whyyo/shared";

import { buildIdleSourcePlan } from "./idle-source-plan";
import type { YoVaultStatsItem } from "./yo-sdk";

const recommendation = {
  bucket: "USD",
  vaultSymbol: "yoUSD",
  vaultAddress: "0x1111111111111111111111111111111111111111",
  suggestedUsd: 100,
  suggestedAmounts: {
    recommendedUsd: 100,
    idleFirstUsd: 100,
    highRiskOnlyUsd: 0,
    combinedUsd: 100,
    quarterUsd: 25,
    halfUsd: 50,
    allUsd: 100,
  },
} as unknown as RankedRecommendation;

const idleProtocols: CanonicalProtocolExposure[] = [
  {
    canonicalProtocolId: "wallet",
    canonicalProtocolName: "Wallet",
    chain: "base",
    bucket: "USD",
    strategyType: "spot_idle",
    usdValue: 128,
    riskGrade: "UNKNOWN",
    riskScore: 0,
    assetSymbols: ["USDC"],
    tokenAddresses: [],
    source: "debank",
    matchingConfidence: 1,
  },
];

const yoVaults: YoVaultStatsItem[] = [
  {
    id: "yoUSD",
    name: "yoUSD",
    asset: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      address: "0x2222222222222222222222222222222222222222",
    },
    shareAsset: {
      name: "yoUSD",
      symbol: "yoUSD",
      decimals: 18,
      address: "0x3333333333333333333333333333333333333333",
    },
    chain: {
      id: 8453,
      name: "Base",
    },
    contracts: {
      vaultAddress: "0x1111111111111111111111111111111111111111",
    },
    secondaryVaults: [],
  },
];

describe("buildIdleSourcePlan", () => {
  it("prefers the largest supported chain+asset route before a larger unsupported network", () => {
    const tokenExposures: CanonicalTokenExposure[] = [
      {
        chain: "other",
        tokenAddress: "0x4444444444444444444444444444444444444444",
        symbol: "USDC",
        bucket: "USD",
        usdValue: 84,
        amount: 84,
        source: "debank",
      },
      {
        chain: "base",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        symbol: "USDC",
        bucket: "USD",
        usdValue: 44,
        amount: 44,
        source: "debank",
      },
    ];

    const plan = buildIdleSourcePlan({
      recommendation,
      tokenExposures,
      protocolExposures: idleProtocols,
      vaults: yoVaults,
    });

    expect(plan?.chain).toBe("base");
    expect(plan?.availableUsd).toBe(44);
    expect(plan?.recommendedUsd).toBe(44);
  });

  it("falls back to the largest candidate when no supported route matches", () => {
    const tokenExposures: CanonicalTokenExposure[] = [
      {
        chain: "other",
        tokenAddress: "0x4444444444444444444444444444444444444444",
        symbol: "USDC",
        bucket: "USD",
        usdValue: 84,
        amount: 84,
        source: "debank",
      },
      {
        chain: "base",
        tokenAddress: "0x5555555555555555555555555555555555555555",
        symbol: "USDT",
        bucket: "USD",
        usdValue: 44,
        amount: 44,
        source: "debank",
      },
    ];

    const plan = buildIdleSourcePlan({
      recommendation,
      tokenExposures,
      protocolExposures: idleProtocols,
      vaults: yoVaults,
    });

    expect(plan?.chain).toBe("other");
    expect(plan?.availableUsd).toBe(84);
  });
});
