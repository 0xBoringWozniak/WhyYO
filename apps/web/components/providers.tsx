"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { WALLET_SESSION_EVENT, isWalletReconnectEnabled, wagmiConfig } from "../lib/wagmi";
import { YieldProvider } from "../lib/yo-sdk";

const queryClient = new QueryClient();
const isWalletAddressPath = (pathname: string | null) => /^\/0x[a-fA-F0-9]{40}$/.test(pathname ?? "");

export const Providers = ({ children }: { children: ReactNode }) => {
  const [reconnectOnMount, setReconnectOnMount] = React.useState(false);

  React.useEffect(() => {
    const getAllowReconnectForRoute = () => {
      const { pathname, search } = window.location;
      const searchParams = new URLSearchParams(search);
      const resumeParam = searchParams.get("resume");
      const connectParam = searchParams.get("connect");

      return (!isWalletAddressPath(pathname) && pathname !== "/") || (resumeParam === "1" && connectParam !== "1");
    };

    const syncReconnectFlag = () => {
      setReconnectOnMount(isWalletReconnectEnabled() && getAllowReconnectForRoute());
    };

    syncReconnectFlag();
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
