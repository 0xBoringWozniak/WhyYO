"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { WALLET_SESSION_EVENT, isWalletReconnectEnabled, wagmiConfig } from "../lib/wagmi";
import { YieldProvider } from "../lib/yo-sdk";

const queryClient = new QueryClient();

export const Providers = ({ children }: { children: ReactNode }) => {
  const [reconnectOnMount, setReconnectOnMount] = React.useState(false);

  React.useEffect(() => {
    setReconnectOnMount(isWalletReconnectEnabled());

    const syncReconnectFlag = () => {
      setReconnectOnMount(isWalletReconnectEnabled());
    };

    window.addEventListener(WALLET_SESSION_EVENT, syncReconnectFlag);
    return () => window.removeEventListener(WALLET_SESSION_EVENT, syncReconnectFlag);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={reconnectOnMount}>
      <QueryClientProvider client={queryClient}>
        <YieldProvider>{children}</YieldProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
