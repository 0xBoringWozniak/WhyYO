"use client";

import type React from "react";
import { useRouter } from "next/navigation";

import { cn } from "../lib/utils";

const METHODOLOGY_PATH = "/methodology";
const SCROLL_QUERY_KEY = "scrollY";

export const METHODOLOGY_SECTION_IDS = {
  riskCoverage: "risk-coverage",
  diversification: "diversification",
  weightedRisk: "weighted-risk",
  highRiskExposure: "high-risk-exposure",
  savingsScore: "savings-score",
  trustIndex: "trust-index",
  coverage: "coverage",
  yoShare: "yo-share",
  vaultHighRisk: "vault-high-risk",
  overlap: "overlap",
  recommendationState: "recommendation-state",
  vaultApy: "vault-apy",
  estimatedAnnualYield: "estimated-annual-yield",
  suggestedAmount: "suggested-amount",
  idleCapital: "idle-capital",
} as const;

const withScrollQuery = (path: string, scrollY: number) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${SCROLL_QUERY_KEY}=${encodeURIComponent(String(scrollY))}`;
};

export const buildMethodologyMetricHref = (sectionId: string) =>
  `${METHODOLOGY_PATH}#${sectionId}`;

export const restoreDashboardScrollFromUrl = () => {
  const url = new URL(window.location.href);
  const scrollYRaw = url.searchParams.get(SCROLL_QUERY_KEY);
  if (!scrollYRaw) return;

  const scrollY = Number(scrollYRaw);
  url.searchParams.delete(SCROLL_QUERY_KEY);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

  if (Number.isFinite(scrollY)) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    });
  }
};

export const MethodologyLink = ({
  sectionId,
  children,
  className,
}: {
  sectionId: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const router = useRouter();

  return (
    <button
      type="button"
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const scrollAwareReturnTo = withScrollQuery(currentPath, window.scrollY);
      const url = new URL(buildMethodologyMetricHref(sectionId), window.location.origin);
      url.searchParams.set("returnTo", scrollAwareReturnTo);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }}
    className={cn(
      "inline p-0 m-0 border-0 bg-transparent text-current cursor-pointer underline decoration-current/45 underline-offset-4 transition hover:decoration-current",
      className,
    )}
  >
    {children}
    </button>
  );
};
