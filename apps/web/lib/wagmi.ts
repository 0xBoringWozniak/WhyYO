"use client";

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

const chains = [base, mainnet, arbitrum, optimism, polygon] as const;

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
