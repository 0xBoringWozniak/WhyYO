"use client";

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

const chains = [base, mainnet, arbitrum, optimism, polygon] as const;
export const WALLET_SESSION_STORAGE_KEY = "whyyo.walletReconnectAllowed";
export const WALLET_SESSION_EVENT = "whyyo:wallet-session-change";

export const isWalletReconnectEnabled = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WALLET_SESSION_STORAGE_KEY) === "1";
};

export const setWalletReconnectEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(WALLET_SESSION_STORAGE_KEY, "1");
  } else {
    window.localStorage.removeItem(WALLET_SESSION_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(WALLET_SESSION_EVENT));
};

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [base.id]: http("https://base-rpc.publicnode.com"),
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
    [arbitrum.id]: http("https://arbitrum-one-rpc.publicnode.com"),
    [optimism.id]: http("https://optimism-rpc.publicnode.com"),
    [polygon.id]: http("https://polygon-bor-rpc.publicnode.com"),
  },
  ssr: false,
});
