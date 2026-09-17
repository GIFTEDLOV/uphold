export const COMMITMENT_STATUSES = [
  "ACTIVE",
  "BREACH_CLAIMED",
  "CONTESTED",
  "BREACH_CONFIRMED",
  "PAYOUT_PENDING",
  "REFUND_PENDING",
  "SETTLED",
  "COMPLETED",
] as const;

export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export const SEMANTIC_CLASSIFICATIONS = [
  "HOLDS",
  "WEAKENED",
  "ABSENT",
  "INDETERMINATE",
] as const;

export type SemanticClassification = (typeof SEMANTIC_CLASSIFICATIONS)[number];

export type ErrorDomain =
  | "PRECONDITION"
  | "EXTERNAL_EVIDENCE"
  | "SOURCE"
  | "TRANSIENT"
  | "MODEL_ERROR"
  | "TRANSACTION_FAILURE"
  | "EXECUTION_FAILURE"
  | "STATE_CONFIRMATION_FAILURE";

export interface Commitment {
  commitment_id: string;
  title: string;
  category: string;
  promisor: string;
  beneficiary: string;
  source_url: string;
  commitment_text: string;
  baseline_archive_timestamp: string;
  baseline_digest: string;
  baseline_body_digest: string;
  baseline_excerpt: string;
  baseline_snapshot_id?: string;
  baseline_byte_length?: number;
  created_at: string;
  expires_at: string;
  contest_window_seconds: number;
  original_stake: bigint;
  current_stake: bigint;
  total_stake_added: bigint;
  status: CommitmentStatus;
  last_checked_at: string;
  last_observed_archive_timestamp: string;
  last_snapshot_id?: string;
  last_qualified_archive_timestamp: string;
  last_qualified_digest: string;
  checks_run: number;
  consecutive_negative_count: number;
  breach_claimed_at: string;
  contest_deadline: string;
  breach_capture_1: string;
  breach_capture_2: string;
  contest_evidence_url: string;
  contest_evidence_timestamp: string;
  contest_evidence_digest: string;
  contest_evidence_snapshot_id?: string;
  contest_classification?: string;
  contest_nonce?: number;
  contest_outage_grace_count?: number;
  contest_outage_at?: string;
  contest_outage_domain?: string;
  contest_outage_reason?: string;
  contest_result: string;
  final_settlement_at: string;
  final_settlement_amount: bigint;
  pending_transfer_recipient: string;
  pending_transfer_amount: bigint;
  pending_transfer_kind: string;
  pending_transfer_requested_at: string;
  extensions_count: number;
  stake_additions_count: number;
}

export interface HistoryEntry {
  event: string;
  at?: string;
  capture_timestamp?: string;
  http_status?: number;
  archive_timestamp?: string;
  archive_digest?: string;
  body_digest?: string;
  sha256?: string;
  byte_length?: number;
  snapshot_id?: string;
  replay_url?: string;
  classification?: SemanticClassification;
  captured_state?: "AUTHENTICATED" | "UNASSESSED" | string;
  snapshot_state?: "UNASSESSED" | string;
  excerpt?: string;
  short_reason?: string;
  qualified?: boolean;
  domain?: ErrorDomain | string;
  reason?: string;
  [key: string]: unknown;
}

export interface Ledger {
  total_escrowed: bigint;
  total_deposited: bigint;
  total_paid_to_beneficiaries: bigint;
  total_returned_to_promisors: bigint;
  total_pending_outflows: bigint;
  total_pending_payouts: bigint;
  total_pending_refunds: bigint;
  commitments_created: number;
  checks_run: number;
  breach_claims: number;
  contests_filed: number;
  contests_upheld: number;
  contests_rejected: number;
  commitments_completed: number;
  pending_commitments: number;
}

export interface Limits {
  max_id_length: number;
  max_title_length: number;
  max_category_length: number;
  max_url_length: number;
  max_commitment_length: number;
  max_archive_bytes: number;
  max_snapshot_bytes?: number;
  max_history_entries: number;
  max_commitments: number;
  max_checks: number;
  min_contest_window_seconds: number;
  max_contest_window_seconds: number;
  contest_outage_grace_seconds?: number;
}

export interface ContractInfo {
  name: string;
  version: string;
  semantic_classifications: SemanticClassification[];
  evidence_provider: string;
  evidence_discovery?: string;
  breach_rule: string;
  semantic_verification?: string;
  source_claim?: string;
  contest_rule?: string;
  contest_outage_recovery?: string;
  transfer_mechanism?: string;
  settlement_confirmation?: string;
}

export interface AddressRecord {
  commitments_created: number;
  completed_intact: number;
  breached: number;
  contests_won: number;
  contests_lost: number;
  total_gen_bonded: bigint;
  gen_returned: bigint;
  gen_received: bigint;
}

export type ActionKey =
  | "check"
  | "increase_stake"
  | "extend"
  | "contest"
  | "adjudicate"
  | "settle"
  | "expire";

export interface ActionContext {
  commitment: Commitment;
  actor: string | null;
  now?: Date;
}

export interface PendingTransaction {
  id: string;
  genlayerTxId: `0x${string}`;
  evmTxHash?: `0x${string}`;
  method: string;
  commitmentId?: string;
  stateExpectation?: {
    status?: CommitmentStatus;
    statusNot?: CommitmentStatus;
    currentStake?: string;
    expiresAt?: string;
    minimumChecksRun?: number;
  };
  createdAt: string;
}

export interface ActivityItem extends HistoryEntry {
  commitmentId: string;
  title: string;
}
