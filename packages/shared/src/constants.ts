export const CANONICAL_BUCKETS = ["USD", "ETH", "BTC", "OTHER"] as const;
export const CANONICAL_CHAINS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "solana",
  "tron",
  "other",
] as const;
export const RISK_GRADES = ["A", "B", "C", "D", "UNKNOWN"] as const;
export const STRATEGY_TYPES = [
  "lending",
  "staking",
  "restaking",
  "dex_lp",
  "yield_farming",
  "synthetic_yield",
  "basis_trade",
  "spot_idle",
  "vault",
  "unknown",
] as const;
export const RECOMMENDATION_STRENGTHS = ["strong", "medium", "weak", "none"] as const;
export const RECOMMENDATION_CONFIDENCE = ["high", "medium", "low"] as const;
export const RECOMMENDATION_TYPES = [
  "migration",
  "idle_opportunity",
  "informational_only",
  "already_in_yo",
  "no_incremental_improvement",
] as const;
export const RECOMMENDATION_INTENTS = [
  "risk_improvement",
  "diversification_improvement",
  "idle_deployment",
] as const;
export const BUCKET_MODES = ["productive", "mixed", "idle_only", "empty"] as const;
export const CTA_MODES = ["deposit", "learn_more", "disabled"] as const;
export const ACTIONABILITY_LEVELS = [
  "actionable",
  "cautious_actionable",
  "informational_only",
  "suppressed",
] as const;
export const SAFETY_CLAIM_LEVELS = ["strong", "moderate", "cautious", "none"] as const;
export const YO_BUCKETS = ["USD", "ETH", "BTC"] as const;
export const YO_VAULT_SYMBOLS = ["yoUSD", "yoETH", "yoBTC", "yoEUR", "yoUSDT", "yoGOLD"] as const;
export const EPSILON = 1e-9;
export const DUST_THRESHOLD_USD = 10;
export const TOLERANCE = 1e-6;

export const RISK_GRADE_TO_SCORE = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  UNKNOWN: 3.5,
} as const;

export const CHAIN_ID_MAP: Record<string, (typeof CANONICAL_CHAINS)[number]> = {
  eth: "ethereum",
  ethereum: "ethereum",
  base: "base",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  matic: "polygon",
  polygon: "polygon",
  solana: "solana",
  tron: "tron",
  unknown: "other",
};

export const USD_SYMBOLS = new Set([
  "USD",
  "USDC",
  "USDT",
  "USDS",
  "DAI",
  "TUSD",
  "USDE",
]);

export const ETH_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "STETH",
  "WSTETH",
  "WEETH",
  "RSETH",
  "CBETH",
  "EETH",
]);

export const BTC_SYMBOLS = new Set(["BTC", "WBTC", "CBBTC", "TBTC"]);

export const DEFAULT_METHODOLOGY = {
  minBucketUsd: 500,
  maxUnknownRiskPct: 0.4,
  informationalUnknownRiskPct: 0.6,
  highUnknownRiskPct: 0.7,
  informationalOnlyUnknownRiskPct: 0.8,
  minKnownCoverage: 0.6,
  minAbsRiskDelta: 0.1,
  minHreDelta: 0.05,
  minSpsDelta: 5,
  lowOverlapPct: 0.1,
  minMoveUsd: 250,
  targetHre: 0.1,
  targetWrs: 2,
  targetSps: 75,
  idleScaleUsd: 5000,
  unknownPenaltyScale: 0.3,
  alreadyInTargetVaultPct: 0.25,
  idleOpportunityShareThreshold: 0.6,
  mostlyIdleShareThreshold: 0.7,
  diversificationIntentTop1Threshold: 0.8,
  diversificationIntentHHIThreshold: 0.75,
  idleVaultGuardrails: {
    maxUnknownRiskPct: 0.8,
    maxHighRiskPct: 0.8,
    maxProtocolHHI: 0.85,
    minSavingsScore: 35,
  },
  complexityWeights: {
    positions: 0.5,
    protocols: 0.3,
    chains: 0.2,
  },
  savingsPenaltyWeights: {
    weightedRisk: 0.28,
    highRisk: 0.24,
    protocolHHI: 0.14,
    complexity: 0.12,
    unknown: 0.12,
    idle: 0.1,
  },
  rankerWeights: {
    relativeRiskImprovement: 0.3,
    highRiskReduction: 0.22,
    savingsScoreImprovement: 0.14,
    concentrationImprovement: 0.08,
    simplicityGain: 0.08,
    similarity: 0.05,
    idleOpportunityGain: 0.13,
    unknownPenalty: 0.18,
    sizePenalty: 0.08,
  },
} as const;
