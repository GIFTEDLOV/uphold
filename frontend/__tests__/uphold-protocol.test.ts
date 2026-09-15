import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { allowedActions, buildUpholdWrite, formatGen, parseGenToWei, UPHOLD_WRITE_METHODS } from "../lib/uphold/actions";
import { getUpholdContractAddress, isStudioNextNetwork } from "../lib/uphold/config";
import { mapUpholdError } from "../lib/uphold/errors";
import { breachProgress } from "../lib/uphold/format";
import { normalizeCommitment, normalizeHistory } from "../lib/uphold/normalize";
import { normalizeAddressRecord } from "../lib/uphold/normalize";
import { validateDraft } from "../components/uphold/CreateFlow";
import type { Commitment } from "../lib/uphold/types";

const actor = "0x1111111111111111111111111111111111111111";
const beneficiary = "0x2222222222222222222222222222222222222222";

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    commitment_id: "upl-test", title: "Monthly report", category: "accountability", promisor: actor, beneficiary, source_url: "https://example.com/promise", commitment_text: "I will publish a monthly report.", baseline_archive_timestamp: "20260101000000", baseline_digest: "digest", baseline_body_digest: "body", baseline_excerpt: "I will publish…", created_at: "2026-01-01T00:00:00Z", expires_at: "2027-01-01T00:00:00Z", contest_window_seconds: 86400, original_stake: 100n, current_stake: 100n, total_stake_added: 0n, status: "ACTIVE", last_checked_at: "2026-01-01T00:00:00Z", last_observed_archive_timestamp: "20260101000000", last_qualified_archive_timestamp: "", last_qualified_digest: "", checks_run: 0, consecutive_negative_count: 0, breach_claimed_at: "", contest_deadline: "", breach_capture_1: "", breach_capture_2: "", contest_evidence_url: "", contest_evidence_timestamp: "", contest_evidence_digest: "", contest_result: "", final_settlement_at: "", final_settlement_amount: 0n, pending_transfer_recipient: "", pending_transfer_amount: 0n, pending_transfer_kind: "", pending_transfer_requested_at: "", extensions_count: 0, stake_additions_count: 0, ...overrides,
  };
}

describe("Uphold contract boundary", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("treats missing and placeholder deployment values as unconfigured", () => {
    expect(getUpholdContractAddress()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", "your_contract_address");
    expect(getUpholdContractAddress()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", actor);
    expect(getUpholdContractAddress()).toBe(actor);
  });

  it("keeps the shared network pinned to Studio Next", () => {
    expect(isStudioNextNetwork()).toBe(true);
  });

  it("builds every public Uphold write against the configured address", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", actor);
    for (const method of UPHOLD_WRITE_METHODS) {
      expect(buildUpholdWrite(method).kind).toBe("write");
      expect(buildUpholdWrite(method)).toMatchObject({ address: actor, method });
    }
  });

  it("normalizes SDK Maps and numeric values into the Uphold view model", () => {
    const value = new Map<string, unknown>([[
      "commitment_id", "upl-map",
    ], ["status", "BREACH_CLAIMED"], ["original_stake", "100"], ["current_stake", 80], ["checks_run", 2]]);
    const result = normalizeCommitment(value);
    expect(result.commitment_id).toBe("upl-map");
    expect(result.status).toBe("BREACH_CLAIMED");
    expect(result.original_stake).toBe(100n);
    expect(result.current_stake).toBe(80n);
    expect(normalizeHistory([new Map([["event", "CHECK"], ["classification", "HOLDS"]])])[0].classification).toBe("HOLDS");
    expect(normalizeCommitment({ status: "PAYOUT_PENDING", pending_transfer_amount: "100", pending_transfer_kind: "PAYOUT" }).pending_transfer_amount).toBe(100n);
  });

  it("exposes only state-valid contextual actions", () => {
    expect(allowedActions({ commitment: commitment(), actor })).toEqual(["check", "increase_stake", "extend"]);
    expect(allowedActions({ commitment: commitment(), actor: beneficiary })).toEqual(["check"]);
    expect(allowedActions({ commitment: commitment({ status: "BREACH_CLAIMED", consecutive_negative_count: 2, contest_deadline: "2026-01-02T00:00:00Z" }), actor })).toEqual(["settle"]);
    expect(allowedActions({ commitment: commitment({ status: "PAYOUT_PENDING", pending_transfer_amount: 100n }), actor })).toEqual([]);
    expect(allowedActions({ commitment: commitment({ status: "REFUND_PENDING", pending_transfer_amount: 100n }), actor })).toEqual([]);
    expect(allowedActions({ commitment: commitment({ status: "COMPLETED" }), actor })).toEqual([]);
  });

  it("shows the two-point rule without treating one point as a breach", () => {
    expect(breachProgress(commitment({ consecutive_negative_count: 1 }))).toMatchObject({ count: 1, required: 2, claimed: false });
    expect(breachProgress(commitment({ consecutive_negative_count: 2, status: "BREACH_CLAIMED" }))).toMatchObject({ count: 2, claimed: true });
  });

  it("keeps GEN arithmetic exact at wei precision", () => {
    expect(parseGenToWei("1.25")).toBe(1_250_000_000_000_000_000n);
    expect(parseGenToWei("1.123456789012345678")).toBe(1_123_456_789_012_345_678n);
    expect(parseGenToWei("0")).toBe(0n);
    expect(parseGenToWei("1.1234567890123456789")).toBeNull();
    expect(formatGen(1_250_000_000_000_000_000n)).toBe("1.25");
  });

  it("validates create, extension, and contest inputs before a write payload", () => {
    const draft = { title: "", category: "", sourceUrl: "not a url", commitmentText: "", baselineTimestamp: "bad", beneficiary: "bad", stake: "0", expiresAt: "2020-01-01T00:00", contestWindow: "5" };
    const errors = validateDraft(draft, 4);
    expect(errors.join(" ")).toMatch(/title|category|URL|commitment|timestamp|beneficiary|Stake|Expiry|Contest/);
    expect(allowedActions({ commitment: commitment({ expires_at: "2099-01-01T00:00:00Z" }), actor })).toContain("extend");
    expect(allowedActions({ commitment: commitment({ status: "BREACH_CLAIMED", contest_deadline: "2020-01-02T00:00:00Z" }), actor })).not.toContain("contest");
  });

  it("formats objective address records without a reputation score", () => {
    const record = normalizeAddressRecord({ commitments_created: "2", total_gen_bonded: "1250000000000000000", gen_returned: 500n });
    expect(record.commitments_created).toBe(2);
    expect(record.total_gen_bonded).toBe(1_250_000_000_000_000_000n);
    expect(record.gen_returned).toBe(500n);
    expect(record).not.toHaveProperty("trust_score");
  });

  it("preserves failure domains instead of flattening evidence failures", () => {
    expect(mapUpholdError(new Error("[EXTERNAL] archive unavailable")).domain).toBe("EXTERNAL_EVIDENCE");
    expect(mapUpholdError(new Error("[LLM] malformed semantic response")).domain).toBe("MODEL_ERROR");
    expect(mapUpholdError(new Error("contest window expired")).domain).toBe("PRECONDITION");
  });
});
