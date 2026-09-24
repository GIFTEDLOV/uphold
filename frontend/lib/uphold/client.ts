import { createGenLayerClient } from "@/lib/genlayer/client";
import { TransactionHashVariant } from "genlayer-js/types";
import { E2E_FIXTURES_ENABLED, e2eRead } from "./e2e-fixtures";
import { getUpholdContractAddress } from "./config";
import {
  normalizeAddressRecord,
  normalizeCommitment,
  normalizeCommitmentIds,
  normalizeContractInfo,
  normalizeHistory,
  normalizeLedger,
  normalizeLimits,
} from "./normalize";
import type { ActivityItem, AddressRecord, Commitment, ContractInfo, HistoryEntry, Ledger, Limits } from "./types";

export function requireUpholdAddress(): `0x${string}` {
  const address = getUpholdContractAddress();
  if (!address) throw new Error("Uphold contract not configured");
  return address;
}

function createReadClient() {
  return createGenLayerClient();
}

async function read(functionName: string, args: unknown[] = []): Promise<unknown> {
  if (E2E_FIXTURES_ENABLED) return e2eRead(functionName);
  const client = createReadClient() as any;
  return client.readContract({
    address: requireUpholdAddress(),
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

export async function readCommitment(commitmentId: string): Promise<Commitment> {
  return normalizeCommitment(await read("get_commitment", [commitmentId]));
}

export async function readCommitmentIds(limit = 100): Promise<string[]> {
  return normalizeCommitmentIds(await read("get_commitment_ids", [limit]));
}

export async function readCommitmentHistory(commitmentId: string): Promise<HistoryEntry[]> {
  return normalizeHistory(await read("commitment_history", [commitmentId]));
}

export async function readLedger(): Promise<Ledger> {
  return normalizeLedger(await read("get_ledger"));
}

export async function readLimits(): Promise<Limits> {
  return normalizeLimits(await read("get_limits"));
}

export async function readContractInfo(): Promise<ContractInfo> {
  return normalizeContractInfo(await read("contract_info"));
}

export async function readAddressRecord(address: string): Promise<AddressRecord> {
  return normalizeAddressRecord(await read("get_address_record", [address]));
}

export async function readCommitmentIndex(limit = 100): Promise<Commitment[]> {
  const ids = await readCommitmentIds(limit);
  return Promise.all(ids.map((id) => readCommitment(id)));
}

export async function readActivity(limit = 100): Promise<ActivityItem[]> {
  const commitments = await readCommitmentIndex(limit);
  const items = await Promise.all(commitments.map(async (commitment) => {
    const history = await readCommitmentHistory(commitment.commitment_id);
    return history.map((entry) => ({ ...entry, commitmentId: commitment.commitment_id, title: commitment.title }));
  }));
  return items.flat().toSorted((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());
}
