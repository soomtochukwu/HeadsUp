"use client";
import "@rainbow-me/rainbowkit/styles.css";

import * as React from "react";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { type Chain } from "viem";

// Force specific chain definitions to match Wallet expectations (Prevents S-CELO errors)
const celoMainnet = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
} as const satisfies Chain;

const celoSepolia = {
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://sepolia.celoscan.io' },
  },
  testnet: true,
} as const satisfies Chain;

const config = getDefaultConfig({
  appName: "Flipen",
  projectId: "7b4405ad426eb6d4e981a8570a10337c",
  chains: [celoMainnet, celoSepolia],
  transports: {
    [celoMainnet.id]: http(),
    [celoSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

function ReferralTracker() {
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get("ref");
      // Basic validation for Ethereum address format
      if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
        localStorage.setItem("headsup_referrer", ref);
      }
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider
          initialChain={celoMainnet}
          theme={darkTheme({
            accentColor: "#DAA520",
            accentColorForeground: "white",
          })}
          modalSize="compact"
        >
          <ReferralTracker />
          {children}
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
