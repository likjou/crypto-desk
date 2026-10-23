"use client";

import { useMarketFeed } from "@/hooks/useMarketFeed";
import { useSepoliaWallet } from "@/hooks/useSepoliaWallet";
import { MarketTable } from "@/components/MarketTable";
import { WalletPanel } from "@/components/WalletPanel";

export function Desk() {
  const feed = useMarketFeed();
  const wallet = useSepoliaWallet();

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Crypto Desk
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              A live crypto market table, plus a Sepolia wallet you can connect
              and send a test transaction from.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Testnet only · chain 11155111
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
        <WalletPanel wallet={wallet} />
        <MarketTable feed={feed} />
      </main>
    </div>
  );
}
