import {
  BTC_SYMBOLS,
  CHAIN_ID_MAP,
  ETH_SYMBOLS,
  RISK_GRADE_TO_SCORE,
  USD_SYMBOLS,
} from "@whyyo/shared";
import type { CanonicalBucket, CanonicalChain, RiskGrade, StrategyType } from "@whyyo/shared";

const CHAIN_PREFIX_TOKENS = new Set([
  "eth",
  "ethereum",
  "base",
  "arb",
  "arbitrum",
  "op",
  "optimism",
  "polygon",
  "matic",
  "bsc",
  "binance",
  "avax",
  "avalanche",
  "sol",
  "solana",
  "tron",
]);

const PROTOCOL_SUFFIX_TOKENS = new Set([
  "app",
  "dao",
  "finance",
  "fi",
  "labs",
  "market",
  "markets",
  "network",
  "networks",
  "protocol",
  "protocols",
  "xyz",
]);

const PROMOTIONAL_SYMBOL_PATTERN =
  /(https?|www\.|t\.me|telegram|claim|visit|reward|rewards|redeem|airdrop|bonus|gift|pool|swap|bridge)/i;

const STABLE_BUCKET_PATTERN =
  /^(?:[A-Z0-9]{0,12})?(?:USD|USDC|USDT|USDE|USDS|USD0|USDT0|DAI|TUSD|FDUSD|PYUSD|LUSD|SUSD|CRVUSD|FRAX|GHO|USDB|USDX)(?:[A-Z0-9]{0,8})?$/;

const ETH_BUCKET_PATTERN =
  /^(?:W|ST|WST|WE|RS|CB|M|R|S|P|LB|IB|YO)?(?:ETH|WETH)$/;

const BTC_BUCKET_PATTERN =
  /^(?:W|LB|SOLV|T|CB|M|S|YO)?(?:BTC|WBTC|TBTC|CBBTC)$/;

const BTC_ALIAS_PATTERN = /(SOLVBTC|LBTC|WBTC|TBTC|CBBTC|BTCB)/;

const CONFUSABLE_MAP: Record<string, string> = {
  "А": "A",
  "В": "B",
  "С": "C",
  "Е": "E",
  "Н": "H",
  "К": "K",
  "М": "M",
  "О": "O",
  "Р": "P",
  "Т": "T",
  "Х": "X",
  "а": "a",
  "е": "e",
  "о": "o",
  "р": "p",
  "с": "c",
  "х": "x",
  "і": "i",
  "Ι": "I",
  "Ѕ": "S",
  "ѕ": "s",
  "Ҭ": "T",
  "ꓢ": "S",
  "ᗞ": "D",
  "₮": "T",
};

export const normalizeString = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeChain = (chain: string | null | undefined): CanonicalChain => {
  if (!chain) return "other";
  return CHAIN_ID_MAP[normalizeString(chain)] ?? "other";
};

export const normalizeTickerSymbol = (value?: string | null): string => {
  if (!value) return "";
  const folded = Array.from(value.normalize("NFKD"))
    .map((char) => CONFUSABLE_MAP[char] ?? char)
    .join("");

  return folded
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

const tokenizeProtocolFamily = (value: string): string[] =>
  normalizeString(value)
    .replace(/([a-z])([0-9]+)/g, "$1 $2")
    .replace(/([0-9]+)([a-z])/g, "$1 $2")
    .split(/[\s-]+/)
    .filter(Boolean);

const stripLeadingChainToken = (tokens: string[]): string[] => {
  if (tokens.length <= 1) return tokens;
  return CHAIN_PREFIX_TOKENS.has(tokens[0]!) ? tokens.slice(1) : tokens;
};

const stripTrailingProtocolTokens = (tokens: string[]): string[] => {
  const output = [...tokens];
  while (output.length > 0) {
    const last = output[output.length - 1]!;
    if (output.length > 1 && (/^v?\d+$/.test(last) || PROTOCOL_SUFFIX_TOKENS.has(last))) {
      output.pop();
      continue;
    }
    const stripped = last.replace(/(protocols?|finance|markets?|networks?|labs|dao|app|xyz|fi)$/g, "");
    if (stripped !== last && stripped.length >= 2) {
      output[output.length - 1] = stripped;
      continue;
    }
    break;
  }
  return output;
};

const toSnakeCase = (tokens: string[]): string => tokens.filter(Boolean).join("_");

export const buildProtocolFamilyKeys = (...values: Array<string | null | undefined>): string[] => {
  const candidates = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const rawTokens = tokenizeProtocolFamily(value);
    if (rawTokens.length === 0) continue;

    const variants = [
      stripTrailingProtocolTokens(stripLeadingChainToken(rawTokens)),
      stripLeadingChainToken(rawTokens),
      stripTrailingProtocolTokens(rawTokens),
      rawTokens,
    ];

    for (const variant of variants) {
      const key = toSnakeCase(variant);
      if (key) candidates.add(key);
    }
  }

  return [...candidates];
};

export const toProtocolFamilyKey = (...values: Array<string | null | undefined>): string => {
  const [primary] = buildProtocolFamilyKeys(...values);
  return primary ?? "unknown";
};

export const inferBucketFromSymbol = (
  symbol?: string | null,
  parentSymbol?: string | null,
): CanonicalBucket => {
  const rawSymbol = symbol ?? "";
  const rawParent = parentSymbol ?? "";

  if (PROMOTIONAL_SYMBOL_PATTERN.test(rawSymbol) || PROMOTIONAL_SYMBOL_PATTERN.test(rawParent)) {
    return "OTHER";
  }

  const normalizedParent = normalizeTickerSymbol(rawParent);
  const normalizedSymbol = normalizeTickerSymbol(rawSymbol);

  if (
    normalizedParent === "USD" ||
    USD_SYMBOLS.has(normalizedSymbol) ||
    USD_SYMBOLS.has(normalizedParent) ||
    STABLE_BUCKET_PATTERN.test(normalizedSymbol) ||
    STABLE_BUCKET_PATTERN.test(normalizedParent)
  ) {
    return "USD";
  }
  if (
    normalizedParent === "ETH" ||
    ETH_SYMBOLS.has(normalizedSymbol) ||
    ETH_SYMBOLS.has(normalizedParent) ||
    ETH_BUCKET_PATTERN.test(normalizedSymbol) ||
    ETH_BUCKET_PATTERN.test(normalizedParent)
  ) {
    return "ETH";
  }
  if (
    normalizedParent === "BTC" ||
    BTC_SYMBOLS.has(normalizedSymbol) ||
    BTC_SYMBOLS.has(normalizedParent) ||
    BTC_ALIAS_PATTERN.test(normalizedSymbol) ||
    BTC_ALIAS_PATTERN.test(normalizedParent) ||
    BTC_BUCKET_PATTERN.test(normalizedSymbol) ||
    BTC_BUCKET_PATTERN.test(normalizedParent)
  ) {
    return "BTC";
  }
  return "OTHER";
};

export const inferStrategyType = (name: string, slug?: string | null, bucket?: CanonicalBucket): StrategyType => {
  const haystack = normalizeString(`${name} ${slug ?? ""}`);
  if (haystack.includes("yield optimizer") || haystack.includes("yo")) return "vault";
  if (haystack.includes("restaking") || haystack.includes("eigen") || haystack.includes("etherfi") || haystack.includes("kelp")) {
    return "restaking";
  }
  if (haystack.includes("staking")) return "staking";
  if (haystack.includes("lending") || haystack.includes("aave") || haystack.includes("compound") || haystack.includes("morpho")) {
    return "lending";
  }
  if (
    haystack.includes("uniswap") ||
    haystack.includes("aerodrome") ||
    haystack.includes("amm") ||
    haystack.includes(" dex") ||
    haystack.includes(" lp") ||
    haystack.endsWith("lp")
  ) {
    return "dex_lp";
  }
  if (haystack.includes("basis") || haystack.includes("carry")) return "basis_trade";
  if (haystack.includes("yield") && bucket === "USD") return "synthetic_yield";
  if (haystack.includes("wallet") || haystack.includes("idle") || haystack.includes("spot")) return "spot_idle";
  return "unknown";
};

export const riskGradeToScore = (grade: RiskGrade): number => RISK_GRADE_TO_SCORE[grade];

export const riskScoreToGrade = (score: number): RiskGrade => {
  if (score <= 1.5) return "A";
  if (score <= 2.5) return "B";
  if (score <= 3.5) return "C";
  if (score <= 4) return "D";
  return "UNKNOWN";
};
