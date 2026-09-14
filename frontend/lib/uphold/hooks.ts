"use client";

import { useQuery } from "@tanstack/react-query";
import { getUpholdContractAddress } from "./config";
import {
  readAddressRecord,
  readActivity,
  readCommitment,
  readCommitmentHistory,
  readCommitmentIndex,
  readContractInfo,
  readLedger,
  readLimits,
} from "./client";

const configured = () => Boolean(getUpholdContractAddress());

export function useCommitment(commitmentId: string) {
  return useQuery({
    queryKey: ["uphold", "commitment", commitmentId],
    queryFn: () => readCommitment(commitmentId),
    enabled: configured() && Boolean(commitmentId),
    staleTime: 10_000,
  });
}

export function useCommitmentHistory(commitmentId: string) {
  return useQuery({
    queryKey: ["uphold", "history", commitmentId],
    queryFn: () => readCommitmentHistory(commitmentId),
    enabled: configured() && Boolean(commitmentId),
    staleTime: 10_000,
  });
}

export function useCommitments() {
  return useQuery({
    queryKey: ["uphold", "commitments"],
    queryFn: () => readCommitmentIndex(),
    enabled: configured(),
    staleTime: 10_000,
  });
}

export function useLedger() {
  return useQuery({
    queryKey: ["uphold", "ledger"],
    queryFn: readLedger,
    enabled: configured(),
    staleTime: 10_000,
  });
}

export function useLimits() {
  return useQuery({
    queryKey: ["uphold", "limits"],
    queryFn: readLimits,
    enabled: configured(),
    staleTime: 60_000,
  });
}

export function useContractInfo() {
  return useQuery({
    queryKey: ["uphold", "info"],
    queryFn: readContractInfo,
    enabled: configured(),
    staleTime: 60_000,
  });
}

export function useAddressRecord(address: string | null) {
  return useQuery({
    queryKey: ["uphold", "record", address],
    queryFn: () => readAddressRecord(address as string),
    enabled: configured() && Boolean(address),
    staleTime: 15_000,
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["uphold", "activity"],
    queryFn: () => readActivity(),
    enabled: configured(),
    staleTime: 10_000,
  });
}
