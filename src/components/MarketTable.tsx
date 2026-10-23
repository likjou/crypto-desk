"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { formatCompactUsd, formatSignedPercent, formatUsdAmount } from "@/lib/format";
import { searchCoins, type CoinSuggestion, type MarketCoin } from "@/lib/markets";
import type { MarketFeed } from "@/hooks/useMarketFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { TriangleAlertIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
} as const;

export function MarketTable({ feed }: { feed: MarketFeed }) {
  const [query, setQuery] = useState("");
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visible = useMemo(() => {
    if (pinnedId) return feed.rows.filter((coin) => coin.id === pinnedId);
    const matched = feed.rows.filter((coin) => matchesQuery(coin, query));
    if (query.trim()) return matched;
    return matched.filter((coin) => coin.rank !== null && coin.rank <= 50);
  }, [feed.rows, pinnedId, query]);

  const choose = async (suggestion: CoinSuggestion) => {
    setQuery(suggestion.symbol);
    setPinnedId(suggestion.id);
    if (feed.rows.some((coin) => coin.id === suggestion.id)) return;
    setPending(true);
    try {
      await feed.ensureCoin(suggestion.id);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm tracking-wide uppercase">
          Market
          <StatusBadge status={feed.status} host={feed.host} />
        </CardTitle>
        <CardDescription>
          Top 50 by market cap. Price and 24h move on the Binance websocket. Volume,
          market cap, and the 7-day line come from CoinGecko.
        </CardDescription>
        <CardAction className="w-full sm:w-72">
          <CoinSearch
            query={query}
            coins={feed.rows}
            onQueryChange={(value) => {
              setPinnedId(null);
              setQuery(value);
            }}
            onSelect={(suggestion) => {
              void choose(suggestion);
            }}
            onClear={() => {
              setPinnedId(null);
              setQuery("");
            }}
          />
        </CardAction>
      </CardHeader>

      {feed.error && feed.rows.length > 0 && (
        <div className="px-4 pt-4">
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Market data is stale</AlertTitle>
            <AlertDescription>{feed.error}</AlertDescription>
          </Alert>
        </div>
      )}

      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">#</TableHead>
            <TableHead>Coin</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">1h</TableHead>
            <TableHead className="text-right">24h</TableHead>
            <TableHead className="text-right">7d</TableHead>
            <TableHead className="text-right">24h volume</TableHead>
            <TableHead className="text-right">Market cap</TableHead>
            <TableHead className="px-4 text-right">Last 7 days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feed.loading && feed.rows.length === 0 ? (
            <SkeletonRows />
          ) : pending && visible.length === 0 ? (
            <SkeletonRows count={3} />
          ) : feed.error && feed.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-6">
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Could not load the market</AlertTitle>
                  <AlertDescription>{feed.error}</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-8 text-muted-foreground">
                {query.trim() || pinnedId
                  ? "No coins match that search."
                  : "No market data returned."}
              </TableCell>
            </TableRow>
          ) : (
            visible.map((coin) => <MarketRow key={coin.id} coin={coin} />)
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <TableRow key={index}>
          <TableCell className="px-4">
            <Skeleton className="h-4 w-6" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-16" />
          </TableCell>
          <TableCell className="px-4">
            <Skeleton className="ml-auto h-9 w-28" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function StatusBadge({
  status,
  host,
}: {
  status: MarketFeed["status"];
  host: string | null;
}) {
  const live = status === "live";
  return (
    <Badge variant="outline" className="h-6 px-2 font-normal tracking-normal normal-case">
      <span className={`size-1.5 rounded-full ${live ? "bg-up animate-pulse" : "bg-primary"}`} />
      {STATUS_LABEL[status]}
      {live && host ? <span className="hidden md:inline">· {host}</span> : null}
    </Badge>
  );
}

const MarketRow = memo(function MarketRow({ coin }: { coin: MarketCoin }) {
  const direction = usePriceFlash(coin.price);

  return (
    <TableRow>
      <TableCell className="px-4 font-mono text-xs text-muted-foreground tabular-nums">
        {coin.rank ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {coin.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coin.image} alt="" width={28} height={28} className="size-7 rounded-full" />
          ) : (
            <span className="size-7 rounded-full bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{coin.name}</p>
            <p className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
              {coin.symbol}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell
        className={`text-right font-mono tabular-nums ${
          direction === "up" ? "text-up" : direction === "down" ? "text-down" : ""
        }`}
      >
        {formatUsdAmount(coin.price)}
      </TableCell>
      <PercentCell value={coin.change1h} />
      <PercentCell value={coin.change24h} />
      <PercentCell value={coin.change7d} />
      <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
        {formatCompactUsd(coin.volume24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {formatCompactUsd(coin.marketCap)}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex justify-end">
          <Sparkline values={coin.sparkline} />
        </div>
      </TableCell>
    </TableRow>
  );
});

function PercentCell({ value }: { value: number | null }) {
  const tone =
    value === null || value === 0 ? "text-muted-foreground" : value > 0 ? "text-up" : "text-down";
  return (
    <TableCell className={`text-right font-mono tabular-nums ${tone}`}>
      {formatSignedPercent(value)}
    </TableCell>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values);
  if (!points) return <span className="text-xs text-muted-foreground">—</span>;
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg viewBox="0 0 120 36" className="h-9 w-28" aria-hidden="true">
      <polyline
        fill="none"
        stroke={rising ? "#3dd68c" : "#ff6b6b"}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function sparklinePoints(values: number[]): string | null {
  const sampled = downsample(values, 40);
  if (sampled.length < 2) return null;
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  return sampled
    .map((price, index) => {
      const x = (index / (sampled.length - 1)) * 120;
      const y = 34 - ((price - min) / span) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function downsample(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from(
    { length: maxPoints },
    (_, index) => values[Math.round(index * step)] ?? values[values.length - 1],
  );
}

function usePriceFlash(price: number): "up" | "down" | "flat" {
  const previous = useRef<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | "flat">("flat");

  useEffect(() => {
    const prior = previous.current;
    previous.current = price;
    if (prior === null || prior === price) return;
    setDirection(price > prior ? "up" : "down");
    const timer = window.setTimeout(() => setDirection("flat"), 700);
    return () => window.clearTimeout(timer);
  }, [price]);

  return direction;
}

function matchesQuery(coin: MarketCoin, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return coin.name.toLowerCase().includes(needle) || coin.symbol.toLowerCase().includes(needle);
}

function CoinSearch({
  query,
  coins,
  onQueryChange,
  onSelect,
  onClear,
}: {
  query: string;
  coins: MarketCoin[];
  onQueryChange: (value: string) => void;
  onSelect: (suggestion: CoinSuggestion) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<{ query: string; coins: CoinSuggestion[] }>({
    query: "",
    coins: [],
  });
  const [searching, setSearching] = useState(false);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const local: CoinSuggestion[] = coins
      .filter((coin) => matchesQuery(coin, needle))
      .slice(0, 8)
      .map((coin) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        rank: coin.rank,
      }));
    const seen = new Set(local.map((coin) => coin.id));
    const remoteMatches = remote.query.toLowerCase() === needle ? remote.coins : [];
    const extra = remoteMatches.filter((coin) => !seen.has(coin.id)).slice(0, 8 - local.length);
    return [...local, ...extra].slice(0, 8);
  }, [coins, query, remote]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;

    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchCoins(needle)
        .then((results) => setRemote({ query: needle, coins: results.slice(0, 8) }))
        .catch(() => setRemote({ query: needle, coins: [] }))
        .finally(() => setSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Popover open={open && query.trim().length > 0} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent p-0">
        <PopoverAnchor asChild>
          <div className="relative">
            <CommandInput
              value={query}
              placeholder="Search"
              aria-label="Search cryptocurrencies"
              onValueChange={(value) => {
                onQueryChange(value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="absolute top-1/2 right-8 z-10 -translate-y-1/2"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="end"
          className="w-(--radix-popover-trigger-width) p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <CommandList>
            {searching && suggestions.length === 0 ? (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-4/5" />
              </div>
            ) : (
              <>
                <CommandEmpty>No matches</CommandEmpty>
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.id}
                  value={suggestion.id}
                  className="[&>svg]:hidden"
                  onSelect={() => {
                    onSelect(suggestion);
                    setOpen(false);
                  }}
                >
                  {suggestion.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={suggestion.image}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 rounded-full"
                    />
                  ) : (
                    <span className="size-6 rounded-full bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{suggestion.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {suggestion.symbol}
                    </span>
                  </span>
                  {suggestion.rank !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{suggestion.rank}
                    </span>
                  )}
                  </CommandItem>
                ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
