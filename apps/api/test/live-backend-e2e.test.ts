import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { importRiskDataset } from "../src/bootstrap/import-risk-dataset";
import { applyMigrations } from "../src/bootstrap/migrate";
import { seedDevAliases } from "../src/bootstrap/seed-dev-aliases";
import { getDb } from "../src/db/pool";
import { getRedis } from "../src/db/redis";

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
    // Use current process env when .env is not present.
  }
};

await loadEnvFile();

const normalizeHostSideEnv = (): void => {
  if (process.env.DATABASE_URL?.includes("@postgres:")) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace("@postgres:", "@localhost:");
  }
  if (process.env.REDIS_URL === "redis://redis:6379") {
    process.env.REDIS_URL = "redis://localhost:6379";
  }
  if (process.env.RISK_DATASET_FILE === "/app/data/risk/risk-dataset.json") {
    process.env.RISK_DATASET_FILE = path.resolve(repoRoot, "data/risk/risk-dataset.json");
  }
};

normalizeHostSideEnv();

const walletAddress = process.env.INTEGRATION_TEST_WALLET_ADDRESS;
const runE2E = process.env.RUN_LIVE_BACKEND_E2E === "true" || process.env.RUN_LIVE_BACKEND_E2E === "1";
const describeIf = runE2E && walletAddress ? describe : describe.skip;

describeIf("live backend e2e scan pipeline", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    const db = getDb();
    await db.query("SELECT 1");
    await getRedis().ping();
    await applyMigrations(db);
    await seedDevAliases(db);
    await importRiskDataset(db);
    app = await buildApp();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await getRedis().quit();
    await getDb().end();
  });

  it(
    "runs the full scan endpoint, persists the result, and writes frontend payload artifacts",
    async () => {
      const startResponse = await app.inject({
        method: "POST",
        url: "/api/v1/scan/start",
        payload: {
          walletAddress,
        },
      });

      expect(startResponse.statusCode).toBe(200);
      const startPayload = startResponse.json();
      expect(startPayload.scanId).toBeTypeOf("string");
      expect(startPayload.portfolioOverview.ownerAddress).toBe(walletAddress!.toLowerCase());
      expect(Array.isArray(startPayload.bucketOverview)).toBe(true);
      expect(Array.isArray(startPayload.recommendations)).toBe(true);

      const persistedResponse = await app.inject({
        method: "GET",
        url: `/api/v1/scan/${startPayload.scanId}`,
      });

      expect(persistedResponse.statusCode).toBe(200);
      const persistedPayload = persistedResponse.json();
      expect(persistedPayload.scanId).toBe(startPayload.scanId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const shortWallet = walletAddress!.slice(0, 10).toLowerCase();
      const outputDir = path.resolve(repoRoot, "test_runs");
      await mkdir(outputDir, { recursive: true });

      const artifact = {
        generatedAt: new Date().toISOString(),
        walletAddress: walletAddress!.toLowerCase(),
        scanId: startPayload.scanId,
        status: startPayload.status,
        warnings: startPayload.warnings,
        summary: {
          totalUsd: startPayload.portfolioOverview.totalUsd,
          analyzedUsd: startPayload.portfolioOverview.analyzedUsd,
          coveragePct: startPayload.portfolioOverview.coveragePct,
          protocolCount: startPayload.portfolioOverview.protocolCount,
          positionCount: startPayload.portfolioOverview.positionCount,
          chainCount: startPayload.portfolioOverview.chainCount,
          recommendationCount: startPayload.recommendations.length,
        },
        recommendations: startPayload.recommendations.map((recommendation: Record<string, unknown>) => ({
          bucket: recommendation.bucket,
          vaultSymbol: recommendation.vaultSymbol,
          score: recommendation.score,
          strength: recommendation.strength,
          confidence: recommendation.confidence,
          suggestedUsd: recommendation.suggestedUsd,
          headline:
            typeof recommendation.llmExplanation === "object" && recommendation.llmExplanation !== null
              ? (recommendation.llmExplanation as Record<string, unknown>).headline
              : null,
          summary:
            typeof recommendation.llmExplanation === "object" && recommendation.llmExplanation !== null
              ? (recommendation.llmExplanation as Record<string, unknown>).summary
              : null,
        })),
        frontendPayload: startPayload,
        persistedPayload,
      };

      const outputPath = path.join(outputDir, `${timestamp}-${shortWallet}-scan.json`);
      const latestPath = path.join(outputDir, "latest-backend-scan.json");
      await writeFile(outputPath, JSON.stringify(artifact, null, 2));
      await writeFile(latestPath, JSON.stringify(artifact, null, 2));

      expect(startPayload.methodology).toBeDefined();
    },
    120_000,
  );
});
