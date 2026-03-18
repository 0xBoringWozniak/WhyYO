import type { PoolClient } from "pg";

import type { CanonicalBucket, CanonicalChain, StrategyType } from "@whyyo/shared";
import { toProtocolFamilyKey, type CanonicalProtocolCatalogEntry } from "@whyyo/domain";

import { getDb } from "../db/pool";

type ProtocolRow = {
  id: string;
  canonical_name: string;
  strategy_type_default: StrategyType;
  bucket_hints_json: CanonicalBucket[];
};

type AliasRow = {
  canonical_protocol_id: string;
  alias: string;
  chain_nullable: CanonicalChain | null;
};

const mapCatalog = (protocols: ProtocolRow[], aliases: AliasRow[]): CanonicalProtocolCatalogEntry[] =>
  protocols.map((protocol) => ({
    canonicalProtocolId: toProtocolFamilyKey(protocol.canonical_name),
    canonicalName: protocol.canonical_name,
    aliases: aliases
      .filter((alias) => alias.canonical_protocol_id === protocol.id)
      .map((alias) => alias.alias),
    defaultStrategyType: protocol.strategy_type_default,
    bucketHints: protocol.bucket_hints_json,
  }));

export class ProtocolRepository {
  async listCatalog(client?: PoolClient): Promise<CanonicalProtocolCatalogEntry[]> {
    const executor = client ?? getDb();
    const protocols = await executor.query<ProtocolRow>(
      "SELECT id, canonical_name, strategy_type_default, bucket_hints_json FROM canonical_protocols ORDER BY canonical_name ASC",
    );
    const aliases = await executor.query<AliasRow>(
      "SELECT canonical_protocol_id, alias, chain_nullable FROM protocol_aliases ORDER BY alias ASC",
    );
    return mapCatalog(protocols.rows, aliases.rows);
  }
}
