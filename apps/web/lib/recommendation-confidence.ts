import type { RankedRecommendation } from "@whyyo/shared";

export type TrustMetricStatus = "green" | "yellow" | "orange" | "red" | "neutral";
export type RecommendationConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export const RECOMMENDATION_CONFIDENCE_CONFIG = {
  portfolioWeights: {
    weightedRisk: 30,
    savingsScore: 30,
    diversification: 25,
    highRiskExposure: 15,
  },
  trustWeights: {
    coverage: 50,
    vaultHighRisk: 20,
    overlap: 15,
    yoShare: 15,
  },
  trustThresholds: {
    coverage: {
      greenMin: 60,
      yellowMin: 30,
    },
    vaultHighRisk: {
      greenMax: 20,
      yellowMax: 30,
      orangeMax: 40,
    },
    overlap: {
      greenMax: 10,
      yellowMax: 30,
      orangeMax: 50,
    },
    yoShare: {
      greenMax: 10,
      yellowMax: 20,
      orangeMax: 30,
    },
  },
  portfolioDeltaNormalization: {
    weightedRisk: 0.4,
    savingsScore: 12,
    diversificationPctPoints: 15,
    highRiskExposurePctPoints: 10,
    fallbackImpactScore: 0.4,
  },
  hardLowRules: {
    coverageMin: 30,
    maxRedTrustMetricsBeforeLow: 1,
    maxNonImprovingPortfolioMetricsBeforeLow: 1,
  },
  bandThresholds: {
    impact: {
      mediumMin: 0.35,
      highMin: 0.65,
    },
    trust: {
      mediumMin: 0.45,
      highMin: 0.75,
    },
  },
  statusScores: {
    green: 1,
    yellow: 2 / 3,
    orange: 1 / 3,
    red: 0,
    neutral: 0.5,
  },
} as const;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const normalizeImprovement = (improvement: number | null, fullScoreAt: number): number | null =>
  improvement === null ? null : clamp01(improvement / fullScoreAt);

export const trustMetricToneClass = (status: TrustMetricStatus) => {
  switch (status) {
    case "green":
      return "text-lime";
    case "yellow":
      return "text-[#ffd84d]";
    case "orange":
      return "text-[#ff9f43]";
    case "red":
      return "text-[#ff6b6b]";
    default:
      return "text-white";
  }
};

export const getCoverageTrustStatus = (value: number | null): TrustMetricStatus => {
  if (value === null) return "neutral";
  if (value > RECOMMENDATION_CONFIDENCE_CONFIG.trustThresholds.coverage.greenMin) return "green";
  if (value >= RECOMMENDATION_CONFIDENCE_CONFIG.trustThresholds.coverage.yellowMin) return "yellow";
  return "red";
};

const getLowerBetterTrustStatus = ({
  value,
  greenMax,
  yellowMax,
  orangeMax,
}: {
  value: number | null;
  greenMax: number;
  yellowMax: number;
  orangeMax: number;
}): TrustMetricStatus => {
  if (value === null) return "neutral";
  if (value <= greenMax) return "green";
  if (value <= yellowMax) return "yellow";
  if (value <= orangeMax) return "orange";
  return "red";
};

export const getVaultHighRiskTrustStatus = (value: number | null) =>
  getLowerBetterTrustStatus({
    value,
    ...RECOMMENDATION_CONFIDENCE_CONFIG.trustThresholds.vaultHighRisk,
  });

export const getOverlapTrustStatus = (value: number | null) =>
  getLowerBetterTrustStatus({
    value,
    ...RECOMMENDATION_CONFIDENCE_CONFIG.trustThresholds.overlap,
  });

export const getYoShareTrustStatus = (value: number | null) =>
  getLowerBetterTrustStatus({
    value,
    ...RECOMMENDATION_CONFIDENCE_CONFIG.trustThresholds.yoShare,
  });

const getTrustStatusScore = (status: TrustMetricStatus) => RECOMMENDATION_CONFIDENCE_CONFIG.statusScores[status];

const getPortfolioDeltaDetails = (recommendation: RankedRecommendation) => {
  const weightedRiskImprovement =
    recommendation.metrics.weightedRiskBefore != null && recommendation.metrics.weightedRiskAfter != null
      ? recommendation.metrics.weightedRiskBefore - recommendation.metrics.weightedRiskAfter
      : null;
  const savingsScoreImprovement =
    recommendation.metrics.savingsScoreBefore != null && recommendation.metrics.savingsScoreAfter != null
      ? recommendation.metrics.savingsScoreAfter - recommendation.metrics.savingsScoreBefore
      : null;
  const diversificationImprovementPctPoints =
    recommendation.metrics.protocolHHIBefore != null && recommendation.metrics.protocolHHIAfter != null
      ? (recommendation.metrics.protocolHHIBefore - recommendation.metrics.protocolHHIAfter) * 100
      : null;
  const highRiskExposureImprovementPctPoints =
    recommendation.metrics.highRiskBeforePct != null && recommendation.metrics.highRiskAfterPct != null
      ? (recommendation.metrics.highRiskBeforePct - recommendation.metrics.highRiskAfterPct) * 100
      : null;

  return {
    weightedRiskImprovement,
    savingsScoreImprovement,
    diversificationImprovementPctPoints,
    highRiskExposureImprovementPctPoints,
  };
};

const getBand = (score: number, thresholds: { mediumMin: number; highMin: number }) => {
  if (score >= thresholds.highMin) return "high";
  if (score >= thresholds.mediumMin) return "medium";
  return "low";
};

const CONFIDENCE_STYLES: Record<RecommendationConfidenceLabel, string> = {
  HIGH: "border-lime/40 bg-lime/10 text-lime",
  MEDIUM: "border-[#ffd84d]/40 bg-[#ffd84d]/10 text-[#ffd84d]",
  LOW: "border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ff6b6b]",
};

export const getRecommendationConfidence = (recommendation: RankedRecommendation) => {
  const trustStatuses = {
    coverage: getCoverageTrustStatus(recommendation.metrics.coveragePct),
    vaultHighRisk: getVaultHighRiskTrustStatus(recommendation.metrics.vaultHighRiskExposurePct),
    overlap: getOverlapTrustStatus(recommendation.metrics.protocolOverlapPct),
    yoShare: getYoShareTrustStatus(recommendation.metrics.existingYoSharePct * 100),
  };

  const trustWeightEntries = [
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.coverage,
      status: trustStatuses.coverage,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.vaultHighRisk,
      status: trustStatuses.vaultHighRisk,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.overlap,
      status: trustStatuses.overlap,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.yoShare,
      status: trustStatuses.yoShare,
    },
  ];

  const trustScore =
    trustWeightEntries.reduce((sum, entry) => sum + entry.weight * getTrustStatusScore(entry.status), 0) /
    trustWeightEntries.reduce((sum, entry) => sum + entry.weight, 0);

  const {
    weightedRiskImprovement,
    savingsScoreImprovement,
    diversificationImprovementPctPoints,
    highRiskExposureImprovementPctPoints,
  } = getPortfolioDeltaDetails(recommendation);

  const portfolioComponents = [
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.weightedRisk,
      score: normalizeImprovement(
        weightedRiskImprovement,
        RECOMMENDATION_CONFIDENCE_CONFIG.portfolioDeltaNormalization.weightedRisk,
      ),
      improving: weightedRiskImprovement !== null ? weightedRiskImprovement > 0 : null,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.savingsScore,
      score: normalizeImprovement(
        savingsScoreImprovement,
        RECOMMENDATION_CONFIDENCE_CONFIG.portfolioDeltaNormalization.savingsScore,
      ),
      improving: savingsScoreImprovement !== null ? savingsScoreImprovement > 0 : null,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.diversification,
      score: normalizeImprovement(
        diversificationImprovementPctPoints,
        RECOMMENDATION_CONFIDENCE_CONFIG.portfolioDeltaNormalization.diversificationPctPoints,
      ),
      improving: diversificationImprovementPctPoints !== null ? diversificationImprovementPctPoints > 0 : null,
    },
    {
      weight: RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.highRiskExposure,
      score: normalizeImprovement(
        highRiskExposureImprovementPctPoints,
        RECOMMENDATION_CONFIDENCE_CONFIG.portfolioDeltaNormalization.highRiskExposurePctPoints,
      ),
      improving: highRiskExposureImprovementPctPoints !== null ? highRiskExposureImprovementPctPoints > 0 : null,
    },
  ];

  const measurablePortfolioComponents = portfolioComponents.filter(
    (component) => component.score !== null && component.improving !== null,
  );

  const impactScore =
    measurablePortfolioComponents.length > 0
      ? measurablePortfolioComponents.reduce((sum, component) => sum + component.weight * (component.score ?? 0), 0) /
        measurablePortfolioComponents.reduce((sum, component) => sum + component.weight, 0)
      : RECOMMENDATION_CONFIDENCE_CONFIG.portfolioDeltaNormalization.fallbackImpactScore;

  const redTrustMetricCount = Object.values(trustStatuses).filter((status) => status === "red").length;
  const nonImprovingPortfolioMetricCount = portfolioComponents.filter((component) => component.improving === false).length;

  const isHardLow =
    (recommendation.metrics.coveragePct !== null &&
      recommendation.metrics.coveragePct < RECOMMENDATION_CONFIDENCE_CONFIG.hardLowRules.coverageMin) ||
    redTrustMetricCount > RECOMMENDATION_CONFIDENCE_CONFIG.hardLowRules.maxRedTrustMetricsBeforeLow ||
    nonImprovingPortfolioMetricCount > RECOMMENDATION_CONFIDENCE_CONFIG.hardLowRules.maxNonImprovingPortfolioMetricsBeforeLow;

  let label: RecommendationConfidenceLabel;
  if (isHardLow) {
    label = "LOW";
  } else {
    const trustBand = getBand(trustScore, RECOMMENDATION_CONFIDENCE_CONFIG.bandThresholds.trust);
    const impactBand = getBand(impactScore, RECOMMENDATION_CONFIDENCE_CONFIG.bandThresholds.impact);

    if (trustBand === "high" && impactBand === "high") {
      label = "HIGH";
    } else if (trustBand !== "low" && impactBand !== "low") {
      label = "MEDIUM";
    } else {
      label = "LOW";
    }
  }

  return {
    label,
    className: CONFIDENCE_STYLES[label],
    trustScore,
    impactScore,
    isHardLow,
    redTrustMetricCount,
    nonImprovingPortfolioMetricCount,
    trustStatuses,
    portfolioImprovements: {
      weightedRiskImprovement,
      savingsScoreImprovement,
      diversificationImprovementPctPoints,
      highRiskExposureImprovementPctPoints,
    },
  };
};
