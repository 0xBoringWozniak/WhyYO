import { describe, expect, it } from "vitest";
import type { CanonicalProtocolExposure, CanonicalTokenExposure, RankedRecommendation } from "@whyyo/shared";

import { buildIdleSourcePlan } from "./idle-source-plan";

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
        tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
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
    });

    expect(plan?.chain).toBe("other");
    expect(plan?.availableUsd).toBe(84);
  });

  it("does not treat non-underlying idle assets on a supported chain as direct deposit candidates", () => {
    const tokenExposures: CanonicalTokenExposure[] = [
      {
        chain: "base",
        tokenAddress: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        bucket: "USD",
        usdValue: 84,
        amount: 84,
        source: "debank",
      },
      {
        chain: "base",
        tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
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
    });

    expect(plan?.chain).toBe("base");
    expect(plan?.symbol).toBe("USDC");
    expect(plan?.availableUsd).toBe(44);
  });
});
