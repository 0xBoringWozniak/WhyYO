import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: Array<string | false | null | undefined>): string => twMerge(clsx(inputs));

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const formatPct = (value: number): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Math.abs(value) < 0.05 ? 0 : value)}%`;
