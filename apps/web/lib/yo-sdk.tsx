"use client";

import * as React from "react";
import * as YoReact from "@yo-protocol/react";

type MaybeComponent = React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;

const yoModule = YoReact as unknown as Record<string, unknown>;

const fallbackHook = <T,>(value: T) => (): T => value;

export const YieldProvider =
  (yoModule.YieldProvider as MaybeComponent | undefined) ??
  (({ children }: React.PropsWithChildren) => <>{children}</>);

export const useYoVaults =
  ((options?: Record<string, unknown>) =>
    (
      yoModule.useVaults as
        | ((hookOptions?: Record<string, unknown>) => { vaults?: unknown[]; isLoading?: boolean; data?: unknown[] })
        | undefined
    )?.(options) ?? { vaults: [], data: [], isLoading: false });

export const useYoApprove =
  ((options?: Record<string, unknown>) =>
    (
      yoModule.useApprove as
        | ((hookOptions: Record<string, unknown>) => {
            approve?: (amount: bigint) => Promise<unknown>;
            approveMax?: () => Promise<unknown>;
            isLoading?: boolean;
            isPending?: boolean;
            hash?: string;
            error?: Error | null;
          })
        | undefined
    )?.(options ?? {}) ?? {});

export const useYoAllowance =
  ((token?: string, spender?: string, owner?: string, options?: Record<string, unknown>) =>
    (
      yoModule.useAllowance as
        | ((
            hookToken?: string,
            hookSpender?: string,
            hookOwner?: string,
            hookOptions?: Record<string, unknown>,
          ) => {
            allowance?: bigint;
            isLoading?: boolean;
            isError?: boolean;
            error?: Error | null;
            refetch?: () => Promise<unknown>;
          })
        | undefined
    )?.(token, spender, owner, options ?? {}) ?? { allowance: 0n, isLoading: false, isError: false, error: null });

export const useYoDeposit =
  ((options?: Record<string, unknown>) =>
    (
      yoModule.useDeposit as
        | ((hookOptions: Record<string, unknown>) => {
            deposit?: (args: Record<string, unknown>) => Promise<unknown>;
            isLoading?: boolean;
            isPending?: boolean;
            hash?: string;
            approveHash?: string;
            error?: Error | null;
          })
        | undefined
    )?.(options ?? {}) ?? {});
