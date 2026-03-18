import { createHash } from "node:crypto";

import type { ExplanationInput, ExplanationOutput } from "@whyyo/shared";

import { getDb } from "../db/pool";

export class ExplanationCacheRepository {
  hashInput(input: ExplanationInput): string {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }

  async get(input: ExplanationInput): Promise<ExplanationOutput | null> {
    const hash = this.hashInput(input);
    const result = await getDb().query<{ response_json: ExplanationOutput }>(
      `SELECT response_json
       FROM explanation_cache
       WHERE input_hash = $1
         AND expires_at > NOW()
       LIMIT 1`,
      [hash],
    );
    return result.rows[0]?.response_json ?? null;
  }

  async set({
    input,
    model,
    output,
    ttlMinutes,
  }: {
    input: ExplanationInput;
    model: string;
    output: ExplanationOutput;
    ttlMinutes: number;
  }): Promise<void> {
    const hash = this.hashInput(input);
    await getDb().query(
      `INSERT INTO explanation_cache (input_hash, model, response_json, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))
       ON CONFLICT (input_hash)
       DO UPDATE SET response_json = EXCLUDED.response_json,
                     model = EXCLUDED.model,
                     expires_at = EXCLUDED.expires_at`,
      [hash, model, JSON.stringify(output), ttlMinutes],
    );
  }
}
