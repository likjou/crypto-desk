"use client";

import { useRef, useState } from "react";
import { formatClock, formatEth, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  explorerAddressUrl,
  explorerTxUrl,
  networkName,
  SEPOLIA_CHAIN_ID,
} from "@/lib/ethereum";
import type { WalletActivity } from "@/lib/transactions";
import type { AccountSnapshot, SepoliaWallet, TransactionState } from "@/hooks/useSepoliaWallet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

const REFRESH_SPIN_MS = 700;

export function WalletPanel({ wallet }: { wallet: SepoliaWallet }) {
  if (wallet.phase === "checking") return <WalletSkeleton />;
  if (wallet.phase !== "ready" || !wallet.account) return <ConnectWarning wallet={wallet} />;
  return <ConnectedWallet wallet={wallet} account={wallet.account} />;
}

function ConnectedWallet({
  wallet,
  account,
}: {
  wallet: SepoliaWallet;
  account: AccountSnapshot;
}) {
  const onSepolia = account.chainId === SEPOLIA_CHAIN_ID;
  const busy = wallet.tx.status === "signing" || wallet.tx.status === "pending";
  const rows = withLiveTransaction(wallet.activity, wallet.tx);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function onRefresh() {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    const started = Date.now();

    try {
      await wallet.refresh();
      await wallet.reloadActivity();
    } finally {
      const remaining = REFRESH_SPIN_MS - (Date.now() - started);
      window.setTimeout(() => {
        refreshLock.current = false;
        setRefreshing(false);
      }, Math.max(0, remaining));
    }
  }

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm tracking-wide uppercase">Wallet</CardTitle>
          <CardDescription>ethers.js reads the account. MetaMask holds the key and signs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-xl bg-background p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                <a
                  className={cn(
                    "font-mono text-sm underline underline-offset-4",
                    revealed ? "break-all" : "truncate",
                  )}
                  href={explorerAddressUrl(account.address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {revealed ? account.address : shortAddress(account.address)}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={copied ? "Address copied" : "Copy address"}
                  onClick={() => void onCopy()}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={revealed ? "Hide address" : "Reveal address"}
                  aria-pressed={revealed}
                  onClick={() => setRevealed((current) => !current)}
                >
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
              <Badge variant={onSepolia ? "secondary" : "outline"} className="shrink-0">
                {networkName(account.chainId)}
              </Badge>
            </div>
            <p className="mt-4 font-mono text-3xl tabular-nums">
              {formatEth(account.balanceWei)}
              <span className="ml-2 text-base text-muted-foreground">ETH</span>
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="font-mono text-[11px] text-muted-foreground">
                {account.balanceWei.toString()} wei
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Refresh balance"
                aria-busy={refreshing}
                onClick={() => void onRefresh()}
              >
                <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
              </Button>
            </div>
          </div>

          {onSepolia ? (
            <Button className="w-full" size="lg" disabled={busy} onClick={() => void wallet.sendTestTransaction()}>
              {busy ? "Transaction in progress…" : "Send 0 ETH to myself"}
            </Button>
          ) : (
            <Button className="w-full" size="lg" onClick={() => void wallet.switchToSepolia()}>
              Switch to Sepolia
            </Button>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            Sepolia only. The transfer value is zero, so you pay gas and get a real
            transaction hash to follow. Fund the account from a{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://www.alchemy.com/faucets/ethereum-sepolia"
              target="_blank"
              rel="noreferrer"
            >
              Sepolia faucet
            </a>
            , or{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://sepolia-faucet.pk910.de"
              target="_blank"
              rel="noreferrer"
            >
              mine Sepolia here
            </a>
            .
          </p>

          {wallet.error && (
            <p className="text-sm text-destructive" role="status">
              {wallet.error}
            </p>
          )}
          {wallet.tx.status === "error" && (
            <p className="text-sm text-destructive" role="status">
              {wallet.tx.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm tracking-wide uppercase">Recent transactions</CardTitle>
          <CardDescription>The latest Sepolia transfers for this account, and the one you just sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {onSepolia ? (
            <ActivityList rows={rows} state={wallet.activityState} />
          ) : (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Wrong network</AlertTitle>
              <AlertDescription>
                Switch to Sepolia to load this account&apos;s recent transactions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectWarning({ wallet }: { wallet: SepoliaWallet }) {
  const missing = wallet.phase === "missing";
  const connecting = wallet.phase === "connecting";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm tracking-wide uppercase">Wallet</CardTitle>
        <CardDescription>Balance and recent transactions appear here after you connect.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>{missing ? "No wallet found" : "Wallet not connected"}</AlertTitle>
          <AlertDescription>
            {missing
              ? "This browser has no injected wallet. Install MetaMask, then come back to this page."
              : "Connect MetaMask on Sepolia to see your balance and the latest transactions."}
          </AlertDescription>
        </Alert>

        {missing ? (
          <Button size="lg" className="w-full" asChild>
            <a href="https://metamask.io/download" target="_blank" rel="noreferrer">
              Install MetaMask
            </a>
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={connecting}
            onClick={() => void wallet.connect()}
          >
            {connecting ? "Waiting for the wallet…" : "Connect MetaMask"}
          </Button>
        )}

        {wallet.error && (
          <p className="text-sm text-destructive" role="status">
            {wallet.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WalletSkeleton() {
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-2" aria-busy="true">
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-3 w-48" />
        </CardContent>
      </Card>
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityList({
  rows,
  state,
}: {
  rows: WalletActivity[];
  state: SepoliaWallet["activityState"];
}) {
  if (state === "loading" && rows.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (state === "error" && rows.length === 0) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Could not load transactions</AlertTitle>
        <AlertDescription>The Sepolia history request failed. Refresh the balance and try again.</AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions returned for this account.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.hash ?? "signing"}
          className="flex items-start justify-between gap-3 rounded-xl bg-background px-3 py-3 ring-1 ring-foreground/10"
        >
          <div className="min-w-0">
            <p className="truncate text-sm">{row.summary}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {row.hash ? (
                <a
                  className="underline underline-offset-4"
                  href={explorerTxUrl(row.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(row.hash)}
                </a>
              ) : (
                "Waiting for a hash"
              )}
              {row.timestamp !== null ? ` · ${formatClock(row.timestamp)}` : ""}
              {row.blockNumber !== null ? ` · block ${row.blockNumber}` : ""}
            </p>
          </div>
          <StatusBadge status={row.status} />
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: WalletActivity["status"] }) {
  if (status === "confirmed") return <Badge variant="secondary">Confirmed</Badge>;
  if (status === "reverted") return <Badge variant="destructive">Reverted</Badge>;
  if (status === "signing") return <Badge variant="outline">Signing</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function withLiveTransaction(history: WalletActivity[], tx: TransactionState): WalletActivity[] {
  const live = liveActivity(tx);
  if (!live) return history;
  return [live, ...history.filter((row) => row.hash !== live.hash)].slice(0, 5);
}

function liveActivity(tx: TransactionState): WalletActivity | null {
  if (tx.status === "signing") {
    return {
      hash: null,
      status: "signing",
      blockNumber: null,
      timestamp: null,
      valueWei: 0n,
      summary: "Waiting for your signature",
    };
  }

  if (tx.status === "pending" || tx.status === "confirmed" || tx.status === "reverted") {
    return {
      hash: tx.hash,
      status: tx.status,
      blockNumber: tx.status === "confirmed" ? tx.blockNumber : null,
      timestamp: null,
      valueWei: 0n,
      summary: "0 ETH to this wallet",
    };
  }

  return null;
}
