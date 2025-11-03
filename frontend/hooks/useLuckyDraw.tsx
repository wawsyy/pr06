"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useChainId } from "wagmi";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { EncryptedLuckyDrawABI } from "@/abi/EncryptedLuckyDrawABI";
import { EncryptedLuckyDrawAddresses } from "@/abi/EncryptedLuckyDrawAddresses";

type UseLuckyDrawParams = {
  instance: FhevmInstance | undefined;
  storage: GenericStringStorage;
  provider: ethers.BrowserProvider | undefined;
  signer: ethers.JsonRpcSigner | undefined;
};

type LuckyDrawState = {
  contractAddress?: `0x${string}`;
  isDeployed: boolean;
  participantCount: number | undefined;
  maxParticipants: number | undefined;
  lastDrawTimestamp: number | undefined;
  admin: string | undefined;
  winnerHandle?: string;
  myIdHandle?: string;
  myWinHandle?: string;
  isRegistered: boolean;
};

const ZERO_HASH = ethers.ZeroHash;

function isUserRejectedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const codePaths = [
    (error as { code?: string | number }).code,
    (error as { error?: { code?: string | number } }).error?.code,
    (error as { info?: { error?: { code?: string | number } } }).info?.error?.code,
  ];

  return codePaths.some((code) => code === 4001 || code === "ACTION_REJECTED");
}

function isAuthorizationError(error: unknown, handle?: string): boolean {
  if (!error) return false;
  const message = String(
    (error as { message?: string }).message ??
      (error as { error?: { message?: string } }).error?.message ??
      error,
  );

  const lowered = message.toLowerCase();
  if (lowered.includes("not authorized")) {
    if (handle) {
      return lowered.includes(handle.toLowerCase());
    }
    return true;
  }
  return false;
}

function getDeploymentByChainId(chainId: number | undefined) {
  if (chainId === undefined) {
    return undefined;
  }

  const entry =
    EncryptedLuckyDrawAddresses[
      chainId.toString() as keyof typeof EncryptedLuckyDrawAddresses
    ];

  if (!entry || !("address" in entry)) {
    return undefined;
  }

  return entry as {
    address: `0x${string}`;
    chainId: number;
    chainName: string;
  };
}

export function useLuckyDraw({
  instance,
  storage,
  provider,
  signer,
}: UseLuckyDrawParams) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [state, setState] = useState<LuckyDrawState>({
    isDeployed: false,
    participantCount: undefined,
    maxParticipants: undefined,
    lastDrawTimestamp: undefined,
    admin: undefined,
    contractAddress: undefined,
    winnerHandle: undefined,
    myIdHandle: undefined,
    myWinHandle: undefined,
    isRegistered: false,
  });

  const [message, setMessage] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDecryptingWinner, setIsDecryptingWinner] = useState(false);
  const [isDecryptingStatus, setIsDecryptingStatus] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [decryptedWinner, setDecryptedWinner] = useState<number | undefined>(
    undefined,
  );
  const [decryptedStatus, setDecryptedStatus] = useState<boolean | undefined>(
    undefined,
  );
  const [decryptedId, setDecryptedId] = useState<number | undefined>(undefined);

  const contractInfo = useMemo(
    () => getDeploymentByChainId(chainId),
    [chainId],
  );

  const canUseContract = Boolean(
    contractInfo?.address && contractInfo.address !== ethers.ZeroAddress,
  );

  const contractRef = useRef<ethers.Contract | null>(null);

  const getReadonlyContract = useCallback(() => {
    if (!contractInfo?.address) {
      return null;
    }
    if (contractRef.current && contractRef.current.target === contractInfo.address) {
      return contractRef.current;
    }
    const runner = signer ?? provider;
    if (!runner) {
      return null;
    }
    const contract = new ethers.Contract(
      contractInfo.address,
      EncryptedLuckyDrawABI.abi,
      runner,
    );
    contractRef.current = contract;
    return contract;
  }, [contractInfo?.address, provider, signer]);

  const refresh = useCallback(async () => {
    if (!canUseContract) {
      setState((prev) => ({
        ...prev,
        contractAddress: undefined,
        isDeployed: false,
        participantCount: undefined,
        maxParticipants: undefined,
        admin: undefined,
        winnerHandle: undefined,
        myIdHandle: undefined,
        myWinHandle: undefined,
        isRegistered: false,
      }));
      return;
    }

    const contract = getReadonlyContract();
    if (!contract) {
      return;
    }

    setIsRefreshing(true);
    setMessage("Refreshing encrypted lucky draw state...");

    try {
      const [participants, maxParticipants, adminAddress, winner, timestamp] = await Promise.all([
        contract.participantCount(),
        contract.maxParticipants(),
        contract.admin(),
        contract.getEncryptedWinnerIndex(),
        contract.lastDrawTimestamp(),
      ]);

      let myId: string | undefined;
      let myWin: string | undefined;
      let registered = false;
      if (address) {
        registered = await contract.isRegistered(address);

        if (registered) {
          [myId, myWin] = await Promise.all([
            contract.getEncryptedId(address),
            contract.getEncryptedWinStatus(address),
          ]);
        }
      }

      setState({
        contractAddress: contractInfo?.address,
        isDeployed: true,
        participantCount: Number(participants),
        maxParticipants: Number(maxParticipants),
        lastDrawTimestamp: Number(timestamp),
        admin: adminAddress,
        winnerHandle: winner,
        myIdHandle: myId,
        myWinHandle: myWin,
        isRegistered: registered,
      });
      setMessage("State refreshed.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to refresh lucky draw state.");
    } finally {
      setIsRefreshing(false);
    }
  }, [address, canUseContract, contractInfo?.address, getReadonlyContract]);

  const requireSigner = useCallback(() => {
    if (!signer || !address) {
      throw new Error("Connect wallet to continue.");
    }
    if (!state.contractAddress) {
      throw new Error("Contract not deployed on this network.");
    }
    if (!instance) {
      throw new Error("FHEVM instance not ready.");
    }
  }, [address, instance, signer, state.contractAddress]);

  const register = useCallback(
    async (clearId: number) => {
      requireSigner();
      if (!instance || !signer || !state.contractAddress) {
        return;
      }

      setIsRegistering(true);
      setMessage("Preparing encrypted registration...");

      try {
        const input = instance.createEncryptedInput(
          state.contractAddress,
          signer.address,
        );
        input.add32(clearId);
        const encrypted = await input.encrypt();
        const contract = new ethers.Contract(
          state.contractAddress,
          EncryptedLuckyDrawABI.abi,
          signer,
        );

        const tx = await contract.register(
          encrypted.handles[0],
          encrypted.inputProof,
        );
        await tx.wait();
        setMessage("Registration successful. Refreshing state...");
        await refresh();
      } catch (error) {
        if (isUserRejectedError(error)) {
          setMessage("Registration cancelled in wallet.");
        } else {
          console.error(error);
          setMessage("Registration failed.");
        }
      } finally {
        setIsRegistering(false);
      }
    },
    [instance, refresh, requireSigner, signer, state.contractAddress],
  );

  const decryptWinner = useCallback(async () => {
    requireSigner();
    if (!state.winnerHandle || state.winnerHandle === ZERO_HASH) {
      setMessage("No draw has been executed yet.");
      return;
    }
    if (!instance || !state.contractAddress || !signer) {
      return;
    }

    setIsDecryptingWinner(true);
    setMessage("Decrypting winner index...");

    try {
      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [state.contractAddress],
        signer,
        storage,
      );
      if (!signature) {
        throw new Error("Unable to generate decryption signature.");
      }

      const decrypted = await instance.userDecrypt(
        [
          {
            handle: state.winnerHandle,
            contractAddress: state.contractAddress,
          },
        ],
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays,
      );

      const value = decrypted[state.winnerHandle];
      const numericValue =
        typeof value === "bigint"
          ? Number(value)
          : typeof value === "number"
            ? value
            : Number(value ?? 0);
      setDecryptedWinner(numericValue);
      setMessage("Winner index decrypted locally.");
    } catch (error) {
      if (isAuthorizationError(error, state.winnerHandle)) {
        setMessage("You don't have permission to decrypt the winner.");
      } else {
        console.error(error);
        setMessage("Failed to decrypt winner index.");
      }
    } finally {
      setIsDecryptingWinner(false);
    }
  }, [instance, requireSigner, signer, state.contractAddress, state.winnerHandle, storage]);

  const decryptMyId = useCallback(async () => {
    requireSigner();
    if (!state.myIdHandle || state.myIdHandle === ZERO_HASH) {
      setMessage("No encrypted identifier found for your address.");
      return;
    }
    if (!instance || !state.contractAddress || !signer) {
      return;
    }

    setMessage("Decrypting your participant ID...");

    try {
      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [state.contractAddress],
        signer,
        storage,
      );
      if (!signature) {
        throw new Error("Unable to generate decryption signature.");
      }

      const decrypted = await instance.userDecrypt(
        [
          {
            handle: state.myIdHandle,
            contractAddress: state.contractAddress,
          },
        ],
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays,
      );

      const value = decrypted[state.myIdHandle];
      const numericValue =
        typeof value === "bigint"
          ? Number(value)
          : typeof value === "number"
            ? value
            : Number(value ?? 0);

      setDecryptedId(numericValue);
      setMessage("Encrypted identifier decrypted locally.");
    } catch (error) {
      if (isAuthorizationError(error, state.myIdHandle)) {
        setMessage("You can only decrypt IDs you submitted with this wallet.");
      } else {
        console.error(error);
        setMessage("Failed to decrypt identifier.");
      }
    }
  }, [instance, requireSigner, signer, state.contractAddress, state.myIdHandle, storage]);

  const decryptMyStatus = useCallback(async () => {
    requireSigner();
    if (!state.myWinHandle || state.myWinHandle === ZERO_HASH) {
      setMessage("No encrypted draw result yet.");
      return;
    }
    if (!instance || !state.contractAddress || !signer) {
      return;
    }

    setIsDecryptingStatus(true);
    setMessage("Decrypting your lottery result...");

    try {
      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [state.contractAddress],
        signer,
        storage,
      );
      if (!signature) {
        throw new Error("Unable to generate decryption signature.");
      }

      const decrypted = await instance.userDecrypt(
        [
          {
            handle: state.myWinHandle,
            contractAddress: state.contractAddress,
          },
        ],
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays,
      );

      const value = decrypted[state.myWinHandle];
      const boolValue =
        typeof value === "boolean"
          ? value
          : typeof value === "bigint"
            ? value === BigInt(1)
            : Boolean(Number(value ?? 0));

      setDecryptedStatus(boolValue);
      setMessage("Draw result decrypted locally.");
    } catch (error) {
      if (isAuthorizationError(error, state.myWinHandle)) {
        setMessage("You can only decrypt your own latest result with this wallet.");
      } else {
        console.error(error);
        setMessage("Failed to decrypt draw result.");
      }
    } finally {
      setIsDecryptingStatus(false);
    }
  }, [instance, requireSigner, signer, state.contractAddress, state.myWinHandle, storage]);

  const drawWinner = useCallback(async () => {
    requireSigner();
    if (!signer || !state.contractAddress) {
      return;
    }
    if (address?.toLowerCase() !== state.admin?.toLowerCase()) {
      setMessage("Only the administrator can trigger a lucky draw.");
      return;
    }

    setIsDrawing(true);
    setMessage("Triggering encrypted lucky draw...");

    try {
      const contract = new ethers.Contract(
        state.contractAddress,
        EncryptedLuckyDrawABI.abi,
        signer,
      );
      const tx = await contract.drawWinner();
      await tx.wait();
      setMessage("Lucky draw executed. Refreshing state...");
      await refresh();
    } catch (error) {
      if (isUserRejectedError(error)) {
        setMessage("Lucky draw cancelled in wallet.");
      } else {
        console.error(error);
        setMessage("Failed to execute lucky draw.");
      }
    } finally {
      setIsDrawing(false);
    }
  }, [address, refresh, requireSigner, signer, state.admin, state.contractAddress]);

  return {
    state,
    refresh,
    register,
    decryptWinner,
    decryptMyStatus,
    decryptMyId,
    drawWinner,
    message,
    isRefreshing,
    isRegistering,
    isDecryptingWinner,
    isDecryptingStatus,
    isDrawing,
    decryptedWinner,
    decryptedStatus,
    decryptedId,
    canUseContract,
    isConnected,
  };
}


