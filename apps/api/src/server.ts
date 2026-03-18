import { buildApp } from "./app";
import { getEnv } from "./config/env";

const start = async (): Promise<void> => {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
