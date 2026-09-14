import { beforeEach, describe, expect, it } from "vitest";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import { canShowTransactionSuccess, isExecutionSuccessful, readPendingTransactions, removePendingTransaction, writePendingTransaction } from "../lib/uphold/transactions";

const success: TrackedStatus = { phase: "finalized", successful: true, executionResultName: "RETURNED" };
const finalizedOnly: TrackedStatus = { phase: "finalized", statusName: "FINALIZED" };

describe("Uphold transaction reconciliation", () => {
  beforeEach(() => localStorage.clear());

  it("requires finalized execution success, not only FINALIZED status", () => {
    expect(isExecutionSuccessful(success)).toBe(true);
    expect(isExecutionSuccessful(finalizedOnly)).toBe(false);
    expect(isExecutionSuccessful({ phase: "decided", successful: true, executionResultName: "RETURNED" })).toBe(false);
  });

  it("requires the expected contract state readback before showing success", () => {
    expect(canShowTransactionSuccess(success, false)).toBe(false);
    expect(canShowTransactionSuccess(success, true)).toBe(true);
    expect(canShowTransactionSuccess(finalizedOnly, true)).toBe(false);
  });

  it("persists a broadcast identifier for same-transaction recovery", () => {
    const pending = { id: "0xabc", genlayerTxId: "0xabc" as `0x${string}`, method: "increase_stake", commitmentId: "upl-test", createdAt: new Date().toISOString() };
    writePendingTransaction(pending);
    expect(readPendingTransactions()).toEqual([pending]);
    removePendingTransaction(pending.id);
    expect(readPendingTransactions()).toEqual([]);
  });
});
