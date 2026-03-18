import type { Pool } from "pg";

import { getDb } from "../db/pool";

const seed = [
  {
    canonicalName: "aave",
    strategyType: "lending",
    bucketHints: ["USD", "ETH", "BTC"],
    aliases: ["aave", "aave-v3", "aave v3"],
  },
  {
    canonicalName: "morpho",
    strategyType: "lending",
    bucketHints: ["USD", "ETH", "BTC"],
    aliases: ["morpho", "morpho blue"],
  },
  {
    canonicalName: "uniswap",
    strategyType: "dex_lp",
    bucketHints: ["USD", "ETH", "BTC"],
    aliases: ["uniswap", "uniswap v3"],
  },
  {
    canonicalName: "lido",
    strategyType: "staking",
    bucketHints: ["ETH"],
    aliases: ["lido", "lido eth staking"],
  },
  {
    canonicalName: "maple",
    strategyType: "synthetic_yield",
    bucketHints: ["USD"],
    aliases: ["maple", "maple usd yield"],
  },
] as const;

export const seedDevAliases = async (db: Pool = getDb()): Promise<number> => {
  for (const protocol of seed) {
    const protocolResult = await db.query<{ id: string }>(
      `INSERT INTO canonical_protocols (canonical_name, strategy_type_default, bucket_hints_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (canonical_name)
       DO UPDATE SET strategy_type_default = EXCLUDED.strategy_type_default,
                     bucket_hints_json = EXCLUDED.bucket_hints_json
       RETURNING id`,
      [protocol.canonicalName, protocol.strategyType, JSON.stringify(protocol.bucketHints)],
    );
    const protocolId = protocolResult.rows[0]?.id;
    if (!protocolId) {
      throw new Error(`Failed to upsert canonical protocol ${protocol.canonicalName}`);
    }
    for (const alias of protocol.aliases) {
      await db.query(
        `INSERT INTO protocol_aliases (canonical_protocol_id, alias, chain_nullable, confidence)
         VALUES ($1, $2, '', 0.9)
         ON CONFLICT (alias, chain_nullable)
         DO NOTHING`,
        [protocolId, alias],
      );
    }
  }

  return seed.length;
};
