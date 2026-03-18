import { z } from "zod";

export const debankChainSchema = z.object({
  id: z.string(),
  community_id: z.number().nullable().optional(),
  name: z.string(),
  native_token_id: z.string().nullable().optional(),
  born_at: z.number().nullable().optional(),
  logo_url: z.string().url().or(z.string()),
  wrapped_token_id: z.string().nullable().optional(),
  usd_value: z.number().optional(),
});

export const debankTotalBalanceSchema = z.object({
  total_usd_value: z.number(),
  chain_list: z.array(debankChainSchema),
});

export const debankSimpleProtocolSchema = z.object({
  id: z.string(),
  chain: z.string(),
  name: z.string(),
  site_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  has_supported_portfolio: z.boolean().optional(),
  tvl: z.number().nullable().optional(),
  net_usd_value: z.number(),
  asset_usd_value: z.number(),
  debt_usd_value: z.number(),
});

export const debankTokenSchema = z.object({
  id: z.string(),
  chain: z.string(),
  name: z.string(),
  symbol: z.string(),
  optimized_symbol: z.string().nullable().optional(),
  decimals: z.number(),
  logo_url: z.string().nullable().optional(),
  protocol_id: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  is_verified: z.boolean().nullable().optional(),
  is_core: z.boolean().nullable().optional(),
  is_wallet: z.boolean().nullable().optional(),
  time_at: z.number().nullable().optional(),
  amount: z.number(),
  raw_amount: z.union([z.number(), z.string()]).optional(),
});

export const debankPortfolioItemSchema = z.object({
  stats: z.object({
    asset_usd_value: z.number(),
    debt_usd_value: z.number(),
    net_usd_value: z.number(),
  }),
  update_at: z.number().nullable().optional(),
  name: z.string(),
  detail_types: z.array(z.string()).default([]),
  detail: z.object({
    supply_token_list: z.array(debankTokenSchema).default([]).optional(),
    borrow_token_list: z.array(debankTokenSchema).default([]).optional(),
    reward_token_list: z.array(debankTokenSchema).default([]).optional(),
  }),
  proxy_detail: z.record(z.string(), z.unknown()).default({}),
});

export const debankComplexProtocolSchema = z.object({
  id: z.string(),
  chain: z.string(),
  name: z.string(),
  site_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  has_supported_portfolio: z.boolean().optional(),
  tvl: z.number().nullable().optional(),
  portfolio_item_list: z.array(debankPortfolioItemSchema),
});

export const debankSpenderSchema = z.object({
  id: z.string(),
  value: z.union([z.number(), z.string()]),
  exposure_usd: z.number(),
  protocol: z
    .object({
      id: z.string(),
      name: z.string(),
      logo_url: z.string().nullable().optional(),
      chain: z.string(),
    })
    .nullable(),
  is_contract: z.boolean().optional(),
  is_open_source: z.boolean().optional(),
  is_hacked: z.boolean().optional(),
  is_abandoned: z.boolean().optional(),
});

export const debankTokenAuthorizedSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  chain: z.string(),
  price: z.number().nullable().optional(),
  balance: z.number().nullable().optional(),
  spenders: z.array(debankSpenderSchema),
  sum_exposure_usd: z.number(),
  exposure_balance: z.number().nullable().optional(),
});

export const debankUserBundleSchema = z.object({
  totalBalance: debankTotalBalanceSchema,
  usedChains: z.array(debankChainSchema),
  simpleProtocols: z.array(debankSimpleProtocolSchema),
  complexProtocols: z.array(debankComplexProtocolSchema),
  tokens: z.array(debankTokenSchema),
});

export type DebankUserBundle = z.infer<typeof debankUserBundleSchema>;
