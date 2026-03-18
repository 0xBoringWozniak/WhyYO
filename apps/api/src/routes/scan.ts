import type { FastifyInstance } from "fastify";

import { scanRequestSchema } from "@whyyo/shared";

import { ScanService } from "../services/scan-service";

export const registerScanRoutes = async (app: FastifyInstance): Promise<void> => {
  const scanService = new ScanService();

  app.post("/api/v1/scan/start", async (request, reply) => {
    const parsed = scanRequestSchema.parse(request.body);
    const response = await scanService.startScan(parsed.walletAddress);
    return reply.send(response);
  });

  app.post("/api/v1/scan/refresh", async (request, reply) => {
    const parsed = scanRequestSchema.parse(request.body);
    const response = await scanService.startScan(parsed.walletAddress);
    return reply.send(response);
  });

  app.get("/api/v1/scan/:scanId", async (request, reply) => {
    const params = request.params as { scanId: string };
    const response = await scanService.getScan(params.scanId);
    if (!response) {
      return reply.status(404).send({ message: "Scan not found" });
    }
    return reply.send(response);
  });
};
