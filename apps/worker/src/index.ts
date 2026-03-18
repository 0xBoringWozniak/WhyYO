import { createHash } from "node:crypto";

import { Worker } from "bullmq";
import OpenAI from "openai";
import { Pool } from "pg";

import { explanationInputSchema, explanationOutputSchema, type ExplanationInput, type ExplanationOutput } from "@whyyo/shared";

const env = {
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://whyyo:whyyo@postgres:5432/whyyo",
  queuePrefix: process.env.QUEUE_PREFIX ?? "whyyo",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.4",
  openAiTemperature: Number(process.env.OPENAI_EXPLANATION_TEMPERATURE ?? "0.2"),
};

const db = new Pool({ connectionString: env.databaseUrl });
const queueConnection = { url: env.redisUrl };
const client = env.openAiApiKey
  ? new OpenAI({ apiKey: env.openAiApiKey, baseURL: env.openAiBaseUrl })
  : null;

const fallbackExplanation = (input: ExplanationInput): ExplanationOutput => ({
  headline: `${input.bucket} savings vs ${input.vaultSymbol}`,
  summary: `${input.vaultSymbol} was ranked by the deterministic engine as a better fit for this bucket based on weighted risk, high-risk exposure, and savings score.`,
  bullets: [
    `Suggested move: $${input.suggestedUsd.toFixed(2)}`,
    `Coverage: ${input.metrics.coveragePct === null ? "n/a" : `${input.metrics.coveragePct.toFixed(1)}%`}`,
    `Protocol overlap: ${input.metrics.protocolOverlapPct.toFixed(1)}%`,
  ],
  caution: input.caveats[0],
});

const inputHash = (input: ExplanationInput): string =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");

const persistExplanation = async (input: ExplanationInput, output: ExplanationOutput): Promise<void> => {
  await db.query(
    `INSERT INTO explanation_cache (input_hash, model, response_json, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '20 minute')
     ON CONFLICT (input_hash)
     DO UPDATE SET model = EXCLUDED.model,
                   response_json = EXCLUDED.response_json,
                   expires_at = EXCLUDED.expires_at`,
    [inputHash(input), env.openAiModel, JSON.stringify(output)],
  );
};

const worker = new Worker(
  "explanations",
  async (job) => {
    const parsedInput = explanationInputSchema.safeParse(job.data);
    if (!parsedInput.success) {
      console.warn(`Skipping legacy or invalid explanation job ${job.id ?? "unknown"}`, parsedInput.error.issues);
      return { skipped: true };
    }
    const input = parsedInput.data;
    if (!client) {
      const output = fallbackExplanation(input);
      await persistExplanation(input, output);
      return output;
    }
    const response = await client.responses.create({
      model: env.openAiModel,
      temperature: env.openAiTemperature,
      input: [
        {
          role: "system",
          content:
            "You explain DeFi recommendations. Use only the given metrics, do not invent numbers, keep the tone crisp and trustworthy, and note caveats when present.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "worker_explanation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              caution: { type: "string" },
            },
            required: ["headline", "summary", "bullets"],
          },
        },
      },
    });
    const output = explanationOutputSchema.parse(JSON.parse(response.output_text));
    await persistExplanation(input, output);
    return output;
  },
  {
    connection: queueConnection,
    prefix: env.queuePrefix,
    concurrency: 2,
  },
);

worker.on("ready", () => {
  console.log("Worker ready");
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed`, error);
});
