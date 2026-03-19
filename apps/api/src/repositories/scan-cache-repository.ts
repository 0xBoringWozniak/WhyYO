import { scanResponseSchema, type ScanResponse } from "@whyyo/shared";

import { getEnv } from "../config/env";
import { getRedis } from "../db/redis";

const buildScanCacheKey = (walletAddress: string) => `scan:full:${walletAddress.toLowerCase()}`;

export class ScanCacheRepository {
  async get(walletAddress: string): Promise<ScanResponse | null> {
    const redis = getRedis();
    const normalizedWalletAddress = walletAddress.toLowerCase();
    const cacheKey = buildScanCacheKey(walletAddress);
    const cached = await redis.get(cacheKey);
    if (!cached) return null;

    try {
      const parsed = scanResponseSchema.parse(JSON.parse(cached));
      if (parsed.portfolioOverview.ownerAddress.toLowerCase() !== normalizedWalletAddress) {
        await redis.del(cacheKey);
        return null;
      }
      return parsed;
    } catch {
      await redis.del(cacheKey);
      return null;
    }
  }

  async set(walletAddress: string, response: ScanResponse): Promise<void> {
    const redis = getRedis();
    await redis.set(buildScanCacheKey(walletAddress), JSON.stringify(response), "EX", getEnv().SCAN_CACHE_TTL_SEC);
  }

  async clear(walletAddress: string): Promise<void> {
    const redis = getRedis();
    await redis.del(buildScanCacheKey(walletAddress));
  }
}
