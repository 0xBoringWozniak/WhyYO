import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";

import { getEnv } from "./config/env";
import { registerDebugRoutes } from "./routes/debug";
import { registerMethodologyRoutes } from "./routes/methodology";
import { registerScanRoutes } from "./routes/scan";
import { registerSystemRoutes } from "./routes/system";

export const buildApp = async () => {
  const env = getEnv();
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: env.API_RATE_LIMIT_MAX,
    timeWindow: env.API_RATE_LIMIT_WINDOW_MS,
  });

  if (env.ENABLE_SWAGGER) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "Why YO API",
          version: "0.1.0",
        },
      },
    });
    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  await registerSystemRoutes(app);
  await registerMethodologyRoutes(app);
  await registerScanRoutes(app);
  if (env.ENABLE_DEBUG_ENDPOINTS) {
    await registerDebugRoutes(app);
  }

  return app;
};
