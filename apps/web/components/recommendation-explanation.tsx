"use client";

import * as React from "react";

import { MethodologyLink, METHODOLOGY_SECTION_IDS } from "./methodology-link";

const LINKABLE_METRIC_PHRASES: Array<{ phrase: string; sectionId: string }> = [
  { phrase: "High-risk exposure", sectionId: METHODOLOGY_SECTION_IDS.highRiskExposure },
  { phrase: "Weighted risk", sectionId: METHODOLOGY_SECTION_IDS.weightedRisk },
  { phrase: "Savings score", sectionId: METHODOLOGY_SECTION_IDS.savingsScore },
  { phrase: "Diversification", sectionId: METHODOLOGY_SECTION_IDS.diversification },
  { phrase: "Risk coverage", sectionId: METHODOLOGY_SECTION_IDS.riskCoverage },
  { phrase: "Trust index", sectionId: METHODOLOGY_SECTION_IDS.trustIndex },
  { phrase: "Recommendation state", sectionId: METHODOLOGY_SECTION_IDS.recommendationState },
  { phrase: "Protocol overlap", sectionId: METHODOLOGY_SECTION_IDS.overlap },
  { phrase: "Overlap", sectionId: METHODOLOGY_SECTION_IDS.overlap },
  { phrase: "Existing YO share", sectionId: METHODOLOGY_SECTION_IDS.yoShare },
  { phrase: "YO share", sectionId: METHODOLOGY_SECTION_IDS.yoShare },
  { phrase: "Vault high-risk", sectionId: METHODOLOGY_SECTION_IDS.vaultHighRisk },
  { phrase: "Coverage", sectionId: METHODOLOGY_SECTION_IDS.coverage },
].sort((left, right) => right.phrase.length - left.phrase.length);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const renderLinkedMetricText = (text: string) => {
  if (!text) return text;

  const nodes: React.ReactNode[] = [];
  const pattern = new RegExp(
    `(${LINKABLE_METRIC_PHRASES.map(({ phrase }) => escapeRegExp(phrase)).join("|")})`,
    "gi",
  );

  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const found = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(<React.Fragment key={`text-${matchIndex}`}>{text.slice(lastIndex, start)}</React.Fragment>);
    }

    const metric = LINKABLE_METRIC_PHRASES.find(({ phrase }) => phrase.toLowerCase() === found.toLowerCase());
    if (!metric) {
      nodes.push(<React.Fragment key={`match-${matchIndex}`}>{found}</React.Fragment>);
      lastIndex = start + found.length;
      matchIndex += 1;
      continue;
    }

    nodes.push(
      <MethodologyLink key={`match-${matchIndex}`} sectionId={metric.sectionId}>
        {found}
      </MethodologyLink>,
    );

    lastIndex = start + found.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key="text-tail">{text.slice(lastIndex)}</React.Fragment>);
  }

  return nodes;
};
