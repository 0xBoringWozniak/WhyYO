"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "../lib/wagmi";
import { YieldProvider } from "../lib/yo-sdk";

const queryClient = new QueryClient();

export const Providers = ({ children }: { children: ReactNode }) => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <YieldProvider>{children}</YieldProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
