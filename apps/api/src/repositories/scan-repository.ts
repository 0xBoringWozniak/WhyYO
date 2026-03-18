import type { PoolClient } from "pg";

import type { BucketMetrics, RankedRecommendation, ScanResponse } from "@whyyo/shared";

import { getDb } from "../db/pool";

type ScanRow = {
  id: string;
  wallet_address: string;
  status: "pending" | "completed" | "failed" | "partial";
  total_usd: number;
  analyzed_usd: number;
  coverage_pct: number;
  warnings_json: string[];
  payload_json: ScanResponse | null;
  created_at: string;
};

export class ScanRepository {
  async createScanSession(walletAddress: string, client?: PoolClient): Promise<string> {
    const executor = client ?? getDb();
    const result = await executor.query<{ id: string }>(
      `INSERT INTO scan_sessions (wallet_address, status)
       VALUES ($1, 'pending')
       RETURNING id`,
      [walletAddress.toLowerCase()],
    );
    const scanId = result.rows[0]?.id;
    if (!scanId) {
      throw new Error("Failed to create scan session");
    }
    return scanId;
  }

  async persistResult({
    scanId,
    response,
  }: {
    scanId: string;
    response: ScanResponse;
  }): Promise<void> {
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE scan_sessions
         SET status = $2,
             total_usd = $3,
             analyzed_usd = $4,
             coverage_pct = $5,
             warnings_json = $6,
             payload_json = $7
         WHERE id = $1`,
        [
          scanId,
          response.status,
          response.portfolioOverview.totalUsd,
          response.portfolioOverview.analyzedUsd,
          response.portfolioOverview.coveragePct,
          JSON.stringify(response.warnings),
          JSON.stringify(response),
        ],
      );
      await client.query("DELETE FROM scan_bucket_metrics WHERE scan_id = $1", [scanId]);
      await client.query("DELETE FROM scan_recommendations WHERE scan_id = $1", [scanId]);

      for (const metric of response.bucketOverview) {
        await client.query(
          `INSERT INTO scan_bucket_metrics
           (scan_id, bucket, total_usd, weighted_risk, high_risk_pct, unknown_risk_pct, savings_score,
            positions_count, protocol_count, chain_count, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            scanId,
            metric.bucket,
            metric.totalUsd,
            metric.weightedRiskScore,
            metric.highRiskExposurePct ?? 0,
            metric.unknownRiskExposurePct ?? 0,
            metric.savingsScore,
            metric.positionCount,
            metric.protocolCount,
            metric.chainCount,
            JSON.stringify(metric),
          ],
        );
      }

      for (const recommendation of response.recommendations) {
        await client.query(
          `INSERT INTO scan_recommendations
           (scan_id, bucket, vault_symbol, score, strength, confidence, suggested_usd, payload_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            scanId,
            recommendation.bucket,
            recommendation.vaultSymbol,
            recommendation.score,
            recommendation.strength,
            recommendation.confidence,
            recommendation.suggestedUsd,
            JSON.stringify(recommendation),
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getScan(scanId: string): Promise<ScanResponse | null> {
    const result = await getDb().query<ScanRow>(
      "SELECT payload_json FROM scan_sessions WHERE id = $1 LIMIT 1",
      [scanId],
    );
    return result.rows[0]?.payload_json ?? null;
  }
}
