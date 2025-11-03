"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useChainId } from "wagmi";

import { FHECounterABI } from "@/abi/FHECounterABI";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useFhevm } from "@/fhevm/useFhevm";
import { useBrowserEthers } from "@/hooks/useBrowserEthers";
import { useFHECounter } from "@/hooks/useFHECounter";

const MOCK_CHAINS = { 31337: "http://127.0.0.1:8545" };

function formatClearValue(value?: string | bigint | boolean) {
  if (value === undefined) {
    return "Not decrypted";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

export function FHECounterDemo() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { storage } = useInMemoryStorage();
  const { provider, signer, eip1193 } = useBrowserEthers();

  const { instance, error: fhevmError } = useFhevm({
    provider: eip1193,
    chainId,
    initialMockChains: MOCK_CHAINS,
    enabled: Boolean(eip1193),
  });

  const sameChainRef = useRef<(target: number | undefined) => boolean>(() => false);
  useEffect(() => {
    sameChainRef.current = (target) => target === chainId;
  }, [chainId]);

  const sameSignerRef = useRef<(candidate: ethers.JsonRpcSigner | undefined) => boolean>(() => false);
  useEffect(() => {
    sameSignerRef.current = (candidate) => {
      if (!candidate || !signer) {
        return false;
      }
      try {
        return candidate.address?.toLowerCase() === signer.address?.toLowerCase();
      } catch {
        return false;
      }
    };
  }, [signer]);

  const fheCounter = useFHECounter({
    instance,
    fhevmDecryptionSignatureStorage: storage,
    eip1193Provider: eip1193,
    chainId,
    ethersSigner: signer,
    ethersReadonlyProvider: provider,
    sameChain: sameChainRef,
    sameSigner: sameSignerRef,
  });

  const [inputValue, setInputValue] = useState("1");
  const [isResetting, setIsResetting] = useState(false);

  const parsedInput = useMemo(() => {
    const parsed = Number(inputValue);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
      return undefined;
    }
    return parsed;
  }, [inputValue]);

  const handleIncrement = () => {
    if (parsedInput === undefined) {
      return;
    }
    fheCounter.incOrDec(parsedInput);
  };

  const handleDecrement = () => {
    if (parsedInput === undefined) {
      return;
    }
    fheCounter.incOrDec(-parsedInput);
  };

  const handleReset = async () => {
    if (!signer || !fheCounter.contractAddress) {
      return;
    }
    try {
      setIsResetting(true);
      const contract = new ethers.Contract(
        fheCounter.contractAddress,
        FHECounterABI.abi,
        signer
      );
      const tx = await contract.reset();
      await tx.wait();
      fheCounter.refreshCountHandle();
    } catch (error) {
      console.error("Failed to reset counter", error);
    } finally {
      setIsResetting(false);
    }
  };

  const disableActions = !isConnected || !fheCounter.isDeployed;

  return (
    <article className="card-surface flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">FHE Counter Demo</h3>
          <p className="text-sm text-slate-500">
            Increment and decrement an encrypted counter using fully homomorphic encryption.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-600">
          Encrypted
        </span>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-6 py-4">
          <span className="text-sm font-medium text-slate-500">Current Count</span>
          <span className="text-2xl font-bold text-slate-900">
            {formatClearValue(fheCounter.clear)}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-600" htmlFor="counter-value">
            Value to add/subtract
          </label>
          <input
            id="counter-value"
            type="number"
            min={1}
            max={1000}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-indigo-400 focus:outline-none"
            placeholder="Enter value (1-1000)"
            disabled={disableActions}
          />
          {parsedInput === undefined && (
            <p className="text-sm text-rose-500">Enter an integer between 1 and 1,000.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-60"
            onClick={handleIncrement}
            disabled={
              disableActions ||
              parsedInput === undefined ||
              !fheCounter.canIncOrDec ||
              fheCounter.isIncOrDec
            }
          >
            {fheCounter.isIncOrDec ? "Processing..." : `+${inputValue || 1}`}
          </button>

          <button
            type="button"
            className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-amber-600 disabled:opacity-60"
            onClick={handleDecrement}
            disabled={
              disableActions ||
              parsedInput === undefined ||
              !fheCounter.canIncOrDec ||
              fheCounter.isIncOrDec
            }
          >
            {fheCounter.isIncOrDec ? "Processing..." : `-${inputValue || 1}`}
          </button>

          <button
            type="button"
            className="rounded-2xl bg-slate-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 disabled:opacity-60"
            onClick={handleReset}
            disabled={disableActions || !signer || !fheCounter.contractAddress || isResetting}
          >
            {isResetting ? "Resetting..." : "Reset to 0"}
          </button>

          <button
            type="button"
            className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60"
            onClick={fheCounter.decryptCountHandle}
            disabled={disableActions || !fheCounter.canDecrypt || fheCounter.isDecrypting}
          >
            {fheCounter.isDecrypting ? "Decrypting..." : "Decrypt Count"}
          </button>

          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            onClick={fheCounter.refreshCountHandle}
            disabled={fheCounter.isRefreshing}
          >
            {fheCounter.isRefreshing ? "Refreshing..." : "Refresh Count"}
          </button>
        </div>

        {fhevmError && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {fhevmError.message}
          </p>
        )}

        {fheCounter.message && (
          <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {fheCounter.message}
          </p>
        )}

        {!isConnected && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Connect your wallet to interact with the encrypted counter.
          </p>
        )}
      </div>
    </article>
  );
}

