"use client";

import type { RankedRecommendation } from "@whyyo/shared";

import { cn, formatPct, formatUsd } from "../lib/utils";
import { MethodologyLink, METHODOLOGY_SECTION_IDS } from "./methodology-link";

const formatMetricValue = (value: number | null, format: "number" | "percent" | "currency"): string => {
  if (value === null) return "n/a";
  if (format === "currency") return formatUsd(value);
  if (format === "percent") return formatPct(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

const metricScaleMax = (metric: RankedRecommendation["visualization"]["beforeAfterBars"][number]) => {
  switch (metric.key) {
    case "weighted_risk":
      return 4;
    case "high_risk_exposure":
    case "savings_score":
    case "diversification_score":
      return 100;
    default:
      return metric.format === "percent" ? 100 : Math.max(Math.abs(metric.before ?? 0), Math.abs(metric.after ?? 0), 1);
  }
};

const widthForValue = (value: number | null, maxValue: number): string => {
  if (value === null || maxValue <= 0) return "0%";
  return `${Math.max(6, Math.min(100, (Math.abs(value) / maxValue) * 100))}%`;
};

const isImproved = (metric: RankedRecommendation["visualization"]["beforeAfterBars"][number]) => {
  if (metric.before === null || metric.after === null) return null;
  return metric.betterDirection === "lower" ? metric.after < metric.before : metric.after > metric.before;
};

export const BeforeAfterBars = ({
  metrics,
}: {
  metrics: RankedRecommendation["visualization"]["beforeAfterBars"];
}) => {
  const metricOrder: Record<RankedRecommendation["visualization"]["beforeAfterBars"][number]["key"], number> = {
    weighted_risk: 0,
    diversification_score: 1,
    high_risk_exposure: 2,
    savings_score: 3,
  };
  const orderedMetrics = [...metrics].sort(
    (left, right) => (metricOrder[left.key] ?? Number.MAX_SAFE_INTEGER) - (metricOrder[right.key] ?? Number.MAX_SAFE_INTEGER),
  );
  const sectionIdByMetricKey: Partial<Record<RankedRecommendation["visualization"]["beforeAfterBars"][number]["key"], string>> = {
    weighted_risk: METHODOLOGY_SECTION_IDS.weightedRisk,
    high_risk_exposure: METHODOLOGY_SECTION_IDS.highRiskExposure,
    savings_score: METHODOLOGY_SECTION_IDS.savingsScore,
    diversification_score: METHODOLOGY_SECTION_IDS.diversification,
  };

  return (
    <div className="space-y-5">
      {orderedMetrics.map((metric) => {
        const improved = isImproved(metric);

        return (
          <div key={metric.key} className="space-y-3">
            <div className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 font-medium text-white/82">
                {sectionIdByMetricKey[metric.key] ? (
                  <MethodologyLink sectionId={sectionIdByMetricKey[metric.key] ?? ""}>{metric.label}</MethodologyLink>
                ) : (
                  <span>{metric.label}</span>
                )}
              </span>
              <span
                className={cn(
                  "font-semibold",
                  improved === null && "text-white/78",
                  improved === true && "text-lime",
                  improved === false && "text-[#ff6b6b]",
                )}
              >
                {formatMetricValue(metric.before, metric.format)} {"->"} {formatMetricValue(metric.after, metric.format)}
              </span>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs uppercase tracking-[0.18em] text-white/48">Now</span>
                <div className="h-3 flex-1 rounded-full bg-white/8">
                  <div
                    className="h-3 rounded-full bg-white/55"
                    style={{ width: widthForValue(metric.before, metricScaleMax(metric)) }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-16 text-xs uppercase tracking-[0.18em]",
                    improved === false ? "text-[#ff6b6b]" : "text-lime",
                  )}
                >
                  YO
                </span>
                <div className={cn("h-3 flex-1 rounded-full", improved === false ? "bg-[#351717]" : "bg-[#243113]")}>
                  <div
                    className={cn(
                      "h-3 rounded-full shadow-[0_0_18px_rgba(215,255,31,0.32)]",
                      improved === false ? "bg-[#ff6b6b] shadow-none" : "bg-lime",
                    )}
                    style={{ width: widthForValue(metric.after, metricScaleMax(metric)) }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const StackedBar = ({
  segments,
}: {
  segments: Array<{ key: string; label: string; valuePct: number; tone?: "good" | "warn" | "neutral" }>;
}) => (
  <div className="space-y-2">
    <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={cn(
            segment.key === "productive" && "bg-mint",
            segment.key === "idle" && !segment.tone && "bg-lime",
            segment.tone === "good" && "bg-lime",
            segment.tone === "warn" && "bg-[#ff6b6b]",
            (!segment.tone || segment.tone === "neutral") &&
              segment.key !== "productive" &&
              segment.key !== "idle" &&
              "bg-white/45",
          )}
          style={{ width: `${Math.max(0, segment.valuePct)}%` }}
        />
      ))}
    </div>
    <div className="flex flex-wrap gap-4 text-sm text-white/70">
      {segments.map((segment) => (
        <span key={segment.key}>
          {segment.label} {formatPct(segment.valuePct)}
        </span>
      ))}
    </div>
  </div>
);

export const SimplificationVisual = ({
  beforePositions,
  afterPositions,
}: {
  beforePositions: number;
  afterPositions: number;
}) => {
  const beforeDotCount = Math.min(beforePositions, 10);
  const afterDotCount = Math.min(afterPositions, 10);
  const dotClassName =
    Math.max(beforeDotCount, afterDotCount) >= 9 ? "h-2 w-2 rounded-full" : "h-2.5 w-2.5 rounded-full";

  return (
    <div className="rounded-2xl border border-white/8 bg-[#121212] p-4">
      <div className="flex items-center justify-between gap-4 text-base">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Structure</div>
          <div className="mt-1 font-medium text-white/82">
            {beforePositions} positions {"->"} {afterPositions} target positions
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {Array.from({ length: beforeDotCount }).map((_, index) => (
            <span key={`before-${index}`} className={cn(dotClassName, "bg-white/25")} />
          ))}
          <span className="mx-2 text-white/30">{"->"}</span>
          {Array.from({ length: afterDotCount }).map((_, index) => (
            <span key={`after-${index}`} className={cn(dotClassName, "bg-lime")} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const CompositionCompare = ({
  current,
  target,
  title,
}: {
  current: Array<{ key: string; label: string; weightPct: number }>;
  target: Array<{ key: string; label: string; weightPct: number }>;
  title: string;
}) => (
  <div className="flex h-full flex-col space-y-3">
    <div className="text-xs uppercase tracking-[0.18em] text-white/46">{title}</div>
    <div className="grid flex-1 gap-3 md:grid-cols-2">
      <div className="flex h-full flex-col space-y-2">
        <div className="text-sm font-medium text-white/82">Current</div>
        <div className="min-h-[228px] max-h-[228px] space-y-2 overflow-y-auto pr-3 [scrollbar-color:rgba(215,255,31,0.45)_transparent] [scrollbar-width:auto] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lime/45 [&::-webkit-scrollbar-track]:bg-transparent">
          {current.length > 0 ? (
            current.map((entry) => (
              <div key={entry.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatPct(entry.weightPct)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10">
                  <div className="h-2.5 rounded-full bg-white/60" style={{ width: `${entry.weightPct}%` }} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-white/45">No productive composition</div>
          )}
        </div>
      </div>
      <div className="flex h-full flex-col space-y-2">
        <div className="text-sm font-medium text-white/82">YO</div>
        <div className="min-h-[228px] max-h-[228px] space-y-2 overflow-y-auto pr-3 [scrollbar-color:rgba(215,255,31,0.45)_transparent] [scrollbar-width:auto] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lime/45 [&::-webkit-scrollbar-track]:bg-transparent">
          {target.map((entry) => (
            <div key={entry.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-white/68">
                <span>{title === "Strategy mix" && entry.label.toLowerCase() === "unknown" ? "defi" : entry.label}</span>
                <span>{formatPct(entry.weightPct)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#243113]">
                <div className="h-2.5 rounded-full bg-lime" style={{ width: `${entry.weightPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
