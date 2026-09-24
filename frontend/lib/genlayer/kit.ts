"use client";

import { useMemo } from "react";
import { createTransactionKit, type TransactionKit } from "@genlayer/transaction-kit";
import feeProfile from "../../fee-profile.json";
import { GENLAYER_CHAIN, getEthereumProvider } from "./client";
import { E2E_FIXTURES_ENABLED } from "@/lib/uphold/e2e-fixtures";

export function useTransactionKit(address: string | null): TransactionKit | null {
  return useMemo(() => {
    const provider = getEthereumProvider();

    if (!provider || !address?.startsWith("0x")) {
      return null;
    }

    if (E2E_FIXTURES_ENABLED) {
      return {
        estimate: async () => ({
          feeValue: 1500000000000000000n,
          source: window.localStorage.getItem("uphold.e2e.fee-source") === "network" ? "network" : "developer",
        }),
        submit: async () => ({
          genlayerTxId: "0xe2e0000000000000000000000000000000000000000000000000000000000001",
          evmTxHash: "0xe2e0000000000000000000000000000000000000000000000000000000000002",
        }),
        track: async (_id: string, onUpdate?: (status: any) => void) => {
          const status = {
            phase: "finalized",
            successful: true,
            executionResultName: "FINISHED_WITH_RETURN",
            genlayerTxId: "0xe2e0000000000000000000000000000000000000000000000000000000000001",
          };
          onUpdate?.(status);
          return status;
        },
      } as unknown as TransactionKit;
    }

    return createTransactionKit({
      chain: GENLAYER_CHAIN,
      provider,
      account: address as `0x${string}`,
      suggestions: feeProfile,
    });
  }, [address]);
}
