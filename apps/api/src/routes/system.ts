import type { FastifyInstance } from "fastify";

import { healthResponseSchema } from "@whyyo/shared";

import { getDb } from "../db/pool";
import { getRedis } from "../db/redis";
import { RiskRepository } from "../repositories/risk-repository";

export const registerSystemRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/api/v1/system/health", async () => {
    const payload = {
      status: "ok",
      checks: {
        api: "ok",
      },
      timestamp: new Date().toISOString(),
    } as const;
    return healthResponseSchema.parse(payload);
  });

  app.get("/api/v1/system/readiness", async (_, reply) => {
    const checks: Record<string, "ok" | "degraded" | "error"> = {
      postgres: "ok",
      redis: "ok",
      riskDataset: "ok",
    };

    try {
      await getDb().query("SELECT 1");
    } catch {
      checks.postgres = "error";
    }

    try {
      await getRedis().ping();
    } catch {
      checks.redis = "error";
    }

    try {
      const version = await new RiskRepository().getActiveVersion();
      if (!version) checks.riskDataset = "degraded";
    } catch {
      checks.riskDataset = "error";
    }

    const status = Object.values(checks).includes("error")
      ? "error"
      : Object.values(checks).includes("degraded")
        ? "degraded"
        : "ok";

    if (status !== "ok") {
      reply.status(503);
    }

    return healthResponseSchema.parse({
      status,
      checks,
      timestamp: new Date().toISOString(),
    });
  });
};
