export type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  rank: number | null;
  price: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  volume24h: number | null;
  marketCap: number | null;
  sparkline: number[];
};

export type CoinSuggestion = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  rank: number | null;
};

const MARKETS_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";
const SEARCH_ENDPOINT = "https://api.coingecko.com/api/v3/search";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readSparkline(value: unknown): number[] {
  if (!isRecord(value) || !Array.isArray(value.price)) return [];
  return value.price.filter((point): point is number => typeof point === "number");
}

export function readMarketCoin(value: unknown): MarketCoin | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (typeof value.symbol !== "string" || typeof value.image !== "string") return null;

  const price = readNumber(value.current_price);
  if (price === null) return null;

  return {
    id: value.id,
    symbol: value.symbol.toUpperCase(),
    name: value.name,
    image: value.image,
    rank: readNumber(value.market_cap_rank),
    price,
    change1h: readNumber(value.price_change_percentage_1h_in_currency),
    change24h: readNumber(value.price_change_percentage_24h_in_currency),
    change7d: readNumber(value.price_change_percentage_7d_in_currency),
    volume24h: readNumber(value.total_volume),
    marketCap: readNumber(value.market_cap),
    sparkline: readSparkline(value.sparkline_in_7d),
  };
}

export function readMarketList(payload: unknown): MarketCoin[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry) => {
    const coin = readMarketCoin(entry);
    return coin ? [coin] : [];
  });
}

function marketUrl(params: Record<string, string>): string {
  const url = new URL(MARKETS_ENDPOINT);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("sparkline", "true");
  url.searchParams.set("price_change_percentage", "1h,24h,7d");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function fetchMarkets(url: string): Promise<MarketCoin[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Market list failed (${response.status})`);
  }
  return readMarketList(await response.json());
}

export function fetchTopMarkets(): Promise<MarketCoin[]> {
  return fetchMarkets(
    marketUrl({
      order: "market_cap_desc",
      per_page: "50",
      page: "1",
    }),
  );
}

export function fetchMarketById(id: string): Promise<MarketCoin | null> {
  return fetchMarkets(marketUrl({ ids: id })).then((coins) => coins[0] ?? null);
}

export async function searchCoins(query: string): Promise<CoinSuggestion[]> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("query", query);
  const response = await fetch(url);
  if (!response.ok) return [];

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.coins)) return [];

  return payload.coins.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (typeof entry.id !== "string" || typeof entry.name !== "string") return [];
    if (typeof entry.symbol !== "string") return [];
    const image = typeof entry.thumb === "string" ? entry.thumb : "";
    return [
      {
        id: entry.id,
        symbol: entry.symbol.toUpperCase(),
        name: entry.name,
        image,
        rank: readNumber(entry.market_cap_rank),
      },
    ];
  });
}

export function mergeMarkets(previous: MarketCoin[], fresh: MarketCoin[]): MarketCoin[] {
  const freshIds = new Set(fresh.map((coin) => coin.id));
  const extras = previous.filter((coin) => !freshIds.has(coin.id));
  return [...fresh, ...extras];
}
