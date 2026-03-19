"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import type { BucketMetrics, CanonicalProtocolExposure, CanonicalTokenExposure, RankedRecommendation } from "@whyyo/shared";

import { refreshScan, startScan } from "../lib/api";
import { getVaultAccent, getVaultLogoUrl, yoBrandMarkUrl } from "../lib/brand-assets";
import { reportClientError } from "../lib/client-error-reporting";
import {
  getCoverageTrustStatus,
  getOverlapTrustStatus,
  getRecommendationConfidence,
  getVaultHighRiskTrustStatus,
  getYoShareTrustStatus,
  trustMetricToneClass,
} from "../lib/recommendation-confidence";
import { cn, formatPct, formatUsd } from "../lib/utils";
import { setWalletReconnectEnabled } from "../lib/wagmi";
import { useScanStore } from "../store/use-scan-store";
import { AssetIcon } from "./asset-icon";
import { ConfidenceBadge } from "./confidence-badge";
import { MethodologyLink, METHODOLOGY_SECTION_IDS, buildDashboardReturnTo, restoreDashboardScrollFromUrl } from "./methodology-link";
import { BeforeAfterBars, CompositionCompare, SimplificationVisual, StackedBar } from "./metrics-visuals";
import { Badge, Button, Card } from "./ui";
import { DepositDrawer } from "./yo-deposit-drawer";

const scanningSteps = [
  "Loading your portfolio from blockchain...",
  "Calculating risk scores...",
  "Comparing with YO vaults...",
  "Creating recommendations...",
];

const thinkingPhrasesV0 = [
  "Loading data from blockchain.",
  "Collecting risk scores.",
  "Idle assets are scored separately from productive DeFi positions.",
  "Diversification is measured across protocols, chains, and strategies.",
  "YO recommendations are bucket-specific.",
  "Unknown coverage lowers recommendation confidence.",
  "LLM agent creates personal explanation.",
];

const thinkingPhrases = [
  "Welcome to WhyYO",
  "We'll help you get the most out of your DeFi assets with YO vaults",
  "Loading portfolio data from on-chain",
  "Bucket-specific recommendations are preparing",
  "Calculating risk scores and diversification metrics for your positions",
  "Determining optimal allocations and confidence levels",
  "Finalizing personalized comments with our AI agent",
];

const formatCoverage = (value: number | null) => (value === null ? "n/a" : formatPct(value * 100));
const formatDiversification = (value: number | null) => (value === null ? "n/a" : formatPct((1 - value) * 100));
const shortenAddress = (value?: string) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not connected");
const formatAnalyzedValue = (value: number) => {
  const absValue = Math.abs(value);
  if (absValue < 100_000) return formatUsd(value);
  if (absValue < 1_000_000) {
    const compact = value / 1_000;
    const digits = Math.abs(compact) >= 100 ? 0 : 1;
    return `$${compact.toFixed(digits)}k`;
  }
  const compact = value / 1_000_000;
  const digits = Math.abs(compact) >= 100 ? 0 : Math.abs(compact) >= 10 ? 1 : 2;
  return `$${compact.toFixed(digits)}M`;
};
const formatIntentLabel = (value: string) =>
  value
    .split("_")
    .map((part) => (part ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part))
    .join(" ");
const formatReadableValue = (value: number | null, formatter: (value: number) => string, fallback: string) =>
  value === null ? fallback : formatter(value);
const getDisplayPositionCount = ({
  positionCount,
  defiPositionCount,
  idlePositionCount,
}: {
  positionCount: number;
  defiPositionCount: number;
  idlePositionCount: number;
}) => {
  if (defiPositionCount === 0 && idlePositionCount > 0) return 1;
  return positionCount;
};
const formatBucketUsd = (value: number) => {
  if (Math.abs(value) < 1_000_000) return formatUsd(value);
  if (Math.abs(value) < 1_000_000_000) {
    const compact = value / 1_000_000;
    const digits = compact >= 100 ? 0 : compact >= 10 ? 1 : 2;
    return `$${compact.toFixed(digits)}M`;
  }
  const compact = value / 1_000_000_000;
  const digits = compact >= 100 ? 0 : compact >= 10 ? 1 : 2;
  return `$${compact.toFixed(digits)}B`;
};

type BootStage = "intro" | "booting" | "connect" | "active";

type BucketTokenChip = {
  key: string;
  symbol: string;
  usdValue: number;
  logoUrl: string | null;
};

type IdleSourcePlan = {
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

type WithdrawalPlanItem = {
  protocolName: string;
  strategyLabel: string;
  usdValue: number;
  chain: string;
};

const USD_BUCKET_SYMBOLS = new Set(["USD", "USDC", "USDT", "USDS", "DAI", "USDE", "USDBC"]);
const ETH_BUCKET_SYMBOLS = new Set(["ETH", "WETH", "STETH", "WSTETH", "WEETH", "CBETH", "EETH"]);
const BTC_BUCKET_SYMBOLS = new Set(["BTC", "WBTC", "CBBTC", "TBTC", "SOLVBTC.JUP", "SOLVBTC"]);

const pickBucketSymbolSet = (bucket: string) => {
  if (bucket === "USD") return USD_BUCKET_SYMBOLS;
  if (bucket === "ETH") return ETH_BUCKET_SYMBOLS;
  if (bucket === "BTC") return BTC_BUCKET_SYMBOLS;
  return new Set<string>();
};

const CHAIN_TO_ID: Partial<Record<CanonicalTokenExposure["chain"], number>> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
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

const isValidWalletAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());

const buildIdleSourcePlan = ({
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

  const best = candidates[0];
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

const buildWithdrawalPlan = ({
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

const getBucketTokens = (tokens: CanonicalTokenExposure[], bucket: string): BucketTokenChip[] => {
  const grouped = new Map<string, BucketTokenChip>();

  for (const token of tokens.filter((entry) => entry.bucket === bucket)) {
    const key = (token.parentSymbol ?? token.symbol).toUpperCase();
    const existing = grouped.get(key);

    if (existing) {
      existing.usdValue += token.usdValue;
      if (!existing.logoUrl && token.logoUrl) existing.logoUrl = token.logoUrl;
      continue;
    }

    grouped.set(key, {
      key,
      symbol: token.parentSymbol ?? token.symbol,
      usdValue: token.usdValue,
      logoUrl: token.logoUrl ?? null,
    });
  }

  return [...grouped.values()].sort((left, right) => right.usdValue - left.usdValue).slice(0, 12);
};

const getBucketProtocols = (protocols: CanonicalProtocolExposure[], bucket: string) =>
  protocols
    .filter((protocol) => protocol.bucket === bucket && protocol.strategyType !== "spot_idle")
    .sort((left, right) => right.usdValue - left.usdValue)
    .slice(0, 12);

const SectionTitle = ({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      {eyebrow ? <div className="text-xs uppercase tracking-[0.22em] text-white/40">{eyebrow}</div> : null}
      <div className="mt-2 flex items-center gap-3">
        <h2 className="yo-display text-[2.5rem] leading-none text-white md:text-[3.5rem]">{title}</h2>
      </div>
    </div>
    {action}
  </div>
);

const StatBlock = ({
  label,
  value,
  emphasis = false,
  valueClassName,
  labelClassName,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClassName?: string;
  labelClassName?: string;
}) => (
  <div className="space-y-2">
    <div className={cn("flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/42", labelClassName)}>
      <span>{label}</span>
    </div>
    <div className={cn("font-display leading-none text-white", emphasis ? "text-6xl" : "text-4xl", valueClassName)}>{value}</div>
  </div>
);

class SectionErrorBoundary extends React.Component<
  React.PropsWithChildren<{ title: string }>,
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportClientError({
      kind: "react_boundary",
      message: error.message || `${this.props.title} render failure`,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      extra: { section: this.props.title },
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Card className="border-[#ff6b6b]/40 bg-[#1a1111] text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-[#ff6b6b]">Section fallback</div>
          <div className="mt-3 text-2xl font-semibold">{this.props.title} failed to render</div>
          <p className="mt-3 text-base leading-7 text-white/68">
            The dashboard kept the rest of the scan alive, but this block hit a client-side rendering issue.
            Refresh once, and if it persists we can isolate the exact payload shape causing it.
          </p>
        </Card>
      );
    }

    return this.props.children;
  }
}

const OverlayBackdrop = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[44rem] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/8 blur-[120px]"
  />
);

const IntroOverlay = ({
  stage,
  onEnter,
}: {
  stage: BootStage;
  onEnter: () => void;
}) => {
  if (stage === "active" || stage === "connect") return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black">
      <style jsx>{`
        @keyframes yoIntroGlow {
          0%,
          100% {
            transform: scale(1);
            box-shadow:
              0 0 46px rgba(215, 255, 31, 0.16),
              0 0 120px rgba(215, 255, 31, 0.1);
          }
          50% {
            transform: scale(1.018);
            box-shadow:
              0 0 80px rgba(215, 255, 31, 0.3),
              0 0 180px rgba(215, 255, 31, 0.18);
          }
        }

        @keyframes yoIntroBloom {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.42;
            transform: scale(1.12);
          }
        }

        @keyframes yoBootFlash {
          0% {
            opacity: 0;
            transform: scale(0.94);
            filter: blur(18px);
          }
          24% {
            opacity: 1;
            transform: scale(1.03);
            filter: blur(0);
          }
          60% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
          100% {
            opacity: 0;
            transform: scale(1.08);
            filter: blur(12px);
          }
        }
      `}</style>
      <OverlayBackdrop />
      {stage === "intro" ? (
        <button
          type="button"
          aria-label="Enter WHY YO"
          className="group flex h-full w-full cursor-pointer items-center justify-center bg-transparent focus-visible:outline-none"
          onClick={onEnter}
        >
          <div
            className="relative flex h-32 w-[28rem] max-w-[88vw] items-center justify-center rounded-[34px] border border-lime/24 bg-lime px-10 text-center text-black transition duration-500 group-hover:scale-[1.015] group-focus-visible:scale-[1.015] group-focus-visible:ring-2 group-focus-visible:ring-lime/70"
            style={{ animation: "yoIntroGlow 2.45s ease-in-out infinite" }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-24%] rounded-[52px] bg-lime/22 blur-[62px]"
              style={{ animation: "yoIntroBloom 2.45s ease-in-out infinite" }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-44%] rounded-[74px] bg-lime/12 blur-[130px]"
              style={{ animation: "yoIntroBloom 2.45s ease-in-out infinite" }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.02)_42%,rgba(0,0,0,0.04)_100%)] opacity-80"
            />
            <span className="relative z-10 yo-display text-[3.9rem] leading-none">WHY YO</span>
          </div>
        </button>
      ) : (
        <div className="tv-boot relative flex h-full w-full items-center justify-center overflow-hidden bg-[#050505] text-black">
          <div className="tv-noise absolute inset-0 opacity-20" />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[26rem] w-[44rem] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/8 blur-[120px]"
            style={{ animation: "yoBootFlash 1s ease-out forwards" }}
          />
          <div className="relative z-10 text-center">
            <div
              className="mx-auto flex h-32 w-[30rem] max-w-[90vw] items-center justify-center rounded-[36px] border border-lime/18 bg-lime shadow-[0_0_90px_rgba(215,255,31,0.14)]"
              style={{ animation: "yoBootFlash 0.92s cubic-bezier(0.22,1,0.36,1) forwards" }}
            >
              <div className="yo-display text-[4rem] leading-none">WHY YO</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ConnectOverlay = ({
  open,
  onConnect,
  isConnecting,
  addressDraft,
  setAddressDraft,
  onUseAddress,
}: {
  open: boolean;
  onConnect: () => void;
  isConnecting: boolean;
  addressDraft: string;
  setAddressDraft: (value: string) => void;
  onUseAddress: () => void;
}) => {
  if (!open) return null;

  const isGuestAddressReady = isValidWalletAddress(addressDraft.trim());

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center overflow-hidden bg-black px-6">
      <OverlayBackdrop />
      <div className="relative z-10 w-full max-w-[760px]">
        <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4">
          <Button className="w-full px-8 py-4 text-base" onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </Button>

          <div className="flex w-full items-center gap-4">
            <input
              value={addressDraft}
              onChange={(event) => setAddressDraft(event.target.value)}
              placeholder="0x..."
              className="h-[56px] min-w-0 flex-1 rounded-full border border-white/10 bg-[#141414] px-5 text-base text-white outline-none placeholder:text-white/25"
            />
            <button
              type="button"
              aria-label="Use public address"
              disabled={!isGuestAddressReady}
              onClick={onUseAddress}
              className={cn(
                "inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border text-xl font-semibold transition",
                isGuestAddressReady
                  ? "border-lime/28 bg-lime text-black shadow-[0_0_24px_rgba(215,255,31,0.18)] hover:bg-[#ebff71]"
                  : "border-white/10 bg-white/6 text-white/24",
              )}
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingOverlay = ({
  open,
}: {
  open: boolean;
}) => {
  const [phraseIndex, setPhraseIndex] = React.useState(0);
  const [visibleChars, setVisibleChars] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setPhraseIndex(0);
    setVisibleChars(0);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const phrase = thinkingPhrases[phraseIndex] ?? thinkingPhrases[0] ?? "";
    const typingDone = visibleChars >= phrase.length;
    const delay = typingDone ? 900 : 38;

    const timer = window.setTimeout(() => {
      if (typingDone) {
        setPhraseIndex((current) => (current + 1) % thinkingPhrases.length);
        setVisibleChars(0);
        return;
      }
      setVisibleChars((current) => Math.min(current + 1, phrase.length));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [open, phraseIndex, visibleChars]);

  if (!open) return null;

  const activePhrase = (thinkingPhrases[phraseIndex] ?? thinkingPhrases[0] ?? "").slice(0, visibleChars);

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center overflow-hidden bg-black px-6">
      <OverlayBackdrop />
      <div className="relative z-10 w-full max-w-[980px] text-left">
        <div className="flex min-h-[2.5rem] items-center gap-4 text-[1.45rem] leading-9 text-white md:text-[1.6rem]">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-lime border-t-transparent" />
          </span>
          <span className="min-w-0">
            {activePhrase}
            <span className="ml-1 inline-block h-8 w-[2px] animate-pulse bg-lime align-middle" />
          </span>
        </div>
      </div>
    </div>
  );
};

const BucketOverviewCard = ({
  bucket,
  tokens,
  protocols,
  hasRecommendation,
}: {
  bucket: BucketMetrics;
  tokens: BucketTokenChip[];
  protocols: CanonicalProtocolExposure[];
  hasRecommendation: boolean;
}) => {
  const idlePct = Math.max(0, Math.min(100, bucket.idleSharePct * 100));
  const productivePct = Math.max(0, Math.min(100, 100 - idlePct));
  const displayPositionCount = getDisplayPositionCount({
    positionCount: bucket.positionCount,
    defiPositionCount: bucket.defiPositionCount,
    idlePositionCount: bucket.idlePositionCount,
  });
  const coveredPct =
    bucket.riskCoveragePct === null ? 0 : Math.max(0, Math.min(100, productivePct * bucket.riskCoveragePct));
  const unknownPct = Math.max(0, 100 - coveredPct);

  const coverageSegments = [
    { key: "covered", label: "Covered", valuePct: coveredPct, tone: "good" as const },
    { key: "unknown", label: "Unknown", valuePct: unknownPct, tone: "warn" as const },
  ];

  const productiveVsIdleSegments = [
    { key: "productive", label: "Productive", valuePct: productivePct, tone: "good" as const },
    { key: "idle", label: "Idle", valuePct: idlePct, tone: "warn" as const },
  ];
  const topTokens = tokens.slice(0, 3);
  const remainingTokenUsd = tokens.slice(3).reduce((sum, token) => sum + token.usdValue, 0);
  const tokenPreviewItems =
    remainingTokenUsd > 0
      ? [
          ...topTokens,
          {
            key: `${bucket.bucket}-others`,
            symbol: "Others",
            usdValue: remainingTokenUsd,
            logoUrl: null,
          },
        ]
      : topTokens;

  return (
    <Card className="relative flex h-[82vh] min-h-[820px] max-h-[980px] flex-col space-y-4 overflow-hidden">
    <Badge
      tone={hasRecommendation ? "good" : "neutral"}
      className="absolute right-4 top-4 z-10 h-10 min-w-[86px] max-w-[86px] justify-center px-2 py-0 text-center text-[10px]"
    >
      {hasRecommendation ? "LIVE" : "SOON"}
    </Badge>

    <div className="min-w-0 pr-28">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-white/42">{bucket.bucket} bucket</div>
        <div
          className={cn(
            "mt-3 font-display leading-[0.92] tracking-tight text-white",
            bucket.bucketSizeUsd >= 1_000_000 ? "text-[clamp(2.55rem,3.1vw,3.8rem)]" : "text-[clamp(2.6rem,3.8vw,4.3rem)]",
          )}
        >
          <span className="whitespace-nowrap">{formatBucketUsd(bucket.bucketSizeUsd)}</span>
        </div>
      </div>
    </div>

    <div className="grid gap-x-6 gap-y-3 text-base text-white/76 md:grid-cols-2">
      <div>
        <div className="text-white/62">Idle capital</div>
        <div className="mt-1 text-white">{formatUsd(bucket.idleAssetUsd)}</div>
      </div>
      <div>
        <div className="text-white/62">
          <MethodologyLink sectionId={METHODOLOGY_SECTION_IDS.riskCoverage}>Risk coverage</MethodologyLink>
        </div>
        <div className="mt-1 text-white">{formatCoverage(bucket.riskCoveragePct)}</div>
      </div>
      <div>
        <div className="text-white/62">
          <MethodologyLink sectionId={METHODOLOGY_SECTION_IDS.diversification}>Diversification</MethodologyLink>
        </div>
        <div className="mt-1 text-white">{formatDiversification(bucket.protocolHHI)}</div>
      </div>
      <div>
        <div className="text-white/62">Positions</div>
        <div className="mt-1 text-white">{displayPositionCount}</div>
      </div>
    </div>

    <StackedBar segments={coverageSegments} />
    <StackedBar segments={productiveVsIdleSegments} />

    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.2em] text-white/42">Top tokens</div>
      <div className="space-y-2">
        {tokenPreviewItems.length > 0 ? (
          <div className="grid min-h-[154px] grid-cols-2 auto-rows-[72px] content-start gap-2">
            {tokenPreviewItems.map((token) => (
              <div key={token.key} className="flex h-[72px] min-w-0 items-center gap-2 rounded-[22px] border border-white/10 bg-black/45 px-3 py-2.5">
                <AssetIcon src={token.logoUrl} alt={token.symbol} label={token.symbol} className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-[0.95rem] font-semibold leading-tight text-white">{token.symbol}</div>
                  <div className="truncate text-xs text-white/48">{formatUsd(token.usdValue)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-base text-white/46">No material token exposures</div>
        )}
      </div>
    </div>

    <div className="min-h-0 flex flex-1 flex-col space-y-2">
      <div className="text-xs uppercase tracking-[0.2em] text-white/42">Protocol mix</div>
      <div className="min-h-0 space-y-2">
        {protocols.length > 0 ? (
          <div className="max-h-[430px] min-h-[430px] space-y-2.5 overflow-y-auto pr-3 [scrollbar-color:rgba(215,255,31,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lime/55 [&::-webkit-scrollbar-track]:bg-transparent">
            {protocols.map((protocol) => (
              <div
                key={`${protocol.chain}:${protocol.canonicalProtocolId}:${protocol.usdValue}`}
                className="flex min-w-0 items-center justify-between rounded-[22px] border border-white/8 bg-black/45 px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AssetIcon
                    src={protocol.logoUrl ?? null}
                    alt={protocol.canonicalProtocolName}
                    label={protocol.canonicalProtocolName}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[1.02rem] font-semibold leading-tight text-white">
                      {protocol.originalProtocolName ?? protocol.canonicalProtocolName}
                    </div>
                    <div className="truncate text-[11px] uppercase tracking-[0.17em] text-white/42">
                      {protocol.strategyType.replaceAll("_", " ")}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 pl-3 text-base text-white/68">{formatUsd(protocol.usdValue)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-base text-white/46">No productive protocol positions</div>
        )}
      </div>
    </div>
    </Card>
  );
};

const RecommendationCard = ({
  recommendation,
  walletAddress,
  onConnectRequest,
  tokenExposures,
  protocolExposures,
}: {
  recommendation: RankedRecommendation;
  walletAddress: string;
  onConnectRequest: () => void;
  tokenExposures: CanonicalTokenExposure[];
  protocolExposures: CanonicalProtocolExposure[];
}) => {
  const accent = getVaultAccent(recommendation.vaultSymbol);
  const showDepositButton = recommendation.suggestedUsd > 0;
  const idleSourcePlan = buildIdleSourcePlan({
    recommendation,
    tokenExposures,
    protocolExposures,
  });
  const withdrawalPlan = buildWithdrawalPlan({
    recommendation,
    protocolExposures,
    idleSourcePlan,
  });
  const confidence = getRecommendationConfidence(recommendation);
  const coverageTone = trustMetricToneClass(getCoverageTrustStatus(recommendation.metrics.coveragePct));
  const vaultHighRiskTone = trustMetricToneClass(getVaultHighRiskTrustStatus(recommendation.metrics.vaultHighRiskExposurePct));
  const existingYoShareTone = trustMetricToneClass(getYoShareTrustStatus(recommendation.metrics.existingYoSharePct * 100));
  const overlapTone = trustMetricToneClass(getOverlapTrustStatus(recommendation.metrics.protocolOverlapPct));
  const displayBeforePositions =
    recommendation.visualization.currentComposition.protocols.length === 0 && recommendation.metrics.idleAssetUsd > 0
      ? 1
      : recommendation.visualization.simplification.beforePositions;
  const trustMetricBadges = [
    {
      key: "coverage",
      sectionId: METHODOLOGY_SECTION_IDS.coverage,
      label: "Coverage",
      value: formatReadableValue(recommendation.metrics.coveragePct, formatPct, "n/a"),
      tone: coverageTone,
    },
    {
      key: "vault-high-risk",
      sectionId: METHODOLOGY_SECTION_IDS.vaultHighRisk,
      label: "Vault high-risk",
      value: formatReadableValue(recommendation.metrics.vaultHighRiskExposurePct, formatPct, "n/a"),
      tone: vaultHighRiskTone,
    },
    {
      key: "yo-share",
      sectionId: METHODOLOGY_SECTION_IDS.yoShare,
      label: "YO share",
      value: formatPct(recommendation.metrics.existingYoSharePct * 100),
      tone: existingYoShareTone,
    },
    {
      key: "overlap",
      sectionId: METHODOLOGY_SECTION_IDS.overlap,
      label: "Overlap",
      value: formatPct(recommendation.metrics.protocolOverlapPct),
      tone: overlapTone,
    },
  ];

  return (
    <Card className="w-full min-w-full snap-start overflow-visible p-0">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex items-center gap-4">
            <AssetIcon
              src={getVaultLogoUrl(recommendation.vaultSymbol)}
              alt={recommendation.vaultSymbol}
              label={recommendation.vaultSymbol}
              accent={accent}
              className="h-16 w-16 border-transparent"
            />
            <div>
              <h3 className="text-[1.42rem] font-semibold leading-tight text-white">
                {recommendation.bucket} Bucket <span className="text-white/36">·</span>{" "}
                <span className="text-[#ffd84d]">{formatIntentLabel(recommendation.primaryIntent)}</span>
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="h-full rounded-[26px] border border-white/8 bg-[#121212] p-4">
            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/42">
              {recommendation.showBeforeAfterBars ? "Modeled comparison" : "Idle profile"}
            </div>
            {recommendation.showBeforeAfterBars ? (
              <BeforeAfterBars metrics={recommendation.visualization.beforeAfterBars} />
            ) : recommendation.showIdleOpportunityVisual ? (
              <div className="rounded-[22px] border border-white/8 bg-black/35 p-4">
                <div className="space-y-4">
                  <StackedBar segments={recommendation.visualization.idleVsInvestedBar} />
                  <div className="grid gap-2 text-[0.96rem] text-white/74">
                    <div>Idle capital {formatUsd(recommendation.metrics.idleAssetUsd)}</div>
                    <div>Est. annual yield {formatUsd(recommendation.metrics.estimatedAnnualYieldOpportunityUsd ?? 0)}</div>
                    <div>Vault APY {formatPct(recommendation.metrics.vaultApyPct)}</div>
                    <div>
                      <MethodologyLink sectionId={METHODOLOGY_SECTION_IDS.vaultHighRisk}>Vault high-risk</MethodologyLink>{" "}
                      {recommendation.metrics.vaultHighRiskExposurePct === null ? "n/a" : formatPct(recommendation.metrics.vaultHighRiskExposurePct)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[#121212] p-4">
            <div className="flex h-full flex-col">
              <div className="text-xs uppercase tracking-[0.2em] text-white/42">Suggested amount</div>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div className="font-display text-[3rem] leading-none text-lime">{formatUsd(recommendation.suggestedUsd)}</div>
                <div className="pt-1">
                  <ConfidenceBadge label={confidence.label} className={confidence.className} />
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  {trustMetricBadges.map((metric) => (
                    <div key={metric.key} className="min-w-0 rounded-[18px] border border-white/8 bg-black/30 px-4 py-4">
                      <div className="min-w-0 overflow-hidden text-[0.68rem] uppercase tracking-[0.13em] leading-tight text-white/42">
                        <MethodologyLink className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap no-underline border-b border-current/80 pb-[0.14rem]" sectionId={metric.sectionId}>
                          {metric.label}
                        </MethodologyLink>
                      </div>
                      <div className={cn("mt-3 text-[1.45rem] font-semibold leading-none", metric.tone)}>{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto space-y-4 pt-4">
                <SimplificationVisual
                  beforePositions={displayBeforePositions}
                  afterPositions={recommendation.visualization.simplification.afterPositions}
                />
                <div className="flex justify-center">
                  {showDepositButton ? (
                    <DepositDrawer
                      recommendation={recommendation}
                      walletAddress={walletAddress}
                      onConnectRequest={onConnectRequest}
                      primaryButtonLabel="Preview deposit"
                      emphasize
                      idleSourcePlan={idleSourcePlan}
                      withdrawalPlan={withdrawalPlan}
                    />
                  ) : (
                    <Button variant="secondary" disabled>
                      No deposit amount
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="h-full rounded-[22px] border border-white/8 bg-[#121212] p-4">
            <CompositionCompare
              title="Protocol mix"
              current={recommendation.visualization.currentComposition.protocols}
              target={recommendation.visualization.yoComposition.protocols}
            />
          </div>
          <div className="h-full rounded-[22px] border border-white/8 bg-[#121212] p-4">
            <CompositionCompare
              title="Strategy mix"
              current={recommendation.visualization.currentComposition.strategies}
              target={recommendation.visualization.yoComposition.strategies}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export const ScanShell = ({
  initialWalletAddress,
  initialBootStage,
}: {
  initialWalletAddress?: string;
  initialBootStage?: BootStage;
} = {}) => {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { phase, scan, error, hasHydrated, setPhase, setScan, setError } = useScanStore();
  const [bootStage, setBootStage] = React.useState<BootStage>(initialBootStage ?? (initialWalletAddress ? "active" : "intro"));
  const [addressDraft, setAddressDraft] = React.useState(initialWalletAddress ?? "");
  const [forceConnectChoice, setForceConnectChoice] = React.useState(false);
  const lastAutoScannedWallet = React.useRef<string | null>(null);
  const recommendationsScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollRecommendationsPrev, setCanScrollRecommendationsPrev] = React.useState(false);
  const [canScrollRecommendationsNext, setCanScrollRecommendationsNext] = React.useState(false);
  const introAutoEnterTimeoutRef = React.useRef<number | null>(null);
  const introBootTimeoutRef = React.useRef<number | null>(null);
  const introTransitionStartedRef = React.useRef(false);

  const activeWalletAddress = initialWalletAddress ?? address ?? "";
  const normalizedActiveWalletAddress = activeWalletAddress ? activeWalletAddress.toLowerCase() : "";
  const normalizedScanOwnerAddress = scan?.portfolioOverview.ownerAddress?.toLowerCase() ?? "";
  const scanMatchesActiveWallet = Boolean(normalizedActiveWalletAddress) && normalizedScanOwnerAddress === normalizedActiveWalletAddress;
  const visibleScan = scanMatchesActiveWallet ? scan : null;
  const isConnectedWalletView = Boolean(address && !initialWalletAddress);
  const resumeParam = searchParams.get("resume");
  const connectParam = searchParams.get("connect");

  React.useEffect(() => {
    setAddressDraft(initialWalletAddress ?? "");
    setForceConnectChoice(false);
    setBootStage(initialBootStage ?? (initialWalletAddress ? "active" : "intro"));
  }, [initialBootStage, initialWalletAddress]);

  React.useEffect(() => {
    if (initialWalletAddress) return;
    if (resumeParam !== "1") return;

    setForceConnectChoice(false);
    setBootStage((current) => (current === "intro" || current === "booting" ? "active" : current));
  }, [initialWalletAddress, resumeParam]);

  React.useEffect(() => {
    if (initialWalletAddress) return;
    if (connectParam !== "1") return;

    setError(null);
    setForceConnectChoice(true);
    setBootStage("connect");
  }, [connectParam, initialWalletAddress, setError]);

  React.useEffect(() => {
    restoreDashboardScrollFromUrl();
  }, []);

  const openMethodologyPage = React.useCallback(() => {
    const currentPath =
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    const returnTo = buildDashboardReturnTo(currentPath, typeof window !== "undefined" ? window.scrollY : 0);
    window.history.replaceState(window.history.state, "", returnTo);
    router.push(`/methodology?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router]);

  const mutation = useMutation({
    mutationFn: async (walletAddress: string) => startScan(walletAddress),
    onMutate: () => {
      setPhase("scanning");
      setError(null);
    },
    onSuccess: (data) => setScan(data),
    onError: (mutationError) => setError((mutationError as Error).message),
  });

  const refreshMutation = useMutation({
    mutationFn: async (walletAddress: string) => refreshScan(walletAddress),
    onMutate: () => {
      setPhase("scanning");
      setError(null);
    },
    onSuccess: (data) => setScan(data),
    onError: (mutationError) => setError((mutationError as Error).message),
  });

  React.useEffect(() => {
    if (!hasHydrated) return;
    if (bootStage !== "active" || !activeWalletAddress) return;

    if (visibleScan?.portfolioOverview.ownerAddress.toLowerCase() === normalizedActiveWalletAddress) {
      lastAutoScannedWallet.current = normalizedActiveWalletAddress;
      return;
    }
    if (phase === "scanning" || mutation.isPending) return;
    if (lastAutoScannedWallet.current === normalizedActiveWalletAddress && (visibleScan !== null || error !== null)) return;

    lastAutoScannedWallet.current = normalizedActiveWalletAddress;
    mutation.mutate(activeWalletAddress);
  }, [
    activeWalletAddress,
    bootStage,
    error,
    hasHydrated,
    mutation,
    normalizedActiveWalletAddress,
    phase,
    setError,
    visibleScan,
  ]);

  React.useEffect(() => {
    if (!hasHydrated) return;
    if (!normalizedActiveWalletAddress) return;
    if (!scan || scanMatchesActiveWallet) return;

    setScan(null);
    setPhase("idle");
    setError(null);
    lastAutoScannedWallet.current = null;
  }, [hasHydrated, normalizedActiveWalletAddress, scan, scanMatchesActiveWallet, setError, setPhase, setScan]);

  const clearIntroAutoTimer = React.useCallback(() => {
    if (introAutoEnterTimeoutRef.current !== null) {
      window.clearTimeout(introAutoEnterTimeoutRef.current);
      introAutoEnterTimeoutRef.current = null;
    }
  }, []);

  const clearIntroBootTimer = React.useCallback(() => {
    if (introBootTimeoutRef.current !== null) {
      window.clearTimeout(introBootTimeoutRef.current);
      introBootTimeoutRef.current = null;
    }
  }, []);

  const enterApp = React.useCallback(() => {
    if (introTransitionStartedRef.current) return;

    introTransitionStartedRef.current = true;
    clearIntroAutoTimer();
    clearIntroBootTimer();
    setBootStage("booting");
    introBootTimeoutRef.current = window.setTimeout(() => {
      setBootStage(activeWalletAddress ? "active" : "connect");
      introBootTimeoutRef.current = null;
    }, 920);
  }, [activeWalletAddress, clearIntroAutoTimer, clearIntroBootTimer]);

  React.useEffect(() => {
    if (bootStage !== "intro") {
      clearIntroAutoTimer();
      return;
    }

    introTransitionStartedRef.current = false;
    clearIntroAutoTimer();
    introAutoEnterTimeoutRef.current = window.setTimeout(() => {
      if (!introTransitionStartedRef.current) {
        enterApp();
      }
      introAutoEnterTimeoutRef.current = null;
    }, 2450);

    return () => {
      clearIntroAutoTimer();
    };
  }, [bootStage, clearIntroAutoTimer, enterApp]);

  React.useEffect(
    () => () => {
      clearIntroAutoTimer();
      clearIntroBootTimer();
    },
    [clearIntroAutoTimer, clearIntroBootTimer],
  );

  React.useEffect(() => {
    if (bootStage === "connect" && activeWalletAddress && !forceConnectChoice) {
      setBootStage("active");
    }
  }, [activeWalletAddress, bootStage, forceConnectChoice]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (bootStage !== "active") return;
    if (initialWalletAddress) return;

    const url = new URL(window.location.href);
    let changed = false;

    if (url.searchParams.has("connect")) {
      url.searchParams.delete("connect");
      changed = true;
    }
    if (url.pathname === "/" && url.searchParams.get("resume") !== "1") {
      url.searchParams.set("resume", "1");
      changed = true;
    }

    if (changed) {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [bootStage, initialWalletAddress]);

  React.useEffect(() => {
    if (initialWalletAddress) return;
    if (!isConnected || !address) return;
    setWalletReconnectEnabled(true);
  }, [address, initialWalletAddress, isConnected]);

  const goToIntroScreen = React.useCallback(() => {
    setWalletReconnectEnabled(false);
    setScan(null);
    setError(null);
    setPhase("idle");
    lastAutoScannedWallet.current = null;
    if (initialWalletAddress) {
      router.push("/?connect=1");
      return;
    }
    setForceConnectChoice(true);
    setBootStage("connect");
    router.push("/?connect=1");
  }, [initialWalletAddress, router, setError, setPhase, setScan]);

  const openConnectChoice = React.useCallback(() => {
    setScan(null);
    setError(null);
    setPhase("idle");
    lastAutoScannedWallet.current = null;
    if (initialWalletAddress) {
      window.location.assign("/?connect=1");
      return;
    }
    if (isConnected || address) {
      setForceConnectChoice(false);
      setBootStage("active");
      return;
    }
    setForceConnectChoice(true);
    setBootStage("connect");
  }, [address, initialWalletAddress, isConnected, setError, setPhase, setScan]);

  const disconnectWallet = React.useCallback(() => {
    setScan(null);
    setError(null);
    setPhase("idle");
    lastAutoScannedWallet.current = null;
    setWalletReconnectEnabled(false);
    if (initialWalletAddress) {
      window.location.assign("/");
      return;
    }
    setForceConnectChoice(true);
    if (address) {
      disconnect();
    }
    setBootStage("connect");
  }, [address, disconnect, initialWalletAddress, setError, setPhase, setScan]);

  const loadingVisible =
    bootStage === "active" &&
    Boolean(activeWalletAddress) &&
    !error &&
    !visibleScan &&
    (phase === "scanning" || mutation.isPending || refreshMutation.isPending);

  const connectInjectedWallet = () => {
    if (isConnected || address) {
      setForceConnectChoice(false);
      setBootStage("active");
      return;
    }
    setScan(null);
    setError(null);
    setPhase("idle");
    lastAutoScannedWallet.current = null;
    setForceConnectChoice(false);
    const connector = connectors[0];
    if (!connector) {
      setError("No browser wallet connector is available.");
      return;
    }
    connect({ connector });
  };

  const openGuestAddress = () => {
    if (!isValidWalletAddress(addressDraft.trim())) {
      setError("Enter a valid 0x wallet address.");
      return;
    }
    setWalletReconnectEnabled(false);
    setScan(null);
    setError(null);
    setPhase("idle");
    lastAutoScannedWallet.current = null;
    window.location.assign(`/${addressDraft.trim()}`);
  };

  const totalValue = visibleScan?.portfolioOverview.totalUsd ?? 0;
  const recommendations = visibleScan?.recommendations ?? [];
  const sortedRecommendations = React.useMemo(
    () => [...recommendations].sort((left, right) => right.suggestedUsd - left.suggestedUsd),
    [recommendations],
  );
  const tokenExposures = visibleScan?.portfolioOverview.tokenExposures ?? [];
  const protocolExposures = visibleScan?.portfolioOverview.protocolExposures ?? [];
  const analyzedUsd = visibleScan?.portfolioOverview.analyzedUsd ?? 0;

  React.useEffect(() => {
    const element = recommendationsScrollerRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      setCanScrollRecommendationsPrev(element.scrollLeft > 8);
      setCanScrollRecommendationsNext(maxScrollLeft - element.scrollLeft > 8);
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [recommendations.length, visibleScan]);

  return (
    <>
      <IntroOverlay stage={bootStage} onEnter={enterApp} />
      <ConnectOverlay
        open={bootStage === "connect" && !initialWalletAddress && (!address || forceConnectChoice)}
        onConnect={connectInjectedWallet}
        isConnecting={isConnecting}
        addressDraft={addressDraft}
        setAddressDraft={setAddressDraft}
        onUseAddress={openGuestAddress}
      />
      <LoadingOverlay open={loadingVisible} />
      <main className="min-h-screen bg-fog text-ink">
        <section className="grid-shell">
          <div className="mx-auto max-w-[1880px] px-6 py-6 lg:px-10 2xl:px-14">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={goToIntroScreen}
                className="group relative z-10 inline-flex cursor-pointer items-center gap-3 bg-transparent text-lime transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={yoBrandMarkUrl} alt="YO" className="h-20 w-auto" />
                <span className="rounded-full border border-lime px-5 py-3 text-2xl font-semibold uppercase tracking-[0.18em] text-lime transition group-hover:border-lime/80 group-hover:text-lime/80">
                  Why YO?
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-white/8 px-5 py-3 text-sm font-semibold text-white/78">
                  {isConnectedWalletView ? (
                    <span className="inline-flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-lime shadow-[0_0_12px_rgba(215,255,31,0.45)]" />
                      <span>{shortenAddress(activeWalletAddress)}</span>
                    </span>
                  ) : (
                    <span>
                      {initialWalletAddress ? "Guest address" : "Wallet"}:{" "}
                      {activeWalletAddress ? shortenAddress(activeWalletAddress) : "Not set"}
                    </span>
                  )}
                </div>
                {address && !initialWalletAddress ? (
                  <Button
                    variant="secondary"
                    onClick={disconnectWallet}
                  >
                    Disconnect
                  </Button>
                ) : !initialWalletAddress ? (
                  <Button variant="secondary" onClick={() => setBootStage("connect")}>
                    Connect wallet
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(420px,0.82fr)]">
              <div className="rounded-[42px] bg-lime px-8 py-7 text-black shadow-panel lg:px-9 lg:py-8">
                <div className="flex min-h-full flex-col">
                  <div className="flex flex-1 items-center justify-center text-center">
                    <h1 className="yo-display max-w-5xl text-[4.3rem] leading-[0.9] md:text-[6rem]">
                      YO GOT YO RISK OPTIMIZED, PERIOD.
                    </h1>
                  </div>
                  <div className="mt-6">
                    <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
                      <Button
                        type="button"
                        variant="secondary"
                        className="border border-black/10 bg-black text-white hover:bg-black/85 xl:whitespace-nowrap"
                        onClick={openMethodologyPage}
                      >
                        Methodology
                      </Button>
                      <a
                        href="https://exponential.fi/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-black/12 bg-white/55 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-black/72 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:bg-white/68 xl:whitespace-nowrap"
                      >
                        Powered by Exponential
                      </a>
                      <a
                        href="https://debank.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-black/12 bg-white/55 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-black/72 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:bg-white/68 xl:whitespace-nowrap"
                      >
                        Portfolio via DeBank
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="space-y-3">
                  <p className="max-w-xl text-[1.15rem] leading-8 text-white/72">
                    WhyYO tool scans your wallet, scores risk and diversification bucket by bucket, and shows where{" "}
                    <a
                      href="https://yo.xyz"
                      target="_blank"
                      rel="noreferrer"
                      className="align-baseline text-lime underline decoration-lime/45 underline-offset-4 [font:inherit] [line-height:inherit] [letter-spacing:inherit]"
                    >
                      YO vaults
                    </a>{" "}
                    can improve the setup based on the personal portfolio metrics.
                  </p>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="flex h-full flex-col gap-3">
                    <div className="min-h-[1.9rem] text-xs uppercase leading-[1.45] tracking-[0.22em] text-white/42">
                      Analyzed value
                    </div>
                    <div className="min-h-[5.6rem] font-display text-[clamp(3.4rem,4.7vw,4.9rem)] leading-[0.92] text-lime">
                      {formatAnalyzedValue(analyzedUsd)}
                    </div>
                    <p className="mt-1 text-base leading-7 text-white/62">
                      The share of your portfolio the engine could confidently analyze and use for recommendations.
                    </p>
                  </Card>

                  <Card className="flex h-full flex-col gap-3">
                    <div className="min-h-[1.9rem] text-xs uppercase leading-[1.45] tracking-[0.22em] text-white/42">
                      Recommendations
                    </div>
                    <div className="flex min-h-[5.6rem] items-start justify-center font-display text-[clamp(3.4rem,4.7vw,4.9rem)] leading-[0.92] text-lime">
                      {recommendations.length}
                    </div>
                    <p className="mt-1 text-base leading-7 text-white/62">
                      Explore personalized recommendations based on your onchain data and an industry-leading risk
                      framework.
                    </p>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "mx-auto max-w-[1880px] space-y-10 px-6 py-10 lg:px-10 2xl:px-14",
            loadingVisible && "pointer-events-none opacity-0",
          )}
        >
          {phase === "scanning" ? (
            <Card className="space-y-5">
              <SectionTitle
                eyebrow="Live pipeline"
                title="SCANNING WALLET"
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {scanningSteps.map((step, index) => (
                  <div key={step} className="rounded-[22px] border border-white/8 bg-black/50 px-4 py-4 text-base text-white/72">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-lime text-sm font-bold text-black">
                      {index + 1}
                    </div>
                    <div>{step}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {error ? <Card className="border-lime/30 text-lg text-white">{error}</Card> : null}

          {visibleScan ? (
            <>
              <section className="space-y-5">
                <SectionTitle title="BUCKET OVERVIEW" />
                <div className="grid items-start gap-4 xl:grid-cols-4">
                  {visibleScan.bucketOverview.map((bucket) => (
                    <BucketOverviewCard
                      key={bucket.bucket}
                      bucket={bucket}
                      tokens={getBucketTokens(tokenExposures, bucket.bucket)}
                      protocols={getBucketProtocols(protocolExposures, bucket.bucket)}
                      hasRecommendation={recommendations.some((recommendation) => recommendation.bucket === bucket.bucket)}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="yo-display text-[2.5rem] leading-none text-white md:text-[3.5rem]">
                    WHY YO? LET THE NUMBERS SPEAK.
                  </h2>
                </div>
                <div className="relative">
                  {recommendations.length > 1 ? (
                    <>
                      <Button
                        className={cn(
                          "absolute left-3 top-[60.5%] z-20 h-10 w-10 -translate-y-1/2 border-lime/18 bg-lime/20 px-0 text-base text-lime shadow-[0_0_20px_rgba(215,255,31,0.12)] backdrop-blur-sm hover:bg-lime/28",
                          !canScrollRecommendationsPrev && "border-white/8 bg-white/8 text-white/20 shadow-none hover:bg-white/8",
                        )}
                        disabled={!canScrollRecommendationsPrev}
                        onClick={() =>
                          recommendationsScrollerRef.current?.scrollBy({
                            left: -Math.max(recommendationsScrollerRef.current.clientWidth * 0.9, 320),
                            behavior: "smooth",
                          })
                        }
                      >
                        ←
                      </Button>
                      <Button
                        className={cn(
                          "absolute right-3 top-[60.5%] z-20 h-10 w-10 -translate-y-1/2 border-lime/18 bg-lime/20 px-0 text-base text-lime shadow-[0_0_20px_rgba(215,255,31,0.12)] backdrop-blur-sm hover:bg-lime/28",
                          !canScrollRecommendationsNext && "border-white/8 bg-white/8 text-white/20 shadow-none hover:bg-white/8",
                        )}
                        disabled={!canScrollRecommendationsNext}
                        onClick={() =>
                          recommendationsScrollerRef.current?.scrollBy({
                            left: Math.max(recommendationsScrollerRef.current.clientWidth * 0.9, 320),
                            behavior: "smooth",
                          })
                        }
                      >
                        →
                      </Button>
                    </>
                  ) : null}
                  <SectionErrorBoundary title="Recommendations">
                    <div ref={recommendationsScrollerRef} className="scrollbar-thin flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3">
                      {sortedRecommendations.map((recommendation) => (
                        <RecommendationCard
                          key={`${recommendation.bucket}:${recommendation.vaultAddress}`}
                          recommendation={recommendation}
                          walletAddress={address ?? ""}
                          onConnectRequest={openConnectChoice}
                          tokenExposures={tokenExposures}
                          protocolExposures={protocolExposures}
                        />
                      ))}
                    </div>
                  </SectionErrorBoundary>
                </div>
              </section>
            </>
          ) : (
            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="space-y-5">
                <SectionTitle title="FEATURED YO VAULTS" />
                <div className="grid gap-4 md:grid-cols-3">
                  {["yoUSD", "yoETH", "yoBTC"].map((vaultSymbol) => (
                    <div key={vaultSymbol} className="rounded-[28px] border border-white/10 bg-black/45 p-5">
                      <div className="flex items-center gap-4">
                        <AssetIcon
                          src={getVaultLogoUrl(vaultSymbol)}
                          alt={vaultSymbol}
                          label={vaultSymbol}
                          accent={getVaultAccent(vaultSymbol)}
                          className="h-16 w-16 border-transparent"
                        />
                        <div className="text-3xl font-semibold text-white">{vaultSymbol}</div>
                      </div>
                      <div className="mt-8 grid gap-3 text-base text-white/64">
                        <div>Intent-aware scoring</div>
                        <div>Coverage-aware confidence</div>
                        <div>Direct deposit handoff</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-5">
                <SectionTitle title="HOW IT WORKS" />
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    "Tap the WHY YO? intro cell to power on the dashboard and trigger scan mode.",
                    "Connect a wallet or use /0xaddress to load the same dashboard without wallet auth.",
                    "Read bucket cards first, then jump into WhyYOAgent recommendation cards for the next move.",
                  ].map((item, index) => (
                    <div key={item} className="rounded-[26px] border border-white/8 bg-black/45 p-5">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-xl font-bold text-lime">
                        {index + 1}
                      </div>
                      <p className="text-lg leading-8 text-white/72">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          )}
        </section>
      </main>
    </>
  );
};
