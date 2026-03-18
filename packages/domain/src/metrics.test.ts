import { describe, expect, it } from "vitest";

import type { CanonicalProtocolExposure } from "@whyyo/shared";

import { computeBucketMetrics } from "./metrics";
import { inferBucketFromSymbol, toProtocolFamilyKey } from "./normalization";

const exposures: CanonicalProtocolExposure[] = [
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
    matchingConfidence: 1,
  },
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
    matchingConfidence: 1,
  },
  {
    canonicalProtocolId: "wallet",
    canonicalProtocolName: "Wallet",
    chain: "ethereum",
    bucket: "USD",
    strategyType: "spot_idle",
    usdValue: 500,
    riskGrade: "A",
    riskScore: 1,
    assetSymbols: ["USDC"],
    tokenAddresses: ["0xwallet"],
    source: "debank",
    matchingConfidence: 1,
  },
];

describe("normalization", () => {
  it("maps token families to buckets", () => {
    expect(inferBucketFromSymbol("USDC", "USD")).toBe("USD");
    expect(inferBucketFromSymbol("wstETH", "ETH")).toBe("ETH");
    expect(inferBucketFromSymbol("cbBTC", "BTC")).toBe("BTC");
    expect(inferBucketFromSymbol("SolvBTC.JUP", "SolvBTC.JUP")).toBe("BTC");
    expect(inferBucketFromSymbol("yoUSD", "yoUSD")).toBe("USD");
    expect(inferBucketFromSymbol("aBasUSDC", "aBasUSDC")).toBe("USD");
    expect(inferBucketFromSymbol("UЅDС", "UЅDС")).toBe("USD");
    expect(inferBucketFromSymbol("Visit https://claim.site for 10 ETH", "Visit https://claim.site for 10 ETH")).toBe(
      "OTHER",
    );
    expect(inferBucketFromSymbol("UNI", "UNI")).toBe("OTHER");
  });

  it("builds deterministic protocol family keys", () => {
    expect(toProtocolFamilyKey("arb_aave3")).toBe("aave");
    expect(toProtocolFamilyKey("base_yoxyz")).toBe("yo");
    expect(toProtocolFamilyKey("AvantisFi")).toBe("avantis");
  });
});

describe("metrics", () => {
  it("computes weighted risk on DeFi-only capital and tracks idle separately", () => {
    const metrics = computeBucketMetrics("USD", exposures);
    expect(metrics.totalUsd).toBe(2500);
    expect(metrics.bucketSizeUsd).toBe(2500);
    expect(metrics.defiInvestedUsd).toBe(2000);
    expect(metrics.idleAssetUsd).toBe(500);
    expect(metrics.idleSharePct).toBe(0.2);
    expect(metrics.weightedRiskScore).toBe(2.5);
    expect(metrics.highRiskExposurePct).toBe(0.5);
    expect(metrics.riskCoveragePct).toBe(1);
    expect(metrics.protocolCount).toBe(2);
    expect(metrics.savingsScore).not.toBeNull();
  });

  it("marks risk coverage as unavailable for idle-only buckets", () => {
    const metrics = computeBucketMetrics("ETH", [
      {
        canonicalProtocolId: "wallet",
        canonicalProtocolName: "Wallet",
        chain: "ethereum",
        bucket: "ETH",
        strategyType: "spot_idle",
        usdValue: 1500,
        riskGrade: "A",
        riskScore: 1,
        assetSymbols: ["ETH"],
        tokenAddresses: ["eth"],
        source: "debank",
        matchingConfidence: 1,
      },
    ]);

    expect(metrics.defiInvestedUsd).toBe(0);
    expect(metrics.idleAssetUsd).toBe(1500);
    expect(metrics.riskCoveragePct).toBeNull();
    expect(metrics.weightedRiskScore).toBeNull();
    expect(metrics.visualization.coverageBar[2]?.valuePct).toBe(100);
  });
});
