import type { FastifyInstance } from "fastify";

import { ProtocolRepository } from "../repositories/protocol-repository";
import { RiskRepository } from "../repositories/risk-repository";

export const registerDebugRoutes = async (app: FastifyInstance): Promise<void> => {
  const riskRepository = new RiskRepository();
  const protocolRepository = new ProtocolRepository();

  app.get("/api/v1/debug/risk/version", async () => riskRepository.getActiveVersion());

  app.get("/api/v1/debug/risk/pools", async (request) => {
    const query = request.query as { limit?: string };
    const pools = await riskRepository.listActivePools();
    return pools.slice(0, Number(query.limit ?? 20));
  });

  app.get("/api/v1/debug/risk/pools/:slug", async (request) => {
    const params = request.params as { slug: string };
    return riskRepository.searchPoolsBySlug(params.slug);
  });

  app.get("/api/v1/debug/risk/summary", async () => {
    const version = await riskRepository.getActiveVersion();
    const pools = await riskRepository.listActivePools();
    return {
      version,
      totalPools: pools.length,
      byBucket: pools.reduce<Record<string, number>>((acc, pool) => {
        acc[pool.bucket] = (acc[pool.bucket] ?? 0) + 1;
        return acc;
      }, {}),
      bySource: pools.reduce<Record<string, number>>((acc, pool) => {
        acc[pool.sourceKind] = (acc[pool.sourceKind] ?? 0) + 1;
        return acc;
      }, {}),
    };
  });

  app.get("/api/v1/debug/matching/protocols", async (request) => {
    const query = request.query as { query?: string };
    const catalog = await protocolRepository.listCatalog();
    if (!query.query) return catalog.slice(0, 20);
    return catalog.filter((item) =>
      [item.canonicalName, item.canonicalProtocolId, ...item.aliases]
        .join(" ")
        .toLowerCase()
        .includes(query.query!.toLowerCase()),
    );
  });
};
