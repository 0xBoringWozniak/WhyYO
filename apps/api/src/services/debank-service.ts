import type { DebankUserBundle } from "@whyyo/integrations";
import { HttpClient, debankChainSchema, debankComplexProtocolSchema, debankSimpleProtocolSchema, debankTokenSchema, debankTotalBalanceSchema } from "@whyyo/integrations";

import { getEnv } from "../config/env";
import { getRedis } from "../db/redis";
import { withRedisCache } from "../utils/cache";

const debankAccessKey = getEnv().DEBANK_ACCESS_KEY;

export class DebankService {
  private readonly http = new HttpClient({
    baseUrl: getEnv().DEBANK_BASE_URL,
    ...(debankAccessKey
      ? {
          headers: {
            AccessKey: debankAccessKey,
          },
        }
      : {}),
    timeoutMs: getEnv().DEBANK_TIMEOUT_MS,
    retries: 2,
  });

  async fetchUserBundle(walletAddress: string): Promise<DebankUserBundle> {
    const redis = getRedis();
    return withRedisCache({
      redis,
      key: `debank:user:${walletAddress.toLowerCase()}`,
      ttlSec: getEnv().DEBANK_CACHE_TTL_SEC,
      load: async () => {
        if (!getEnv().DEBANK_ACCESS_KEY) {
          return {
            totalBalance: { total_usd_value: 0, chain_list: [] },
            usedChains: [],
            simpleProtocols: [],
            complexProtocols: [],
            tokens: [],
          };
        }

        const getWithFallback = async <T>(paths: string[]): Promise<T> => {
          let lastError: unknown;
          for (const path of paths) {
            try {
              return await this.http.get<T>(path);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError instanceof Error ? lastError : new Error("DeBank request failed");
        };

        const [totalBalanceRaw, usedChainsRaw, simpleProtocolsRaw, complexProtocolsRaw, tokensRaw] = await Promise.all([
          getWithFallback<unknown>([`/v1/user/total_balance?id=${walletAddress}`]),
          getWithFallback<unknown>([`/v1/user/used_chain_list?id=${walletAddress}`]),
          getWithFallback<unknown>([
            `/v1/user/all_simple_protocol_list?id=${walletAddress}`,
            `/v1/user/simple_protocol_list?id=${walletAddress}`,
          ]),
          getWithFallback<unknown>([
            `/v1/user/all_complex_protocol_list?id=${walletAddress}`,
            `/v1/user/complex_protocol_list?id=${walletAddress}`,
          ]),
          getWithFallback<unknown>([`/v1/user/all_token_list?id=${walletAddress}&is_all=true`]),
        ]);

        return {
          totalBalance: debankTotalBalanceSchema.parse(totalBalanceRaw),
          usedChains: debankChainSchema.array().parse(usedChainsRaw),
          simpleProtocols: debankSimpleProtocolSchema.array().parse(simpleProtocolsRaw),
          complexProtocols: debankComplexProtocolSchema.array().parse(complexProtocolsRaw),
          tokens: debankTokenSchema.array().parse(tokensRaw),
        };
      },
    });
  }
}
