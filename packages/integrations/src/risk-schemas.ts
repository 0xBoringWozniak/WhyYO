import { z } from "zod";

export const riskDatasetAssetSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  parent_symbol: z.string().nullable(),
  logo: z.string().nullable().optional(),
  asset_funding_group_id: z.string().nullable(),
});

export const riskDatasetBlockchainSchema = z.object({
  id: z.string(),
  name: z.string(),
  image_url: z.string().nullable().optional(),
});

export const riskDatasetPoolSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  tvl: z.union([z.string(), z.number()]),
  risk: z.enum(["A", "B", "C", "D"]).catch("C"),
  yield: z.union([z.string(), z.number()]),
  assets: z.array(riskDatasetAssetSchema),
  blockchain: riskDatasetBlockchainSchema,
});

export const wrappedRiskDatasetSchema = z.object({
  code: z.string(),
  error: z.unknown().nullable(),
  data: z.object({
    pools: z.array(riskDatasetPoolSchema),
    yo_pools: z.array(riskDatasetPoolSchema),
    total_count: z.number(),
    count: z.number(),
  }),
});

export const flatRiskDatasetSchema = z.array(riskDatasetPoolSchema);

export const riskDatasetSchema = z.union([wrappedRiskDatasetSchema, flatRiskDatasetSchema]);

export type RiskDataset = z.infer<typeof wrappedRiskDatasetSchema>;
export type RiskDatasetInput = z.infer<typeof riskDatasetSchema>;

export const isYoPoolRecord = (pool: z.infer<typeof riskDatasetPoolSchema>): boolean => {
  const slug = pool.slug.toLowerCase();
  const title = pool.title.toLowerCase();
  const primarySymbol = pool.assets[0]?.symbol?.toLowerCase() ?? "";
  return (
    slug.includes("yield-optimizer") ||
    title.includes("yield optimizer") ||
    title.startsWith("yo ") ||
    primarySymbol.startsWith("yo")
  );
};

export const normalizeRiskDatasetInput = (input: RiskDatasetInput): RiskDataset => {
  if (Array.isArray(input)) {
    const yoPools = input.filter(isYoPoolRecord);
    const pools = input.filter((pool) => !isYoPoolRecord(pool));
    return {
      code: "1",
      error: null,
      data: {
        pools,
        yo_pools: yoPools,
        total_count: input.length,
        count: input.length,
      },
    };
  }
  return input;
};
