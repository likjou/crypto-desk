/** One symbol, the URL from the brief: wss://stream.binance.com:9443/ws/btcusdt@ticker */
export const BINANCE_SINGLE_STREAM_URL =
  "wss://stream.binance.com:9443/ws/btcusdt@ticker";

const STREAMS = ["btcusdt@ticker", "ethusdt@ticker"] as const;
const STREAM_PATH = `/stream?streams=${STREAMS.join("/")}`;

/**
 * Same combined ticker on two hosts.
 * stream.binance.com is the public endpoint. Some networks block it.
 * data-stream.binance.vision is Binance's market-data host and serves the same payload.
 */
export const BINANCE_STREAM_URLS = [
  `wss://stream.binance.com:9443${STREAM_PATH}`,
  `wss://data-stream.binance.vision${STREAM_PATH}`,
] as const;

/** Every USDT market that traded, pushed about once a second. */
export const MINI_TICKER_URLS = [
  "wss://stream.binance.com:9443/ws/!miniTicker@arr",
  "wss://data-stream.binance.vision/ws/!miniTicker@arr",
] as const;

export type SpotTick = {
  symbol: string;
  lastPrice: number;
  changePercent: number;
  quoteVolume: number;
};

export const TRACKED_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;

export type TrackedSymbol = (typeof TRACKED_SYMBOLS)[number];

export type Ticker = {
  symbol: TrackedSymbol;
  lastPrice: string;
  priceChange: string;
  changePercent: string;
  high: string;
  low: string;
  baseVolume: string;
  eventTime: number;
};

const TRACKED = new Set<string>(TRACKED_SYMBOLS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTrackedSymbol(symbol: string): symbol is TrackedSymbol {
  return TRACKED.has(symbol);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/**
 * Binance sends the ticker object on a single stream, and wraps it as
 * `{ stream, data }` on a combined stream. Accept either shape.
 */
export function readTicker(payload: unknown): Ticker | null {
  if (!isRecord(payload)) return null;

  const event = isRecord(payload.data) ? payload.data : payload;
  if (event.e !== "24hrTicker") return null;

  const symbol = readString(event, "s");
  const lastPrice = readString(event, "c");
  const priceChange = readString(event, "p");
  const changePercent = readString(event, "P");
  const high = readString(event, "h");
  const low = readString(event, "l");
  const baseVolume = readString(event, "v");
  const eventTime = event.E;

  if (!symbol || !isTrackedSymbol(symbol)) return null;
  if (!lastPrice || !priceChange || !changePercent || !high || !low || !baseVolume) {
    return null;
  }
  if (typeof eventTime !== "number") return null;

  return {
    symbol,
    lastPrice,
    priceChange,
    changePercent,
    high,
    low,
    baseVolume,
    eventTime,
  };
}

/** Pull USDT mini-ticker or 24h ticker events out of a stream message. */
export function readSpotTicks(payload: unknown): SpotTick[] {
  const events = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : [isRecord(payload) && isRecord(payload.data) ? payload.data : payload];

  const ticks: SpotTick[] = [];
  for (const event of events) {
    const tick = readSpotTick(event);
    if (tick) ticks.push(tick);
  }
  return ticks;
}

function readSpotTick(value: unknown): SpotTick | null {
  if (!isRecord(value)) return null;
  if (value.e !== "24hrMiniTicker" && value.e !== "24hrTicker") return null;

  const pair = readString(value, "s");
  if (!pair || !pair.endsWith("USDT")) return null;

  const lastPrice = readDecimal(value.c);
  const open = readDecimal(value.o);
  const quotedPercent = readDecimal(value.P);
  const quoteVolume = readDecimal(value.q);
  if (lastPrice === null || quoteVolume === null) return null;

  const changePercent =
    quotedPercent !== null
      ? quotedPercent
      : open !== null && open > 0
        ? ((lastPrice - open) / open) * 100
        : null;
  if (changePercent === null) return null;

  return {
    symbol: pair.slice(0, -"USDT".length),
    lastPrice,
    changePercent,
    quoteVolume,
  };
}

function readDecimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function assetLabel(symbol: TrackedSymbol): string {
  return symbol === "BTCUSDT" ? "Bitcoin" : "Ether";
}

export function assetCode(symbol: TrackedSymbol): string {
  return symbol === "BTCUSDT" ? "BTC" : "ETH";
}
