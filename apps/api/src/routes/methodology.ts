import type { FastifyInstance } from "fastify";

import { defaultMethodologyResponse } from "@whyyo/shared";

export const registerMethodologyRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/api/v1/methodology", async () => defaultMethodologyResponse);
};
