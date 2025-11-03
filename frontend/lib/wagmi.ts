import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import type { Chain } from "wagmi/chains";
import { hardhat, sepolia } from "wagmi/chains";

const LOCAL_RPC = process.env.NEXT_PUBLIC_LOCAL_RPC ?? "http://127.0.0.1:8545";
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID";

const hardhatChain: Chain = {
  ...hardhat,
  rpcUrls: {
    default: { http: [LOCAL_RPC] },
    public: { http: [LOCAL_RPC] },
  },
};

export const chains = [hardhatChain, sepolia] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Encrypted Lucky Draw",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains,
  transports: {
    [hardhatChain.id]: http(LOCAL_RPC),
    [sepolia.id]: http(),
  },
  ssr: true,
});

