import { formatEth } from "@/lib/format";

export type ActivityStatus = "signing" | "pending" | "confirmed" | "reverted";

export type WalletActivity = {
  hash: string | null;
  status: ActivityStatus;
  blockNumber: number | null;
  timestamp: number | null;
  valueWei: bigint;
  summary: string;
};

const RECENT_LIMIT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readAddress(value: unknown): string | null {
  if (!isRecord(value) || typeof value.hash !== "string") return null;
  return value.hash;
}

function readBlockNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function readStatus(value: Record<string, unknown>, blockNumber: number | null): ActivityStatus {
  const status = typeof value.status === "string" ? value.status.toLowerCase() : "";
  const result = typeof value.result === "string" ? value.result.toLowerCase() : "";

  if (status === "error" || result === "error" || result === "reverted") return "reverted";
  if (status === "ok" || result === "success") return "confirmed";
  if (blockNumber !== null) return "confirmed";
  return "pending";
}

function readWei(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

function readActivity(value: unknown, account: string): WalletActivity | null {
  if (!isRecord(value) || typeof value.hash !== "string") return null;

  const from = readAddress(value.from)?.toLowerCase() ?? null;
  const to = readAddress(value.to)?.toLowerCase() ?? null;
  const self = account.toLowerCase();
  const valueWei = readWei(value.value);
  const amount = `${formatEth(valueWei)} ETH`;

  let summary = `${amount} transfer`;
  if (from === self && to === self) summary = `${amount} to this wallet`;
  else if (from === self) summary = `Sent ${amount}`;
  else if (to === self) summary = `Received ${amount}`;

  const blockNumber = readBlockNumber(value.block_number);
  const status = readStatus(value, blockNumber);
  const timestamp = typeof value.timestamp === "string" ? Date.parse(value.timestamp) : null;

  return {
    hash: value.hash,
    status,
    blockNumber,
    timestamp: timestamp !== null && Number.isFinite(timestamp) ? timestamp : null,
    valueWei,
    summary,
  };
}

export async function fetchRecentTransactions(address: string): Promise<WalletActivity[]> {
  const response = await fetch(
    `https://eth-sepolia.blockscout.com/api/v2/addresses/${address}/transactions`,
  );
  if (!response.ok) {
    throw new Error(`Transaction history failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];

  return payload.items.slice(0, RECENT_LIMIT).flatMap((item) => {
    const activity = readActivity(item, address);
    return activity ? [activity] : [];
  });
}
