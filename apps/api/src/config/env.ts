import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(8080),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.string().default("info"),
  ENABLE_SWAGGER: z.coerce.boolean().default(true),
  ENABLE_DEBUG_ENDPOINTS: z.coerce.boolean().default(true),
  API_RATE_LIMIT_MAX: z.coerce.number().default(60),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  DEBANK_ACCESS_KEY: z.string().optional(),
  DEBANK_BASE_URL: z.string().default("https://pro-openapi.debank.com"),
  DEBANK_CACHE_TTL_SEC: z.coerce.number().default(90),
  DEBANK_TIMEOUT_MS: z.coerce.number().default(8000),
  YO_PARTNER_ID: z.string().optional(),
  YO_DEFAULT_SLIPPAGE_BPS: z.coerce.number().default(50),
  YO_API_TIMEOUT_MS: z.coerce.number().default(8000),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-5.4"),
  OPENAI_EXPLANATION_TEMPERATURE: z.coerce.number().default(0.2),
  ENABLE_EXPLANATION_CACHE: z.coerce.boolean().default(true),
  ENABLE_ASYNC_EXPLANATIONS: z.coerce.boolean().default(true),
  RISK_DATASET_FILE: z.string().default("/app/data/risk/risk-dataset.json"),
  RISK_DATASET_VERSION: z.string().default("local-dev"),
  RISK_DATASET_IMPORT_ON_BOOT: z.coerce.boolean().default(true),
  RISK_DATASET_CACHE_TTL_SEC: z.coerce.number().default(1800),
  BASE_RPC_URL: z.string().optional(),
  ETHEREUM_RPC_URL: z.string().optional(),
  ARBITRUM_RPC_URL: z.string().optional(),
  OPTIMISM_RPC_URL: z.string().optional(),
  POLYGON_RPC_URL: z.string().optional(),
  QUEUE_PREFIX: z.string().default("whyyo"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export const getEnv = (): AppEnv => {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
};
