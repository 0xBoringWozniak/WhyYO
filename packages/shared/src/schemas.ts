import { z } from "zod";

import {
  ACTIONABILITY_LEVELS,
  BUCKET_MODES,
  CANONICAL_BUCKETS,
  CANONICAL_CHAINS,
  CTA_MODES,
  DEFAULT_METHODOLOGY,
  RECOMMENDATION_INTENTS,
  RECOMMENDATION_CONFIDENCE,
  SAFETY_CLAIM_LEVELS,
  RECOMMENDATION_STRENGTHS,
  RECOMMENDATION_TYPES,
  RISK_GRADES,
  STRATEGY_TYPES,
  YO_BUCKETS,
  YO_VAULT_SYMBOLS,
} from "./constants";
import {
  METHODOLOGY_COMPUTATION_PLAN,
  METHODOLOGY_MARKDOWN,
  METHODOLOGY_SECTIONS,
  METHODOLOGY_VISUALIZATION_PLAN,
  METRIC_REGISTRY,
} from "./methodology-content";

export const canonicalBucketSchema = z.enum(CANONICAL_BUCKETS);
export const canonicalChainSchema = z.enum(CANONICAL_CHAINS);
export const riskGradeSchema = z.enum(RISK_GRADES);
export const strategyTypeSchema = z.enum(STRATEGY_TYPES);
export const recommendationStrengthSchema = z.enum(RECOMMENDATION_STRENGTHS);
export const recommendationConfidenceSchema = z.enum(RECOMMENDATION_CONFIDENCE);
export const recommendationTypeSchema = z.enum(RECOMMENDATION_TYPES);
export const recommendationIntentSchema = z.enum(RECOMMENDATION_INTENTS);
export const bucketModeSchema = z.enum(BUCKET_MODES);
export const ctaModeSchema = z.enum(CTA_MODES);
export const actionabilitySchema = z.enum(ACTIONABILITY_LEVELS);
export const safetyClaimLevelSchema = z.enum(SAFETY_CLAIM_LEVELS);
export const yoBucketSchema = z.enum(YO_BUCKETS);
export const yoVaultSymbolSchema = z.enum(YO_VAULT_SYMBOLS);
export const metricAudienceSchema = z.enum(["internal", "ranker", "user"]);
export const metricValueFormatSchema = z.enum(["number", "percent", "currency"]);
export const visualizationSurfaceSchema = z.enum(["bucket", "recommendation", "methodology"]);

export const canonicalTokenExposureSchema = z.object({
  chain: canonicalChainSchema,
  tokenAddress: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  symbol: z.string(),
  parentSymbol: z.string().optional(),
  bucket: canonicalBucketSchema,
  usdValue: z.number(),
  amount: z.number().optional(),
  source: z.enum(["debank", "yo", "risk"]),
});

export const canonicalProtocolExposureSchema = z.object({
  canonicalProtocolId: z.string(),
  canonicalProtocolName: z.string(),
  originalProtocolId: z.string().optional(),
  originalProtocolName: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  chain: canonicalChainSchema,
  bucket: canonicalBucketSchema,
  strategyType: strategyTypeSchema,
  usdValue: z.number(),
  weight: z.number().optional(),
  riskGrade: riskGradeSchema,
  riskScore: z.number(),
  assetSymbols: z.array(z.string()),
  tokenAddresses: z.array(z.string()),
  source: z.enum(["debank", "yo"]),
  matchingConfidence: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const canonicalUserPortfolioSchema = z.object({
  ownerAddress: z.string(),
  totalUsd: z.number(),
  analyzedUsd: z.number(),
  riskCoveredUsd: z.number(),
  coveragePct: z.number(),
  tokenExposures: z.array(canonicalTokenExposureSchema),
  protocolExposures: z.array(canonicalProtocolExposureSchema),
  bucketTotals: z.record(canonicalBucketSchema, z.number()),
  protocolCount: z.number(),
  positionCount: z.number(),
  chainCount: z.number(),
  warnings: z.array(z.string()),
});

export const coverageSegmentSchema = z.object({
  key: z.enum(["covered", "unknown", "idle"]),
  label: z.string(),
  valuePct: z.number(),
  tone: z.enum(["good", "warn", "neutral"]),
});

export const beforeAfterMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  before: z.number().nullable(),
  after: z.number().nullable(),
  format: metricValueFormatSchema,
  betterDirection: z.enum(["higher", "lower"]),
});

export const compositionEntrySchema = z.object({
  key: z.string(),
  label: z.string(),
  weightPct: z.number(),
});

export const suggestedAmountsSchema = z.object({
  recommendedUsd: z.number(),
  idleFirstUsd: z.number(),
  highRiskOnlyUsd: z.number(),
  combinedUsd: z.number(),
  quarterUsd: z.number(),
  halfUsd: z.number(),
  allUsd: z.number(),
});

export const recommendationVisualizationSchema = z.object({
  beforeAfterBars: z.array(beforeAfterMetricSchema),
  coverageBar: z.array(coverageSegmentSchema),
  idleVsInvestedBar: z.array(
    z.object({
      key: z.enum(["productive", "idle"]),
      label: z.string(),
      valuePct: z.number(),
    }),
  ),
  simplification: z.object({
    beforePositions: z.number(),
    afterPositions: z.number(),
  }),
  currentComposition: z.object({
    protocols: z.array(compositionEntrySchema),
    strategies: z.array(compositionEntrySchema),
  }),
  yoComposition: z.object({
    protocols: z.array(compositionEntrySchema),
    strategies: z.array(compositionEntrySchema),
  }),
});

export const canonicalYoVaultSchema = z.object({
  vaultId: z.string(),
  vaultSymbol: yoVaultSymbolSchema,
  vaultAddress: z.string(),
  chain: canonicalChainSchema,
  bucket: canonicalBucketSchema,
  tvlUsd: z.number(),
  apyPct: z.number(),
  riskGrade: riskGradeSchema,
  riskScore: z.number(),
  allocation: z.array(canonicalProtocolExposureSchema),
  pendingRedeems: z
    .object({
      assetsPending: z.number().optional(),
      sharesPending: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const bucketMetricsSchema = z.object({
  bucket: canonicalBucketSchema,
  totalUsd: z.number(),
  bucketSizeUsd: z.number(),
  defiInvestedUsd: z.number(),
  idleAssetUsd: z.number(),
  idleSharePct: z.number(),
  productiveSharePct: z.number(),
  idleYieldOpportunityUsd: z.number(),
  riskCoveragePct: z.number().nullable(),
  weightedRiskScore: z.number().nullable(),
  highRiskExposurePct: z.number().nullable(),
  unknownRiskExposurePct: z.number().nullable(),
  protocolHHI: z.number().nullable(),
  chainHHI: z.number().nullable(),
  strategyHHI: z.number().nullable(),
  savingsScore: z.number().nullable(),
  positionCount: z.number(),
  defiPositionCount: z.number(),
  idlePositionCount: z.number(),
  protocolCount: z.number(),
  chainCount: z.number(),
  protocolWeights: z.record(z.string(), z.number()),
  chainWeights: z.record(z.string(), z.number()),
  strategyWeights: z.record(z.string(), z.number()),
  visualization: z.object({
    coverageBar: z.array(coverageSegmentSchema),
    idleVsInvestedBar: z.array(
      z.object({
        key: z.enum(["productive", "idle"]),
        label: z.string(),
        valuePct: z.number(),
      }),
    ),
  }),
});

export const explanationOutputSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()).max(3),
  caution: z.string().optional(),
});

export const recommendationBenefitFlagsSchema = z.object({
  improvesDiversification: z.boolean(),
  deploysIdleCapital: z.boolean(),
  improvesWeightedRisk: z.boolean(),
  reducesHighRiskExposure: z.boolean(),
  improvesSavingsScore: z.boolean(),
  improvesSimplicity: z.boolean(),
});

const explanationBucketMetricsSchema = z.object({
  totalUsd: z.number(),
  bucketSizeUsd: z.number(),
  defiInvestedUsd: z.number(),
  idleAssetUsd: z.number(),
  idleSharePct: z.number(),
  productiveSharePct: z.number(),
  riskCoveragePct: z.number().nullable(),
  weightedRiskScore: z.number().nullable(),
  highRiskExposurePct: z.number().nullable(),
  mediumRiskExposurePct: z.number(),
  unknownRiskExposurePct: z.number().nullable(),
  protocolHHI: z.number().nullable(),
  chainHHI: z.number().nullable(),
  strategyHHI: z.number().nullable(),
  savingsScore: z.number().nullable(),
  positionCount: z.number(),
  defiPositionCount: z.number(),
  idlePositionCount: z.number(),
  protocolCount: z.number(),
  chainCount: z.number(),
  top1ProtocolShare: z.number(),
  top3ProtocolShare: z.number(),
  top1ChainShare: z.number(),
  top1StrategyShare: z.number(),
  complexityNorm: z.number(),
});

const explanationProjectedMetricsSchema = z.object({
  migrationRatio: z.number(),
  weightedRiskScore: z.number().nullable(),
  highRiskExposurePct: z.number(),
  unknownRiskExposurePct: z.number(),
  protocolHHI: z.number().nullable(),
  chainHHI: z.number().nullable(),
  strategyHHI: z.number().nullable(),
  savingsScore: z.number().nullable(),
});

const explanationDecisionSchema = z.object({
  score: z.number(),
  strength: recommendationStrengthSchema,
  confidence: recommendationConfidenceSchema,
  primaryIntent: recommendationIntentSchema,
  recommendationType: recommendationTypeSchema,
  actionability: actionabilitySchema,
  safetyClaimLevel: safetyClaimLevelSchema,
  benefitFlags: recommendationBenefitFlagsSchema,
  bucketMode: bucketModeSchema,
  eligible: z.boolean(),
  ctaEnabled: z.boolean(),
  ctaMode: ctaModeSchema,
  isAlreadyInTargetVault: z.boolean(),
  existingYoSharePct: z.number(),
  showBeforeAfterBars: z.boolean(),
  showCoverageBar: z.boolean(),
  showIdleOpportunityVisual: z.boolean(),
  avgMatchingConfidence: z.number(),
  riskGain: z.number(),
  highRiskGain: z.number(),
  savingsGain: z.number(),
  concentrationGain: z.number(),
  diversificationGain: z.number(),
  idleDeploymentGain: z.number(),
  vaultQualityScore: z.number(),
  simplicityGain: z.number(),
  similarity: z.number(),
  strategyFitGain: z.number(),
  unknownPenalty: z.number(),
  sizePenalty: z.number(),
});

const explanationAllocationItemSchema = z.object({
  canonicalProtocolId: z.string(),
  canonicalProtocolName: z.string(),
  chain: canonicalChainSchema,
  strategyType: strategyTypeSchema,
  riskGrade: riskGradeSchema,
  riskScore: z.number(),
  usdValue: z.number(),
  weightPct: z.number(),
  matchingConfidence: z.number(),
});

const explanationVaultContextSchema = z.object({
  vaultAddress: z.string(),
  chain: canonicalChainSchema,
  bucket: canonicalBucketSchema,
  apyPct: z.number(),
  tvlUsd: z.number(),
  riskGrade: riskGradeSchema,
  riskScore: z.number(),
  allocationCount: z.number(),
  avgMatchingConfidence: z.number(),
  topAllocations: z.array(explanationAllocationItemSchema),
});

export const rankedRecommendationSchema = z.object({
  bucket: yoBucketSchema,
  vaultSymbol: z.enum(["yoUSD", "yoETH", "yoBTC"]),
  vaultAddress: z.string(),
  score: z.number(),
  primaryIntent: recommendationIntentSchema,
  recommendationType: recommendationTypeSchema,
  actionability: actionabilitySchema,
  safetyClaimLevel: safetyClaimLevelSchema,
  benefitFlags: recommendationBenefitFlagsSchema,
  bucketMode: bucketModeSchema,
  eligible: z.boolean(),
  strength: recommendationStrengthSchema,
  confidence: recommendationConfidenceSchema,
  ctaEnabled: z.boolean(),
  ctaMode: ctaModeSchema,
  isAlreadyInTargetVault: z.boolean(),
  showBeforeAfterBars: z.boolean(),
  showCoverageBar: z.boolean(),
  showIdleOpportunityVisual: z.boolean(),
  suggestedUsd: z.number(),
  suggestedAmounts: suggestedAmountsSchema,
  metrics: z.object({
    bucketSizeUsd: z.number(),
    defiInvestedUsd: z.number(),
    idleAssetUsd: z.number(),
    idleSharePct: z.number(),
    productiveSharePct: z.number(),
    existingYoSharePct: z.number(),
    estimatedAnnualYieldOpportunityUsd: z.number().nullable(),
    vaultApyPct: z.number(),
    vaultWeightedRisk: z.number().nullable(),
    vaultHighRiskExposurePct: z.number().nullable(),
    vaultUnknownRiskExposurePct: z.number().nullable(),
    vaultProtocolHHI: z.number().nullable(),
    weightedRiskBefore: z.number().nullable(),
    weightedRiskAfter: z.number().nullable(),
    weightedRiskImprovementPct: z.number().nullable(),
    highRiskBeforePct: z.number().nullable(),
    highRiskAfterPct: z.number().nullable(),
    highRiskReductionPctPoints: z.number(),
    savingsScoreBefore: z.number().nullable(),
    savingsScoreAfter: z.number().nullable(),
    savingsScoreDelta: z.number().nullable(),
    protocolHHIBefore: z.number().nullable(),
    protocolHHIAfter: z.number().nullable(),
    protocolConcentrationImprovementPct: z.number().nullable(),
    protocolOverlapPct: z.number(),
    protocolDistance: z.number(),
    strategyDistance: z.number(),
    positionsBefore: z.number(),
    positionsAfter: z.number(),
    coveragePct: z.number().nullable(),
    unknownRiskExposurePct: z.number().nullable(),
  }),
  reasonCodes: z.array(z.string()),
  caveats: z.array(z.string()),
  visualization: recommendationVisualizationSchema,
  llmExplanation: explanationOutputSchema.optional(),
});

export const scanRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const methodologyResponseSchema = z.object({
  version: z.string(),
  formulas: z.record(z.string(), z.string()),
  thresholds: z.object({
    minBucketUsd: z.number(),
    maxUnknownRiskPct: z.number(),
    informationalUnknownRiskPct: z.number(),
    highUnknownRiskPct: z.number(),
    informationalOnlyUnknownRiskPct: z.number(),
    minKnownCoverage: z.number(),
    minAbsRiskDelta: z.number(),
    minHreDelta: z.number(),
    minSpsDelta: z.number(),
    lowOverlapPct: z.number(),
    mostlyIdleShareThreshold: z.number(),
    diversificationIntentTop1Threshold: z.number(),
    diversificationIntentHHIThreshold: z.number(),
  }),
  defaults: z.object({
    minMoveUsd: z.number(),
    targetHre: z.number(),
    targetWrs: z.number(),
    targetSps: z.number(),
    idleScaleUsd: z.number(),
    unknownPenaltyScale: z.number(),
    alreadyInTargetVaultPct: z.number(),
    idleOpportunityShareThreshold: z.number(),
  }),
  registry: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      formula: z.string(),
      units: z.string(),
      inputs: z.array(z.string()),
      whereUsed: z.array(z.string()),
      shownInUi: z.boolean(),
      audience: z.array(metricAudienceSchema),
      chartUsage: z.array(z.string()),
      caveats: z.array(z.string()),
    }),
  ),
  computationPlan: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      outputs: z.array(z.string()),
    }),
  ),
  visualizationPlan: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      surfaces: z.array(z.string()),
    }),
  ),
  doc: z.object({
    title: z.string(),
    subtitle: z.string(),
    markdown: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        body: z.string(),
      }),
    ),
  }),
});

export const scanResponseSchema = z.object({
  scanId: z.string().uuid(),
  status: z.enum(["pending", "completed", "failed", "partial"]),
  portfolioOverview: canonicalUserPortfolioSchema,
  bucketOverview: z.array(bucketMetricsSchema),
  recommendations: z.array(rankedRecommendationSchema),
  methodology: methodologyResponseSchema,
  dataFreshness: z.object({
    debankFetchedAt: z.string().nullable(),
    yoFetchedAt: z.string().nullable(),
    riskDatasetImportedAt: z.string().nullable(),
  }),
  warnings: z.array(z.string()),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  checks: z.record(z.string(), z.enum(["ok", "degraded", "error"])),
  timestamp: z.string(),
});

export const explanationInputSchema = z.object({
  bucket: yoBucketSchema,
  vaultSymbol: z.enum(["yoUSD", "yoETH", "yoBTC"]),
  vaultAddress: z.string(),
  score: z.number(),
  strength: recommendationStrengthSchema,
  confidence: recommendationConfidenceSchema,
  suggestedUsd: z.number(),
  metrics: rankedRecommendationSchema.shape.metrics,
  userBucketMetrics: explanationBucketMetricsSchema,
  vaultMetrics: explanationBucketMetricsSchema,
  projectedMetrics: explanationProjectedMetricsSchema,
  decision: explanationDecisionSchema,
  vault: explanationVaultContextSchema,
  reasonCodes: z.array(z.string()),
  caveats: z.array(z.string()),
});

export const defaultMethodologyResponse = {
  version: "1.0.0",
  formulas: {
    weightedRiskScore: "WRS = sum(weight_i * riskScore_i)",
    highRiskExposurePct: "HRE = sum(weight_i * I[riskScore_i >= 3])",
    unknownRiskExposurePct: "URE = sum(weight_i * I[risk == UNKNOWN])",
    protocolHHI: "ProtocolHHI = sum(protocolWeight_p ^ 2)",
    idleAssetValue: "IAV = sum(idle wallet assets in bucket)",
    idleShare: "ISR = IAV / TV",
    savingsScore:
      "SPS = 100 * (1 - clamp01(0.28*risk + 0.24*highRisk + 0.14*protocolHHI + 0.12*complexity + 0.12*unknown + 0.10*idle))",
    suggestion:
      "baselinePreset = combinedUsd > 0 ? combinedUsd : idleFirstUsd > 0 ? idleFirstUsd : highRiskOnlyUsd > 0 ? highRiskOnlyUsd : quarterUsd; recommendedUsd = min(TV, max(minMoveUsd, baselinePreset))",
    rankerScore:
      "Score = intent-aware blend of risk improvement, diversification gain, or idle deployment gain, minus intent-aware unknown and size penalties",
  },
  thresholds: {
    minBucketUsd: DEFAULT_METHODOLOGY.minBucketUsd,
    maxUnknownRiskPct: DEFAULT_METHODOLOGY.maxUnknownRiskPct,
    informationalUnknownRiskPct: DEFAULT_METHODOLOGY.informationalUnknownRiskPct,
    highUnknownRiskPct: DEFAULT_METHODOLOGY.highUnknownRiskPct,
    informationalOnlyUnknownRiskPct: DEFAULT_METHODOLOGY.informationalOnlyUnknownRiskPct,
    minKnownCoverage: DEFAULT_METHODOLOGY.minKnownCoverage,
    minAbsRiskDelta: DEFAULT_METHODOLOGY.minAbsRiskDelta,
    minHreDelta: DEFAULT_METHODOLOGY.minHreDelta,
    minSpsDelta: DEFAULT_METHODOLOGY.minSpsDelta,
    lowOverlapPct: DEFAULT_METHODOLOGY.lowOverlapPct,
    mostlyIdleShareThreshold: DEFAULT_METHODOLOGY.mostlyIdleShareThreshold,
    diversificationIntentTop1Threshold: DEFAULT_METHODOLOGY.diversificationIntentTop1Threshold,
    diversificationIntentHHIThreshold: DEFAULT_METHODOLOGY.diversificationIntentHHIThreshold,
  },
  defaults: {
    minMoveUsd: DEFAULT_METHODOLOGY.minMoveUsd,
    targetHre: DEFAULT_METHODOLOGY.targetHre,
    targetWrs: DEFAULT_METHODOLOGY.targetWrs,
    targetSps: DEFAULT_METHODOLOGY.targetSps,
    idleScaleUsd: DEFAULT_METHODOLOGY.idleScaleUsd,
    unknownPenaltyScale: DEFAULT_METHODOLOGY.unknownPenaltyScale,
    alreadyInTargetVaultPct: DEFAULT_METHODOLOGY.alreadyInTargetVaultPct,
    idleOpportunityShareThreshold: DEFAULT_METHODOLOGY.idleOpportunityShareThreshold,
  },
  registry: METRIC_REGISTRY.map((metric) => ({
    ...metric,
    inputs: [...metric.inputs],
    whereUsed: [...metric.whereUsed],
    audience: [...metric.audience],
    chartUsage: [...metric.chartUsage],
    caveats: [...metric.caveats],
  })),
  computationPlan: METHODOLOGY_COMPUTATION_PLAN.map((stage) => ({
    ...stage,
    outputs: [...stage.outputs],
  })),
  visualizationPlan: METHODOLOGY_VISUALIZATION_PLAN.map((item) => ({
    ...item,
    surfaces: [...item.surfaces],
  })),
  doc: {
    title: "Methodology",
    subtitle: "How we score your savings",
    markdown: METHODOLOGY_MARKDOWN,
    sections: METHODOLOGY_SECTIONS.map((section) => ({ ...section })),
  },
} satisfies z.infer<typeof methodologyResponseSchema>;
