"use client";

import * as React from "react";

import type { RecommendationConfidenceLabel } from "../lib/recommendation-confidence";
import { cn } from "../lib/utils";
import { MethodologyLink, METHODOLOGY_SECTION_IDS } from "./methodology-link";

export const ConfidenceBadge = ({
  label,
  className,
}: {
  label: RecommendationConfidenceLabel;
  className: string;
}) => (
  <>
    <style jsx>{`
      @keyframes confidenceBadgeGlow {
        0%,
        100% {
          opacity: 0.92;
          transform: scale(1);
          box-shadow: 0 0 0 rgba(215, 255, 31, 0);
        }
        50% {
          opacity: 1;
          transform: scale(1.015);
          box-shadow: 0 0 18px rgba(215, 255, 31, 0.12);
        }
      }
    `}</style>
    <span
      className={cn(
        "inline-flex min-w-[108px] items-center justify-center rounded-full border px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.16em]",
        className,
      )}
      style={{ animation: "confidenceBadgeGlow 2.4s ease-in-out infinite" }}
    >
      <MethodologyLink className="no-underline" sectionId={METHODOLOGY_SECTION_IDS.confidence}>
        {label}
      </MethodologyLink>
    </span>
  </>
);
