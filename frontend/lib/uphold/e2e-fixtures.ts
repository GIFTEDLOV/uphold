import type { Commitment, HistoryEntry } from "./types";

export const E2E_FIXTURES_ENABLED = process.env.NEXT_PUBLIC_E2E_FIXTURES === "1";

export const E2E_FIXTURE_ADDRESS = "0x1111111111111111111111111111111111111111";
export const E2E_FIXTURE_BENEFICIARY = "0x2222222222222222222222222222222222222222";

const commitment: Commitment = {
  commitment_id: "fixture-commitment",
  title: "Monthly transparency report",
  category: "Public accountability",
  promisor: E2E_FIXTURE_ADDRESS,
  beneficiary: E2E_FIXTURE_BENEFICIARY,
  source_url: "https://example.com/commitment",
  commitment_text: "I will publish a monthly transparency report every month.",
  baseline_archive_timestamp: "2026-09-01T00:00:00Z",
  baseline_digest: "a".repeat(64),
  baseline_body_digest: "a".repeat(64),
  baseline_excerpt: "I will publish a monthly transparency report every month.",
  baseline_snapshot_id: "fixture-commitment:0",
  baseline_byte_length: 62,
  created_at: "2026-09-01T00:00:00Z",
  expires_at: "2027-09-01T00:00:00Z",
  contest_window_seconds: 86400,
  original_stake: 100000000000000000000n,
  current_stake: 100000000000000000000n,
  total_stake_added: 0n,
  status: "ACTIVE",
  last_checked_at: "2026-09-01T00:00:00Z",
  last_observed_archive_timestamp: "2026-09-01T00:00:00Z",
  last_snapshot_id: "fixture-commitment:0",
  last_qualified_archive_timestamp: "",
  last_qualified_digest: "",
  checks_run: 0,
  consecutive_negative_count: 0,
  breach_claimed_at: "",
  contest_deadline: "",
  breach_capture_1: "",
  breach_capture_2: "",
  contest_evidence_url: "",
  contest_evidence_timestamp: "",
  contest_evidence_digest: "",
  contest_evidence_snapshot_id: "",
  contest_classification: "UNASSESSED",
  contest_nonce: 0,
  contest_outage_grace_count: 0,
  contest_outage_at: "",
  contest_outage_domain: "",
  contest_outage_reason: "",
  contest_result: "",
  final_settlement_at: "",
  final_settlement_amount: 0n,
  pending_transfer_recipient: "0x0000000000000000000000000000000000000000",
  pending_transfer_amount: 0n,
  pending_transfer_kind: "",
  pending_transfer_requested_at: "",
  extensions_count: 0,
  stake_additions_count: 0,
};

const history: HistoryEntry[] = [
  {
    event: "CREATED",
    at: "2026-09-01T00:00:00Z",
    capture_timestamp: "2026-09-01T00:00:00Z",
    classification: "HOLDS",
    captured_state: "AUTHENTICATED",
    excerpt: commitment.baseline_excerpt,
  },
];

export function e2eRead(functionName: string): unknown {
  if (functionName === "get_commitment_ids") return [commitment.commitment_id];
  if (functionName === "get_commitment") return commitment;
  if (functionName === "commitment_history") return history;
  if (functionName === "contract_info") {
    return {
      name: "Uphold",
      version: "live-snapshot-v1.2",
      semantic_classifications: ["HOLDS", "WEAKENED", "ABSENT", "INDETERMINATE"],
      evidence_provider: "authenticated live source",
      breach_rule: "two qualified negative checks",
      semantic_verification: "independent validator rerun",
      transfer_mechanism: "finalized native-value message",
    };
  }
  if (functionName === "get_limits") {
    return {
      max_id_length: 64,
      max_title_length: 120,
      max_category_length: 48,
      max_url_length: 512,
      max_commitment_length: 2000,
      max_archive_bytes: 32768,
      max_history_entries: 64,
      max_commitments: 1000,
      max_checks: 128,
      min_contest_window_seconds: 3600,
      max_contest_window_seconds: 2592000,
    };
  }
  if (functionName === "get_address_record") {
    return {
      commitments_created: 1,
      completed_intact: 0,
      breached: 0,
      contests_won: 0,
      contests_lost: 0,
      total_gen_bonded: commitment.original_stake,
      gen_returned: 0,
      gen_received: 0,
    };
  }
  return {
    total_escrowed: commitment.current_stake,
    total_deposited: commitment.current_stake,
    total_paid_to_beneficiaries: 0,
    total_returned_to_promisors: 0,
    total_pending_outflows: 0,
    total_pending_payouts: 0,
    total_pending_refunds: 0,
    commitments_created: 1,
    checks_run: 0,
    breach_claims: 0,
    contests_filed: 0,
    contests_upheld: 0,
    contests_rejected: 0,
    commitments_completed: 0,
    pending_commitments: 1,
  };
}
