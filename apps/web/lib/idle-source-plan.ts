import type { CanonicalChain, CanonicalProtocolExposure, CanonicalTokenExposure, RankedRecommendation } from "@whyyo/shared";

export type IdleSourcePlan = {
  symbol: string;
  chain: string;
  chainId: number | null;
  tokenAddress: string;
  decimals: number;
  logoUrl: string | null;
  availableUsd: number;
  availableAmount: number | null;
  recommendedUsd: number;
  recommendedAmount: number | null;
};

export type WithdrawalPlanItem = {
  protocolName: string;
  strategyLabel: string;
  usdValue: number;
  chain: string;
};

type SupportedDepositRoute = {
  chainId: number;
  symbol: string;
  address: string;
};

type SupportedDirectVault = "yoUSD" | "yoBTC" | "yoETH";

const USD_BUCKET_SYMBOLS = new Set(["USD", "USDC", "USDT", "USDS", "DAI", "USDE", "USDBC"]);
const ETH_BUCKET_SYMBOLS = new Set(["ETH", "WETH", "STETH", "WSTETH", "WEETH", "CBETH", "EETH"]);
const BTC_BUCKET_SYMBOLS = new Set(["BTC", "WBTC", "CBBTC", "TBTC", "SOLVBTC.JUP", "SOLVBTC"]);

const CHAIN_TO_ID: Partial<Record<CanonicalChain, number>> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
};

// Mirrors the current @yo-protocol/core VAULTS config for safe direct deposits.
const SAFE_DIRECT_DEPOSIT_ROUTES: Record<SupportedDirectVault, SupportedDepositRoute[]> = {
  yoUSD: [
    {
      chainId: 1,
      symbol: "USDC",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    {
      chainId: 8453,
      symbol: "USDC",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    },
    {
      chainId: 42161,
      symbol: "USDC",
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    },
  ],
  yoBTC: [
    {
      chainId: 1,
      symbol: "CBBTC",
      address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    },
    {
      chainId: 8453,
      symbol: "CBBTC",
      address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    },
  ],
  yoETH: [
    {
      chainId: 1,
      symbol: "WETH",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    },
    {
      chainId: 8453,
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006",
    },
  ],
};

const normalizeAddress = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const isEvmAddress = (value?: string | null) => /^0x[a-fA-F0-9]{40}$/.test(value?.trim() ?? "");

const pickBucketSymbolSet = (bucket: string) => {
  if (bucket === "USD") return USD_BUCKET_SYMBOLS;
  if (bucket === "ETH") return ETH_BUCKET_SYMBOLS;
  if (bucket === "BTC") return BTC_BUCKET_SYMBOLS;
  return new Set<string>();
};

const inferTokenDecimals = (symbol: string, bucket: string) => {
  const normalized = symbol.toUpperCase();
  if (bucket === "USD" || normalized.includes("USDC") || normalized.includes("USDT") || normalized.includes("USDS") || normalized === "DAI") {
    return 6;
  }
  if (bucket === "BTC" || normalized.includes("BTC")) {
    return 8;
  }
  return 18;
};

const getSupportedDepositRoutes = (recommendation: RankedRecommendation): SupportedDepositRoute[] =>
  SAFE_DIRECT_DEPOSIT_ROUTES[recommendation.vaultSymbol as SupportedDirectVault] ?? [];

const matchesSupportedRoute = (token: CanonicalTokenExposure, routes: SupportedDepositRoute[]) => {
  const chainId = CHAIN_TO_ID[token.chain];
  if (!chainId) return false;

  const tokenAddress = normalizeAddress(token.tokenAddress);
  const tokenSymbol = (token.parentSymbol ?? token.symbol).toUpperCase();

  return routes.some((route) => {
    if (route.chainId !== chainId) return false;

    const routeAddress = normalizeAddress(route.address);
    if (isEvmAddress(tokenAddress)) {
      return routeAddress === tokenAddress;
    }

    return route.symbol.toUpperCase() === tokenSymbol;
  });
};

export const buildIdleSourcePlan = ({
  recommendation,
  tokenExposures,
  protocolExposures,
}: {
  recommendation: RankedRecommendation;
  tokenExposures: CanonicalTokenExposure[];
  protocolExposures: CanonicalProtocolExposure[];
}): IdleSourcePlan | null => {
  const targetIdleUsd = Math.min(recommendation.suggestedUsd, recommendation.suggestedAmounts.idleFirstUsd);
  if (targetIdleUsd <= 0) return null;

  const bucketSymbols = pickBucketSymbolSet(recommendation.bucket);
  const idleSymbols = new Set(
    protocolExposures
      .filter((protocol) => protocol.bucket === recommendation.bucket && protocol.strategyType === "spot_idle")
      .flatMap((protocol) => protocol.assetSymbols)
      .map((symbol) => symbol.toUpperCase()),
  );

  const candidates = tokenExposures
    .filter((token) => token.bucket === recommendation.bucket)
    .filter((token) => {
      const symbol = (token.parentSymbol ?? token.symbol).toUpperCase();
      return idleSymbols.has(symbol) || bucketSymbols.has(symbol);
    })
    .sort((left, right) => right.usdValue - left.usdValue);

  if (candidates.length === 0) return null;

  const supportedRoutes = getSupportedDepositRoutes(recommendation);
  const directCandidates = supportedRoutes.length > 0 ? candidates.filter((token) => matchesSupportedRoute(token, supportedRoutes)) : [];
  const best = (directCandidates.length > 0 ? directCandidates : candidates)[0];
  if (!best) return null;

  const availableUsd = best.usdValue;
  const recommendedUsd = Math.min(targetIdleUsd, availableUsd);
  const unitPrice = best.amount && best.amount > 0 ? best.usdValue / best.amount : null;
  const recommendedAmount = unitPrice && unitPrice > 0 ? recommendedUsd / unitPrice : null;

  return {
    symbol: best.parentSymbol ?? best.symbol,
    chain: best.chain,
    chainId: CHAIN_TO_ID[best.chain] ?? null,
    tokenAddress: best.tokenAddress ?? "",
    decimals: inferTokenDecimals(best.parentSymbol ?? best.symbol, recommendation.bucket),
    logoUrl: best.logoUrl ?? null,
    availableUsd,
    availableAmount: best.amount ?? null,
    recommendedUsd,
    recommendedAmount,
  };
};

export const buildWithdrawalPlan = ({
  recommendation,
  protocolExposures,
  idleSourcePlan,
}: {
  recommendation: RankedRecommendation;
  protocolExposures: CanonicalProtocolExposure[];
  idleSourcePlan?: IdleSourcePlan | null;
}): WithdrawalPlanItem[] => {
  const targetUsd = Math.max(
    0,
    Math.max(recommendation.suggestedUsd, recommendation.suggestedAmounts.highRiskOnlyUsd) - (idleSourcePlan?.recommendedUsd ?? 0),
  );
  if (targetUsd <= 0) return [];

  const productive = protocolExposures
    .filter((protocol) => protocol.bucket === recommendation.bucket && protocol.strategyType !== "spot_idle")
    .filter((protocol) => protocol.canonicalProtocolId !== "yo")
    .filter((protocol) => (protocol.originalProtocolName ?? protocol.canonicalProtocolName).toLowerCase() !== "yo")
    .sort((left, right) => {
      const riskBias = (right.riskScore >= 3 ? 1 : 0) - (left.riskScore >= 3 ? 1 : 0);
      if (riskBias !== 0) return riskBias;
      return right.usdValue - left.usdValue;
    });

  const selected: WithdrawalPlanItem[] = [];
  let coveredUsd = 0;

  for (const protocol of productive) {
    if (coveredUsd >= targetUsd && selected.length > 0) break;
    selected.push({
      protocolName: protocol.originalProtocolName ?? protocol.canonicalProtocolName,
      strategyLabel: protocol.strategyType.replaceAll("_", " "),
      usdValue: protocol.usdValue,
      chain: protocol.chain,
    });
    coveredUsd += protocol.usdValue;
  }

  return selected.slice(0, 3);
};
