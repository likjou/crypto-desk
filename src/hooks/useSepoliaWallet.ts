"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BrowserProvider } from "ethers";
import {
  SEPOLIA_CHAIN_ID,
  ensureSepolia,
  getEthereum,
  readErrorMessage,
} from "@/lib/ethereum";
import { fetchRecentTransactions, type WalletActivity } from "@/lib/transactions";

export type AccountSnapshot = {
  address: string;
  balanceWei: bigint;
  chainId: bigint;
};

export type TransactionState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "pending"; hash: string }
  | { status: "confirmed"; hash: string; blockNumber: number }
  | { status: "reverted"; hash: string }
  | { status: "error"; message: string };

export type WalletPhase =
  | "checking"
  | "missing"
  | "disconnected"
  | "connecting"
  | "ready";

export type SepoliaWallet = {
  phase: WalletPhase;
  account: AccountSnapshot | null;
  error: string | null;
  tx: TransactionState;
  activity: WalletActivity[];
  activityState: "idle" | "loading" | "error";
  connect: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  refresh: () => Promise<void>;
  reloadActivity: () => Promise<void>;
  sendTestTransaction: () => Promise<void>;
};

type Session = "pending" | "anonymous" | "connected";

/** Blockscout can list a mined transfer before it fills in the receipt. Ask the wallet's node. */
async function confirmPending(rows: WalletActivity[]): Promise<WalletActivity[]> {
  if (!rows.some((row) => row.status === "pending" && row.hash)) return rows;

  const ethereum = getEthereum();
  if (!ethereum) return rows;

  const provider = new BrowserProvider(ethereum);
  const settled = await Promise.all(
    rows.map(async (row) => {
      if (row.status !== "pending" || !row.hash) return row;

      try {
        const receipt = await provider.getTransactionReceipt(row.hash);
        if (!receipt) return row;
        return {
          ...row,
          status: receipt.status === 1 ? "confirmed" : "reverted",
          blockNumber: receipt.blockNumber,
        } satisfies WalletActivity;
      } catch {
        return row;
      }
    }),
  );

  return settled;
}

function subscribe(): () => void {
  return () => {};
}

/** null on the server so the first paint does not claim the wallet is missing. */
function providerOnClient(): boolean | null {
  return getEthereum() !== null;
}

function providerOnServer(): boolean | null {
  return null;
}

async function readAccount(): Promise<AccountSnapshot | null> {
  const ethereum = getEthereum();
  if (!ethereum) return null;

  const provider = new BrowserProvider(ethereum);
  const accounts = (await provider.send("eth_accounts", [])) as string[];
  const address = accounts[0];
  if (!address) return null;

  const network = await provider.getNetwork();
  const balanceWei = await provider.getBalance(address);

  return {
    address,
    balanceWei,
    chainId: network.chainId,
  };
}

export function useSepoliaWallet(): SepoliaWallet {
  const providerFlag = useSyncExternalStore(subscribe, providerOnClient, providerOnServer);
  const [session, setSession] = useState<Session>("pending");
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TransactionState>({ status: "idle" });
  const [activity, setActivity] = useState<WalletActivity[]>([]);
  const [activityState, setActivityState] = useState<"idle" | "loading" | "error">("idle");

  const refresh = useCallback(async () => {
    let snapshot: AccountSnapshot | null = null;
    let failure: string | null = null;

    try {
      snapshot = await readAccount();
    } catch (caught) {
      failure = readErrorMessage(caught);
    }

    if (failure) {
      setError(failure);
      setAccount(null);
      setSession("anonymous");
      return;
    }

    setAccount(snapshot);
    setSession(snapshot ? "connected" : "anonymous");
    setError(null);
  }, []);

  useEffect(() => {
    if (providerFlag !== true) return;
    const ethereum = getEthereum();
    if (!ethereum) return;

    const onAccounts = () => {
      void refresh();
    };
    const onChain = () => {
      setTx({ status: "idle" });
      void refresh();
    };

    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    // Subscribe first, then read, so a change during that read still hits the listeners.
    const initialRead = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(initialRead);
      ethereum.removeListener("accountsChanged", onAccounts);
      ethereum.removeListener("chainChanged", onChain);
    };
  }, [providerFlag, refresh]);

  const loadActivity = useCallback(async (address: string, background = false) => {
    if (!background) setActivityState("loading");
    try {
      const rows = await fetchRecentTransactions(address);
      setActivity(await confirmPending(rows));
      setActivityState("idle");
    } catch {
      if (!background) setActivityState("error");
    }
  }, []);

  const reloadActivity = useCallback(async () => {
    if (!account || account.chainId !== SEPOLIA_CHAIN_ID) return;
    await loadActivity(account.address);
  }, [account, loadActivity]);

  const watchedAddress = account?.address ?? null;
  const watchedChainId = account?.chainId ?? null;

  useEffect(() => {
    if (!watchedAddress || watchedChainId !== SEPOLIA_CHAIN_ID) return;
    const timer = window.setTimeout(() => {
      void loadActivity(watchedAddress);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadActivity, watchedAddress, watchedChainId]);

  const hasPendingActivity = activity.some((row) => row.status === "pending" && row.hash !== null);

  useEffect(() => {
    if (!watchedAddress || watchedChainId !== SEPOLIA_CHAIN_ID || !hasPendingActivity) return;
    const timer = window.setInterval(() => {
      void loadActivity(watchedAddress, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasPendingActivity, loadActivity, watchedAddress, watchedChainId]);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    setConnecting(true);
    setError(null);

    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await ensureSepolia(ethereum);
      await refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
      await refresh();
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const switchToSepolia = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    setError(null);
    try {
      await ensureSepolia(ethereum);
      await refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
    }
  }, [refresh]);

  const sendTestTransaction = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum || !account) return;

    setError(null);
    setTx({ status: "signing" });

    try {
      const provider = new BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        setTx({
          status: "error",
          message: "Switch to Sepolia before sending a test transaction.",
        });
        return;
      }

      const signer = await provider.getSigner();
      const from = await signer.getAddress();
      const response = await signer.sendTransaction({
        to: from,
        value: 0n,
      });

      setTx({ status: "pending", hash: response.hash });
      const receipt = await response.wait();

      if (!receipt || receipt.status !== 1) {
        setTx({ status: "reverted", hash: response.hash });
        return;
      }

      setTx({
        status: "confirmed",
        hash: response.hash,
        blockNumber: receipt.blockNumber,
      });
      await refresh();
      await loadActivity(from);
    } catch (caught) {
      setTx({ status: "error", message: readErrorMessage(caught) });
    }
  }, [account, loadActivity, refresh]);

  const phase: WalletPhase =
    providerFlag === null || (providerFlag && session === "pending")
      ? "checking"
      : providerFlag === false
        ? "missing"
        : connecting
          ? "connecting"
          : account
            ? "ready"
            : "disconnected";

  return {
    phase,
    account,
    error,
    tx,
    activity,
    activityState,
    connect,
    switchToSepolia,
    refresh,
    reloadActivity,
    sendTestTransaction,
  };
}
