import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
} from "@genlayer/transaction-kit";
import { useTransactionKit } from "@/lib/genlayer/kit";
import { useWallet } from "@/lib/genlayer/wallet";
import { readCommitment } from "./client";
import type { ErrorDomain, PendingTransaction } from "./types";

export const PENDING_TX_STORAGE_KEY = "uphold.pending-transactions.v1";

export type TransactionStage =
  | "idle"
  | "preparing"
  | "fee_estimate"
  | "awaiting_wallet"
  | "broadcast"
  | "consensus"
  | "finalizing"
  | "finalized"
  | "execution_verified"
  | "state_confirmed"
  | "error";

export interface TransactionState {
  stage: TransactionStage;
  quote?: PolicyQuote;
  status?: TrackedStatus;
  pending?: PendingTransaction;
  error?: { domain: ErrorDomain; message: string };
}

export interface TransactionRequest {
  tx: SubmitInput;
  userValue?: bigint;
  commitmentId?: string;
  stateExpectation?: PendingTransaction["stateExpectation"];
  stateCheck: () => Promise<boolean>;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readPendingTransactions(): PendingTransaction[] {
  if (!isBrowser()) return [];
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_TX_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writePendingTransaction(transaction: PendingTransaction): void {
  if (!isBrowser()) return;
  const existing = readPendingTransactions().filter((item) => item.id !== transaction.id);
  localStorage.setItem(PENDING_TX_STORAGE_KEY, JSON.stringify([...existing, transaction]));
}

export function removePendingTransaction(id: string): void {
  if (!isBrowser()) return;
  const remaining = readPendingTransactions().filter((item) => item.id !== id);
  localStorage.setItem(PENDING_TX_STORAGE_KEY, JSON.stringify(remaining));
}

export function isExecutionSuccessful(status: TrackedStatus | undefined): boolean {
  return Boolean(
    status?.phase === "finalized" &&
      status.successful === true &&
      status.executionResultName,
  );
}

export function canShowTransactionSuccess(status: TrackedStatus | undefined, stateConfirmed: boolean): boolean {
  return isExecutionSuccessful(status) && stateConfirmed;
}

function stageForStatus(status: TrackedStatus): TransactionStage {
  if (status.phase === "finalized") return "finalizing";
  if (status.phase === "submitted") return "broadcast";
  return "consensus";
}

export function useUpholdTransaction() {
  const wallet = useWallet();
  const kit = useTransactionKit(wallet.address);
  const [state, setState] = useState<TransactionState>({ stage: "idle" });
  const [pending, setPending] = useState<PendingTransaction[]>([]);

  useEffect(() => {
    setPending(readPendingTransactions());
  }, []);

  const prepare = useCallback(async (request: TransactionRequest) => {
    if (!wallet.address || !wallet.isConnected) {
      const error = { domain: "PRECONDITION" as const, message: "Connect a wallet before signing." };
      setState({ stage: "error", error });
      return false;
    }
    if (!wallet.isOnCorrectNetwork) {
      const error = { domain: "PRECONDITION" as const, message: "Switch to GenLayer Studio-dev before signing." };
      setState({ stage: "error", error });
      return false;
    }
    if (!kit) {
      const error = { domain: "PRECONDITION" as const, message: "Wallet signing is unavailable in this browser." };
      setState({ stage: "error", error });
      return false;
    }

    setState({ stage: "preparing" });
    try {
      const quote = await kit.estimate(
        { preset: "standard", userValue: request.userValue ?? 0n },
        request.tx,
      );
      setState({ stage: "fee_estimate", quote });
      return true;
    } catch (cause) {
      setState({
        stage: "error",
        error: { domain: "TRANSACTION_FAILURE", message: cause instanceof Error ? cause.message : "Fee estimation failed." },
      });
      return false;
    }
  }, [kit, wallet.address, wallet.isConnected, wallet.isOnCorrectNetwork]);

  const submit = useCallback(async (request: TransactionRequest) => {
    if (!kit || state.stage !== "fee_estimate" || !state.quote) return false;
    setState((current) => ({ ...current, stage: "awaiting_wallet" }));
    try {
      const result = await kit.submit(state.quote, request.tx);
      const saved: PendingTransaction = {
        id: result.genlayerTxId,
        genlayerTxId: result.genlayerTxId,
        evmTxHash: result.evmTxHash,
        method: request.tx.kind === "write" ? request.tx.method : "deploy",
        commitmentId: request.commitmentId,
        stateExpectation: request.stateExpectation,
        createdAt: new Date().toISOString(),
      };
      writePendingTransaction(saved);
      setPending(readPendingTransactions());
      setState((current) => ({ ...current, stage: "broadcast", pending: saved }));

      const finalStatus = await kit.track(
        result.genlayerTxId,
        (status) => setState((current) => ({ ...current, stage: stageForStatus(status), status })),
        { until: "finalized" },
      );
      setState((current) => ({ ...current, stage: "finalized", status: finalStatus }));

      if (!isExecutionSuccessful(finalStatus)) {
        setState({
          stage: "error",
          pending: saved,
          status: finalStatus,
          error: { domain: "EXECUTION_FAILURE", message: "The transaction finalized, but contract execution was not successful." },
        });
        return false;
      }
      setState((current) => ({ ...current, stage: "execution_verified" }));

      const confirmed = await request.stateCheck();
      if (!canShowTransactionSuccess(finalStatus, confirmed)) {
        setState({
          stage: "error",
          pending: saved,
          status: finalStatus,
          error: { domain: "STATE_CONFIRMATION_FAILURE", message: "Execution succeeded, but the expected contract state was not confirmed." },
        });
        return false;
      }
      removePendingTransaction(saved.id);
      setPending(readPendingTransactions());
      setState({ stage: "state_confirmed", status: finalStatus });
      return true;
    } catch (cause) {
      setState({
        stage: "error",
        error: { domain: "TRANSACTION_FAILURE", message: cause instanceof Error ? cause.message : "Transaction submission failed." },
      });
      return false;
    }
  }, [kit, state]);

  const reconcile = useCallback(async (transaction: PendingTransaction, stateCheck?: () => Promise<boolean>) => {
    if (!kit) return false;
    try {
      setState({ stage: "consensus", pending: transaction });
      const finalStatus = await kit.track(
        transaction.genlayerTxId,
        (status) => setState((current) => ({ ...current, stage: stageForStatus(status), status })),
        { until: "finalized" },
      );
      setState({ stage: "finalized", status: finalStatus, pending: transaction });
      if (!isExecutionSuccessful(finalStatus)) {
        setState({ stage: "error", status: finalStatus, pending: transaction, error: { domain: "EXECUTION_FAILURE", message: "The pending transaction finalized without successful execution." } });
        return false;
      }
      setState({ stage: "execution_verified", status: finalStatus, pending: transaction });
      const confirmed = stateCheck ? await stateCheck() : await verifyPendingState(transaction);
      if (!confirmed) {
        setState({ stage: "error", status: finalStatus, pending: transaction, error: { domain: "STATE_CONFIRMATION_FAILURE", message: "Execution succeeded, but the expected state is not visible yet." } });
        return false;
      }
      removePendingTransaction(transaction.id);
      setPending(readPendingTransactions());
      setState({ stage: "state_confirmed", status: finalStatus });
      return true;
    } catch (cause) {
      setState({ stage: "error", pending: transaction, error: { domain: "TRANSIENT", message: cause instanceof Error ? cause.message : "Could not reconcile the pending transaction." } });
      return false;
    }
  }, [kit]);

  return useMemo(() => ({
    state,
    pending,
    prepare,
    submit,
    reconcile,
    reset: () => setState({ stage: "idle" }),
  }), [pending, prepare, reconcile, state, submit]);
}

async function verifyPendingState(transaction: PendingTransaction): Promise<boolean> {
  if (!transaction.commitmentId) return false;
  try {
    const commitment = await readCommitment(transaction.commitmentId);
    const expected = transaction.stateExpectation;
    if (!expected) return commitment.commitment_id === transaction.commitmentId;
    if (expected.status && commitment.status !== expected.status) return false;
    if (expected.statusNot && commitment.status === expected.statusNot) return false;
    if (expected.currentStake && commitment.current_stake !== BigInt(expected.currentStake)) return false;
    if (expected.expiresAt && commitment.expires_at !== expected.expiresAt) return false;
    if (expected.minimumChecksRun !== undefined && commitment.checks_run < expected.minimumChecksRun) return false;
    return true;
  } catch {
    return false;
  }
}
