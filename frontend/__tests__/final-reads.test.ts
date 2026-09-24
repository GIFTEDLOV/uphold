import { beforeEach, describe, expect, it, vi } from "vitest";

const readContract = vi.fn<(args: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);

vi.mock("genlayer-js", () => ({
  createClient: vi.fn(() => ({ readContract })),
}));

vi.mock("genlayer-js/types", () => ({
  TransactionHashVariant: { LATEST_FINAL: "latest-final" },
}));

import {
  readAddressRecord,
  readCommitment,
  readCommitmentHistory,
  readCommitmentIds,
  readContractInfo,
  readLedger,
  readLimits,
} from "../lib/uphold/client";

const address = "0x1234567890123456789012345678901234567890";

describe("canonical Uphold reads", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = address;
    readContract.mockClear();
  });

  it("requests every accounting and application read at LATEST_FINAL", async () => {
    await readCommitment("upl-1");
    await readCommitmentIds();
    await readCommitmentHistory("upl-1");
    await readLedger();
    await readLimits();
    await readContractInfo();
    await readAddressRecord(address);

    expect(readContract).toHaveBeenCalledTimes(7);
    for (const [call] of readContract.mock.calls) {
      expect(call).toEqual(expect.objectContaining({
        transactionHashVariant: "latest-final",
      }));
    }
  });
});
