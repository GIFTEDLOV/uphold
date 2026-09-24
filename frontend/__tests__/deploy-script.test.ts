import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDeploymentTarget,
  DEPLOYMENT_CONTRACT_PATH,
  EXPECTED_CHAIN_ID,
  EXPECTED_CONTRACT_SHA256,
  EXPECTED_RPC,
  hasExistingBroadcast,
  isSuccessfulDeploymentReceipt,
  verifyUpholdSourceSha,
} from "../../deploy/deployScript";

describe("deployment receipt success", () => {
  it("does not treat UNDETERMINED as a successful deployment", () => {
    expect(
      isSuccessfulDeploymentReceipt({
        status: 6,
        statusName: "UNDETERMINED",
      }),
    ).toBe(false);
  });

  it("requires FINALIZED plus FINISHED_WITH_RETURN", () => {
    expect(
      isSuccessfulDeploymentReceipt({
        statusName: "FINALIZED",
        txExecutionResultName: "FINISHED_WITH_RETURN",
      }),
    ).toBe(true);
    expect(
      isSuccessfulDeploymentReceipt({
        statusName: "ACCEPTED",
        txExecutionResultName: "FINISHED_WITH_RETURN",
      }),
    ).toBe(false);
    expect(
      isSuccessfulDeploymentReceipt({
        statusName: "FINALIZED",
        txExecutionResultName: "FINISHED_WITH_ERROR",
      }),
    ).toBe(false);
    expect(
      isSuccessfulDeploymentReceipt({ statusName: "LEADER_TIMEOUT" }),
    ).toBe(false);
  });
});

describe("Uphold deployment gates", () => {
  it("selects Uphold and the Studio-dev chain", () => {
    expect(DEPLOYMENT_CONTRACT_PATH).toBe("contracts/uphold.py");
    expect(DEPLOYMENT_CONTRACT_PATH).not.toContain("football");
    expect(() => assertDeploymentTarget(EXPECTED_RPC, EXPECTED_CHAIN_ID)).not.toThrow();
    expect(() => assertDeploymentTarget(EXPECTED_RPC, 61996)).toThrow();
    expect(() => assertDeploymentTarget("https://example.test", EXPECTED_CHAIN_ID)).toThrow();
  });

  it("gates the exact approved source bytes", () => {
    const source = readFileSync(path.resolve(process.cwd(), "../contracts/uphold.py"));
    expect(verifyUpholdSourceSha(source)).toBe(EXPECTED_CONTRACT_SHA256);
    expect(() => verifyUpholdSourceSha(new TextEncoder().encode("wrong source"))).toThrow();
  });

  it("rejects a second broadcast from persisted transaction state", () => {
    expect(hasExistingBroadcast({ txHash: "0xabc" })).toBe(true);
    expect(hasExistingBroadcast({ status: "FINALIZED_SUCCESSFUL" })).toBe(true);
    expect(hasExistingBroadcast({ status: "PREPARED", txHash: null })).toBe(false);
  });

  it("persists the hash before finalization and contains no blind duplicate path", () => {
    const source = readFileSync(path.resolve(process.cwd(), "../deploy/deployScript.ts"), "utf8");
    expect(source).not.toContain("football_bets.py");
    expect(source).not.toContain('waitUntil: "decided"');
    expect(source.indexOf("manifest.txHash = txHash")).toBeLessThan(
      source.indexOf("client.waitForFinalization"),
    );
  });
});
