import { GENLAYER_CHAIN, GENLAYER_CHAIN_ID } from "@/lib/genlayer/network";

const PLACEHOLDER_ADDRESSES = new Set([
  "",
  "your_contract_address",
  "0x0000000000000000000000000000000000000000",
  "0x...",
]);

export const UPHOLD_NETWORK = {
  name: "GenLayer Studio-dev",
  rpcUrl: "https://studio-dev.genlayer.com/api",
  chainId: 61997,
  explorerUrl: "https://explorer-studio-dev.genlayer.com/",
} as const;

/** Official measured Studio-dev profile is passed to Transaction Kit. */
export const UPHOLD_FEE_PROFILE_PRESENT = true;

export function getUpholdContractAddress(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "";
  if (PLACEHOLDER_ADDRESSES.has(raw.toLowerCase())) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw as `0x${string}`;
}

export function isUpholdConfigured(): boolean {
  return getUpholdContractAddress() !== null;
}

export function isStudioDevNetwork(): boolean {
  return (
    GENLAYER_CHAIN_ID === UPHOLD_NETWORK.chainId &&
    GENLAYER_CHAIN.rpcUrls.default.http[0] === UPHOLD_NETWORK.rpcUrl
  );
}

export function getNetworkMismatchMessage(chainId: string | null): string {
  if (!chainId) return `Connect a wallet on ${UPHOLD_NETWORK.name}.`;
  return `Your wallet is on chain ${chainId}; Uphold requires ${UPHOLD_NETWORK.name} (${UPHOLD_NETWORK.chainId}).`;
}

/** Backward-compatible symbol for consumers that have not migrated yet. */
export const isStudioNextNetwork = isStudioDevNetwork;
