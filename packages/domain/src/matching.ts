import type { CanonicalBucket, CanonicalChain, StrategyType } from "@whyyo/shared";

import {
  buildProtocolFamilyKeys,
  inferBucketFromSymbol,
  inferStrategyType,
  normalizeChain,
  normalizeString,
  toProtocolFamilyKey,
} from "./normalization";

export type CanonicalProtocolCatalogEntry = {
  canonicalProtocolId: string;
  canonicalName: string;
  aliases: string[];
  defaultStrategyType: StrategyType;
  bucketHints?: CanonicalBucket[];
  chain?: CanonicalChain;
};

export type ProtocolMatchResult = {
  canonicalProtocolId: string;
  canonicalProtocolName: string;
  matchingConfidence: number;
  strategyType: StrategyType;
  bucket: CanonicalBucket;
};

export const matchCanonicalProtocol = ({
  originalProtocolId,
  originalProtocolName,
  chain,
  slug,
  title,
  symbol,
  parentSymbol,
  catalog,
}: {
  originalProtocolId?: string | null;
  originalProtocolName?: string | null;
  chain?: string | null;
  slug?: string | null;
  title?: string | null;
  symbol?: string | null;
  parentSymbol?: string | null;
  catalog: CanonicalProtocolCatalogEntry[];
}): ProtocolMatchResult => {
  const bucket = inferBucketFromSymbol(symbol, parentSymbol);
  const canonicalChain = normalizeChain(chain);
  const rawCandidates = [originalProtocolId, originalProtocolName, slug, title].filter(
    (value): value is string => Boolean(value),
  );
  const candidates = rawCandidates.map((value) => normalizeString(value)).filter(Boolean);
  const candidateKeys = buildProtocolFamilyKeys(...rawCandidates);

  for (const entry of catalog) {
    const normalizedAliases = [entry.canonicalProtocolId, entry.canonicalName, ...entry.aliases].map(normalizeString);
    const aliasKeys = buildProtocolFamilyKeys(entry.canonicalProtocolId, entry.canonicalName, ...entry.aliases);
    if (
      (candidates.some((candidate) => normalizedAliases.includes(candidate)) ||
        candidateKeys.some((candidate) => aliasKeys.includes(candidate))) &&
      (!entry.chain || entry.chain === canonicalChain)
    ) {
      return {
        canonicalProtocolId: entry.canonicalProtocolId,
        canonicalProtocolName: entry.canonicalName,
        matchingConfidence: 0.9,
        strategyType: entry.defaultStrategyType,
        bucket,
      };
    }
  }

  const strategyType = inferStrategyType(`${originalProtocolName ?? ""} ${title ?? ""}`, slug, bucket);
  return {
    canonicalProtocolId: toProtocolFamilyKey(originalProtocolId, originalProtocolName, slug, title),
    canonicalProtocolName: title ?? originalProtocolName ?? "Unknown",
    matchingConfidence: candidates.some(Boolean) ? 0.75 : 0.5,
    strategyType,
    bucket,
  };
};
