import type {
  Actionability,
  BucketMode,
  CanonicalTokenExposure,
  CanonicalYoVault,
  CtaMode,
  ExplanationInput,
  RecommendationBenefitFlags,
  RecommendationConfidence,
  RecommendationIntent,
  RecommendationStrength,
  RecommendationType,
  RankedRecommendation,
  SafetyClaimLevel,
} from "@whyyo/shared";
import { DEFAULT_METHODOLOGY, type CanonicalBucket } from "@whyyo/shared";

import {
  computeBucketMetrics,
  computeSavingsScore,
  protocolDistanceL1,
  protocolOverlap,
  usdMapToWeightMap,
  weightMapToUsdMap,
} from "./metrics";

export type RankerInputs = {
  userMetrics: ReturnType<typeof computeBucketMetrics>;
  vault: CanonicalYoVault;
  vaultMetrics: ReturnType<typeof computeBucketMetrics>;
  tokenExposures?: CanonicalTokenExposure[];
};

type BucketMetricsComputation = ReturnType<typeof computeBucketMetrics>;

type BlendedMetrics = {
  moveUsd: number;
  movedIdleUsd: number;
  movedDefiUsd: number;
  migrationRatio: number;
  remainingIdleUsd: number;
  weightedRiskAfter: number | null;
  highRiskAfter: number | null;
  unknownRiskAfter: number | null;
  protocolHHIAfter: number | null;
  strategyHHIAfter: number | null;
  protocolWeightsAfter: Record<string, number>;
  strategyWeightsAfter: Record<string, number>;
  top1ProtocolShareAfter: number;
  top1StrategyShareAfter: number;
  effectiveProtocolCountAfter: number;
  effectiveStrategyCountAfter: number;
  savingsScoreAfter: number | null;
  positionsAfter: number;
};

type RecommendationAnalysis = {
  bucketMode: BucketMode;
  existingYoSharePct: number;
  isAlreadyInTargetVault: boolean;
  suggestedAmounts: RankedRecommendation["suggestedAmounts"];
  blended: BlendedMetrics;
  primaryIntent: RecommendationIntent;
  recommendationType: RecommendationType;
  actionability: Actionability;
  safetyClaimLevel: SafetyClaimLevel;
  benefitFlags: RecommendationBenefitFlags;
  score: number;
  eligible: boolean;
  strength: RecommendationStrength;
  confidence: { raw: number; label: RecommendationConfidence };
  ctaMode: CtaMode;
  ctaEnabled: boolean;
  showBeforeAfterBars: boolean;
  showCoverageBar: boolean;
  showIdleOpportunityVisual: boolean;
  reasonCodes: string[];
  caveats: string[];
  diagnostics: {
    avgMatchingConfidence: number;
    riskGain: number;
    highRiskGain: number;
    savingsGain: number;
    concentrationGain: number;
    diversificationGain: number;
    idleDeploymentGain: number;
    vaultQualityScore: number;
    simplicityGain: number;
    similarity: number;
    strategyFitGain: number;
    unknownPenalty: number;
    sizePenalty: number;
    protocolOverlapPct: number;
    protocolDistance: number;
    strategyDistance: number;
  };
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const topShare = (weights: Record<string, number>): number =>
  Object.values(weights).sort((left, right) => right - left)[0] ?? 0;

const hhi = (weights: Record<string, number>): number =>
  Object.values(weights).reduce((sum, weight) => sum + weight ** 2, 0);

const effectiveCount = (weights: Record<string, number>): number => {
  const score = hhi(weights);
  return score > 0 ? 1 / score : 0;
};

const normalizedReduction = (before: number | null, after: number | null): number => {
  if (before === null || after === null || before <= 0) return 0;
  return clamp01((before - after) / before);
};

const normalizedIncrease = (before: number, after: number): number => {
  if (after <= before) return 0;
  return clamp01((after - before) / Math.max(before, 1));
};

const toCompositionEntries = (weights: Record<string, number>) =>
  Object.entries(weights)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([key, weight]) => ({
      key,
      label: key.replaceAll("_", " "),
      weightPct: weight * 100,
    }));

const toExposureCompositionEntries = <T extends {
  usdValue: number;
  originalProtocolName: string | undefined;
  canonicalProtocolName: string;
  strategyType: string;
}>({
  exposures,
  keySelector,
  labelSelector,
}: {
  exposures: T[];
  keySelector: (exposure: T) => string;
  labelSelector: (exposure: T) => string;
}) => {
  const total = exposures.reduce((sum, exposure) => sum + exposure.usdValue, 0);
  if (total <= 0) return [];

  const grouped = new Map<string, { label: string; usdValue: number }>();

  for (const exposure of exposures) {
    const key = keySelector(exposure);
    const label = labelSelector(exposure);
    const existing = grouped.get(key);
    if (existing) {
      existing.usdValue += exposure.usdValue;
      continue;
    }
    grouped.set(key, { label, usdValue: exposure.usdValue });
  }

  return [...grouped.entries()]
    .sort((left, right) => right[1].usdValue - left[1].usdValue)
    .slice(0, 5)
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      weightPct: (entry.usdValue / total) * 100,
    }));
};

const toBucketMode = (userMetrics: BucketMetricsComputation): BucketMode => {
  if (userMetrics.bucketSizeUsd <= 0) return "empty";
  if (userMetrics.defiInvestedUsd <= 0 && userMetrics.idleAssetUsd > 0) return "idle_only";
  if (userMetrics.defiInvestedUsd > 0 && userMetrics.idleAssetUsd > 0) return "mixed";
  return "productive";
};

const computeExistingYoSharePct = ({
  bucket,
  vault,
  tokenExposures,
  bucketSizeUsd,
}: {
  bucket: CanonicalBucket;
  vault: CanonicalYoVault;
  tokenExposures: CanonicalTokenExposure[];
  bucketSizeUsd: number;
}) => {
  if (bucketSizeUsd <= 0) return 0;

  const targetShareUsd = tokenExposures
    .filter((token) => token.bucket === bucket)
    .filter((token) => {
      const tokenAddress = token.tokenAddress?.toLowerCase();
      const symbol = token.symbol.toLowerCase();
      const parentSymbol = token.parentSymbol?.toLowerCase();
      return (
        tokenAddress === vault.vaultAddress.toLowerCase() ||
        symbol === vault.vaultSymbol.toLowerCase() ||
        parentSymbol === vault.vaultSymbol.toLowerCase()
      );
    })
    .reduce((sum, token) => sum + token.usdValue, 0);

  return targetShareUsd / bucketSizeUsd;
};

const isVaultTooWeakForIdleDeployment = (vaultMetrics: BucketMetricsComputation) =>
  (vaultMetrics.unknownRiskExposurePct ?? 0) > DEFAULT_METHODOLOGY.idleVaultGuardrails.maxUnknownRiskPct ||
  (vaultMetrics.highRiskExposurePct ?? 0) > DEFAULT_METHODOLOGY.idleVaultGuardrails.maxHighRiskPct ||
  (vaultMetrics.protocolHHI ?? 0) > DEFAULT_METHODOLOGY.idleVaultGuardrails.maxProtocolHHI ||
  (vaultMetrics.savingsScore ?? 100) < DEFAULT_METHODOLOGY.idleVaultGuardrails.minSavingsScore;

const computeSuggestedAmountsUsd = ({
  bucketSizeUsd,
  idleAssetUsd,
  defiInvestedUsd,
  highRiskExposurePct,
}: {
  bucketSizeUsd: number;
  idleAssetUsd: number;
  defiInvestedUsd: number;
  highRiskExposurePct: number | null;
}) => {
  const idleFirstUsd = Number(idleAssetUsd.toFixed(2));
  const highRiskOnlyUsd = Number((defiInvestedUsd * (highRiskExposurePct ?? 0)).toFixed(2));
  const combinedUsd = Number(Math.min(bucketSizeUsd, idleFirstUsd + highRiskOnlyUsd).toFixed(2));
  const quarterUsd = Number((bucketSizeUsd * 0.25).toFixed(2));
  const halfUsd = Number((bucketSizeUsd * 0.5).toFixed(2));
  const allUsd = Number(bucketSizeUsd.toFixed(2));

  const baseline =
    combinedUsd > 0
      ? combinedUsd
      : idleFirstUsd > 0
        ? idleFirstUsd
        : highRiskOnlyUsd > 0
          ? highRiskOnlyUsd
          : quarterUsd;
  const recommendedUsd =
    bucketSizeUsd <= DEFAULT_METHODOLOGY.minMoveUsd
      ? allUsd
      : Number(Math.min(bucketSizeUsd, Math.max(DEFAULT_METHODOLOGY.minMoveUsd, baseline)).toFixed(2));

  return {
    recommendedUsd,
    idleFirstUsd,
    highRiskOnlyUsd,
    combinedUsd,
    quarterUsd,
    halfUsd,
    allUsd,
  };
};

const computeSimplicityGain = ({
  positionsBefore,
  positionsAfter,
}: {
  positionsBefore: number;
  positionsAfter: number;
}) => {
  if (positionsBefore <= 0) return 0;
  return Math.max(0, (positionsBefore - positionsAfter) / positionsBefore);
};

const computeComplexityNorm = ({
  positions,
  protocols,
  chains,
}: {
  positions: number;
  protocols: number;
  chains: number;
}) => {
  const raw =
    DEFAULT_METHODOLOGY.complexityWeights.positions * Math.log(1 + positions) +
    DEFAULT_METHODOLOGY.complexityWeights.protocols * Math.log(1 + protocols) +
    DEFAULT_METHODOLOGY.complexityWeights.chains * Math.log(1 + chains);
  const rawMax =
    DEFAULT_METHODOLOGY.complexityWeights.positions * Math.log(1 + 12) +
    DEFAULT_METHODOLOGY.complexityWeights.protocols * Math.log(1 + 8) +
    DEFAULT_METHODOLOGY.complexityWeights.chains * Math.log(1 + 5);
  return clamp01(raw / Math.max(rawMax, 1e-9));
};

const computeVaultQualityScore = (vaultMetrics: BucketMetricsComputation) => {
  const weightedRiskPenalty = clamp01(((vaultMetrics.weightedRiskScore ?? 3.5) - 1) / 3);
  const highRiskPenalty = vaultMetrics.highRiskExposurePct ?? 1;
  const unknownPenalty = vaultMetrics.unknownRiskExposurePct ?? 1;
  const concentrationPenalty = vaultMetrics.protocolHHI ?? 1;
  const fragilityPenalty = vaultMetrics.top1ProtocolShare;
  const fallback =
    1 -
    clamp01(
      0.28 * weightedRiskPenalty +
        0.2 * highRiskPenalty +
        0.2 * unknownPenalty +
        0.18 * concentrationPenalty +
        0.14 * fragilityPenalty,
    );
  const savingsBase = vaultMetrics.savingsScore !== null ? clamp01(vaultMetrics.savingsScore / 100) : fallback;
  return clamp01(savingsBase * 0.75 + (1 - unknownPenalty) * 0.15 + (1 - concentrationPenalty) * 0.1);
};

const scaleMap = (values: Record<string, number>, ratio: number) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value * ratio]));

const mergeUsdMaps = (...maps: Record<string, number>[]) => {
  const merged: Record<string, number> = {};
  for (const current of maps) {
    for (const [key, value] of Object.entries(current)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
};

const computeBlendedMetrics = ({
  userMetrics,
  vaultMetrics,
  moveUsd,
}: {
  userMetrics: BucketMetricsComputation;
  vaultMetrics: BucketMetricsComputation;
  moveUsd: number;
}): BlendedMetrics => {
  const x = Math.min(moveUsd, userMetrics.bucketSizeUsd);
  const movedIdleUsd = Math.min(x, userMetrics.idleAssetUsd);
  const movedDefiUsd = Math.min(Math.max(0, x - movedIdleUsd), userMetrics.defiInvestedUsd);
  const remainingCurrentDefiUsd = Math.max(0, userMetrics.defiInvestedUsd - movedDefiUsd);
  const remainingIdleUsd = Math.max(0, userMetrics.idleAssetUsd - movedIdleUsd);
  const totalDefiAfterUsd = remainingCurrentDefiUsd + x;
  const migrationRatio = userMetrics.bucketSizeUsd > 0 ? x / userMetrics.bucketSizeUsd : 0;

  const weightedRiskAfter =
    totalDefiAfterUsd > 0
      ? (((userMetrics.weightedRiskScore ?? 0) * remainingCurrentDefiUsd) +
          ((vaultMetrics.weightedRiskScore ?? 0) * x)) /
        totalDefiAfterUsd
      : null;
  const highRiskAfter =
    totalDefiAfterUsd > 0
      ? (((userMetrics.highRiskExposurePct ?? 0) * remainingCurrentDefiUsd) +
          ((vaultMetrics.highRiskExposurePct ?? 0) * x)) /
        totalDefiAfterUsd
      : null;
  const unknownRiskAfter =
    totalDefiAfterUsd > 0
      ? (((userMetrics.unknownRiskExposurePct ?? 0) * remainingCurrentDefiUsd) +
          ((vaultMetrics.unknownRiskExposurePct ?? 0) * x)) /
        totalDefiAfterUsd
      : null;

  const currentProtocolUsd = weightMapToUsdMap(userMetrics.protocolWeights, userMetrics.defiInvestedUsd);
  const remainingProtocolUsd =
    userMetrics.defiInvestedUsd > 0 ? scaleMap(currentProtocolUsd, remainingCurrentDefiUsd / userMetrics.defiInvestedUsd) : {};
  const vaultProtocolUsd = weightMapToUsdMap(vaultMetrics.protocolWeights, x);
  const blendedProtocolUsd = mergeUsdMaps(remainingProtocolUsd, vaultProtocolUsd);
  const protocolWeightsAfter = usdMapToWeightMap(blendedProtocolUsd);
  const protocolHHIAfter = totalDefiAfterUsd > 0 ? hhi(protocolWeightsAfter) : null;

  const currentStrategyUsd = weightMapToUsdMap(userMetrics.strategyWeights, userMetrics.bucketSizeUsd);
  const remainingStrategyUsd: Record<string, number> = {};
  for (const [key, usd] of Object.entries(currentStrategyUsd)) {
    if (key === "spot_idle") {
      remainingStrategyUsd[key] = userMetrics.idleAssetUsd > 0 ? usd * (remainingIdleUsd / userMetrics.idleAssetUsd) : 0;
      continue;
    }
    remainingStrategyUsd[key] =
      userMetrics.defiInvestedUsd > 0 ? usd * (remainingCurrentDefiUsd / userMetrics.defiInvestedUsd) : 0;
  }
  const vaultStrategyUsd = weightMapToUsdMap(vaultMetrics.strategyWeights, x);
  const blendedStrategyUsd = mergeUsdMaps(remainingStrategyUsd, vaultStrategyUsd);
  const strategyWeightsAfter = usdMapToWeightMap(blendedStrategyUsd);
  const strategyHHIAfter = userMetrics.bucketSizeUsd > 0 ? hhi(strategyWeightsAfter) : null;

  const afterProtocolCount = Object.keys(protocolWeightsAfter).length;
  const afterChainCount = userMetrics.chainCount > 0 ? userMetrics.chainCount : vaultMetrics.chainCount;
  const complexityAfter = computeComplexityNorm({
    positions: Math.max(0, userMetrics.positionCount - (movedIdleUsd > 0 ? 1 : 0) - (movedDefiUsd > 0 ? 1 : 0)) + (x > 0 ? 1 : 0),
    protocols: afterProtocolCount,
    chains: afterChainCount,
  });
  const savingsScoreAfter = computeSavingsScore({
    weightedRiskScore: weightedRiskAfter,
    highRiskExposurePct: highRiskAfter,
    protocolHHI: protocolHHIAfter,
    complexityNorm: complexityAfter,
    unknownRiskExposurePct: unknownRiskAfter,
    idleSharePct: userMetrics.bucketSizeUsd > 0 ? remainingIdleUsd / userMetrics.bucketSizeUsd : 0,
  });

  const removedIdlePositions =
    movedIdleUsd > 0 && userMetrics.idleAssetUsd > 0
      ? Math.min(
          userMetrics.idlePositionCount,
          Math.floor((movedIdleUsd / userMetrics.idleAssetUsd) * userMetrics.idlePositionCount),
        )
      : 0;
  const removedDefiPositions =
    movedDefiUsd > 0 && userMetrics.defiInvestedUsd > 0
      ? Math.min(
          userMetrics.defiPositionCount,
          Math.floor((movedDefiUsd / userMetrics.defiInvestedUsd) * userMetrics.defiPositionCount),
        )
      : 0;
  const positionsAfter = Math.max(0, userMetrics.positionCount - removedIdlePositions - removedDefiPositions) + (x > 0 ? 1 : 0);

  return {
    moveUsd: x,
    movedIdleUsd,
    movedDefiUsd,
    migrationRatio,
    remainingIdleUsd,
    weightedRiskAfter,
    highRiskAfter,
    unknownRiskAfter,
    protocolHHIAfter,
    strategyHHIAfter,
    protocolWeightsAfter,
    strategyWeightsAfter,
    top1ProtocolShareAfter: topShare(protocolWeightsAfter),
    top1StrategyShareAfter: topShare(strategyWeightsAfter),
    effectiveProtocolCountAfter: effectiveCount(protocolWeightsAfter),
    effectiveStrategyCountAfter: effectiveCount(strategyWeightsAfter),
    savingsScoreAfter,
    positionsAfter,
  };
};

const buildConfidence = ({
  bucketMode,
  userMetrics,
  vaultMetrics,
  avgMatchingConfidence,
  structuralSignalBoost,
}: {
  bucketMode: BucketMode;
  userMetrics: BucketMetricsComputation;
  vaultMetrics: BucketMetricsComputation;
  avgMatchingConfidence: number;
  structuralSignalBoost: number;
}): { raw: number; label: RecommendationConfidence } => {
  const userCoverage = bucketMode === "idle_only" ? 1 : userMetrics.riskCoveragePct ?? 0;
  const vaultCoverage = vaultMetrics.riskCoveragePct ?? 0;
  const maxUnknown = Math.max(userMetrics.unknownRiskExposurePct ?? 0, vaultMetrics.unknownRiskExposurePct ?? 0);

  let raw = 0.42 * avgMatchingConfidence + 0.24 * userCoverage + 0.14 * vaultCoverage + 0.2 * structuralSignalBoost;
  if (userMetrics.bucketSizeUsd < DEFAULT_METHODOLOGY.minBucketUsd) raw -= 0.05;
  if (maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct) {
    raw -= 0.03;
    raw = Math.min(raw, structuralSignalBoost >= 0.72 ? 0.82 : 0.68);
  } else if (maxUnknown > DEFAULT_METHODOLOGY.highUnknownRiskPct) {
    raw -= 0.01;
    raw = Math.min(raw, structuralSignalBoost >= 0.72 ? 0.9 : 0.82);
  }

  raw = clamp01(raw);

  if (raw >= 0.64) return { raw, label: "high" };
  if (raw >= 0.4) return { raw, label: "medium" };
  return { raw, label: "low" };
};

const deriveSafetyClaimLevel = ({
  primaryIntent,
  benefitFlags,
  confidence,
  maxUnknown,
}: {
  primaryIntent: RecommendationIntent;
  benefitFlags: RecommendationBenefitFlags;
  confidence: RecommendationConfidence;
  maxUnknown: number;
}): SafetyClaimLevel => {
  const hasMeasuredRiskClaim = benefitFlags.improvesWeightedRisk || benefitFlags.reducesHighRiskExposure;

  if (primaryIntent === "idle_deployment" && !hasMeasuredRiskClaim) return "none";
  if (!hasMeasuredRiskClaim && benefitFlags.improvesDiversification) return "cautious";
  if (maxUnknown > DEFAULT_METHODOLOGY.highUnknownRiskPct || confidence === "low") return hasMeasuredRiskClaim ? "cautious" : "none";
  if (hasMeasuredRiskClaim && confidence === "high" && maxUnknown <= DEFAULT_METHODOLOGY.maxUnknownRiskPct) return "strong";
  if (hasMeasuredRiskClaim) return "moderate";
  return "none";
};

const classifyStrength = ({
  score,
  actionability,
  primaryIntent,
  confidence,
}: {
  score: number;
  actionability: Actionability;
  primaryIntent: RecommendationIntent;
  confidence: RecommendationConfidence;
}): RecommendationStrength => {
  if (actionability === "suppressed" || score < 0.18) return "none";

  let strength: RecommendationStrength = "weak";
  if (score >= 0.75) strength = "strong";
  else if (score >= 0.55) strength = "medium";
  else if (score >= 0.32) strength = "weak";

  if (actionability === "informational_only") {
    if (strength === "strong") return "medium";
    return strength === "medium" ? "weak" : strength;
  }
  if (primaryIntent === "idle_deployment" && confidence !== "high" && strength === "strong") {
    return "medium";
  }
  return strength;
};

const determineCtaMode = ({
  actionability,
  confidence,
}: {
  actionability: Actionability;
  confidence: RecommendationConfidence;
}): CtaMode => {
  if (actionability === "suppressed") return "disabled";
  if (actionability === "informational_only") return "learn_more";
  if (confidence === "low") return "learn_more";
  return "deposit";
};

const determinePrimaryIntent = ({
  userMetrics,
  diversificationGain,
  riskSignalScore,
}: {
  userMetrics: BucketMetricsComputation;
  diversificationGain: number;
  riskSignalScore: number;
}): RecommendationIntent => {
  const mostlyIdle =
    userMetrics.defiInvestedUsd <= 0 || userMetrics.idleSharePct >= DEFAULT_METHODOLOGY.mostlyIdleShareThreshold;
  if (mostlyIdle) return "idle_deployment";

  const concentrationProblem =
    userMetrics.protocolCount <= 1 ||
    userMetrics.top1ProtocolShare >= DEFAULT_METHODOLOGY.diversificationIntentTop1Threshold ||
    (userMetrics.protocolHHI ?? 0) >= DEFAULT_METHODOLOGY.diversificationIntentHHIThreshold;
  const severeConcentrationProblem =
    userMetrics.protocolCount <= 1 ||
    userMetrics.top1ProtocolShare >= 0.9 ||
    (userMetrics.protocolHHI ?? 0) >= 0.9;

  if (
    concentrationProblem &&
    diversificationGain >= (severeConcentrationProblem ? 0.08 : 0.12) &&
    (severeConcentrationProblem || diversificationGain >= riskSignalScore || riskSignalScore < 0.2)
  ) {
    return "diversification_improvement";
  }

  return "risk_improvement";
};

const deriveReasonCodes = ({
  primaryIntent,
  recommendationType,
  benefitFlags,
  protocolOverlapPct,
  maxUnknown,
  isAlreadyInTargetVault,
  vaultTooWeakForIdleDeployment,
}: {
  primaryIntent: RecommendationIntent;
  recommendationType: RecommendationType;
  benefitFlags: RecommendationBenefitFlags;
  protocolOverlapPct: number;
  maxUnknown: number;
  isAlreadyInTargetVault: boolean;
  vaultTooWeakForIdleDeployment: boolean;
}) => {
  const reasons: string[] = [];

  if (benefitFlags.improvesWeightedRisk) reasons.push("LOWER_WEIGHTED_RISK");
  if (benefitFlags.reducesHighRiskExposure) reasons.push("LOWER_HIGH_RISK_EXPOSURE");
  if (benefitFlags.improvesSavingsScore) reasons.push("HIGHER_SAVINGS_SCORE");
  if (benefitFlags.improvesDiversification) reasons.push("LOWER_PROTOCOL_CONCENTRATION");
  if (benefitFlags.improvesSimplicity) reasons.push("SIMPLER_STRUCTURE");
  if (benefitFlags.deploysIdleCapital) reasons.push("UNLOCK_IDLE_CAPITAL");
  if (protocolOverlapPct < DEFAULT_METHODOLOGY.lowOverlapPct) reasons.push("LOW_OVERLAP");
  if (primaryIntent === "idle_deployment") reasons.push("IDLE_ONLY_BUCKET");
  if (isAlreadyInTargetVault) reasons.push("ALREADY_IN_YO");
  if (recommendationType === "no_incremental_improvement") reasons.push("NO_INCREMENTAL_IMPROVEMENT");
  if (recommendationType === "informational_only" && maxUnknown > DEFAULT_METHODOLOGY.maxUnknownRiskPct) {
    reasons.push("INFORMATIONAL_ONLY_LOW_COVERAGE");
  }
  if (recommendationType === "informational_only" && maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct) {
    reasons.push("INFORMATIONAL_ONLY_HIGH_UNKNOWN");
  }
  if (maxUnknown > DEFAULT_METHODOLOGY.maxUnknownRiskPct) reasons.push("TOO_MUCH_UNKNOWN_RISK");
  if (vaultTooWeakForIdleDeployment) reasons.push("VAULT_PROFILE_TOO_WEAK_FOR_IDLE_DEPLOYMENT");

  return reasons;
};

const buildCaveats = ({
  primaryIntent,
  actionability,
  safetyClaimLevel,
  userMetrics,
  vaultMetrics,
  isAlreadyInTargetVault,
}: {
  primaryIntent: RecommendationIntent;
  actionability: Actionability;
  safetyClaimLevel: SafetyClaimLevel;
  userMetrics: BucketMetricsComputation;
  vaultMetrics: BucketMetricsComputation;
  isAlreadyInTargetVault: boolean;
}) => {
  const caveats: string[] = [];
  const maxUnknown = Math.max(userMetrics.unknownRiskExposurePct ?? 0, vaultMetrics.unknownRiskExposurePct ?? 0);

  if (primaryIntent === "idle_deployment") {
    caveats.push("This is primarily an idle-capital deployment recommendation, not a claim that your current setup is inferior.");
  }
  if (maxUnknown > DEFAULT_METHODOLOGY.highUnknownRiskPct) {
    caveats.push("Public risk coverage is incomplete, so safety claims are capped even when structural metrics improve.");
  }
  if (actionability === "informational_only") {
    caveats.push("Treat this as an informational comparison rather than a strong deposit push.");
  }
  if (safetyClaimLevel === "cautious" && primaryIntent === "diversification_improvement") {
    caveats.push("Diversification improvement is directly measurable here, but full risk comparability is limited by coverage.");
  }
  if ((vaultMetrics.unknownRiskExposurePct ?? 0) > 0) {
    caveats.push("Some YO underlying allocations still have unknown external risk mapping.");
  }
  if (isAlreadyInTargetVault) {
    caveats.push("You already have meaningful YO exposure in this bucket, so extra allocation should clear a higher incremental bar.");
  }
  if (userMetrics.bucketSizeUsd < DEFAULT_METHODOLOGY.minBucketUsd) {
    caveats.push("Bucket size is below the primary recommendation threshold.");
  }

  return caveats;
};

const analyzeRecommendation = ({
  userMetrics,
  vault,
  vaultMetrics,
  tokenExposures = [],
}: RankerInputs): RecommendationAnalysis => {
  const bucketMode = toBucketMode(userMetrics);
  const existingYoSharePct = computeExistingYoSharePct({
    bucket: vault.bucket,
    vault,
    tokenExposures,
    bucketSizeUsd: userMetrics.bucketSizeUsd,
  });
  const isAlreadyInTargetVault = existingYoSharePct >= DEFAULT_METHODOLOGY.alreadyInTargetVaultPct;
  const suggestedAmounts = computeSuggestedAmountsUsd({
    bucketSizeUsd: userMetrics.bucketSizeUsd,
    idleAssetUsd: userMetrics.idleAssetUsd,
    defiInvestedUsd: userMetrics.defiInvestedUsd,
    highRiskExposurePct: userMetrics.highRiskExposurePct,
  });
  const blended = computeBlendedMetrics({
    userMetrics,
    vaultMetrics,
    moveUsd: suggestedAmounts.recommendedUsd,
  });

  const protocolOverlapPct = protocolOverlap(userMetrics.protocolWeights, vaultMetrics.protocolWeights);
  const protocolDistance = protocolDistanceL1(userMetrics.protocolWeights, vaultMetrics.protocolWeights);
  const strategyDistance = protocolDistanceL1(userMetrics.strategyWeights, vaultMetrics.strategyWeights);
  const similarity = 1 - protocolDistance;
  const strategyFitGain = Math.max(0, 1 - strategyDistance);
  const avgMatchingConfidence =
    vault.allocation.reduce((sum, exposure) => sum + exposure.matchingConfidence, 0) / Math.max(vault.allocation.length, 1);

  const weightedRiskDelta =
    userMetrics.weightedRiskScore !== null && blended.weightedRiskAfter !== null
      ? userMetrics.weightedRiskScore - blended.weightedRiskAfter
      : 0;
  const highRiskDelta =
    userMetrics.highRiskExposurePct !== null && blended.highRiskAfter !== null
      ? userMetrics.highRiskExposurePct - blended.highRiskAfter
      : 0;
  const savingsScoreDelta =
    userMetrics.savingsScore !== null && blended.savingsScoreAfter !== null
      ? blended.savingsScoreAfter - userMetrics.savingsScore
      : 0;

  const riskGain = normalizedReduction(userMetrics.weightedRiskScore, blended.weightedRiskAfter);
  const highRiskGain = clamp01(Math.max(0, highRiskDelta));
  const savingsGain = clamp01(Math.max(0, savingsScoreDelta) / 25);
  const concentrationGain = normalizedReduction(userMetrics.protocolHHI, blended.protocolHHIAfter);
  const strategyConcentrationGain = normalizedReduction(userMetrics.strategyHHI, blended.strategyHHIAfter);
  const top1ProtocolGain = clamp01(Math.max(0, userMetrics.top1ProtocolShare - blended.top1ProtocolShareAfter));
  const top1StrategyGain = clamp01(Math.max(0, userMetrics.top1StrategyShare - blended.top1StrategyShareAfter));
  const effectiveProtocolGain = normalizedIncrease(
    effectiveCount(userMetrics.protocolWeights),
    blended.effectiveProtocolCountAfter,
  );
  const effectiveStrategyGain = normalizedIncrease(
    effectiveCount(userMetrics.strategyWeights),
    blended.effectiveStrategyCountAfter,
  );
  const diversificationGain = clamp01(
    0.32 * concentrationGain +
      0.16 * strategyConcentrationGain +
      0.18 * top1ProtocolGain +
      0.12 * top1StrategyGain +
      0.12 * effectiveProtocolGain +
      0.1 * effectiveStrategyGain,
  );

  const simplicityGain = computeSimplicityGain({
    positionsBefore: userMetrics.positionCount,
    positionsAfter: blended.positionsAfter,
  });
  const idleValueNorm = clamp01(userMetrics.idleAssetUsd / DEFAULT_METHODOLOGY.idleScaleUsd);
  const yieldOpportunityUsd = Number(((userMetrics.idleAssetUsd * Math.max(vault.apyPct, 0)) / 100).toFixed(2));
  const yieldOpportunityGain = clamp01(yieldOpportunityUsd / Math.max(DEFAULT_METHODOLOGY.idleScaleUsd * 0.1, 1));
  const apyGain = clamp01(vault.apyPct / 12);
  const vaultQualityScore = computeVaultQualityScore(vaultMetrics);
  const idleDeploymentGain = clamp01(
    (0.45 * userMetrics.idleSharePct + 0.25 * idleValueNorm + 0.15 * yieldOpportunityGain + 0.15 * apyGain) *
      (0.55 + 0.45 * vaultQualityScore),
  );
  const concentrationProblemScore = clamp01(
    (userMetrics.protocolCount <= 1 ? 0.4 : 0) +
      0.35 * userMetrics.top1ProtocolShare +
      0.25 * (userMetrics.protocolHHI ?? 0),
  );
  const riskSignalScore = Math.max(riskGain, highRiskGain, savingsGain);
  const primaryIntent = determinePrimaryIntent({
    userMetrics,
    diversificationGain,
    riskSignalScore,
  });

  const benefitFlags: RecommendationBenefitFlags = {
    improvesDiversification: diversificationGain >= 0.12,
    deploysIdleCapital: userMetrics.idleAssetUsd > 0 && blended.movedIdleUsd > 0 && idleDeploymentGain >= 0.2,
    improvesWeightedRisk: weightedRiskDelta >= DEFAULT_METHODOLOGY.minAbsRiskDelta,
    reducesHighRiskExposure: highRiskDelta >= DEFAULT_METHODOLOGY.minHreDelta,
    improvesSavingsScore: savingsScoreDelta >= DEFAULT_METHODOLOGY.minSpsDelta,
    improvesSimplicity: simplicityGain >= 0.15,
  };
  const coreBenefitCount = [
    benefitFlags.improvesWeightedRisk,
    benefitFlags.reducesHighRiskExposure,
    benefitFlags.improvesSavingsScore,
  ].filter(Boolean).length;

  const sizePenalty =
    userMetrics.bucketSizeUsd < DEFAULT_METHODOLOGY.minBucketUsd
      ? 1 - userMetrics.bucketSizeUsd / DEFAULT_METHODOLOGY.minBucketUsd
      : 0;
  const userUnknown = userMetrics.unknownRiskExposurePct ?? 0;
  const vaultUnknown = vaultMetrics.unknownRiskExposurePct ?? 0;
  const maxUnknown = Math.max(userUnknown, vaultUnknown);
  const riskUnknownPenalty = clamp01((0.55 * userUnknown + 0.45 * vaultUnknown) / DEFAULT_METHODOLOGY.unknownPenaltyScale);
  const diversificationUnknownPenalty = clamp01(
    (0.35 * userUnknown + 0.65 * vaultUnknown) / DEFAULT_METHODOLOGY.unknownPenaltyScale,
  );
  const idleUnknownPenalty = clamp01((0.2 * userUnknown + 0.8 * vaultUnknown) / DEFAULT_METHODOLOGY.unknownPenaltyScale);

  const riskScore = clamp01(
    0.34 * riskGain +
      0.24 * highRiskGain +
      0.18 * savingsGain +
      0.12 * diversificationGain +
      0.06 * simplicityGain +
      0.06 * similarity -
      0.08 * riskUnknownPenalty -
      0.05 * sizePenalty,
  );
  const diversificationScore = clamp01(
    0.44 * diversificationGain +
      0.18 * concentrationProblemScore +
      0.12 * riskGain +
      0.08 * highRiskGain +
      0.08 * simplicityGain +
      0.1 * strategyFitGain -
      0.06 * diversificationUnknownPenalty -
      0.04 * sizePenalty,
  );
  const idleScore = clamp01(
    0.42 * idleDeploymentGain +
      0.18 * idleValueNorm +
      0.12 * yieldOpportunityGain +
      0.16 * vaultQualityScore +
      0.06 * simplicityGain +
      0.06 * diversificationGain -
      0.07 * idleUnknownPenalty -
      0.04 * sizePenalty -
      (isVaultTooWeakForIdleDeployment(vaultMetrics) ? 0.08 : 0),
  );

  const strongMeasuredImprovementCase =
    coreBenefitCount >= 2 &&
    (benefitFlags.improvesWeightedRisk || benefitFlags.reducesHighRiskExposure || benefitFlags.improvesSavingsScore);

  const scoreByIntent: Record<RecommendationIntent, number> = {
    risk_improvement: riskScore,
    diversification_improvement: diversificationScore,
    idle_deployment: idleScore,
  };

  const hasPositiveSignal =
    benefitFlags.improvesWeightedRisk ||
    benefitFlags.reducesHighRiskExposure ||
    benefitFlags.improvesSavingsScore ||
    benefitFlags.improvesDiversification ||
    benefitFlags.deploysIdleCapital ||
    benefitFlags.improvesSimplicity;
  const hasMeasuredAnalytics =
    userMetrics.weightedRiskScore !== null ||
    userMetrics.highRiskExposurePct !== null ||
    userMetrics.savingsScore !== null ||
    userMetrics.protocolHHI !== null ||
    userMetrics.idleAssetUsd > 0;
  const hasIncrementalImprovement =
    benefitFlags.improvesWeightedRisk ||
    benefitFlags.reducesHighRiskExposure ||
    benefitFlags.improvesSavingsScore ||
    benefitFlags.improvesDiversification ||
    (benefitFlags.deploysIdleCapital && vaultQualityScore >= 0.35);
  const concentratedDiversificationCase =
    primaryIntent === "diversification_improvement" &&
    benefitFlags.improvesDiversification &&
    concentrationProblemScore >= 0.72 &&
    diversificationGain >= 0.14;
  const idleDeploymentCase =
    primaryIntent === "idle_deployment" && benefitFlags.deploysIdleCapital && idleDeploymentGain >= 0.2;
  const structuralSignalBoost = clamp01(
    0.42 * riskGain +
      0.22 * highRiskGain +
      0.18 * savingsGain +
      0.12 * diversificationGain +
      0.06 * Number(benefitFlags.deploysIdleCapital),
  );
  const lowOverlapBonus = protocolOverlapPct < DEFAULT_METHODOLOGY.lowOverlapPct ? 0.04 : 0;
  const measuredImprovementScoreFloor = strongMeasuredImprovementCase
    ? clamp01(
        0.62 +
          (coreBenefitCount >= 3 ? 0.08 : 0) +
          (benefitFlags.deploysIdleCapital ? 0.04 : 0) +
          (benefitFlags.improvesDiversification ? 0.03 : 0) +
          lowOverlapBonus -
          (maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct ? 0.03 : 0),
      )
    : 0;
  const baseScore = scoreByIntent[primaryIntent] ?? 0;
  const score = Math.max(baseScore, measuredImprovementScoreFloor);

  const confidence = buildConfidence({
    bucketMode,
    userMetrics,
    vaultMetrics,
    avgMatchingConfidence,
    structuralSignalBoost,
  });
  const safetyClaimLevel = deriveSafetyClaimLevel({
    primaryIntent,
    benefitFlags,
    confidence: confidence.label,
    maxUnknown,
  });
  const vaultTooWeakForIdleDeployment = isVaultTooWeakForIdleDeployment(vaultMetrics);

  let actionability: Actionability = "actionable";
  if (isAlreadyInTargetVault && !hasIncrementalImprovement) {
    actionability = "suppressed";
  } else if (
    (!hasPositiveSignal && !hasMeasuredAnalytics) ||
    (score < 0.22 && !concentratedDiversificationCase && !idleDeploymentCase && !strongMeasuredImprovementCase)
  ) {
    actionability = "suppressed";
  } else if (userMetrics.bucketSizeUsd < DEFAULT_METHODOLOGY.minBucketUsd * 0.5) {
    actionability = "suppressed";
  } else if (primaryIntent === "idle_deployment" && vaultTooWeakForIdleDeployment) {
    actionability = score >= 0.45 ? "informational_only" : "suppressed";
  } else if (strongMeasuredImprovementCase && maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct) {
    actionability = coreBenefitCount >= 3 ? "actionable" : "cautious_actionable";
  } else if (strongMeasuredImprovementCase) {
    actionability = "actionable";
  } else if (concentratedDiversificationCase && maxUnknown <= DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct) {
    actionability = confidence.label === "low" ? "informational_only" : "cautious_actionable";
  } else if (
    maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct &&
    (primaryIntent === "risk_improvement" || score < 0.7)
  ) {
    actionability = benefitFlags.improvesDiversification ? "cautious_actionable" : "informational_only";
  } else if (maxUnknown > DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct) {
    actionability = "cautious_actionable";
  } else if (maxUnknown > DEFAULT_METHODOLOGY.highUnknownRiskPct) {
    actionability = score >= 0.32 ? "cautious_actionable" : "informational_only";
  } else if (confidence.label === "low") {
    actionability = score >= 0.38 ? "cautious_actionable" : "informational_only";
  }

  let recommendationType: RecommendationType;
  if (isAlreadyInTargetVault && !hasIncrementalImprovement) {
    recommendationType = "already_in_yo";
  } else if (actionability === "suppressed") {
    recommendationType = "no_incremental_improvement";
  } else if (actionability === "informational_only") {
    recommendationType = "informational_only";
  } else if (primaryIntent === "idle_deployment") {
    recommendationType = "idle_opportunity";
  } else {
    recommendationType = "migration";
  }

  const strength = classifyStrength({
    score,
    actionability,
    primaryIntent,
    confidence: confidence.label,
  });
  const ctaMode = determineCtaMode({
    actionability,
    confidence: confidence.label,
  });
  const ctaEnabled = ctaMode === "deposit";
  const eligible = actionability === "actionable" || actionability === "cautious_actionable";
  const showBeforeAfterBars =
    primaryIntent !== "idle_deployment" &&
    userMetrics.weightedRiskScore !== null &&
    userMetrics.highRiskExposurePct !== null &&
    userMetrics.savingsScore !== null;
  const showCoverageBar = true;
  const showIdleOpportunityVisual = primaryIntent === "idle_deployment" || userMetrics.idleSharePct > 0.15;

  const reasonCodes = deriveReasonCodes({
    primaryIntent,
    recommendationType,
    benefitFlags,
    protocolOverlapPct,
    maxUnknown,
    isAlreadyInTargetVault,
    vaultTooWeakForIdleDeployment,
  });
  const caveats = buildCaveats({
    primaryIntent,
    actionability,
    safetyClaimLevel,
    userMetrics,
    vaultMetrics,
    isAlreadyInTargetVault,
  });

  return {
    bucketMode,
    existingYoSharePct,
    isAlreadyInTargetVault,
    suggestedAmounts,
    blended,
    primaryIntent,
    recommendationType,
    actionability,
    safetyClaimLevel,
    benefitFlags,
    score,
    eligible,
    strength,
    confidence,
    ctaMode,
    ctaEnabled,
    showBeforeAfterBars,
    showCoverageBar,
    showIdleOpportunityVisual,
    reasonCodes,
    caveats,
    diagnostics: {
      avgMatchingConfidence,
      riskGain,
      highRiskGain,
      savingsGain,
      concentrationGain,
      diversificationGain,
      idleDeploymentGain,
      vaultQualityScore,
      simplicityGain,
      similarity,
      strategyFitGain,
      unknownPenalty:
        primaryIntent === "risk_improvement"
          ? riskUnknownPenalty
          : primaryIntent === "diversification_improvement"
            ? diversificationUnknownPenalty
            : idleUnknownPenalty,
      sizePenalty,
      protocolOverlapPct,
      protocolDistance,
      strategyDistance,
    },
  };
};

export const buildRecommendation = ({
  userMetrics,
  vault,
  vaultMetrics,
  tokenExposures = [],
}: RankerInputs): RankedRecommendation => {
  const analysis = analyzeRecommendation({
    userMetrics,
    vault,
    vaultMetrics,
    tokenExposures,
  });

  return {
    bucket: vault.bucket as "USD" | "ETH" | "BTC",
    vaultSymbol: vault.vaultSymbol as "yoUSD" | "yoETH" | "yoBTC",
    vaultAddress: vault.vaultAddress,
    score: analysis.score,
    primaryIntent: analysis.primaryIntent,
    recommendationType: analysis.recommendationType,
    actionability: analysis.actionability,
    safetyClaimLevel: analysis.safetyClaimLevel,
    benefitFlags: analysis.benefitFlags,
    bucketMode: analysis.bucketMode,
    eligible: analysis.eligible,
    strength: analysis.strength,
    confidence: analysis.confidence.label,
    ctaEnabled: analysis.ctaEnabled,
    ctaMode: analysis.ctaMode,
    isAlreadyInTargetVault: analysis.isAlreadyInTargetVault,
    showBeforeAfterBars: analysis.showBeforeAfterBars,
    showCoverageBar: analysis.showCoverageBar,
    showIdleOpportunityVisual: analysis.showIdleOpportunityVisual,
    suggestedUsd: analysis.suggestedAmounts.recommendedUsd,
    suggestedAmounts: analysis.suggestedAmounts,
    metrics: {
      bucketSizeUsd: userMetrics.bucketSizeUsd,
      defiInvestedUsd: userMetrics.defiInvestedUsd,
      idleAssetUsd: userMetrics.idleAssetUsd,
      idleSharePct: userMetrics.idleSharePct,
      productiveSharePct: userMetrics.productiveSharePct,
      existingYoSharePct: analysis.existingYoSharePct,
      estimatedAnnualYieldOpportunityUsd: Number(((userMetrics.idleAssetUsd * vault.apyPct) / 100).toFixed(2)),
      vaultApyPct: vault.apyPct,
      vaultWeightedRisk: vaultMetrics.weightedRiskScore,
      vaultHighRiskExposurePct:
        vaultMetrics.highRiskExposurePct !== null ? vaultMetrics.highRiskExposurePct * 100 : null,
      vaultUnknownRiskExposurePct:
        vaultMetrics.unknownRiskExposurePct !== null ? vaultMetrics.unknownRiskExposurePct * 100 : null,
      vaultProtocolHHI: vaultMetrics.protocolHHI,
      weightedRiskBefore: userMetrics.weightedRiskScore,
      weightedRiskAfter: analysis.blended.weightedRiskAfter,
      weightedRiskImprovementPct:
        userMetrics.weightedRiskScore !== null && analysis.blended.weightedRiskAfter !== null && userMetrics.weightedRiskScore > 0
          ? ((userMetrics.weightedRiskScore - analysis.blended.weightedRiskAfter) / userMetrics.weightedRiskScore) * 100
          : null,
      highRiskBeforePct: userMetrics.highRiskExposurePct,
      highRiskAfterPct: analysis.blended.highRiskAfter,
      highRiskReductionPctPoints:
        userMetrics.highRiskExposurePct !== null && analysis.blended.highRiskAfter !== null
          ? (userMetrics.highRiskExposurePct - analysis.blended.highRiskAfter) * 100
          : 0,
      savingsScoreBefore: userMetrics.savingsScore,
      savingsScoreAfter: analysis.blended.savingsScoreAfter,
      savingsScoreDelta:
        userMetrics.savingsScore !== null && analysis.blended.savingsScoreAfter !== null
          ? analysis.blended.savingsScoreAfter - userMetrics.savingsScore
          : null,
      protocolHHIBefore: userMetrics.protocolHHI,
      protocolHHIAfter: analysis.blended.protocolHHIAfter,
      protocolConcentrationImprovementPct:
        userMetrics.protocolHHI !== null && analysis.blended.protocolHHIAfter !== null && userMetrics.protocolHHI > 0
          ? ((userMetrics.protocolHHI - analysis.blended.protocolHHIAfter) / userMetrics.protocolHHI) * 100
          : null,
      protocolOverlapPct: analysis.diagnostics.protocolOverlapPct * 100,
      protocolDistance: analysis.diagnostics.protocolDistance,
      strategyDistance: analysis.diagnostics.strategyDistance,
      positionsBefore: userMetrics.positionCount,
      positionsAfter: analysis.blended.positionsAfter,
      coveragePct: userMetrics.riskCoveragePct !== null ? userMetrics.riskCoveragePct * 100 : null,
      unknownRiskExposurePct:
        userMetrics.unknownRiskExposurePct !== null ? userMetrics.unknownRiskExposurePct * 100 : null,
    },
    reasonCodes: analysis.reasonCodes,
    caveats: analysis.caveats,
    visualization: {
      beforeAfterBars: analysis.showBeforeAfterBars
        ? [
            {
              key: "weighted_risk",
              label: "Weighted risk",
              before: userMetrics.weightedRiskScore,
              after: analysis.blended.weightedRiskAfter,
              format: "number",
              betterDirection: "lower",
            },
            {
              key: "high_risk_exposure",
              label: "High-risk exposure",
              before: userMetrics.highRiskExposurePct !== null ? userMetrics.highRiskExposurePct * 100 : null,
              after: analysis.blended.highRiskAfter !== null ? analysis.blended.highRiskAfter * 100 : null,
              format: "percent",
              betterDirection: "lower",
            },
            {
              key: "savings_score",
              label: "Savings score",
              before: userMetrics.savingsScore,
              after: analysis.blended.savingsScoreAfter,
              format: "number",
              betterDirection: "higher",
            },
            {
              key: "diversification_score",
              label: "Diversification",
              before: userMetrics.protocolHHI !== null ? (1 - userMetrics.protocolHHI) * 100 : null,
              after: analysis.blended.protocolHHIAfter !== null ? (1 - analysis.blended.protocolHHIAfter) * 100 : null,
              format: "percent",
              betterDirection: "higher",
            },
          ]
        : [],
      coverageBar: userMetrics.visualization.coverageBar,
      idleVsInvestedBar: userMetrics.visualization.idleVsInvestedBar,
      simplification: {
        beforePositions: userMetrics.positionCount,
        afterPositions: analysis.blended.positionsAfter,
      },
      currentComposition: {
        protocols: toCompositionEntries(userMetrics.protocolWeights),
        strategies: toCompositionEntries(userMetrics.strategyWeights),
      },
      yoComposition: {
        protocols: toExposureCompositionEntries({
          exposures: vault.allocation.map((exposure) => ({
            ...exposure,
            originalProtocolName: exposure.originalProtocolName ?? undefined,
          })),
          keySelector: (exposure) =>
            (exposure.originalProtocolName ?? exposure.canonicalProtocolName).toLowerCase().replaceAll(/\s+/g, "-"),
          labelSelector: (exposure) => exposure.originalProtocolName ?? exposure.canonicalProtocolName,
        }),
        strategies: toExposureCompositionEntries({
          exposures: vault.allocation.map((exposure) => ({
            ...exposure,
            originalProtocolName: exposure.originalProtocolName ?? undefined,
          })),
          keySelector: (exposure) => exposure.strategyType,
          labelSelector: (exposure) => exposure.strategyType.replaceAll("_", " "),
        }),
      },
    },
    llmExplanation: undefined,
  };
};

export const buildExplanationInput = ({
  userMetrics,
  vault,
  vaultMetrics,
  recommendation,
}: RankerInputs & {
  recommendation: RankedRecommendation;
}): ExplanationInput => {
  const analysis = analyzeRecommendation({
    userMetrics,
    vault,
    vaultMetrics,
  });
  const totalVaultUsd = vault.allocation.reduce((sum, exposure) => sum + exposure.usdValue, 0);
  const topAllocations = [...vault.allocation]
    .sort((left, right) => right.usdValue - left.usdValue)
    .slice(0, 5)
    .map((exposure) => ({
      canonicalProtocolId: exposure.canonicalProtocolId,
      canonicalProtocolName: exposure.canonicalProtocolName,
      chain: exposure.chain,
      strategyType: exposure.strategyType,
      riskGrade: exposure.riskGrade,
      riskScore: exposure.riskScore,
      usdValue: exposure.usdValue,
      weightPct: totalVaultUsd > 0 ? (exposure.usdValue / totalVaultUsd) * 100 : 0,
      matchingConfidence: exposure.matchingConfidence,
    }));

  return {
    bucket: recommendation.bucket,
    vaultSymbol: recommendation.vaultSymbol,
    vaultAddress: recommendation.vaultAddress,
    score: recommendation.score,
    strength: recommendation.strength,
    confidence: recommendation.confidence,
    suggestedUsd: recommendation.suggestedUsd,
    metrics: recommendation.metrics,
    userBucketMetrics: {
      totalUsd: userMetrics.totalUsd,
      bucketSizeUsd: userMetrics.bucketSizeUsd,
      defiInvestedUsd: userMetrics.defiInvestedUsd,
      idleAssetUsd: userMetrics.idleAssetUsd,
      idleSharePct: userMetrics.idleSharePct,
      productiveSharePct: userMetrics.productiveSharePct,
      riskCoveragePct: userMetrics.riskCoveragePct,
      weightedRiskScore: userMetrics.weightedRiskScore,
      highRiskExposurePct: userMetrics.highRiskExposurePct,
      mediumRiskExposurePct: userMetrics.mediumRiskExposurePct,
      unknownRiskExposurePct: userMetrics.unknownRiskExposurePct,
      protocolHHI: userMetrics.protocolHHI,
      chainHHI: userMetrics.chainHHI,
      strategyHHI: userMetrics.strategyHHI,
      savingsScore: userMetrics.savingsScore,
      positionCount: userMetrics.positionCount,
      defiPositionCount: userMetrics.defiPositionCount,
      idlePositionCount: userMetrics.idlePositionCount,
      protocolCount: userMetrics.protocolCount,
      chainCount: userMetrics.chainCount,
      top1ProtocolShare: userMetrics.top1ProtocolShare,
      top3ProtocolShare: userMetrics.top3ProtocolShare,
      top1ChainShare: userMetrics.top1ChainShare,
      top1StrategyShare: userMetrics.top1StrategyShare,
      complexityNorm: userMetrics.complexityNorm,
    },
    vaultMetrics: {
      totalUsd: vaultMetrics.totalUsd,
      bucketSizeUsd: vaultMetrics.bucketSizeUsd,
      defiInvestedUsd: vaultMetrics.defiInvestedUsd,
      idleAssetUsd: vaultMetrics.idleAssetUsd,
      idleSharePct: vaultMetrics.idleSharePct,
      productiveSharePct: vaultMetrics.productiveSharePct,
      riskCoveragePct: vaultMetrics.riskCoveragePct,
      weightedRiskScore: vaultMetrics.weightedRiskScore,
      highRiskExposurePct: vaultMetrics.highRiskExposurePct,
      mediumRiskExposurePct: vaultMetrics.mediumRiskExposurePct,
      unknownRiskExposurePct: vaultMetrics.unknownRiskExposurePct,
      protocolHHI: vaultMetrics.protocolHHI,
      chainHHI: vaultMetrics.chainHHI,
      strategyHHI: vaultMetrics.strategyHHI,
      savingsScore: vaultMetrics.savingsScore,
      positionCount: vaultMetrics.positionCount,
      defiPositionCount: vaultMetrics.defiPositionCount,
      idlePositionCount: vaultMetrics.idlePositionCount,
      protocolCount: vaultMetrics.protocolCount,
      chainCount: vaultMetrics.chainCount,
      top1ProtocolShare: vaultMetrics.top1ProtocolShare,
      top3ProtocolShare: vaultMetrics.top3ProtocolShare,
      top1ChainShare: vaultMetrics.top1ChainShare,
      top1StrategyShare: vaultMetrics.top1StrategyShare,
      complexityNorm: vaultMetrics.complexityNorm,
    },
    projectedMetrics: {
      migrationRatio: analysis.blended.migrationRatio,
      weightedRiskScore: analysis.blended.weightedRiskAfter,
      highRiskExposurePct: analysis.blended.highRiskAfter ?? 0,
      unknownRiskExposurePct: analysis.blended.unknownRiskAfter ?? 0,
      protocolHHI: analysis.blended.protocolHHIAfter,
      chainHHI: null,
      strategyHHI: analysis.blended.strategyHHIAfter,
      savingsScore: analysis.blended.savingsScoreAfter,
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
      avgMatchingConfidence: analysis.diagnostics.avgMatchingConfidence,
      riskGain: analysis.diagnostics.riskGain,
      highRiskGain: analysis.diagnostics.highRiskGain,
      savingsGain: analysis.diagnostics.savingsGain,
      concentrationGain: analysis.diagnostics.concentrationGain,
      diversificationGain: analysis.diagnostics.diversificationGain,
      idleDeploymentGain: analysis.diagnostics.idleDeploymentGain,
      vaultQualityScore: analysis.diagnostics.vaultQualityScore,
      simplicityGain: analysis.diagnostics.simplicityGain,
      similarity: analysis.diagnostics.similarity,
      strategyFitGain: analysis.diagnostics.strategyFitGain,
      unknownPenalty: analysis.diagnostics.unknownPenalty,
      sizePenalty: analysis.diagnostics.sizePenalty,
    },
    vault: {
      vaultAddress: vault.vaultAddress,
      chain: vault.chain,
      bucket: vault.bucket,
      apyPct: vault.apyPct,
      tvlUsd: vault.tvlUsd,
      riskGrade: vault.riskGrade,
      riskScore: vault.riskScore,
      allocationCount: vault.allocation.length,
      avgMatchingConfidence: analysis.diagnostics.avgMatchingConfidence,
      topAllocations,
    },
    reasonCodes: recommendation.reasonCodes,
    caveats: recommendation.caveats,
  };
};

export const buildRankedRecommendations = ({
  bucketMetrics,
  vaults,
  tokenExposures = [],
}: {
  bucketMetrics: Record<CanonicalBucket, ReturnType<typeof computeBucketMetrics>>;
  vaults: CanonicalYoVault[];
  tokenExposures?: CanonicalTokenExposure[];
}): RankedRecommendation[] => {
  const dedupedRecommendations = new Map<string, RankedRecommendation>();

  for (const vault of vaults.filter((candidate) => candidate.bucket !== "OTHER")) {
    const userMetrics = bucketMetrics[vault.bucket];
    const vaultMetrics = computeBucketMetrics(vault.bucket, vault.allocation);
    const recommendation = buildRecommendation({ userMetrics, vault, vaultMetrics, tokenExposures });
    const key = `${recommendation.bucket}:${recommendation.vaultAddress.toLowerCase()}`;
    const existing = dedupedRecommendations.get(key);

    if (!existing || recommendation.score > existing.score) {
      dedupedRecommendations.set(key, recommendation);
    }
  }

  return [...dedupedRecommendations.values()].sort((left, right) => right.score - left.score);
};
