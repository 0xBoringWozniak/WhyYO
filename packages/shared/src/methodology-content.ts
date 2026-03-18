import { DEFAULT_METHODOLOGY } from "./constants";

export const METRIC_REGISTRY = [
  {
    id: "bucket_size_usd",
    label: "Bucket size",
    description: "Total value of the bucket including productive DeFi positions and idle wallet assets.",
    formula: "TV_b = Σ usd_i + Σ usd_k",
    units: "USD",
    inputs: ["protocolExposures", "idleExposures"],
    whereUsed: ["bucket overview", "eligibility", "suggested amount", "recommendation context"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["bucket overview card"],
    caveats: ["Includes idle assets and invested capital together."],
  },
  {
    id: "defi_invested_value_usd",
    label: "DeFi invested value",
    description: "Value of productive DeFi positions only, excluding idle wallet assets.",
    formula: "DIV_b = Σ usd_i",
    units: "USD",
    inputs: ["defiProtocolExposures"],
    whereUsed: ["idle split", "methodology", "blended risk math"],
    shownInUi: false,
    audience: ["internal", "ranker"],
    chartUsage: ["idle vs invested split"],
    caveats: ["Wallet idle assets are excluded by design."],
  },
  {
    id: "idle_asset_value_usd",
    label: "Idle capital available",
    description: "Value of idle wallet assets in the bucket that are not in productive DeFi positions.",
    formula: "IAV_b = Σ usd_k",
    units: "USD",
    inputs: ["spotIdleExposures"],
    whereUsed: ["recommendation CTA", "suggested amount presets", "explanation"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["bucket overview card", "coverage bar"],
    caveats: ["Idle means wallet-held capital with no detected productive yield position."],
  },
  {
    id: "idle_share_pct",
    label: "Idle share",
    description: "Share of the bucket that is idle rather than productive.",
    formula: "ISR_b = IAV_b / TV_b",
    units: "ratio",
    inputs: ["idleAssetValueUsd", "bucketSizeUsd"],
    whereUsed: ["ranker idle boost", "explanation", "coverage visuals"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["coverage bar", "idle vs invested split"],
    caveats: ["Shown when material enough to affect the recommendation."],
  },
  {
    id: "productive_share_pct",
    label: "Productive share",
    description: "Share of the bucket currently deployed into productive DeFi positions.",
    formula: "PS_b = DIV_b / TV_b = 1 - ISR_b",
    units: "ratio",
    inputs: ["defiInvestedUsd", "bucketSizeUsd"],
    whereUsed: ["methodology", "secondary visualization"],
    shownInUi: false,
    audience: ["internal"],
    chartUsage: ["idle vs invested split"],
    caveats: ["Inverse of idle share."],
  },
  {
    id: "weighted_risk_score",
    label: "Weighted risk",
    description: "Average risk score of productive DeFi positions, weighted by USD value.",
    formula: "WRS_b = Σ w_i * r_i",
    units: "score",
    inputs: ["defiPositionWeights", "riskScores"],
    whereUsed: ["recommendation card", "ranker", "methodology", "before/after bars"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["before/after comparison bars"],
    caveats: ["Idle assets are excluded so wallet balances do not dilute protocol risk."],
  },
  {
    id: "high_risk_exposure_pct",
    label: "High-risk exposure",
    description: "Share of productive DeFi capital mapped to risk score 3 or higher.",
    formula: "HRE_b = Σ_{r_i >= 3} usd_i / DIV_b",
    units: "ratio",
    inputs: ["defiPositions", "riskScores"],
    whereUsed: ["ranker", "recommendation card", "before/after bars"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["before/after comparison bars"],
    caveats: ["C and D are treated as high-risk."],
  },
  {
    id: "unknown_risk_exposure_pct",
    label: "Unknown risk exposure",
    description: "Share of productive DeFi capital that has no public risk mapping.",
    formula: "URE_b = Σ_{risk missing} usd_i / DIV_b",
    units: "ratio",
    inputs: ["defiPositions", "riskCoverage"],
    whereUsed: ["confidence downgrade", "no-overclaiming policy", "coverage bar"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["coverage bar"],
    caveats: ["Unknown is a coverage limitation, not an automatically safe or worst-case label."],
  },
  {
    id: "risk_coverage_pct",
    label: "Risk coverage",
    description: "Share of productive DeFi capital that is covered by public risk mappings.",
    formula: "Coverage_b = 1 - URE_b",
    units: "ratio",
    inputs: ["unknownRiskExposurePct"],
    whereUsed: ["trust messaging", "bucket overview card", "recommendation caveats"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["coverage bar"],
    caveats: ["Coverage applies to productive DeFi positions only."],
  },
  {
    id: "protocol_concentration_hhi",
    label: "Protocol concentration",
    description: "Protocol concentration measured with Herfindahl-Hirschman Index over productive DeFi weights.",
    formula: "HHI_b = Σ_p u_p^2",
    units: "index",
    inputs: ["protocolWeights"],
    whereUsed: ["ranker", "secondary explanation", "composition view"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["composition comparison"],
    caveats: ["Lower is more diversified."],
  },
  {
    id: "position_count",
    label: "Positions",
    description: "Count of bucket positions, including productive DeFi and idle wallet assets.",
    formula: "Npos_b = count(bucket positions)",
    units: "count",
    inputs: ["defiPositions", "idleExposures"],
    whereUsed: ["recommendation card", "simplicity story", "bucket overview"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["position simplification visual"],
    caveats: ["Used as a practical complexity proxy."],
  },
  {
    id: "protocol_count",
    label: "Protocol count",
    description: "Number of distinct DeFi protocol families in the bucket.",
    formula: "Nprot_b = count(distinct protocol families)",
    units: "count",
    inputs: ["defiPositions"],
    whereUsed: ["complexity", "methodology", "secondary UI"],
    shownInUi: false,
    audience: ["internal", "ranker"],
    chartUsage: ["expanded details"],
    caveats: ["Idle wallet holdings are not counted as DeFi protocols."],
  },
  {
    id: "chain_count",
    label: "Chain count",
    description: "Number of distinct chains represented in the bucket.",
    formula: "Nchain_b = count(distinct chains)",
    units: "count",
    inputs: ["defiPositions", "idleExposures"],
    whereUsed: ["complexity", "operational simplification", "methodology"],
    shownInUi: false,
    audience: ["internal", "ranker"],
    chartUsage: ["expanded details"],
    caveats: ["A cross-chain wallet bucket is operationally more complex."],
  },
  {
    id: "protocol_overlap_pct",
    label: "Protocol overlap",
    description: "Overlap between the user's current DeFi protocol mix and the YO vault protocol mix.",
    formula: "PO_b = Σ_p min(u_p, y_p)",
    units: "ratio",
    inputs: ["userProtocolWeights", "yoProtocolWeights"],
    whereUsed: ["trust messaging", "similarity", "expanded details"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["composition comparison"],
    caveats: ["Low overlap means YO is reaching a different protocol mix."],
  },
  {
    id: "savings_profile_score",
    label: "Savings score",
    description: "A 0..100 summary score that combines risk, concentration, complexity, coverage, and idle drag.",
    formula:
      "SPS_b = 100 * (1 - (a*norm(WRS) + b*HRE + c*norm(HHI) + d*norm(Complexity) + e*URE + f*ISR))",
    units: "score",
    inputs: ["weightedRiskScore", "highRiskExposurePct", "protocolHHI", "complexityNorm", "unknownRiskExposurePct", "idleSharePct"],
    whereUsed: ["recommendation card", "ranker", "methodology", "before/after bars"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["before/after comparison bars"],
    caveats: ["The score is a heuristic quality metric, not a forecast."],
  },
  {
    id: "idle_yield_opportunity_usd",
    label: "Idle yield opportunity",
    description: "Baseline idle capital that could be made productive.",
    formula: "IYO_b = IAV_b",
    units: "USD",
    inputs: ["idleAssetValueUsd"],
    whereUsed: ["suggested amount presets", "CTA copy", "explanation"],
    shownInUi: true,
    audience: ["internal", "ranker", "user"],
    chartUsage: ["bucket overview card"],
    caveats: ["Purely a capital-availability metric."],
  },
  {
    id: "estimated_annual_yield_opportunity_usd",
    label: "Estimated annual yield opportunity",
    description: "Simple informational estimate of what YO APY could capture on idle capital.",
    formula: "YCO_b = IAV_b * APY_b^{yo}",
    units: "USD/year",
    inputs: ["idleAssetValueUsd", "yoApyPct"],
    whereUsed: ["expanded recommendation details"],
    shownInUi: true,
    audience: ["internal", "user"],
    chartUsage: ["expanded details"],
    caveats: ["Informational only. Not a promise or guaranteed outcome."],
  },
  {
    id: "relative_risk_improvement",
    label: "Relative risk improvement",
    description: "Ranker gain from lower weighted risk in YO versus current DeFi positions.",
    formula: "RRI_b = max(0, (WRS_user - WRS_yo) / WRS_user)",
    units: "ratio",
    inputs: ["weightedRiskScore", "yoWeightedRiskScore"],
    whereUsed: ["ranker"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["Zero when current WRS is missing or YO is not safer on this metric."],
  },
  {
    id: "high_risk_reduction",
    label: "High-risk reduction",
    description: "Ranker gain from reducing high-risk exposure in YO.",
    formula: "HRR_b = max(0, HRE_user - HRE_yo)",
    units: "ratio",
    inputs: ["highRiskExposurePct", "yoHighRiskExposurePct"],
    whereUsed: ["ranker"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["Zero if YO does not reduce high-risk share."],
  },
  {
    id: "idle_opportunity_gain",
    label: "Idle opportunity gain",
    description: "Ranker boost for idle capital that could be captured by YO.",
    formula: "IOG_b = ISR_b",
    units: "ratio",
    inputs: ["idleSharePct"],
    whereUsed: ["ranker"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["Designed to encourage moving idle wallet assets into productive vaults."],
  },
  {
    id: "unknown_penalty",
    label: "Unknown penalty",
    description: "Ranker penalty applied when public risk coverage is low.",
    formula: "UP_b = min(1, URE_b / unknown_penalty_scale)",
    units: "ratio",
    inputs: ["unknownRiskExposurePct", "unknownPenaltyScale"],
    whereUsed: ["ranker", "confidence downgrade"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["High unknown exposure caps confidence and suppresses aggressive CTA."],
  },
  {
    id: "size_penalty",
    label: "Size penalty",
    description: "Ranker penalty for buckets below the minimum meaningful size threshold.",
    formula: "SizePenalty_b = max(0, 1 - TV_b / min_bucket_usd)",
    units: "ratio",
    inputs: ["bucketSizeUsd", "minBucketUsd"],
    whereUsed: ["ranker", "eligibility"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["Small buckets can still be shown, but not pushed aggressively."],
  },
  {
    id: "final_ranker_score",
    label: "Recommendation score",
    description: "Final 0..1 score used to order bucket-to-vault recommendations.",
    formula:
      "Score_b = 0.30*RRI + 0.22*HRR + 0.14*SSI + 0.08*CI + 0.08*SG + 0.05*SIM + 0.13*IOG - 0.18*UP - 0.08*SizePenalty",
    units: "ratio",
    inputs: ["relativeRiskImprovement", "highRiskReduction", "savingsScoreImprovement", "concentrationImprovement", "simplicityGain", "similarity", "idleOpportunityGain", "unknownPenalty", "sizePenalty"],
    whereUsed: ["recommendation ordering", "strength classification"],
    shownInUi: false,
    audience: ["ranker"],
    chartUsage: [],
    caveats: ["Clamped to [0,1] and then converted into strength/confidence messaging."],
  },
] as const;

export const METHODOLOGY_COMPUTATION_PLAN = [
  {
    id: "normalize",
    title: "Normalize wallet and YO data",
    description: "Canonicalize chains, protocols, strategies, assets, and bucket assignments before scoring anything.",
    outputs: ["canonical token exposures", "canonical protocol exposures", "YO vault allocations"],
  },
  {
    id: "bucketize",
    title: "Split into USD, ETH, and BTC buckets",
    description: "Build independent metric sets for each bucket and exclude cross-bucket comparisons from the ranker.",
    outputs: ["bucket size", "DeFi invested value", "idle asset value"],
  },
  {
    id: "coverage",
    title: "Measure public risk coverage",
    description: "Track covered versus unknown productive DeFi value and downgrade confidence when coverage is low.",
    outputs: ["unknown risk exposure", "risk coverage", "coverage caveats"],
  },
  {
    id: "score",
    title: "Compute bucket and vault metrics",
    description: "Calculate weighted risk, high-risk exposure, concentration, complexity, idle metrics, and savings score.",
    outputs: ["bucket metrics", "YO vault metrics", "suggested amount presets"],
  },
  {
    id: "rank",
    title: "Rank bucket-to-vault migrations",
    description: "Blend risk improvement, simplification, idle opportunity, and coverage penalties into a deterministic score.",
    outputs: ["recommendation score", "strength", "confidence"],
  },
  {
    id: "explain",
    title: "Render visual and narrative outputs",
    description: "Expose deterministic visual models to the UI and use the LLM only for narrative explanation on top of those metrics.",
    outputs: ["before/after bars", "coverage bar", "methodology content", "LLM explanation"],
  },
] as const;

export const METHODOLOGY_VISUALIZATION_PLAN = [
  {
    id: "before_after_bars",
    title: "Before vs after comparison bars",
    description: "Paired horizontal bars for weighted risk, high-risk exposure, and savings score on every recommendation card.",
    surfaces: ["recommendation card"],
  },
  {
    id: "coverage_bar",
    title: "Coverage bar",
    description: "Stacked horizontal bar with covered, unknown, and idle segments.",
    surfaces: ["bucket overview", "recommendation details", "methodology"],
  },
  {
    id: "position_simplification",
    title: "Position simplification",
    description: "Minimal visual that compares current position count to the target YO structure.",
    surfaces: ["recommendation card"],
  },
  {
    id: "composition_comparison",
    title: "Composition comparison",
    description: "Optional current versus YO stacked bars for protocol or strategy composition.",
    surfaces: ["expanded recommendation details"],
  },
  {
    id: "idle_split",
    title: "Idle vs invested split",
    description: "Simple stacked bar to show productive versus idle share inside each bucket.",
    surfaces: ["bucket overview", "methodology"],
  },
] as const;

export const METHODOLOGY_SECTIONS = [
  {
    id: "what-we-analyze",
    title: "What we analyze",
    body:
      "Why YO? looks at your wallet balances, productive DeFi positions, YO vault allocations, and public risk mappings. The system compares each bucket separately and keeps the math deterministic. Narrative copy is layered on top later.",
  },
  {
    id: "how-buckets-work",
    title: "How buckets work",
    body:
      "We split the portfolio into USD, ETH, and BTC buckets. Stablecoins are compared only to yoUSD, ETH assets only to yoETH, and BTC-like assets only to yoBTC. Assets outside those buckets are not cross-compared.",
  },
  {
    id: "risk-scores",
    title: "How risk scores work",
    body:
      "Risk grades map to A=1, B=2, C=3, D=4, and Unknown=3.5. Unknown is not treated as safe, but it is also not treated as the worst possible case. It is a conservative middle-high penalty that mostly impacts confidence and coverage messaging.",
  },
  {
    id: "weighted-risk",
    title: "Weighted risk formula",
    body:
      "Weighted risk is computed only over productive DeFi positions, not idle wallet balances. This prevents idle ETH or idle stablecoins from making a risky DeFi bucket look artificially safer than it really is.",
  },
  {
    id: "high-risk",
    title: "High-risk exposure formula",
    body:
      "High-risk exposure measures how much productive DeFi capital sits in positions with risk score 3 or higher. It is one of the main inputs to recommendation ranking and before/after comparisons.",
  },
  {
    id: "coverage",
    title: "Unknown risk coverage",
    body:
      "Coverage is the share of productive DeFi capital that has public risk mapping. When unknown exposure rises, confidence falls. Above 40% unknown we avoid strong recommendations; above 60% unknown we only show informational suggestions with caveats.",
  },
  {
    id: "savings-score",
    title: "Savings score formula",
    body:
      "Savings score is a summary heuristic from 0 to 100. It combines normalized weighted risk, high-risk exposure, protocol concentration, structural complexity, unknown coverage drag, and idle share. Higher is better, but it is not a forecast.",
  },
  {
    id: "idle-assets",
    title: "How idle assets are treated",
    body:
      "Idle stablecoins, idle ETH, and idle BTC are not mixed into protocol risk metrics directly. Instead, they are measured separately as idle capital and used as an incentive layer for suggested amounts and recommendation ranking.",
  },
  {
    id: "ranking",
    title: "How recommendations are ranked",
    body:
      "The ranker combines relative risk improvement, high-risk reduction, savings score improvement, concentration improvement, simplicity gain, similarity, and idle opportunity gain, then subtracts unknown-coverage and size penalties. All defaults are configurable.",
  },
  {
    id: "suggested-amount",
    title: "What a suggested amount means",
    body:
      "Suggested amount is deterministic. We calculate presets for idle-first, high-risk-only, combined, 25%, 50%, and full-bucket moves. The highlighted amount is a heuristic recommendation, not an obligation or guarantee.",
  },
  {
    id: "limitations",
    title: "Data limitations and caveats",
    body:
      "Public risk coverage is incomplete in DeFi. Some protocols, wrappers, and vault internals are unknown-heavy. When coverage is weak, the UI should say so directly and avoid claiming that YO is definitively safer. Yield opportunity estimates are informational only.",
  },
] as const;

export const METHODOLOGY_MARKDOWN = `# Methodology

## What we analyze

Why YO? analyzes wallet balances, productive DeFi positions, YO vault allocations, and public risk mappings. The deterministic engine computes all scores first. Narrative explanation is layered on top later.

## How buckets work

We compare only inside three buckets:

- USD bucket -> yoUSD
- ETH bucket -> yoETH
- BTC bucket -> yoBTC

We do not compare ETH savings to yoUSD or BTC savings to yoETH.

## How risk scores work

Risk grades map to numeric scores:

- A = 1
- B = 2
- C = 3
- D = 4
- Unknown = 3.5

Unknown is not treated as safe and not treated as automatically worst possible. It is a conservative middle-high penalty.

## Core formulas

### Bucket size

\`TV_b = Σ usd_i + Σ usd_k\`

### DeFi invested value

\`DIV_b = Σ usd_i\`

### Idle asset value

\`IAV_b = Σ usd_k\`

### Idle share

\`ISR_b = IAV_b / TV_b\`

### Weighted risk

\`WRS_b = Σ w_i * r_i\`

where \`w_i = usd_i / DIV_b\`

Weighted risk is computed on productive DeFi positions only.

### High-risk exposure

\`HRE_b = Σ_{r_i >= 3} usd_i / DIV_b\`

### Unknown risk exposure

\`URE_b = Σ_{risk missing} usd_i / DIV_b\`

### Risk coverage

\`Coverage_b = 1 - URE_b\`

### Protocol concentration

\`HHI_b = Σ_p u_p^2\`

### Savings score

\`SPS_b = 100 * (1 - Penalty_b)\`

\`Penalty_b = a*norm(WRS_b) + b*HRE_b + c*norm(HHI_b) + d*norm(Complexity_b) + e*URE_b + f*ISR_b\`

Default penalty weights:

- weighted risk = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.weightedRisk}
- high-risk exposure = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.highRisk}
- protocol concentration = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.protocolHHI}
- complexity = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.complexity}
- unknown risk = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.unknown}
- idle share = ${DEFAULT_METHODOLOGY.savingsPenaltyWeights.idle}

## How idle assets are treated

Idle stablecoins, idle ETH, and idle BTC are handled separately from protocol risk metrics. They are used for:

- idle capital available
- idle share
- estimated annual yield opportunity
- recommendation ranker boost
- suggested amount presets

Estimated annual yield opportunity is informational only:

\`YCO_b = IAV_b * APY_b^{yo}\`

## How recommendations are ranked

We compute:

- relative risk improvement
- high-risk reduction
- savings score improvement
- concentration improvement
- simplicity gain
- similarity
- idle opportunity gain
- unknown penalty
- size penalty

Final ranker score:

\`Score_b = 0.30*RRI + 0.22*HRR + 0.14*SSI + 0.08*CI + 0.08*SG + 0.05*SIM + 0.13*IOG - 0.18*UP - 0.08*SizePenalty\`

The final score is clamped to \`[0,1]\`.

## What a suggested amount means

We calculate several deterministic presets:

- idle-first
- high-risk-only
- combined
- 25%
- 50%
- all

The highlighted amount is a heuristic preset, not a promise of better returns.

## Unknown-risk policy

When unknown risk is high:

- above 40% unknown: no strong recommendation
- above 60% unknown: informational only

In those cases the UI should say that public risk coverage is incomplete and avoid overclaiming safety improvements.

## Visualizations

Core visualizations:

- before vs after bars for weighted risk, high-risk exposure, and savings score
- coverage bar with covered / unknown / idle segments
- position simplification compare
- optional composition compare

We avoid pie-heavy dashboards, radar charts, and overloaded charting.

## Caveats

- Public risk coverage in DeFi is incomplete.
- Some YO underlying allocations can still be unknown.
- Savings score is a heuristic, not a guarantee.
- Yield opportunity estimates are illustrative only.
`;
