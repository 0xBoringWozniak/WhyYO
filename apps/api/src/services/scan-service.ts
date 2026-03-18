import { buildExplanationInput, computeBucketMetrics } from "@whyyo/domain";
import type { ScanResponse } from "@whyyo/shared";

import { ScanRepository } from "../repositories/scan-repository";
import { DebankService } from "./debank-service";
import { buildFallbackExplanation, ExplanationService } from "./explanation-service";
import { PortfolioService } from "./portfolio-service";
import { YoVaultReadService } from "./yo-vault-read-service";
import { getEnv } from "../config/env";

export class ScanService {
  constructor(
    private readonly scanRepository = new ScanRepository(),
    private readonly debankService = new DebankService(),
    private readonly yoVaultReadService = new YoVaultReadService(),
    private readonly portfolioService = new PortfolioService(),
    private readonly explanationService = new ExplanationService(),
  ) {}

  async startScan(walletAddress: string): Promise<ScanResponse> {
    const scanId = await this.scanRepository.createScanSession(walletAddress);
    const [debankResult, yo] = await Promise.all([
      this.debankService.fetchUserBundle(walletAddress).then(
        (bundle) => ({
          bundle,
          warnings: [] as string[],
        }),
        (error) => ({
          bundle: {
            totalBalance: { total_usd_value: 0, chain_list: [] },
            usedChains: [],
            simpleProtocols: [],
            complexProtocols: [],
            tokens: [],
          },
          warnings: [`DeBank degraded: ${(error as Error).message}. Scan used an empty portfolio snapshot.`],
        }),
      ),
      this.yoVaultReadService.listVaults(),
    ]);
    const response = await this.portfolioService.buildScanResponse({
      scanId,
      walletAddress,
      debank: debankResult.bundle,
      vaults: yo.vaults,
      yoWarnings: [...debankResult.warnings, ...yo.warnings],
    });

    const userBucketMetrics = {
      USD: computeBucketMetrics(
        "USD",
        response.portfolioOverview.protocolExposures,
      ),
      ETH: computeBucketMetrics(
        "ETH",
        response.portfolioOverview.protocolExposures,
      ),
      BTC: computeBucketMetrics(
        "BTC",
        response.portfolioOverview.protocolExposures,
      ),
    } as const;
    const vaultMap = new Map(yo.vaults.map((vault) => [vault.vaultAddress.toLowerCase(), vault]));

    for (const recommendation of response.recommendations) {
      const vault = vaultMap.get(recommendation.vaultAddress.toLowerCase());
      if (!vault) {
        recommendation.llmExplanation = buildFallbackExplanation({
          bucket: recommendation.bucket,
          vaultSymbol: recommendation.vaultSymbol,
          vaultAddress: recommendation.vaultAddress,
          score: recommendation.score,
          strength: recommendation.strength,
          confidence: recommendation.confidence,
          suggestedUsd: recommendation.suggestedUsd,
          metrics: recommendation.metrics,
          userBucketMetrics: {
            totalUsd: 0,
            bucketSizeUsd: 0,
            defiInvestedUsd: 0,
            idleAssetUsd: 0,
            idleSharePct: 0,
            productiveSharePct: 0,
            riskCoveragePct: null,
            weightedRiskScore: null,
            highRiskExposurePct: null,
            mediumRiskExposurePct: 0,
            unknownRiskExposurePct: null,
            protocolHHI: null,
            chainHHI: null,
            strategyHHI: null,
            savingsScore: null,
            positionCount: 0,
            defiPositionCount: 0,
            idlePositionCount: 0,
            protocolCount: 0,
            chainCount: 0,
            top1ProtocolShare: 0,
            top3ProtocolShare: 0,
            top1ChainShare: 0,
            top1StrategyShare: 0,
            complexityNorm: 0,
          },
          vaultMetrics: {
            totalUsd: 0,
            bucketSizeUsd: 0,
            defiInvestedUsd: 0,
            idleAssetUsd: 0,
            idleSharePct: 0,
            productiveSharePct: 0,
            riskCoveragePct: null,
            weightedRiskScore: null,
            highRiskExposurePct: null,
            mediumRiskExposurePct: 0,
            unknownRiskExposurePct: null,
            protocolHHI: null,
            chainHHI: null,
            strategyHHI: null,
            savingsScore: null,
            positionCount: 0,
            defiPositionCount: 0,
            idlePositionCount: 0,
            protocolCount: 0,
            chainCount: 0,
            top1ProtocolShare: 0,
            top3ProtocolShare: 0,
            top1ChainShare: 0,
            top1StrategyShare: 0,
            complexityNorm: 0,
          },
          projectedMetrics: {
            migrationRatio: 0,
            weightedRiskScore: recommendation.metrics.weightedRiskAfter,
            highRiskExposurePct: recommendation.metrics.highRiskAfterPct ?? 0,
            unknownRiskExposurePct: (recommendation.metrics.unknownRiskExposurePct ?? 0) / 100,
            protocolHHI: recommendation.metrics.protocolHHIAfter,
            chainHHI: null,
            strategyHHI: null,
            savingsScore: recommendation.metrics.savingsScoreAfter,
          },
          decision: {
            score: recommendation.score,
            strength: recommendation.strength,
            confidence: recommendation.confidence,
            primaryIntent: recommendation.primaryIntent,
            recommendationType: recommendation.recommendationType,
            actionability: recommendation.actionability,
            safetyClaimLevel: recommendation.safetyClaimLevel,
            benefitFlags: recommendation.benefitFlags,
            bucketMode: recommendation.bucketMode,
            eligible: recommendation.eligible,
            ctaEnabled: recommendation.ctaEnabled,
            ctaMode: recommendation.ctaMode,
            isAlreadyInTargetVault: recommendation.isAlreadyInTargetVault,
            existingYoSharePct: recommendation.metrics.existingYoSharePct,
            showBeforeAfterBars: recommendation.showBeforeAfterBars,
            showCoverageBar: recommendation.showCoverageBar,
            showIdleOpportunityVisual: recommendation.showIdleOpportunityVisual,
            avgMatchingConfidence: 0,
            riskGain: 0,
            highRiskGain: 0,
            savingsGain: 0,
            concentrationGain: 0,
            diversificationGain: 0,
            idleDeploymentGain: 0,
            vaultQualityScore: 0,
            simplicityGain: 0,
            similarity: 0,
            strategyFitGain: 0,
            unknownPenalty: 0,
            sizePenalty: 0,
          },
          vault: {
            vaultAddress: recommendation.vaultAddress,
            chain: "other",
            bucket: recommendation.bucket,
            apyPct: 0,
            tvlUsd: 0,
            riskGrade: "UNKNOWN",
            riskScore: 3.5,
            allocationCount: 0,
            avgMatchingConfidence: 0,
            topAllocations: [],
          },
          reasonCodes: recommendation.reasonCodes,
          caveats: recommendation.caveats,
        });
        continue;
      }

      const explanationInput = buildExplanationInput({
        userMetrics: userBucketMetrics[recommendation.bucket],
        vault,
        vaultMetrics: computeBucketMetrics(vault.bucket, vault.allocation),
        recommendation,
      });

      if (getEnv().ENABLE_ASYNC_EXPLANATIONS) {
        recommendation.llmExplanation = await this.explanationService.getImmediateExplanation(explanationInput);
      } else {
        recommendation.llmExplanation = await this.explanationService.explain(explanationInput);
      }
    }

    await this.scanRepository.persistResult({ scanId, response });
    return response;
  }

  async getScan(scanId: string): Promise<ScanResponse | null> {
    return this.scanRepository.getScan(scanId);
  }
}
