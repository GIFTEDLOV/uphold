import {
  COMMITMENT_STATUSES,
  SEMANTIC_CLASSIFICATIONS,
  type AddressRecord,
  type Commitment,
  type CommitmentStatus,
  type ContractInfo,
  type HistoryEntry,
  type Ledger,
  type Limits,
  type SemanticClassification,
} from "./types";

export function toPlain<T = unknown>(value: unknown): T {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [key, toPlain(item)]),
    ) as T;
  }
  if (Array.isArray(value)) return value.map((item) => toPlain(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPlain(item)]),
    ) as T;
  }
  return value as T;
}

function record(value: unknown): Record<string, unknown> {
  return toPlain<Record<string, unknown>>(value ?? {});
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bigintValue(value: unknown, fallback = 0n): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return fallback;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;
}

export function normalizeCommitment(value: unknown): Commitment {
  const item = record(value);
  return {
    commitment_id: stringValue(item.commitment_id),
    title: stringValue(item.title),
    category: stringValue(item.category),
    promisor: stringValue(item.promisor),
    beneficiary: stringValue(item.beneficiary),
    source_url: stringValue(item.source_url),
    commitment_text: stringValue(item.commitment_text),
    baseline_archive_timestamp: stringValue(item.baseline_archive_timestamp),
    baseline_digest: stringValue(item.baseline_digest),
    baseline_body_digest: stringValue(item.baseline_body_digest),
    baseline_excerpt: stringValue(item.baseline_excerpt),
    created_at: stringValue(item.created_at),
    expires_at: stringValue(item.expires_at),
    contest_window_seconds: numberValue(item.contest_window_seconds),
    original_stake: bigintValue(item.original_stake),
    current_stake: bigintValue(item.current_stake),
    total_stake_added: bigintValue(item.total_stake_added),
    status: enumValue<CommitmentStatus>(item.status, COMMITMENT_STATUSES, "ACTIVE"),
    last_checked_at: stringValue(item.last_checked_at),
    last_observed_archive_timestamp: stringValue(item.last_observed_archive_timestamp),
    last_qualified_archive_timestamp: stringValue(item.last_qualified_archive_timestamp),
    last_qualified_digest: stringValue(item.last_qualified_digest),
    checks_run: numberValue(item.checks_run),
    consecutive_negative_count: numberValue(item.consecutive_negative_count),
    breach_claimed_at: stringValue(item.breach_claimed_at),
    contest_deadline: stringValue(item.contest_deadline),
    breach_capture_1: stringValue(item.breach_capture_1),
    breach_capture_2: stringValue(item.breach_capture_2),
    contest_evidence_url: stringValue(item.contest_evidence_url),
    contest_evidence_timestamp: stringValue(item.contest_evidence_timestamp),
    contest_evidence_digest: stringValue(item.contest_evidence_digest),
    contest_result: stringValue(item.contest_result),
    final_settlement_at: stringValue(item.final_settlement_at),
    final_settlement_amount: bigintValue(item.final_settlement_amount),
    extensions_count: numberValue(item.extensions_count),
    stake_additions_count: numberValue(item.stake_additions_count),
  };
}

export function normalizeHistory(value: unknown): HistoryEntry[] {
  const items = Array.isArray(toPlain(value)) ? (toPlain(value) as unknown[]) : [];
  return items.map((entry) => {
    const item = record(entry);
    const classification = enumValue<SemanticClassification>(
      item.classification,
      SEMANTIC_CLASSIFICATIONS,
      "INDETERMINATE",
    );
    return {
      ...item,
      event: stringValue(item.event, "UNKNOWN"),
      at: stringValue(item.at),
      ...(item.classification ? { classification } : {}),
    } as HistoryEntry;
  });
}

export function normalizeLedger(value: unknown): Ledger {
  const item = record(value);
  return {
    total_escrowed: bigintValue(item.total_escrowed),
    total_deposited: bigintValue(item.total_deposited),
    total_paid_to_beneficiaries: bigintValue(item.total_paid_to_beneficiaries),
    total_returned_to_promisors: bigintValue(item.total_returned_to_promisors),
    commitments_created: numberValue(item.commitments_created),
    checks_run: numberValue(item.checks_run),
    breach_claims: numberValue(item.breach_claims),
    contests_filed: numberValue(item.contests_filed),
    contests_upheld: numberValue(item.contests_upheld),
    contests_rejected: numberValue(item.contests_rejected),
    commitments_completed: numberValue(item.commitments_completed),
  };
}

export function normalizeLimits(value: unknown): Limits {
  const item = record(value);
  return {
    max_id_length: numberValue(item.max_id_length, 64),
    max_title_length: numberValue(item.max_title_length, 120),
    max_category_length: numberValue(item.max_category_length, 48),
    max_url_length: numberValue(item.max_url_length, 512),
    max_commitment_length: numberValue(item.max_commitment_length, 2000),
    max_archive_bytes: numberValue(item.max_archive_bytes, 32768),
    max_history_entries: numberValue(item.max_history_entries, 64),
    max_commitments: numberValue(item.max_commitments, 1000),
    max_checks: numberValue(item.max_checks, 128),
    min_contest_window_seconds: numberValue(item.min_contest_window_seconds, 3600),
    max_contest_window_seconds: numberValue(item.max_contest_window_seconds, 2592000),
  };
}

export function normalizeContractInfo(value: unknown): ContractInfo {
  const item = record(value);
  const classifications = Array.isArray(toPlain(item.semantic_classifications))
    ? (toPlain(item.semantic_classifications) as unknown[])
        .filter((entry): entry is SemanticClassification =>
          typeof entry === "string" && SEMANTIC_CLASSIFICATIONS.includes(entry as SemanticClassification),
        )
    : [];
  return {
    name: stringValue(item.name, "Uphold"),
    version: stringValue(item.version),
    semantic_classifications: classifications,
    evidence_provider: stringValue(item.evidence_provider),
    breach_rule: stringValue(item.breach_rule),
  };
}

export function normalizeAddressRecord(value: unknown): AddressRecord {
  const item = record(value);
  return {
    commitments_created: numberValue(item.commitments_created),
    completed_intact: numberValue(item.completed_intact),
    breached: numberValue(item.breached),
    contests_won: numberValue(item.contests_won),
    contests_lost: numberValue(item.contests_lost),
    total_gen_bonded: bigintValue(item.total_gen_bonded),
    gen_returned: bigintValue(item.gen_returned),
    gen_received: bigintValue(item.gen_received),
  };
}

export function normalizeCommitmentIds(value: unknown): string[] {
  const items = Array.isArray(toPlain(value)) ? (toPlain(value) as unknown[]) : [];
  return items.filter((item): item is string => typeof item === "string");
}
