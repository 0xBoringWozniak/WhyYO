import { createHash } from "node:crypto";

import { Queue } from "bullmq";

import type { ExplanationInput } from "@whyyo/shared";

import { getEnv } from "../config/env";

export class QueueService {
  private readonly explanationQueue = new Queue("explanations", {
    connection: { url: getEnv().REDIS_URL },
    prefix: getEnv().QUEUE_PREFIX,
  });

  private getJobId(input: ExplanationInput): string {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }

  async enqueueExplanation(input: ExplanationInput): Promise<void> {
    await this.explanationQueue.add(
      "generate-explanation",
      input,
      {
        jobId: this.getJobId(input),
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}
