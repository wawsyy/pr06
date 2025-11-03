"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useChainId } from "wagmi";

type UseBrowserEthersResult = {
  provider: ethers.BrowserProvider | undefined;
  signer: ethers.JsonRpcSigner | undefined;
  eip1193: ethers.Eip1193Provider | undefined;
};

export function useBrowserEthers(): UseBrowserEthersResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [provider, setProvider] = useState<ethers.BrowserProvider>();
  const [signer, setSigner] = useState<ethers.JsonRpcSigner>();

  const eip1193 = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return window.ethereum as unknown as ethers.Eip1193Provider | undefined;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      if (!eip1193 || !isConnected || !address) {
        setProvider(undefined);
        setSigner(undefined);
        return;
      }

      const browserProvider = new ethers.BrowserProvider(eip1193, chainId);
      if (!isMounted) return;
      setProvider(browserProvider);

      try {
        const signerInstance = await browserProvider.getSigner(address);
        if (isMounted) {
          setSigner(signerInstance);
        }
      } catch {
        if (isMounted) {
          setSigner(undefined);
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
    };
  }, [address, chainId, eip1193, isConnected]);

  return { provider, signer, eip1193 };
}

