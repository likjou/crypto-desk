import { formatEther } from "ethers";

export function formatUsd(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount >= 1 ? 2 : 4,
    maximumFractionDigits: amount >= 1 ? 2 : 4,
  }).format(amount);
}

export function formatPercent(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(amount);
  return `${formatted}%`;
}

export function formatUsdAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const absolute = Math.abs(amount);
  const digits = absolute >= 1 ? 2 : absolute >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function formatCompactUsd(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatSignedPercent(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(amount);
  return `${formatted}%`;
}

export function formatCompact(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Display ETH from wei without turning the amount into a float. */
export function formatEth(wei: bigint): string {
  const eth = formatEther(wei);
  const [whole, fraction = ""] = eth.split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}
