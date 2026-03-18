import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import {
  HttpClient,
  debankChainSchema,
  debankComplexProtocolSchema,
  debankSimpleProtocolSchema,
  debankTokenAuthorizedSchema,
  debankTokenSchema,
  debankTotalBalanceSchema,
  normalizeRiskDatasetInput,
  riskDatasetSchema,
} from "@whyyo/integrations";
import { explanationInputSchema, explanationOutputSchema } from "@whyyo/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const loadEnvFile = async (): Promise<void> => {
  const envPath = path.resolve(repoRoot, ".env");
  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Keep process.env as-is if .env is absent.
  }
};

await loadEnvFile();

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

const walletAddress = process.env.INTEGRATION_TEST_WALLET_ADDRESS;
const debankAccessKey = process.env.DEBANK_ACCESS_KEY;
const debankBaseUrl = process.env.DEBANK_BASE_URL ?? "https://pro-openapi.debank.com";
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const openAiModel = process.env.OPENAI_MODEL ?? "gpt-5.4";

const resolveRiskDatasetPath = (): string => {
  const configured = process.env.RISK_DATASET_FILE;
  const localDefault = path.resolve(repoRoot, "data/risk/risk-dataset.json");
  if (!configured) return localDefault;
  const absoluteCandidate = path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
  return absoluteCandidate;
};

describe("risk dataset integration", () => {
  it("validates the active production risk dataset file and normalizes it", async () => {
    const datasetPath = resolveRiskDatasetPath();
    try {
      await access(datasetPath);
    } catch {
      // Docker path from .env should not break local tests.
      const fallbackPath = path.resolve(repoRoot, "data/risk/risk-dataset.json");
      const rawFallback = await readFile(fallbackPath, "utf8");
      const normalizedFallback = normalizeRiskDatasetInput(riskDatasetSchema.parse(JSON.parse(rawFallback)));
      expect(normalizedFallback.data.total_count).toBeGreaterThan(0);
      expect(normalizedFallback.data.pools.length + normalizedFallback.data.yo_pools.length).toBe(
        normalizedFallback.data.total_count,
      );
      return;
    }

    const raw = await readFile(datasetPath, "utf8");
    const normalized = normalizeRiskDatasetInput(riskDatasetSchema.parse(JSON.parse(raw)));
    expect(normalized.data.total_count).toBeGreaterThan(0);
    expect(normalized.data.pools.length + normalized.data.yo_pools.length).toBe(normalized.data.total_count);
    expect(normalized.data.pools[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
    });
  });
});

describeIf(Boolean(walletAddress && debankAccessKey))("Debank live integration", () => {
  const http = new HttpClient({
    baseUrl: debankBaseUrl,
    headers: {
      AccessKey: debankAccessKey!,
    },
    timeoutMs: 10_000,
    retries: 1,
  });

  const getWithFallback = async <T,>(paths: string[]): Promise<T> => {
    let lastError: unknown;
    for (const currentPath of paths) {
      try {
        return await http.get<T>(currentPath);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Live Debank request failed");
  };

  it(
    "validates live Debank payloads against production schemas",
    async () => {
      const targetWallet = walletAddress!;
      const [totalBalanceRaw, usedChainsRaw, simpleProtocolsRaw, complexProtocolsRaw, tokensRaw, tokenAuthorizedRaw] =
        await Promise.all([
          getWithFallback<unknown>([`/v1/user/total_balance?id=${targetWallet}`]),
          getWithFallback<unknown>([`/v1/user/used_chain_list?id=${targetWallet}`]),
          getWithFallback<unknown>([
            `/v1/user/all_simple_protocol_list?id=${targetWallet}`,
            `/v1/user/simple_protocol_list?id=${targetWallet}`,
          ]),
          getWithFallback<unknown>([
            `/v1/user/all_complex_protocol_list?id=${targetWallet}`,
            `/v1/user/complex_protocol_list?id=${targetWallet}`,
          ]),
          getWithFallback<unknown>([`/v1/user/all_token_list?id=${targetWallet}&is_all=true`]),
          getWithFallback<unknown>([`/v1/user/token_authorized_list?id=${targetWallet}`]).catch(() => []),
        ]);

      const totalBalance = debankTotalBalanceSchema.parse(totalBalanceRaw);
      const usedChains = debankChainSchema.array().parse(usedChainsRaw);
      const simpleProtocols = debankSimpleProtocolSchema.array().parse(simpleProtocolsRaw);
      const complexProtocols = debankComplexProtocolSchema.array().parse(complexProtocolsRaw);
      const tokens = debankTokenSchema.array().parse(tokensRaw);
      const tokenAuthorized = debankTokenAuthorizedSchema.array().parse(tokenAuthorizedRaw);

      expect(totalBalance.total_usd_value).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(usedChains)).toBe(true);
      expect(Array.isArray(simpleProtocols)).toBe(true);
      expect(Array.isArray(complexProtocols)).toBe(true);
      expect(Array.isArray(tokens)).toBe(true);
      expect(Array.isArray(tokenAuthorized)).toBe(true);
    },
    30_000,
  );
});

describeIf(Boolean(openAiApiKey))("OpenAI live integration", () => {
  const client = new OpenAI({
    apiKey: openAiApiKey,
    baseURL: openAiBaseUrl,
  });

  it(
    "validates live explanation responses against the explanation schema",
    async () => {
      const input = explanationInputSchema.parse({
        bucket: "USD",
        vaultSymbol: "yoUSD",
        vaultAddress: "0x0000000000000000000000000000000000000001",
        score: 0.63,
        strength: "medium",
        confidence: "high",
        suggestedUsd: 500,
        metrics: {
          weightedRiskBefore: 3.1,
          weightedRiskAfter: 2.2,
          weightedRiskImprovementPct: 29,
          highRiskBeforePct: 0.42,
          highRiskAfterPct: 0.19,
          highRiskReductionPctPoints: 23,
          savingsScoreBefore: 48,
          savingsScoreAfter: 76,
          savingsScoreDelta: 28,
          protocolHHIBefore: 0.62,
          protocolHHIAfter: 0.38,
          protocolConcentrationImprovementPct: 38.7,
          protocolOverlapPct: 15,
          protocolDistance: 0.85,
          strategyDistance: 0.7,
          positionsBefore: 5,
          positionsAfter: 1,
          coveragePct: 82,
          unknownRiskExposurePct: 18,
        },
        userBucketMetrics: {
          totalUsd: 2000,
          weightedRiskScore: 3.1,
          highRiskExposurePct: 0.42,
          mediumRiskExposurePct: 0.7,
          unknownRiskExposurePct: 0.18,
          protocolHHI: 0.62,
          chainHHI: 0.75,
          strategyHHI: 0.68,
          savingsScore: 48,
          positionCount: 5,
          protocolCount: 4,
          chainCount: 2,
          top1ProtocolShare: 0.46,
          top3ProtocolShare: 0.9,
          top1ChainShare: 0.72,
          top1StrategyShare: 0.64,
          complexityNorm: 0.56,
        },
        vaultMetrics: {
          totalUsd: 1200000,
          weightedRiskScore: 2.2,
          highRiskExposurePct: 0.19,
          mediumRiskExposurePct: 0.3,
          unknownRiskExposurePct: 0.02,
          protocolHHI: 0.38,
          chainHHI: 0.55,
          strategyHHI: 0.41,
          savingsScore: 76,
          positionCount: 3,
          protocolCount: 3,
          chainCount: 2,
          top1ProtocolShare: 0.52,
          top3ProtocolShare: 1,
          top1ChainShare: 0.67,
          top1StrategyShare: 0.82,
          complexityNorm: 0.28,
        },
        projectedMetrics: {
          migrationRatio: 0.25,
          weightedRiskScore: 2.875,
          highRiskExposurePct: 0.3625,
          unknownRiskExposurePct: 0.14,
          protocolHHI: 0.56,
          chainHHI: 0.7,
          strategyHHI: 0.61,
          savingsScore: 55,
        },
        decision: {
          score: 0.63,
          strength: "medium",
          confidence: "high",
          eligible: true,
          avgMatchingConfidence: 0.91,
          riskGain: 0.29,
          highRiskGain: 0.23,
          savingsGain: 0.28,
          concentrationGain: 0.387,
          simplicityGain: 0.74,
          similarity: 0.15,
          strategyFitGain: 0.3,
          unknownPenalty: 0.6,
          sizePenalty: 0,
        },
        vault: {
          vaultAddress: "0x0000000000000000000000000000000000000001",
          chain: "base",
          bucket: "USD",
          apyPct: 6.8,
          tvlUsd: 1200000,
          riskGrade: "B",
          riskScore: 2,
          allocationCount: 3,
          avgMatchingConfidence: 0.91,
          topAllocations: [
            {
              canonicalProtocolId: "aave",
              canonicalProtocolName: "aave",
              chain: "base",
              strategyType: "lending",
              riskGrade: "B",
              riskScore: 2,
              usdValue: 780000,
              weightPct: 65,
              matchingConfidence: 0.94,
            },
          ],
        },
        reasonCodes: ["LOWER_WEIGHTED_RISK", "LOWER_HIGH_RISK_EXPOSURE", "SIMPLER_STRUCTURE"],
        caveats: ["Recommendation is bucket-specific and based on public risk coverage."],
      });

      const response = await client.responses.create({
        model: openAiModel,
        temperature: 0.2,
        input: [
          {
            role: "system",
            content:
              "You explain DeFi savings recommendations. Use only the supplied data. Base the explanation on the full metric set: current bucket metrics, YO vault metrics, projected post-move metrics, decision signals, and caveats. Never invent numbers or claim improvement unless the supplied metrics support it. If score is low, strength is none, or projected metrics worsen, say that plainly. Keep the tone crisp, trustworthy, and non-promotional.",
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
                bullets: { type: "array", items: { type: "string" } },
                caution: { type: ["string", "null"] },
              },
              required: ["headline", "summary", "bullets", "caution"],
            },
          },
        },
      });

      const rawOutput = JSON.parse(response.output_text) as { caution: string | null };
      const parsed = explanationOutputSchema.parse({
        ...rawOutput,
        caution: rawOutput.caution ?? undefined,
      });
      expect(parsed.headline.length).toBeGreaterThan(0);
      expect(parsed.summary.length).toBeGreaterThan(0);
      expect(parsed.bullets.length).toBeGreaterThan(0);
    },
    30_000,
  );
});
