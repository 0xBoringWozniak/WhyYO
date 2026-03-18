import { describe, expect, it } from "vitest";

import {
  normalizeRiskDatasetInput,
  debankChainSchema,
  debankComplexProtocolSchema,
  debankSimpleProtocolSchema,
  debankTokenSchema,
  debankTotalBalanceSchema,
  riskDatasetSchema,
} from "@whyyo/integrations";
import { defaultMethodologyResponse, explanationInputSchema, scanResponseSchema } from "@whyyo/shared";

import complexProtocols from "./fixtures/debank-complex-protocols.json";
import riskDataset from "./fixtures/risk-dataset.json";
import simpleProtocols from "./fixtures/debank-simple-protocols.json";
import tokenList from "./fixtures/debank-token-list.json";
import totalBalance from "./fixtures/debank-total-balance.json";
import usedChains from "./fixtures/debank-used-chains.json";

describe("integration schemas", () => {
  it("parses representative Debank fixtures", () => {
    expect(() => debankTotalBalanceSchema.parse(totalBalance)).not.toThrow();
    expect(() => debankChainSchema.array().parse(usedChains)).not.toThrow();
    expect(() => debankSimpleProtocolSchema.array().parse(simpleProtocols)).not.toThrow();
    expect(() => debankComplexProtocolSchema.array().parse(complexProtocols)).not.toThrow();
    expect(() => debankTokenSchema.array().parse(tokenList)).not.toThrow();
  });

  it("parses representative risk dataset fixtures", () => {
    expect(() => riskDatasetSchema.parse(riskDataset)).not.toThrow();
  });

  it("normalizes flat production-style risk dataset arrays", () => {
    const flatInput = [
      {
        id: "pool-1",
        slug: "aave-usd-lending-ethereum",
        title: "Aave USD Lending",
        tvl: "1000",
        risk: "B",
        yield: "4.2",
        assets: [
          {
            id: "asset-1",
            symbol: "USDC",
            parent_symbol: "USD",
            logo: null,
            asset_funding_group_id: null,
          },
        ],
        blockchain: {
          id: "eth",
          name: "Ethereum",
          image_url: null,
        },
      },
      {
        id: "pool-2",
        slug: "yield-optimizer-usd-base",
        title: "Yield Optimizer USD",
        tvl: "2000",
        risk: "B",
        yield: "5.1",
        assets: [
          {
            id: "asset-2",
            symbol: "yoUSD",
            parent_symbol: "USD",
            logo: null,
            asset_funding_group_id: null,
          },
        ],
        blockchain: {
          id: "base",
          name: "Base",
          image_url: null,
        },
      },
    ];

    const normalized = normalizeRiskDatasetInput(riskDatasetSchema.parse(flatInput));
    expect(normalized.data.pools).toHaveLength(1);
    expect(normalized.data.yo_pools).toHaveLength(1);
    expect(normalized.data.total_count).toBe(2);
  });
});

describe("api contracts", () => {
  it("validates explanation input", () => {
    expect(() =>
      explanationInputSchema.parse({
        bucket: "USD",
        vaultSymbol: "yoUSD",
        vaultAddress: "0x0000000000000000000000000000000000000001",
        score: 0.61,
        strength: "medium",
        confidence: "high",
        suggestedUsd: 500,
        suggestedAmounts: {
          recommendedUsd: 500,
          idleFirstUsd: 200,
          highRiskOnlyUsd: 300,
          combinedUsd: 500,
          quarterUsd: 500,
          halfUsd: 1000,
          allUsd: 2000,
        },
        metrics: {
          bucketSizeUsd: 2000,
          defiInvestedUsd: 1800,
          idleAssetUsd: 200,
          idleSharePct: 0.1,
          productiveSharePct: 0.9,
          existingYoSharePct: 0.2,
          estimatedAnnualYieldOpportunityUsd: 14.4,
          vaultApyPct: 7.2,
          vaultWeightedRisk: 2,
          vaultHighRiskExposurePct: 20,
          vaultUnknownRiskExposurePct: 0,
          vaultProtocolHHI: 0.4,
          weightedRiskBefore: 3,
          weightedRiskAfter: 2,
          weightedRiskImprovementPct: 33.3,
          highRiskBeforePct: 0.5,
          highRiskAfterPct: 0.2,
          highRiskReductionPctPoints: 30,
          savingsScoreBefore: 40,
          savingsScoreAfter: 74,
          savingsScoreDelta: 34,
          protocolHHIBefore: 0.6,
          protocolHHIAfter: 0.4,
          protocolConcentrationImprovementPct: 33,
          protocolOverlapPct: 10,
          protocolDistance: 0.9,
          strategyDistance: 0.7,
          positionsBefore: 5,
          positionsAfter: 1,
          coveragePct: 80,
          unknownRiskExposurePct: 20,
        },
        userBucketMetrics: {
          totalUsd: 2000,
          bucketSizeUsd: 2000,
          defiInvestedUsd: 1800,
          idleAssetUsd: 200,
          idleSharePct: 0.1,
          productiveSharePct: 0.9,
          riskCoveragePct: 0.8,
          weightedRiskScore: 3,
          highRiskExposurePct: 0.5,
          mediumRiskExposurePct: 0.8,
          unknownRiskExposurePct: 0.2,
          protocolHHI: 0.6,
          chainHHI: 0.8,
          strategyHHI: 0.7,
          savingsScore: 40,
          positionCount: 5,
          defiPositionCount: 4,
          idlePositionCount: 1,
          protocolCount: 4,
          chainCount: 2,
          top1ProtocolShare: 0.4,
          top3ProtocolShare: 0.85,
          top1ChainShare: 0.7,
          top1StrategyShare: 0.6,
          complexityNorm: 0.52,
        },
        vaultMetrics: {
          totalUsd: 50000,
          bucketSizeUsd: 50000,
          defiInvestedUsd: 50000,
          idleAssetUsd: 0,
          idleSharePct: 0,
          productiveSharePct: 1,
          riskCoveragePct: 1,
          weightedRiskScore: 2,
          highRiskExposurePct: 0.2,
          mediumRiskExposurePct: 0.3,
          unknownRiskExposurePct: 0,
          protocolHHI: 0.4,
          chainHHI: 0.5,
          strategyHHI: 0.4,
          savingsScore: 74,
          positionCount: 3,
          defiPositionCount: 3,
          idlePositionCount: 0,
          protocolCount: 3,
          chainCount: 2,
          top1ProtocolShare: 0.5,
          top3ProtocolShare: 1,
          top1ChainShare: 0.7,
          top1StrategyShare: 0.8,
          complexityNorm: 0.24,
        },
        projectedMetrics: {
          migrationRatio: 0.25,
          weightedRiskScore: 2.75,
          highRiskExposurePct: 0.425,
          unknownRiskExposurePct: 0.15,
          protocolHHI: 0.52,
          chainHHI: 0.71,
          strategyHHI: 0.62,
          savingsScore: 48,
        },
        decision: {
          score: 0.61,
          strength: "medium",
          confidence: "high",
          primaryIntent: "risk_improvement",
          recommendationType: "migration",
          actionability: "actionable",
          safetyClaimLevel: "strong",
          benefitFlags: {
            improvesDiversification: true,
            deploysIdleCapital: true,
            improvesWeightedRisk: true,
            reducesHighRiskExposure: true,
            improvesSavingsScore: true,
            improvesSimplicity: true,
          },
          bucketMode: "mixed",
          eligible: true,
          ctaEnabled: true,
          ctaMode: "deposit",
          isAlreadyInTargetVault: false,
          existingYoSharePct: 0.2,
          showBeforeAfterBars: true,
          showCoverageBar: true,
          showIdleOpportunityVisual: true,
          avgMatchingConfidence: 0.93,
          riskGain: 0.33,
          highRiskGain: 0.3,
          savingsGain: 0.34,
          concentrationGain: 0.33,
          diversificationGain: 0.41,
          idleDeploymentGain: 0.27,
          vaultQualityScore: 0.74,
          simplicityGain: 0.74,
          similarity: 0.1,
          strategyFitGain: 0.3,
          unknownPenalty: 0.66,
          sizePenalty: 0,
        },
        vault: {
          vaultAddress: "0x0000000000000000000000000000000000000001",
          chain: "base",
          bucket: "USD",
          apyPct: 7.2,
          tvlUsd: 1000000,
          riskGrade: "B",
          riskScore: 2,
          allocationCount: 3,
          avgMatchingConfidence: 0.93,
          topAllocations: [
            {
              canonicalProtocolId: "aave",
              canonicalProtocolName: "aave",
              chain: "base",
              strategyType: "lending",
              riskGrade: "B",
              riskScore: 2,
              usdValue: 700000,
              weightPct: 70,
              matchingConfidence: 0.95,
            },
          ],
        },
        reasonCodes: ["LOWER_WEIGHTED_RISK"],
        caveats: [],
        visualization: {
          beforeAfterBars: [
            {
              key: "weighted_risk",
              label: "Weighted risk",
              before: 3,
              after: 2,
              format: "number",
              betterDirection: "lower",
            },
          ],
          coverageBar: [
            { key: "covered", label: "Covered", valuePct: 70, tone: "good" },
            { key: "unknown", label: "Unknown", valuePct: 20, tone: "warn" },
            { key: "idle", label: "Idle", valuePct: 10, tone: "neutral" },
          ],
          idleVsInvestedBar: [
            { key: "productive", label: "Productive", valuePct: 90 },
            { key: "idle", label: "Idle", valuePct: 10 },
          ],
          simplification: {
            beforePositions: 5,
            afterPositions: 2,
          },
          currentComposition: {
            protocols: [{ key: "aave", label: "aave", weightPct: 40 }],
            strategies: [{ key: "lending", label: "lending", weightPct: 60 }],
          },
          yoComposition: {
            protocols: [{ key: "aave", label: "aave", weightPct: 70 }],
            strategies: [{ key: "lending", label: "lending", weightPct: 100 }],
          },
        },
      }),
    ).not.toThrow();
  });

  it("validates a representative scan response", () => {
    expect(() =>
      scanResponseSchema.parse({
        scanId: "8d5df5dc-23d8-47e9-a5d4-9de04b7ec3c8",
        status: "completed",
        portfolioOverview: {
          ownerAddress: "0x000000000000000000000000000000000000dead",
          totalUsd: 1000,
          analyzedUsd: 800,
          riskCoveredUsd: 700,
          coveragePct: 87.5,
          tokenExposures: [],
          protocolExposures: [],
          bucketTotals: {
            USD: 500,
            ETH: 300,
            BTC: 200,
            OTHER: 0,
          },
          protocolCount: 2,
          positionCount: 2,
          chainCount: 1,
          warnings: [],
        },
        bucketOverview: [],
        recommendations: [],
        methodology: defaultMethodologyResponse,
        dataFreshness: {
          debankFetchedAt: new Date().toISOString(),
          yoFetchedAt: new Date().toISOString(),
          riskDatasetImportedAt: new Date().toISOString(),
        },
        warnings: [],
      }),
    ).not.toThrow();
  });
});
