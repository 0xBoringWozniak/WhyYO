"use client";

import * as React from "react";

import type { RankedRecommendation } from "@whyyo/shared";

import { getVaultAccent, getVaultLogoUrl } from "../lib/brand-assets";
import { useYoAllowance, useYoApprove, useYoDeposit } from "../lib/yo-sdk";
import { cn, formatPct, formatUsd } from "../lib/utils";
import { AssetIcon } from "./asset-icon";
import { MethodologyLink, METHODOLOGY_SECTION_IDS } from "./methodology-link";
import { renderLinkedMetricText } from "./recommendation-explanation";
import { Button, Card } from "./ui";

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

// Official YO gateway address from the SDK constants.
const YO_GATEWAY_ADDRESS = "0xF1EeE0957267b1A474323Ff9CfF7719E964969FA";

const formatAmount = (value: number | null, digits = 5) =>
  value === null ? "n/a" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

const clampAmount = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const isEvmAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const formatDelta = (before: number | null | undefined, after: number | null | undefined, digits = 2) =>
  before == null || after == null ? null : `${before.toFixed(digits)} → ${after.toFixed(digits)}`;

const getExecutionStateLabel = (recommendation: RankedRecommendation) => {
  if (recommendation.actionability === "suppressed" || recommendation.score < 0.25) return "Low";
  if (recommendation.strength === "strong" || recommendation.score >= 0.6) return "Major";
  return "Minor";
};

const MetricHighlight = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-lime">{children}</span>;
const MetricHighlightLink = ({
  sectionId,
  children,
}: {
  sectionId: string;
  children: React.ReactNode;
}) => (
  <MethodologyLink sectionId={sectionId} className="font-semibold text-lime decoration-lime/45 hover:decoration-lime">
    {children}
  </MethodologyLink>
);

const toTokenUnits = (value: string, decimals: number): bigint | null => {
  const normalized = value.trim();
  if (!normalized) return 0n;
  if (!/^\d*\.?\d*$/.test(normalized)) return null;

  const [whole = "0", fraction = ""] = normalized.split(".");
  const safeWhole = whole === "" ? "0" : whole;
  const safeFraction = fraction.slice(0, decimals).padEnd(decimals, "0");

  try {
    return BigInt(`${safeWhole}${safeFraction}`.replace(/^0+(?=\d)/, "") || "0");
  } catch {
    return null;
  }
};

const IdleExecutionActions = ({
  recommendation,
  walletAddress,
  idleSourcePlan,
  amount,
  txSymbol,
  setStatus,
}: {
  recommendation: RankedRecommendation;
  walletAddress: string;
  idleSourcePlan: IdleSourcePlan;
  amount: string;
  txSymbol: string;
  setStatus: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
  const deposit = useYoDeposit({
    vault: recommendation.vaultSymbol,
  }) as {
    deposit?: (args: { token: string; amount: bigint; chainId?: number }) => Promise<unknown>;
    step?: "idle" | "switching-chain" | "approving" | "depositing" | "waiting" | "success" | "error";
    isLoading?: boolean;
    hash?: `0x${string}`;
    approveHash?: `0x${string}`;
    isSuccess?: boolean;
    error?: Error | null;
  };
  const approve = useYoApprove({
    token: idleSourcePlan.tokenAddress,
    spender: YO_GATEWAY_ADDRESS,
  }) as {
    approve?: (amount: bigint) => Promise<unknown>;
    isLoading?: boolean;
    isPending?: boolean;
    hash?: `0x${string}`;
    isSuccess?: boolean;
    error?: Error | null;
    reset?: () => void;
  };
  const allowance = useYoAllowance(
    idleSourcePlan.tokenAddress,
    YO_GATEWAY_ADDRESS,
    walletAddress || undefined,
    {
      enabled: Boolean(walletAddress) && Boolean(idleSourcePlan.tokenAddress),
    },
  ) as {
    allowance?: bigint;
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
    refetch?: () => Promise<unknown>;
  };
  const parsedAmount = React.useMemo(() => toTokenUnits(amount, idleSourcePlan.decimals), [amount, idleSourcePlan.decimals]);
  const canTransact = Boolean(walletAddress) && parsedAmount !== null && parsedAmount > 0n && Boolean(idleSourcePlan.tokenAddress);
  const currentAllowance = allowance.allowance ?? 0n;
  const needsApproval = parsedAmount !== null && parsedAmount > 0n ? currentAllowance < parsedAmount : true;

  const handleDeposit = async () => {
    if (!walletAddress) {
      setStatus("Connect a wallet to execute the idle-asset deposit route.");
      return;
    }
    if (parsedAmount === null) {
      setStatus("Enter a valid amount.");
      return;
    }

    try {
      if (needsApproval) {
        if (!approve.approve) {
          setStatus("YO approve hook is unavailable in the current SDK build.");
          return;
        }
        setStatus(`Preparing ${txSymbol} approval...`);
        await approve.approve(parsedAmount);
        return;
      }

      if (!deposit.deposit) {
        setStatus("YO deposit hook is unavailable in the current SDK build.");
        return;
      }

      setStatus(`Preparing ${txSymbol} deposit route...`);
      const depositArgs: { token: string; amount: bigint; chainId?: number } = {
        token: idleSourcePlan.tokenAddress,
        amount: parsedAmount,
      };
      if (idleSourcePlan.chainId !== null) {
        depositArgs.chainId = idleSourcePlan.chainId;
      }
      await deposit.deposit(depositArgs);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Deposit failed");
    }
  };

  React.useEffect(() => {
    if (approve.isLoading) {
      setStatus(approve.hash ? `Approval submitted for ${txSymbol}. Waiting for confirmation...` : `Confirm approval for ${txSymbol} in your wallet...`);
      return;
    }
    if (approve.isSuccess) {
      setStatus(`Approval confirmed for ${txSymbol}. Click Deposit to continue.`);
      void allowance.refetch?.();
      return;
    }
    if (approve.error) {
      setStatus(approve.error.message);
      return;
    }
    if (deposit.step === "switching-chain") {
      setStatus("Switch chain in your wallet...");
      return;
    }
    if (deposit.step === "depositing") {
      setStatus(deposit.hash ? `Deposit submitted for ${txSymbol}. Waiting for confirmation...` : `Confirm deposit for ${txSymbol} in your wallet...`);
      return;
    }
    if (deposit.step === "waiting") {
      setStatus(`Deposit pending onchain for ${txSymbol}...`);
      return;
    }
    if (deposit.step === "success") {
      setStatus(`Deposited ${formatAmount(Number(amount || "0"))} ${txSymbol} into ${recommendation.vaultSymbol}`);
      return;
    }
    if (deposit.step === "error" && deposit.error) {
      setStatus(deposit.error.message);
    }
  }, [
    allowance,
    approve.error,
    approve.hash,
    approve.isLoading,
    approve.isSuccess,
    deposit.error,
    deposit.hash,
    deposit.step,
    recommendation.vaultSymbol,
    setStatus,
    txSymbol,
  ]);

  const isBusy = Boolean(approve.isLoading || deposit.isLoading);
  const ctaLabel =
    approve.isLoading
      ? approve.hash
        ? "Approving..."
        : "Confirm approve..."
      : deposit.step === "switching-chain"
      ? "Switch chain..."
      : deposit.step === "depositing"
          ? deposit.hash
            ? "Depositing..."
            : "Confirm deposit..."
          : deposit.step === "waiting"
            ? "Waiting onchain..."
            : deposit.step === "success"
              ? "Deposit confirmed"
              : needsApproval
                ? "Approve"
                : "Deposit";

  return (
    <Button onClick={handleDeposit} disabled={!canTransact || isBusy}>
      <span className="inline-flex items-center gap-2">
        {isBusy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
        ) : null}
        {ctaLabel}
      </span>
    </Button>
  );
};

export const DepositDrawer = ({
  recommendation,
  walletAddress,
  onConnectRequest,
  primaryButtonLabel,
  emphasize = false,
  idleSourcePlan,
  withdrawalPlan = [],
}: {
  recommendation: RankedRecommendation;
  walletAddress: string;
  onConnectRequest?: () => void;
  primaryButtonLabel?: string;
  emphasize?: boolean;
  idleSourcePlan?: IdleSourcePlan | null;
  withdrawalPlan?: WithdrawalPlanItem[];
}) => {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const accent = getVaultAccent(recommendation.vaultSymbol);
  const hasIdleSourcePlan = Boolean(idleSourcePlan);
  const isIdleExecution = hasIdleSourcePlan;
  const hasDirectIdleRoute = Boolean(
    idleSourcePlan && idleSourcePlan.chainId !== null && isEvmAddress(idleSourcePlan.tokenAddress),
  );
  const sourceAmountMax = idleSourcePlan?.availableAmount ?? 0;
  const defaultAmount = idleSourcePlan?.recommendedAmount ?? 0;
  const [amount, setAmount] = React.useState(defaultAmount > 0 ? defaultAmount.toFixed(6) : "");

  React.useEffect(() => {
    const nextAmount = idleSourcePlan?.recommendedAmount ?? 0;
    setAmount(nextAmount > 0 ? nextAmount.toFixed(6) : "");
  }, [idleSourcePlan?.recommendedAmount]);

  const approvedAmount = clampAmount(Number(amount || "0"), 0, sourceAmountMax || Number(amount || "0"));
  const txSymbol = idleSourcePlan?.symbol ?? recommendation.bucket;
  const hhiDelta = formatDelta(recommendation.metrics.protocolHHIBefore, recommendation.metrics.protocolHHIAfter, 3);
  const wrsDelta = formatDelta(recommendation.metrics.weightedRiskBefore, recommendation.metrics.weightedRiskAfter, 2);
  const savingsDelta = formatDelta(recommendation.metrics.savingsScoreBefore, recommendation.metrics.savingsScoreAfter, 1);
  const executionStateLabel = getExecutionStateLabel(recommendation);
  const explanationBullets = recommendation.llmExplanation?.bullets?.slice(0, 3) ?? [];
  const hasLlmExplanation = Boolean(recommendation.llmExplanation?.summary || explanationBullets.length);
  const hhiReductionPct =
    recommendation.metrics.protocolHHIBefore != null &&
    recommendation.metrics.protocolHHIAfter != null &&
    recommendation.metrics.protocolHHIBefore > 0
      ? ((recommendation.metrics.protocolHHIBefore - recommendation.metrics.protocolHHIAfter) / recommendation.metrics.protocolHHIBefore) * 100
      : null;

  const buttonLabel = primaryButtonLabel ?? "Preview deposit";

  return (
    <>
      <Button
        className={cn(
          "min-w-[220px]",
          emphasize && "px-8 py-4 text-base shadow-[0_0_32px_rgba(215,255,31,0.24)]",
        )}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/80 p-4 md:items-center">
          <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-[1180px] space-y-4 overflow-y-auto overscroll-contain border-white/10 bg-[#111111] p-4 md:p-5">
            <button
              type="button"
              className="absolute left-3 top-3 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/45 text-2xl text-white/72 transition hover:border-lime/40 hover:text-lime md:left-4 md:top-4"
              onClick={() => setOpen(false)}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="flex items-start justify-between gap-4 pl-16 md:pl-20">
              <div className="flex items-center gap-4">
                <AssetIcon
                  src={getVaultLogoUrl(recommendation.vaultSymbol)}
                  alt={recommendation.vaultSymbol}
                  label={recommendation.vaultSymbol}
                  accent={accent}
                  className="h-16 w-16 border-transparent"
                />
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    {isIdleExecution ? "Idle deposit route" : "Portfolio move plan"}
                  </div>
                  <h3 className="mt-2 text-3xl font-semibold text-white">{recommendation.vaultSymbol}</h3>
                  <div className="mt-2 text-base text-white/58">
                    {recommendation.bucket} bucket ·{" "}
                    <span className="text-[#ffd84d]">{recommendation.primaryIntent.replaceAll("_", " ")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3 rounded-[26px] border border-white/8 bg-[#171717] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/42">{isIdleExecution ? "Execution path" : "Recommended move path"}</div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-black/35 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/38">Suggested amount</div>
                    <div className="mt-3 font-display text-5xl leading-none text-lime">
                      {formatUsd(isIdleExecution ? idleSourcePlan?.recommendedUsd ?? recommendation.suggestedUsd : recommendation.suggestedUsd)}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/35 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/38">
                      <MethodologyLink sectionId={METHODOLOGY_SECTION_IDS.recommendationState}>Recommendation state</MethodologyLink>
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-3xl font-semibold",
                        executionStateLabel === "Major"
                          ? "text-lime"
                          : executionStateLabel === "Minor"
                            ? "text-[#ffd84d]"
                            : "text-[#ff6b6b]",
                      )}
                    >
                      {executionStateLabel}
                    </div>
                  </div>
                </div>

                {idleSourcePlan ? (
                  <div className="space-y-4 rounded-[24px] border border-lime/25 bg-lime/5 p-4">
                    <div className="flex items-center gap-3">
                      <AssetIcon
                        src={idleSourcePlan.logoUrl}
                        alt={idleSourcePlan.symbol}
                        label={idleSourcePlan.symbol}
                        className="h-12 w-12"
                      />
                      <div>
                        <div className="text-lg font-semibold text-white">{idleSourcePlan.symbol}</div>
                        <div className="text-sm text-white/48">{idleSourcePlan.chain}</div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="text-base text-white/74">
                        Balance: {formatUsd(idleSourcePlan.availableUsd)}
                        <div className="mt-1 text-sm text-white/48">
                          {formatAmount(idleSourcePlan.availableAmount)} {idleSourcePlan.symbol}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/38">Deposit amount</div>
                      <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="w-full rounded-[20px] border border-white/10 bg-[#141414] px-4 py-4 text-right text-4xl font-semibold text-white outline-none placeholder:text-white/20"
                        inputMode="decimal"
                        placeholder="0.0"
                      />
                      <div className="mt-2 flex flex-wrap gap-3">
                        {[
                          { label: "25%", value: (sourceAmountMax * 0.25).toFixed(6) },
                          { label: "50%", value: (sourceAmountMax * 0.5).toFixed(6) },
                          { label: "Suggested", value: (idleSourcePlan.recommendedAmount ?? 0).toFixed(6) },
                          { label: "MAX", value: sourceAmountMax.toFixed(6) },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/78 transition hover:border-lime/40 hover:text-lime"
                            onClick={() => setAmount(preset.value)}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-center">
                        {hasDirectIdleRoute ? (
                          <IdleExecutionActions
                            recommendation={recommendation}
                            walletAddress={walletAddress}
                            idleSourcePlan={idleSourcePlan}
                            amount={amount}
                            txSymbol={txSymbol}
                            setStatus={setStatus}
                          />
                        ) : !walletAddress ? (
                          <Button variant="secondary" onClick={onConnectRequest}>
                            Connect
                          </Button>
                        ) : (
                          <div className="group inline-flex min-w-[180px] justify-center rounded-full border border-white/10 bg-white/6 px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/72 transition hover:border-lime/40 hover:text-lime">
                            <span className="group-hover:hidden">Deposit</span>
                            <span className="hidden group-hover:inline">Soon</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {withdrawalPlan.length > 0 ? (
                <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/35 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">Withdraw from current protocols first</div>
                    {withdrawalPlan.map((item) => (
                      <div
                        key={`${item.protocolName}:${item.chain}:${item.usdValue}`}
                        className="group flex items-center justify-between rounded-[18px] border border-white/8 bg-[#151515] px-4 py-4"
                      >
                        <div>
                          <div className="text-lg font-semibold text-white">{item.protocolName}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-white/42">
                            {item.strategyLabel} · {item.chain}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-lg text-white/72">{formatUsd(item.usdValue)}</div>
                          <div className="inline-flex min-w-[86px] justify-center rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/72 transition group-hover:border-lime/40 group-hover:text-lime">
                            <span className="group-hover:hidden">Migrate</span>
                            <span className="hidden group-hover:inline">Soon</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!idleSourcePlan && withdrawalPlan.length === 0 ? (
                  <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/35 p-4">
                    <div className="text-base leading-7 text-white/62">
                      This recommendation does not expose a direct idle source or a productive withdrawal path to automate here. Use the card metrics and explanation as guidance only.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-[26px] border border-white/8 bg-[#171717] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/42">Why it may make sense</div>

                <div className="rounded-[22px] border border-white/10 bg-black/35 p-4 text-[1.02rem] leading-8 text-white/78">
                  {hasLlmExplanation ? (
                    <div className="space-y-4">
                      {recommendation.llmExplanation?.summary ? (
                        <p>{renderLinkedMetricText(recommendation.llmExplanation.summary)}</p>
                      ) : null}
                      {explanationBullets.length ? (
                        <ul className="space-y-3 text-white/74">
                          {explanationBullets.map((bullet, index) => (
                            <li key={`drawer-llm-bullet-${index}`} className="flex gap-3 leading-7">
                              <span className="text-lime">•</span>
                              <span>{renderLinkedMetricText(bullet)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : recommendation.recommendationType === "no_incremental_improvement" ? (
                    <div className="space-y-3">
                      <p>
                      A modeled <MetricHighlight>{formatUsd(recommendation.suggestedUsd)}</MetricHighlight> shift would improve concentration{" "}
                      {hhiDelta ? <MetricHighlight>(HHI {hhiDelta}{hhiReductionPct !== null ? `, ${formatPct(hhiReductionPct)} lower` : ""})</MetricHighlight> : null},
                      but <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.weightedRisk}>Weighted risk</MetricHighlightLink>{" "}
                      {wrsDelta ? <MetricHighlight>{wrsDelta}</MetricHighlight> : "n/a"} and{" "}
                      <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.savingsScore}>Savings score</MetricHighlightLink>{" "}
                      {savingsDelta ? <MetricHighlight>{savingsDelta}</MetricHighlight> : "n/a"} stay below the bar.
                      </p>
                      <p className="text-white/66">
                        The move still helps structure and diversification, but the modeled trust signal remains too soft once overlap, vault risk profile, and the score threshold are taken together.
                      </p>
                      <p className="text-white/66">
                        In plain terms, the vault can simplify the bucket and spread exposure better, but the measured risk improvement is not strong enough yet to justify a stronger push toward execution.
                      </p>
                    </div>
                  ) : isIdleExecution ? (
                    <div className="space-y-3">
                      <p>
                      About <MetricHighlight>{formatUsd(idleSourcePlan?.recommendedUsd ?? recommendation.suggestedUsd)}</MetricHighlight> is idle right now.
                      Deploying it into {recommendation.vaultSymbol} points to estimated annual yield of{" "}
                      <MetricHighlight>{formatUsd(recommendation.metrics.estimatedAnnualYieldOpportunityUsd ?? 0)}</MetricHighlight> at{" "}
                      <MetricHighlight>{formatPct(recommendation.metrics.vaultApyPct)}</MetricHighlight> vault APY.
                      </p>
                      <p className="text-white/66">
                        The case gets stronger when idle capital is meaningful, <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.overlap}>Overlap</MetricHighlightLink> is limited, and the target YO mix improves <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.diversification}>Diversification</MetricHighlightLink> without adding too much new <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.vaultHighRisk}>Vault high-risk</MetricHighlightLink>.
                      </p>
                      <p className="text-white/66">
                        That makes this closer to a capital-activation decision than a full portfolio rewrite: the user keeps the same bucket, but the idle share starts earning inside a broader YO allocation mix.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p>
                      A modeled <MetricHighlight>{formatUsd(recommendation.suggestedUsd)}</MetricHighlight> shift improves concentration{" "}
                      {hhiDelta ? <MetricHighlight>(HHI {hhiDelta})</MetricHighlight> : null}
                      {wrsDelta ? <> and <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.weightedRisk}>Weighted risk</MetricHighlightLink> <MetricHighlight>{wrsDelta}</MetricHighlight></> : null}
                      {savingsDelta ? <> while <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.savingsScore}>Savings score</MetricHighlightLink> moves to <MetricHighlight>{savingsDelta}</MetricHighlight></> : null}.
                      </p>
                      <p className="text-white/66">
                        In practice, the move makes sense when the current bucket is concentrated, the YO vault broadens protocol exposure, and the measured risk path still improves or at least stays inside the acceptable bar.
                      </p>
                      <p className="text-white/66">
                        The strongest cases are the ones where concentration drops visibly, <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.overlap}>Overlap</MetricHighlightLink> stays low, and the <MetricHighlightLink sectionId={METHODOLOGY_SECTION_IDS.savingsScore}>Savings score</MetricHighlightLink> still climbs after the reallocation rather than just looking cleaner on composition alone.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/35 p-4 text-[0.98rem] text-white/72">
                  <div className="flex items-center justify-between gap-4">
                    <span>Vault APY</span>
                    <span className="font-semibold text-lime">{formatPct(recommendation.metrics.vaultApyPct)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span>Idle capital</span>
                    <span>{formatUsd(recommendation.metrics.idleAssetUsd)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span>Est. annual yield</span>
                    <span className="font-semibold text-lime">{formatUsd(recommendation.metrics.estimatedAnnualYieldOpportunityUsd ?? 0)}</span>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/68">
                  {hasIdleSourcePlan
                    ? !hasDirectIdleRoute
                      ? `This idle source is currently detected as ${txSymbol} on ${idleSourcePlan?.chain ?? "the source chain"}, but it does not expose a direct ERC-20 route for safe automated deposit here, so the app keeps this step advisory instead of crashing or fabricating a transaction.`
                      : walletAddress
                        ? `Execution uses ${txSymbol} and caps the direct deposit amount at the idle balance visible in the bucket. Any remaining suggested amount stays manual and should be withdrawn from the listed non-YO protocols first.`
                        : "Connect a wallet to execute the idle deposit path. Guest-address mode is read-only."
                    : "This recommendation is advisory. Use it to decide what to withdraw first from the productive bucket before depositing manually into YO."}
                </div>

              </div>
            </div>

            {status ? <div className="rounded-[22px] border border-lime/30 bg-lime/8 px-4 py-3 text-sm text-white">{status}</div> : null}
            <div className="flex justify-center pb-1 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
};
