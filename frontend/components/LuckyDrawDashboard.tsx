"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { formatDistanceToNowStrict, fromUnixTime } from "date-fns";

import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useFhevm } from "@/fhevm/useFhevm";
import { useBrowserEthers } from "@/hooks/useBrowserEthers";
import { useLuckyDraw } from "@/hooks/useLuckyDraw";

const MOCK_CHAINS = { 31337: "http://127.0.0.1:8545" };

export function LuckyDrawDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { storage } = useInMemoryStorage();
  const { provider, signer, eip1193 } = useBrowserEthers();

  const {
    instance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: eip1193,
    chainId,
    initialMockChains: MOCK_CHAINS,
    enabled: Boolean(eip1193),
  });

  const luckyDraw = useLuckyDraw({
    instance,
    storage,
    provider,
    signer,
  });

  const [idInput, setIdInput] = useState<string>("");
  const [idError, setIdError] = useState<string | undefined>(undefined);

  const { refresh, canUseContract } = luckyDraw;

  const friendlyFhevmError = useMemo(() => {
    if (!fhevmError) {
      return undefined;
    }
    const raw = fhevmError.message ?? "";
    if (raw.includes("Result::unwrap_throw")) {
      return "FHE 执行环境正在恢复，请稍后点击 Refresh 再试。";
    }
    return "FHE 执行环境暂不可用，请刷新页面或重新连接钱包。";
  }, [fhevmError]);

  useEffect(() => {
    if (canUseContract && (signer || provider)) {
      refresh();
    }
  }, [canUseContract, refresh, provider, signer]);

  const lastDrawRelative = useMemo(() => {
    if (!luckyDraw.state.lastDrawTimestamp || luckyDraw.state.lastDrawTimestamp === 0) {
      return "Never";
    }
    const date = fromUnixTime(luckyDraw.state.lastDrawTimestamp);
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }, [luckyDraw.state.lastDrawTimestamp]);

  const isAdmin =
    address &&
    luckyDraw.state.admin &&
    address.toLowerCase() === luckyDraw.state.admin.toLowerCase();

  const handleRegister = async () => {
    if (!idInput) {
      setIdError("Please enter a numeric participant ID.");
      return;
    }
    const parsed = Number(idInput);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2 ** 32 - 1) {
      setIdError("ID must be an integer between 0 and 4,294,967,295.");
      return;
    }
    setIdError(undefined);
    await luckyDraw.register(parsed);
    setIdInput("");
  };

  const disableActions = !isConnected || !luckyDraw.canUseContract;

  return (
    <div className="flex flex-col gap-8">
      <section className="card-surface flex flex-col gap-6 p-8 lg:flex-row">
        <div className="flex-1 space-y-5">
          <span className="badge-chip w-max">Encrypted Lucky Draw</span>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Fair, encrypted raffles with verifiable private winners.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Each participant submits a fully homomorphic encrypted identifier. The platform
            draws a winner using encrypted randomness, and every player privately verifies the
            result without exposing any personal data. No more opaque lotteries—just pure,
            privacy-first fun.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Participants</p>
              <p className="text-2xl font-semibold text-slate-900">
                {luckyDraw.state.participantCount ?? "–"}
                {luckyDraw.state.maxParticipants && (
                  <span className="text-sm text-slate-500">
                    /{luckyDraw.state.maxParticipants}
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Last Draw</p>
              <p className="text-lg font-semibold text-slate-900">{lastDrawRelative}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contract</p>
              <p className="font-mono text-xs text-slate-500">
                {luckyDraw.state.contractAddress ?? "Not deployed"}
              </p>
            </div>
          </div>
        </div>
        <aside className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 text-indigo-900 shadow-inner">
          <h2 className="text-xl font-semibold">Process Snapshot</h2>
          <ol className="space-y-3 text-sm">
            <li>
              <span className="font-semibold text-indigo-700">1. Encrypt</span> — Choose any
              ID and encrypt it locally with FHE.
            </li>
            <li>
              <span className="font-semibold text-indigo-700">2. Submit</span> — Register on-chain
              without disclosing your identifier.
            </li>
            <li>
              <span className="font-semibold text-indigo-700">3. Draw</span> — Admin triggers an
              encrypted random selection.
            </li>
            <li>
              <span className="font-semibold text-indigo-700">4. Verify</span> — Decrypt privately to
              confirm whether you won.
            </li>
          </ol>
          <p className="text-xs text-indigo-600">
            RainbowKit handles secure wallet connections. Every encryption/decryption step uses
            Zama&apos;s FHEVM SDK directly in your browser.
          </p>
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="card-surface flex flex-col gap-4 p-6">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">System Status</h3>
              <p className="text-sm text-slate-500">
                Wallet connection:{" "}
                <span className={isConnected ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                  {isConnected ? "Connected" : "Not connected"}
                </span>
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              onClick={luckyDraw.refresh}
              disabled={disableActions || luckyDraw.isRefreshing}
            >
              {luckyDraw.isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </header>
          <dl className="grid gap-3 text-sm text-slate-600">
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">FHEVM status</dt>
              <dd className="font-semibold text-slate-800">{fhevmStatus}</dd>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">Admin address</dt>
              <dd className="font-mono text-xs text-slate-700">
                {luckyDraw.state.admin ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">Registered?</dt>
              <dd className={luckyDraw.state.isRegistered ? "text-emerald-600 font-semibold" : "text-slate-500"}>
                {luckyDraw.state.isRegistered ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
          {friendlyFhevmError && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {friendlyFhevmError}
            </p>
          )}
          {luckyDraw.message && (
            <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {luckyDraw.message}
            </p>
          )}
        </article>

        <article className="card-surface flex flex-col gap-4 p-6">
          <h3 className="text-lg font-semibold text-slate-900">Encrypted Result Actions</h3>
          <p className="text-sm text-slate-500">
            Unlock private insights after the draw. Decryption never discloses data to the network.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60"
              onClick={luckyDraw.decryptWinner}
              disabled={disableActions || luckyDraw.isDecryptingWinner}
            >
              {luckyDraw.isDecryptingWinner ? "Decrypting winner..." : "Decrypt winner index"}
            </button>
            <button
              type="button"
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-60"
              onClick={luckyDraw.decryptMyStatus}
              disabled={disableActions || luckyDraw.isDecryptingStatus}
            >
              {luckyDraw.isDecryptingStatus ? "Decrypting..." : "Decrypt my result"}
            </button>
            <button
              type="button"
              className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
              onClick={luckyDraw.decryptMyId}
              disabled={disableActions}
            >
              Reveal my encrypted ID
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-inner">
            <p>
              Winner index:{" "}
              <span className="font-semibold text-slate-900">
                {luckyDraw.decryptedWinner ?? "Not decrypted"}
              </span>
            </p>
            <p>
              My encrypted ID:{" "}
              <span className="font-semibold text-slate-900">
                {luckyDraw.decryptedId ?? "Not decrypted"}
              </span>
            </p>
            <p>
              Did I win?{" "}
              <span
                className={
                  luckyDraw.decryptedStatus === undefined
                    ? "font-semibold text-slate-900"
                    : luckyDraw.decryptedStatus
                      ? "font-semibold text-emerald-600"
                      : "font-semibold text-slate-500"
                }
              >
                {luckyDraw.decryptedStatus === undefined
                  ? "Unknown"
                  : luckyDraw.decryptedStatus
                    ? "Yes!"
                    : "Not this round"}
              </span>
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[5fr_4fr]">
        <article className="card-surface flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Register for the next draw</h3>
              <p className="text-sm text-slate-500">
                Choose any numeric identifier. It will stay confidential inside the FHE enclave.
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-600">
              Secure
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-600" htmlFor="lucky-id">
              Participant ID
            </label>
            <input
              id="lucky-id"
              type="number"
              inputMode="numeric"
              min={0}
              max={2 ** 32 - 1}
              value={idInput}
              onChange={(event) => setIdInput(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="Enter any positive integer"
              disabled={disableActions || luckyDraw.state.isRegistered}
            />
            {idError && <p className="text-sm text-rose-500">{idError}</p>}
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-60"
            disabled={
              disableActions || luckyDraw.isRegistering || luckyDraw.state.isRegistered
            }
            onClick={handleRegister}
          >
            {luckyDraw.state.isRegistered
              ? "Already registered"
              : luckyDraw.isRegistering
                ? "Submitting..."
                : "Encrypt & register"}
          </button>
          {!isConnected && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Connect your wallet to register for the lucky draw.
            </p>
          )}
        </article>

        <article className="card-surface flex flex-col gap-4 p-6">
          <h3 className="text-lg font-semibold text-slate-900">Admin console</h3>
          <p className="text-sm text-slate-500">
            Only the administrator can trigger a new lucky draw. The randomness is generated on-chain
            and immediately encrypted so no one can tamper with the outcome.
          </p>
          <button
            type="button"
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
            onClick={luckyDraw.drawWinner}
            disabled={!isAdmin || luckyDraw.isDrawing}
          >
            {isAdmin
              ? luckyDraw.isDrawing
                ? "Drawing..."
                : "Run encrypted draw"
              : "Admin only"}
          </button>
          {!isAdmin && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              You are not the administrator. Connect with the deployer wallet to trigger draws.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}

