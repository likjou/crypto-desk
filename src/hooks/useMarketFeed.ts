"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MINI_TICKER_URLS, readSpotTicks, type SpotTick } from "@/lib/binance";
import {
  fetchMarketById,
  fetchTopMarkets,
  mergeMarkets,
  type MarketCoin,
} from "@/lib/markets";

type StreamStatus = "connecting" | "live" | "reconnecting";

export type MarketFeed = {
  rows: MarketCoin[];
  status: StreamStatus;
  host: string | null;
  loading: boolean;
  error: string | null;
  ensureCoin: (id: string) => Promise<void>;
};

const OPEN_TIMEOUT_MS = 4000;

export function useMarketFeed(): MarketFeed {
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [live, setLive] = useState<ReadonlyMap<string, SpotTick>>(new Map());
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [host, setHost] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const symbolsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    symbolsRef.current = new Set(coins.map((coin) => coin.symbol));
  }, [coins]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const fresh = await fetchTopMarkets();
        if (cancelled) return;
        setCoins((current) => mergeMarkets(current, fresh));
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load the market list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const initial = window.setTimeout(() => {
      void load();
    }, 0);
    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const urls = MINI_TICKER_URLS;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let openTimer: number | undefined;
    let attempt = 0;
    let urlIndex = 0;
    let closedByUs = false;
    let switchingHost = false;

    const connect = () => {
      const url = urls[urlIndex % urls.length];
      const nextHost = new URL(url).host;
      setStatus(attempt === 0 && urlIndex === 0 ? "connecting" : "reconnecting");
      setHost(nextHost);

      socket = new WebSocket(url);
      switchingHost = false;

      openTimer = window.setTimeout(() => {
        if (socket?.readyState === WebSocket.CONNECTING) {
          switchingHost = true;
          urlIndex = (urlIndex + 1) % urls.length;
          socket.close();
        }
      }, OPEN_TIMEOUT_MS);

      socket.onopen = () => {
        window.clearTimeout(openTimer);
        attempt = 0;
        setStatus("live");
        setHost(nextHost);
      };

      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        let payload: unknown;
        try {
          payload = JSON.parse(event.data) as unknown;
        } catch {
          return;
        }

        const ticks = readSpotTicks(payload);
        if (ticks.length === 0) return;

        setLive((current) => {
          let changed = false;
          const next = new Map(current);
          for (const tick of ticks) {
            if (!symbolsRef.current.has(tick.symbol)) continue;
            const previous = next.get(tick.symbol);
            if (
              previous &&
              previous.lastPrice === tick.lastPrice &&
              previous.changePercent === tick.changePercent
            ) {
              continue;
            }
            next.set(tick.symbol, tick);
            changed = true;
          }
          return changed ? next : current;
        });
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        window.clearTimeout(openTimer);
        if (closedByUs) return;
        const delay = switchingHost ? 200 : Math.min(1000 * 2 ** attempt, 15000);
        if (!switchingHost) {
          attempt += 1;
          urlIndex = (urlIndex + 1) % urls.length;
        }
        switchingHost = false;
        setStatus("reconnecting");
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(openTimer);
      socket?.close();
    };
  }, []);

  const ensureCoin = useCallback(async (id: string) => {
    const coin = await fetchMarketById(id);
    if (!coin) return;
    setCoins((current) =>
      current.some((row) => row.id === coin.id) ? current : [...current, coin],
    );
  }, []);

  const rows = useMemo(
    () =>
      coins.map((coin) => {
        const tick = live.get(coin.symbol);
        if (!tick) return coin;
        return {
          ...coin,
          price: tick.lastPrice,
          change24h: tick.changePercent,
        };
      }),
    [coins, live],
  );

  return { rows, status, host, loading, error, ensureCoin };
}
