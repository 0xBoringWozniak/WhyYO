import type { z } from "zod";

import type {
  bucketMetricsSchema,
  beforeAfterMetricSchema,
  bucketModeSchema,
  canonicalProtocolExposureSchema,
  canonicalTokenExposureSchema,
  canonicalUserPortfolioSchema,
  canonicalYoVaultSchema,
  coverageSegmentSchema,
  ctaModeSchema,
  explanationInputSchema,
  explanationOutputSchema,
  healthResponseSchema,
  methodologyResponseSchema,
  actionabilitySchema,
  rankedRecommendationSchema,
  recommendationBenefitFlagsSchema,
  recommendationIntentSchema,
  recommendationTypeSchema,
  recommendationVisualizationSchema,
  safetyClaimLevelSchema,
  scanRequestSchema,
  scanResponseSchema,
  suggestedAmountsSchema,
} from "./schemas";

export type CanonicalBucket = "USD" | "ETH" | "BTC" | "OTHER";
export type CanonicalChain =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "solana"
  | "tron"
  | "other";
export type RiskGrade = "A" | "B" | "C" | "D" | "UNKNOWN";
export type StrategyType =
  | "lending"
  | "staking"
  | "restaking"
  | "dex_lp"
  | "yield_farming"
  | "synthetic_yield"
  | "basis_trade"
  | "spot_idle"
  | "vault"
  | "unknown";
export type RecommendationStrength = "strong" | "medium" | "weak" | "none";
export type RecommendationConfidence = "high" | "medium" | "low";
export type RecommendationType = z.infer<typeof recommendationTypeSchema>;
export type RecommendationIntent = z.infer<typeof recommendationIntentSchema>;
export type BucketMode = z.infer<typeof bucketModeSchema>;
export type CtaMode = z.infer<typeof ctaModeSchema>;
export type Actionability = z.infer<typeof actionabilitySchema>;
export type SafetyClaimLevel = z.infer<typeof safetyClaimLevelSchema>;
export type YoVaultSymbol = "yoUSD" | "yoETH" | "yoBTC" | "yoEUR" | "yoUSDT" | "yoGOLD";

export type CanonicalTokenExposure = z.infer<typeof canonicalTokenExposureSchema>;
export type CanonicalProtocolExposure = z.infer<typeof canonicalProtocolExposureSchema>;
export type CanonicalUserPortfolio = z.infer<typeof canonicalUserPortfolioSchema>;
export type CanonicalYoVault = z.infer<typeof canonicalYoVaultSchema>;
export type BucketMetrics = z.infer<typeof bucketMetricsSchema>;
export type CoverageSegment = z.infer<typeof coverageSegmentSchema>;
export type BeforeAfterMetric = z.infer<typeof beforeAfterMetricSchema>;
export type SuggestedAmounts = z.infer<typeof suggestedAmountsSchema>;
export type RecommendationBenefitFlags = z.infer<typeof recommendationBenefitFlagsSchema>;
export type RecommendationVisualization = z.infer<typeof recommendationVisualizationSchema>;
export type RankedRecommendation = z.infer<typeof rankedRecommendationSchema>;
export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type ScanResponse = z.infer<typeof scanResponseSchema>;
export type MethodologyResponse = z.infer<typeof methodologyResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ExplanationInput = z.infer<typeof explanationInputSchema>;
export type ExplanationOutput = z.infer<typeof explanationOutputSchema>;
