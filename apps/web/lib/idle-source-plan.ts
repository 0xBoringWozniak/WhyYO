import type { CanonicalChain, CanonicalProtocolExposure, CanonicalTokenExposure, RankedRecommendation } from "@whyyo/shared";
import type { YoVaultStatsItem } from "./yo-sdk";

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

const getSupportedDepositRoutes = ({
  recommendation,
  vaults,
}: {
  recommendation: RankedRecommendation;
  vaults: YoVaultStatsItem[];
}): SupportedDepositRoute[] => {
  const normalizedVaultAddress = normalizeAddress(recommendation.vaultAddress);
  const matchedVault =
    vaults.find((vault) => normalizeAddress(vault.contracts?.vaultAddress) === normalizedVaultAddress) ??
    vaults.find((vault) => vault.id === recommendation.vaultSymbol || vault.name === recommendation.vaultSymbol);
  if (!matchedVault) return [];

  const routes = [
    {
      chainId: matchedVault.chain.id,
      symbol: matchedVault.asset.symbol,
      address: matchedVault.asset.address,
    },
    ...(matchedVault.secondaryVaults ?? []).map((vault) => ({
      chainId: vault.chain.id,
      symbol: vault.asset.symbol,
      address: vault.asset.address,
    })),
  ];

  const deduped = new Map<string, SupportedDepositRoute>();
  for (const route of routes) {
    const key = `${route.chainId}:${normalizeAddress(route.address) || route.symbol.toUpperCase()}`;
    deduped.set(key, route);
  }

  return [...deduped.values()];
};

const matchesSupportedRoute = (token: CanonicalTokenExposure, routes: SupportedDepositRoute[]) => {
  const chainId = CHAIN_TO_ID[token.chain];
  if (!chainId) return false;

  const tokenAddress = normalizeAddress(token.tokenAddress);
  if (!isEvmAddress(tokenAddress)) return false;

  const tokenSymbol = (token.parentSymbol ?? token.symbol).toUpperCase();

  return routes.some((route) => {
    if (route.chainId !== chainId) return false;

    const routeAddress = normalizeAddress(route.address);
    if (routeAddress && tokenAddress === routeAddress) return true;

    return route.symbol.toUpperCase() === tokenSymbol;
  });
};

export const buildIdleSourcePlan = ({
  recommendation,
  tokenExposures,
  protocolExposures,
  vaults = [],
}: {
  recommendation: RankedRecommendation;
  tokenExposures: CanonicalTokenExposure[];
  protocolExposures: CanonicalProtocolExposure[];
  vaults?: YoVaultStatsItem[];
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

  const supportedRoutes = getSupportedDepositRoutes({ recommendation, vaults });
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
