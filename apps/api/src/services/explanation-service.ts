import OpenAI from "openai";

import type { ExplanationInput, ExplanationOutput } from "@whyyo/shared";

import { getEnv } from "../config/env";
import { ExplanationCacheRepository } from "../repositories/explanation-cache-repository";

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "n/a" : `${value.toFixed(digits)}%`;

const formatNumber = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? "n/a" : value.toFixed(digits);

export const buildFallbackExplanation = (input: ExplanationInput): ExplanationOutput => {
  const caution = input.caveats[0];
  const strengthLabel = input.strength === "none" ? "limited" : input.strength;
  const diversificationBefore =
    input.metrics.protocolHHIBefore !== null ? (1 - input.metrics.protocolHHIBefore) * 100 : null;
  const diversificationAfter =
    input.metrics.protocolHHIAfter !== null ? (1 - input.metrics.protocolHHIAfter) * 100 : null;
  const argumentLead =
    input.reasonCodes.length > 0
      ? `The strongest measurable drivers are ${input.reasonCodes
          .slice(0, 3)
          .map((reason: string) => reason.toLowerCase().replaceAll("_", " "))
          .join(", ")}.`
      : "The explanation is based on the measured bucket and vault metrics.";

  if (input.decision.recommendationType === "already_in_yo") {
    return {
      headline: `Already meaningfully allocated to ${input.vaultSymbol}`,
      summary:
        `You already hold ${formatPct(input.decision.existingYoSharePct * 100, 0)} of this bucket in ${input.vaultSymbol}. ${argumentLead} The engine does not see enough incremental benefit from adding more right now, so this stays a neutral hold-state rather than a new deposit push.`,
      bullets: [
        `Current YO share: ${formatPct(input.decision.existingYoSharePct * 100, 0)} of this bucket.`,
        `Modeled deltas: weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} -> ${formatNumber(input.metrics.weightedRiskAfter)}, savings ${formatNumber(input.metrics.savingsScoreBefore)} -> ${formatNumber(input.metrics.savingsScoreAfter)}.`,
        `Suggested comparison size is ${formatUsd(input.suggestedUsd)}, but no incremental gain cleared the bar.`,
      ],
      caution,
    };
  }

  if (input.decision.recommendationType === "no_incremental_improvement") {
    return {
      headline: `No additional ${input.vaultSymbol} move is supported right now`,
      summary:
        `The engine does not find enough incremental benefit from moving another ${formatUsd(input.suggestedUsd)} into ${input.vaultSymbol}. ${argumentLead} This is a neutral diagnostic outcome, not a deposit prompt, because the modeled improvement is too weak for the trust level available.`,
      bullets: [
        `Primary intent evaluated: ${input.decision.primaryIntent.replaceAll("_", " ")}.`,
        `Weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} -> ${formatNumber(input.metrics.weightedRiskAfter)}, high-risk ${formatPct(input.metrics.highRiskBeforePct)} -> ${formatPct(input.metrics.highRiskAfterPct)}.`,
        `Savings ${formatNumber(input.metrics.savingsScoreBefore)} -> ${formatNumber(input.metrics.savingsScoreAfter)}, diversification ${formatPct(diversificationBefore)} -> ${formatPct(diversificationAfter)}.`,
      ],
      caution,
    };
  }

  if (input.decision.primaryIntent === "idle_deployment") {
    return {
      headline: `Put idle ${input.bucket} to work`,
      summary:
        `About ${formatUsd(input.userBucketMetrics.idleAssetUsd)} in this bucket is idle today, so the main case for ${input.vaultSymbol} is productive deployment rather than claiming your current setup is inferior. ${argumentLead} The modeled annual yield opportunity is about ${formatUsd(input.metrics.estimatedAnnualYieldOpportunityUsd ?? 0)}, while the vault profile shows APY ${formatPct(input.vault.apyPct, 2)}, weighted risk ${formatNumber(input.metrics.vaultWeightedRisk)}, and unknown exposure ${formatPct(input.metrics.vaultUnknownRiskExposurePct)}.`,
      bullets: [
        `${formatUsd(input.userBucketMetrics.idleAssetUsd)} is idle today and ${formatUsd(input.suggestedUsd)} is the suggested next move size.`,
        `Vault profile: APY ${formatPct(input.vault.apyPct, 2)}, weighted risk ${formatNumber(input.metrics.vaultWeightedRisk)}, high-risk ${formatPct(input.metrics.vaultHighRiskExposurePct)}, unknown ${formatPct(input.metrics.vaultUnknownRiskExposurePct)}.`,
        `This move is about activating idle capital of ${formatPct(input.userBucketMetrics.idleSharePct * 100, 0)} of the bucket, not claiming the current idle balance is unsafe.`,
      ],
      caution,
    };
  }

  if (input.decision.recommendationType === "informational_only") {
    return {
      headline: "Informational comparison only",
      summary:
        `A measurable benefit may still exist here, but public risk coverage is too incomplete for stronger action wording. ${argumentLead} The modeled move size is ${formatUsd(input.suggestedUsd)} and covered metrics can still be useful, but unknown exposure remains too material to turn this into a firm deposit push.`,
      bullets: [
        `Primary intent: ${input.decision.primaryIntent.replaceAll("_", " ")} and suggested size ${formatUsd(input.suggestedUsd)}.`,
        `Weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} -> ${formatNumber(input.metrics.weightedRiskAfter)}, high-risk ${formatPct(input.metrics.highRiskBeforePct)} -> ${formatPct(input.metrics.highRiskAfterPct)}.`,
        `Savings ${formatNumber(input.metrics.savingsScoreBefore)} -> ${formatNumber(input.metrics.savingsScoreAfter)}, diversification ${formatPct(diversificationBefore)} -> ${formatPct(diversificationAfter)}.`,
      ],
      caution,
    };
  }

  if (input.decision.primaryIntent === "diversification_improvement") {
    return {
      headline: `Diversify ${input.bucket} exposure with ${input.vaultSymbol}`,
      summary:
        `The main supported benefit is reducing concentration inside this bucket. ${argumentLead} Compared with the current setup, ${input.vaultSymbol} spreads capital across more underlying allocations and improves diversification from ${formatPct(diversificationBefore)} to ${formatPct(diversificationAfter)}, while the modeled move size is ${formatUsd(input.suggestedUsd)}.`,
      bullets: [
        `Protocol HHI improves from ${formatNumber(input.metrics.protocolHHIBefore)} to ${formatNumber(input.metrics.protocolHHIAfter)}.`,
        `Weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} -> ${formatNumber(input.metrics.weightedRiskAfter)} and high-risk ${formatPct(input.metrics.highRiskBeforePct)} -> ${formatPct(input.metrics.highRiskAfterPct)}.`,
        `Savings ${formatNumber(input.metrics.savingsScoreBefore)} -> ${formatNumber(input.metrics.savingsScoreAfter)} and overlap ${formatPct(input.metrics.protocolOverlapPct)}.`,
      ],
      caution,
    };
  }

  return {
    headline: `Consider moving part of your ${input.bucket} savings to ${input.vaultSymbol}`,
    summary:
      `The modeled comparison supports moving about ${formatUsd(input.suggestedUsd)} from this ${input.bucket} bucket into ${input.vaultSymbol}. ${argumentLead} Covered metrics improve from weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} to ${formatNumber(input.metrics.weightedRiskAfter)}, high-risk exposure ${formatPct(input.metrics.highRiskBeforePct)} to ${formatPct(input.metrics.highRiskAfterPct)}, savings score ${formatNumber(input.metrics.savingsScoreBefore)} to ${formatNumber(input.metrics.savingsScoreAfter)}, and diversification ${formatPct(diversificationBefore)} to ${formatPct(diversificationAfter)}, which is why the engine sees a case for shifting part of the bucket into YO.`,
    bullets: [
      `Weighted risk ${formatNumber(input.metrics.weightedRiskBefore)} -> ${formatNumber(input.metrics.weightedRiskAfter)}.`,
      `High-risk ${formatPct(input.metrics.highRiskBeforePct)} -> ${formatPct(input.metrics.highRiskAfterPct)} and savings ${formatNumber(input.metrics.savingsScoreBefore)} -> ${formatNumber(input.metrics.savingsScoreAfter)}.`,
      `Diversification ${formatPct(diversificationBefore)} -> ${formatPct(diversificationAfter)}, overlap ${formatPct(input.metrics.protocolOverlapPct)}, vault APY ${formatPct(input.vault.apyPct, 2)}.`,
    ],
    caution,
  };
};

export class ExplanationService {
  private readonly cache = new ExplanationCacheRepository();
  private readonly client = getEnv().OPENAI_API_KEY
    ? new OpenAI({
        apiKey: getEnv().OPENAI_API_KEY,
        baseURL: getEnv().OPENAI_BASE_URL,
      })
    : null;

  private async generateExplanation(input: ExplanationInput): Promise<ExplanationOutput> {
    if (!this.client) {
      return buildFallbackExplanation(input);
    }

    const response = await this.client.responses.create({
      model: getEnv().OPENAI_MODEL,
      temperature: getEnv().OPENAI_EXPLANATION_TEMPERATURE,
      input: [
        {
          role: "system",
          content:
            "You write product-card explanations for DeFi savings recommendations. Use only the supplied structured data. Never invent facts, never promise returns, and never overclaim safety. Primary intent controls the narrative: risk_improvement emphasizes lower covered risk and why moving part of the bucket into YO may improve bucket quality, diversification_improvement emphasizes lower concentration and reduced dependence on a single protocol, idle_deployment emphasizes activating idle capital and productive deployment. Recommendation type controls product state: informational_only means context not push, already_in_yo means the user is already materially allocated, no_incremental_improvement means no additional move is supported but the card must still explain the measured metrics. Treat safetyClaimLevel as a hard wording cap. Explicitly argue from the metrics and reason codes which indicators support allocating capital into the YO vault, and which indicators argue against it when the move is weak or unsupported. Use the most decision-relevant numeric values from the payload in the summary and bullets, especially suggestedUsd, weighted risk, high-risk exposure, savings score, diversification, APY, unknown exposure, existing YO share, overlap, top allocations, and yield opportunity when relevant. Every response must contain concrete numeric evidence from the payload and should explain why part of the portfolio may or may not belong in YO based on those numbers. Output must stay card-readable: one short headline, one compact summary of at most 65 words, max 2 bullets of at most 28 words each, and one short caution paragraph of at most 24 words. Prioritize fit over completeness and compress numbers tightly.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recommendation_explanation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              bullets: { type: "array", maxItems: 3, items: { type: "string" } },
              caution: { type: ["string", "null"] },
            },
            required: ["headline", "summary", "bullets", "caution"],
          },
        },
      },
    });

    const outputText = response.output_text;
    const parsedJson = JSON.parse(outputText) as ExplanationOutput & { caution: string | null };
    const parsed: ExplanationOutput = parsedJson.caution === null ? { ...parsedJson, caution: undefined } : parsedJson;

    if (getEnv().ENABLE_EXPLANATION_CACHE) {
      await this.cache.set({
        input,
        model: getEnv().OPENAI_MODEL,
        output: parsed,
        ttlMinutes: 20,
      });
    }

    return parsed;
  }

  async getImmediateExplanation(input: ExplanationInput): Promise<ExplanationOutput> {
    if (getEnv().ENABLE_EXPLANATION_CACHE) {
      const cached = await this.cache.get(input);
      if (cached) return cached;
    }

    try {
      return await this.generateExplanation(input);
    } catch {
      return buildFallbackExplanation(input);
    }
  }

  async explain(input: ExplanationInput): Promise<ExplanationOutput> {
    if (getEnv().ENABLE_EXPLANATION_CACHE) {
      const cached = await this.cache.get(input);
      if (cached) return cached;
    }

    try {
      return await this.generateExplanation(input);
    } catch {
      return buildFallbackExplanation(input);
    }
  }
}
