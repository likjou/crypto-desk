import type { Eip1193Provider } from "ethers";

/** Sepolia testnet. 0xaa36a7 is the hex form MetaMask expects. */
export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

export const SEPOLIA_CHAIN_PARAMS = {
  chainId: SEPOLIA_CHAIN_HEX,
  chainName: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
} as const;

const NETWORK_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "11155111": "Sepolia",
  "17000": "Holesky",
  "8453": "Base",
  "84532": "Base Sepolia",
};

export function networkName(chainId: bigint): string {
  return NETWORK_NAMES[chainId.toString()] ?? `Chain ${chainId.toString()}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

type EthereumWithEvents = Eip1193Provider & {
  on(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  on(event: "chainChanged", listener: (chainId: string) => void): void;
  removeListener(
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ): void;
  removeListener(
    event: "chainChanged",
    listener: (chainId: string) => void,
  ): void;
};

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export function getEthereum(): EthereumWithEvents | null {
  if (typeof window === "undefined") return null;
  const ethereum = window.ethereum;
  if (!ethereum || typeof ethereum !== "object" || !("request" in ethereum)) {
    return null;
  }
  if (typeof ethereum.request !== "function") return null;
  return ethereum as EthereumWithEvents;
}

export function readErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "number" ? error.code : null;
}

export function readErrorMessage(error: unknown): string {
  if (readErrorCode(error) === 4001) return "Request rejected in the wallet.";

  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Request rejected in the wallet.";
    }
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Something went wrong talking to the wallet.";
}

export async function ensureSepolia(ethereum: Eip1193Provider): Promise<void> {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
  } catch (error) {
    if (readErrorCode(error) !== 4902) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [SEPOLIA_CHAIN_PARAMS],
    });
  }
}
