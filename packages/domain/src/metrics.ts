import {
  DEFAULT_METHODOLOGY,
  DUST_THRESHOLD_USD,
  EPSILON,
  type BucketMetrics,
  type CanonicalBucket,
  type CanonicalProtocolExposure,
} from "@whyyo/shared";

export type DistributionMaps = {
  protocolWeights: Record<string, number>;
  chainWeights: Record<string, number>;
  strategyWeights: Record<string, number>;
};

export type BucketComputation = BucketMetrics & {
  mediumRiskExposurePct: number;
  top1ProtocolShare: number;
  top3ProtocolShare: number;
  top1ChainShare: number;
  top1StrategyShare: number;
  complexityNorm: number;
  coveredRiskUsd: number;
  unknownRiskUsd: number;
  savingsPenalty: number | null;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hhi = (weights: number[]): number => weights.reduce((sum, weight) => sum + weight ** 2, 0);

const normalizeWeightMap = (values: Record<string, number>, total: number): Record<string, number> => {
  if (total <= EPSILON) return {};
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value > EPSILON)
      .map(([key, value]) => [key, value / total]),
  );
};

const topShare = (weights: Record<string, number>, topN: number): number =>
  Object.values(weights)
    .sort((left, right) => right - left)
    .slice(0, topN)
    .reduce((sum, weight) => sum + weight, 0);

const buildCoverageBar = ({
  coveredRiskUsd,
  unknownRiskUsd,
}: {
  coveredRiskUsd: number;
  unknownRiskUsd: number;
}) => {
  const productiveUsd = coveredRiskUsd + unknownRiskUsd;

  if (productiveUsd <= EPSILON) {
    return [
      { key: "covered" as const, label: "Covered", valuePct: 0, tone: "good" as const },
      { key: "unknown" as const, label: "Unknown", valuePct: 0, tone: "warn" as const },
    ];
  }

  return [
    {
      key: "covered" as const,
      label: "Covered",
      valuePct: (coveredRiskUsd / productiveUsd) * 100,
      tone: "good" as const,
    },
    {
      key: "unknown" as const,
      label: "Unknown",
      valuePct: (unknownRiskUsd / productiveUsd) * 100,
      tone: "warn" as const,
    },
  ];
};

const buildIdleVsInvestedBar = ({
  bucketSizeUsd,
  defiInvestedUsd,
  idleAssetUsd,
}: {
  bucketSizeUsd: number;
  defiInvestedUsd: number;
  idleAssetUsd: number;
}) => {
  if (bucketSizeUsd <= EPSILON) {
    return [
      { key: "productive" as const, label: "Productive", valuePct: 0, tone: "good" as const },
      { key: "idle" as const, label: "Idle", valuePct: 0, tone: "warn" as const },
    ];
  }

  return [
    {
      key: "productive" as const,
      label: "Productive",
      valuePct: (defiInvestedUsd / bucketSizeUsd) * 100,
      tone: "good" as const,
    },
    {
      key: "idle" as const,
      label: "Idle",
      valuePct: (idleAssetUsd / bucketSizeUsd) * 100,
      tone: "warn" as const,
    },
  ];
};

export const protocolOverlap = (left: Record<string, number>, right: Record<string, number>): number => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let overlap = 0;
  for (const key of keys) {
    overlap += Math.min(left[key] ?? 0, right[key] ?? 0);
  }
  return overlap;
};

export const protocolDistanceL1 = (left: Record<string, number>, right: Record<string, number>): number => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let distance = 0;
  for (const key of keys) {
    distance += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  }
  return 0.5 * distance;
};

export const weightMapToUsdMap = (weights: Record<string, number>, totalUsd: number): Record<string, number> =>
  Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, weight * totalUsd]));

export const usdMapToWeightMap = (values: Record<string, number>): Record<string, number> => {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return normalizeWeightMap(values, total);
};

export const computeSavingsPenalty = ({
  weightedRiskScore,
  highRiskExposurePct,
  protocolHHI,
  complexityNorm,
  unknownRiskExposurePct,
  idleSharePct,
}: {
  weightedRiskScore: number | null;
  highRiskExposurePct: number | null;
  protocolHHI: number | null;
  complexityNorm: number;
  unknownRiskExposurePct: number | null;
  idleSharePct: number;
}): number | null => {
  if (weightedRiskScore === null || highRiskExposurePct === null || protocolHHI === null || unknownRiskExposurePct === null) {
    return null;
  }

  const normWeightedRisk = clamp01((weightedRiskScore - 1) / 3);
  const penalty =
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.weightedRisk * normWeightedRisk +
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.highRisk * highRiskExposurePct +
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.protocolHHI * clamp01(protocolHHI) +
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.complexity * complexityNorm +
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.unknown * unknownRiskExposurePct +
    DEFAULT_METHODOLOGY.savingsPenaltyWeights.idle * idleSharePct;

  return clamp01(penalty);
};

export const computeSavingsScore = ({
  weightedRiskScore,
  highRiskExposurePct,
  protocolHHI,
  complexityNorm,
  unknownRiskExposurePct,
  idleSharePct,
}: {
  weightedRiskScore: number | null;
  highRiskExposurePct: number | null;
  protocolHHI: number | null;
  complexityNorm: number;
  unknownRiskExposurePct: number | null;
  idleSharePct: number;
}): number | null => {
  const penalty = computeSavingsPenalty({
    weightedRiskScore,
    highRiskExposurePct,
    protocolHHI,
    complexityNorm,
    unknownRiskExposurePct,
    idleSharePct,
  });
  if (penalty === null) return null;
  return 100 * (1 - penalty);
};

export const computeBucketMetrics = (
  bucket: CanonicalBucket,
  exposures: CanonicalProtocolExposure[],
): BucketComputation => {
  const scoped = exposures.filter(
    (exposure) =>
      exposure.bucket === bucket &&
      (exposure.source === "yo" || exposure.usdValue >= DUST_THRESHOLD_USD),
  );
  const idleExposures = scoped.filter((exposure) => exposure.strategyType === "spot_idle");
  const defiExposures = scoped.filter((exposure) => exposure.strategyType !== "spot_idle");

  const bucketSizeUsd = scoped.reduce((sum, exposure) => sum + exposure.usdValue, 0);
  const defiInvestedUsd = defiExposures.reduce((sum, exposure) => sum + exposure.usdValue, 0);
  const idleAssetUsd = idleExposures.reduce((sum, exposure) => sum + exposure.usdValue, 0);
  const idleSharePct = bucketSizeUsd > EPSILON ? idleAssetUsd / bucketSizeUsd : 0;
  const productiveSharePct = bucketSizeUsd > EPSILON ? defiInvestedUsd / bucketSizeUsd : 0;

  const protocolRaw: Record<string, number> = {};
  const chainRaw: Record<string, number> = {};
  const strategyRaw: Record<string, number> = {};

  let weightedRiskScore = 0;
  let highRiskExposurePct = 0;
  let mediumRiskExposurePct = 0;
  let unknownRiskExposurePct = 0;

  for (const exposure of defiExposures) {
    protocolRaw[exposure.canonicalProtocolId] = (protocolRaw[exposure.canonicalProtocolId] ?? 0) + exposure.usdValue;
    strategyRaw[exposure.strategyType] = (strategyRaw[exposure.strategyType] ?? 0) + exposure.usdValue;

    if (defiInvestedUsd > EPSILON) {
      const weight = exposure.usdValue / defiInvestedUsd;
      weightedRiskScore += weight * exposure.riskScore;
      highRiskExposurePct += weight * (exposure.riskScore >= 3 ? 1 : 0);
      mediumRiskExposurePct += weight * (exposure.riskScore >= 2 ? 1 : 0);
      unknownRiskExposurePct += weight * (exposure.riskGrade === "UNKNOWN" ? 1 : 0);
    }
  }

  for (const exposure of scoped) {
    chainRaw[exposure.chain] = (chainRaw[exposure.chain] ?? 0) + exposure.usdValue;
    if (exposure.strategyType === "spot_idle") {
      strategyRaw[exposure.strategyType] = (strategyRaw[exposure.strategyType] ?? 0) + exposure.usdValue;
    }
  }

  const protocolWeights = normalizeWeightMap(protocolRaw, defiInvestedUsd);
  const chainWeights = normalizeWeightMap(chainRaw, bucketSizeUsd);
  const strategyWeights = normalizeWeightMap(strategyRaw, bucketSizeUsd);

  const positionCount = scoped.length;
  const defiPositionCount = defiExposures.length;
  const idlePositionCount = idleExposures.length;
  const protocolCount = Object.keys(protocolWeights).length;
  const chainCount = Object.keys(chainWeights).length;
  const strategyCount = Object.keys(strategyWeights).length;

  const complexityRaw =
    DEFAULT_METHODOLOGY.complexityWeights.positions * Math.log(1 + positionCount) +
    DEFAULT_METHODOLOGY.complexityWeights.protocols * Math.log(1 + protocolCount) +
    DEFAULT_METHODOLOGY.complexityWeights.chains * Math.log(1 + chainCount);
  const complexityRawMax =
    DEFAULT_METHODOLOGY.complexityWeights.positions * Math.log(1 + 12) +
    DEFAULT_METHODOLOGY.complexityWeights.protocols * Math.log(1 + 8) +
    DEFAULT_METHODOLOGY.complexityWeights.chains * Math.log(1 + 5);
  const complexityNorm = clamp01(complexityRaw / Math.max(complexityRawMax, EPSILON));

  const computedWeightedRisk = defiInvestedUsd > EPSILON ? weightedRiskScore : null;
  const computedHighRisk = defiInvestedUsd > EPSILON ? highRiskExposurePct : null;
  const computedUnknownRisk = defiInvestedUsd > EPSILON ? unknownRiskExposurePct : null;
  const protocolHHI = defiInvestedUsd > EPSILON ? hhi(Object.values(protocolWeights)) : null;
  const chainHHI = bucketSizeUsd > EPSILON ? hhi(Object.values(chainWeights)) : null;
  const strategyHHI = bucketSizeUsd > EPSILON ? hhi(Object.values(strategyWeights)) : null;
  const riskCoveragePct =
    defiInvestedUsd > EPSILON && computedUnknownRisk !== null ? 1 - computedUnknownRisk : null;
  const coveredRiskUsd = defiInvestedUsd > EPSILON ? defiInvestedUsd * (riskCoveragePct ?? 0) : 0;
  const unknownRiskUsd = defiInvestedUsd > EPSILON ? defiInvestedUsd * (computedUnknownRisk ?? 0) : 0;
  const savingsPenalty = computeSavingsPenalty({
    weightedRiskScore: computedWeightedRisk,
    highRiskExposurePct: computedHighRisk,
    protocolHHI,
    complexityNorm,
    unknownRiskExposurePct: computedUnknownRisk,
    idleSharePct,
  });
  const savingsScore = computeSavingsScore({
    weightedRiskScore: computedWeightedRisk,
    highRiskExposurePct: computedHighRisk,
    protocolHHI,
    complexityNorm,
    unknownRiskExposurePct: computedUnknownRisk,
    idleSharePct,
  });

  return {
    bucket,
    totalUsd: bucketSizeUsd,
    bucketSizeUsd,
    defiInvestedUsd,
    idleAssetUsd,
    idleSharePct,
    productiveSharePct,
    idleYieldOpportunityUsd: idleAssetUsd,
    riskCoveragePct,
    weightedRiskScore: computedWeightedRisk,
    highRiskExposurePct: computedHighRisk,
    unknownRiskExposurePct: computedUnknownRisk,
    protocolHHI,
    chainHHI,
    strategyHHI,
    savingsScore,
    positionCount,
    defiPositionCount,
    idlePositionCount,
    protocolCount,
    chainCount,
    protocolWeights,
    chainWeights,
    strategyWeights,
    visualization: {
      coverageBar: buildCoverageBar({
        coveredRiskUsd,
        unknownRiskUsd,
      }),
      idleVsInvestedBar: buildIdleVsInvestedBar({
        bucketSizeUsd,
        defiInvestedUsd,
        idleAssetUsd,
      }),
    },
    mediumRiskExposurePct: defiInvestedUsd > EPSILON ? mediumRiskExposurePct : 0,
    top1ProtocolShare: topShare(protocolWeights, 1),
    top3ProtocolShare: topShare(protocolWeights, 3),
    top1ChainShare: topShare(chainWeights, 1),
    top1StrategyShare: topShare(strategyWeights, 1),
    complexityNorm,
    coveredRiskUsd,
    unknownRiskUsd,
    savingsPenalty,
  };
};

export const blendDistribution = (
  left: Record<string, number>,
  right: Record<string, number>,
  migrationRatio: number,
): Record<string, number> => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const blended: Record<string, number> = {};
  for (const key of keys) {
    blended[key] = (1 - migrationRatio) * (left[key] ?? 0) + migrationRatio * (right[key] ?? 0);
  }
  return blended;
};
