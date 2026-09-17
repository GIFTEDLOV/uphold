import type { Commitment, CommitmentStatus, HistoryEntry, SemanticClassification } from "./types";
import { formatGen } from "./actions";

export function formatDate(value: string, withTime = false): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(parsed);
}

export function formatArchiveTimestamp(value: string): string {
  if (value.includes("T")) return formatDate(value, true);
  if (!/^\d{14}$/.test(value)) return "—";
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`);
  return formatDate(date.toISOString(), true);
}

export function sourceDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "invalid source"; }
}

export function formatStake(value: bigint): string { return `${formatGen(value)} GEN`; }

export function formatCount(value: number): string { return new Intl.NumberFormat("en-US").format(value); }

export function daysUntil(value: string, now = new Date()): string {
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "Unknown date";
  const delta = target - now.getTime();
  if (delta <= 0) return "Past due";
  const days = Math.ceil(delta / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function classificationTone(classification: SemanticClassification): "positive" | "negative" | "neutral" {
  if (classification === "HOLDS") return "positive";
  if (classification === "WEAKENED" || classification === "ABSENT") return "negative";
  return "neutral";
}

export function historyClassification(entry: HistoryEntry): SemanticClassification | null {
  return entry.classification ?? null;
}

export function lifecycleIndex(status: CommitmentStatus): number {
  if (status === "ACTIVE") return 1;
  if (status === "BREACH_CLAIMED" || status === "CONTESTED") return 2;
  if (status === "BREACH_CONFIRMED") return 3;
  if (status === "PAYOUT_PENDING") return 3;
  return 4;
}

export function commitmentSearchText(commitment: Commitment): string {
  return [commitment.commitment_id, commitment.title, commitment.category, commitment.promisor, commitment.beneficiary, sourceDomain(commitment.source_url)].join(" ").toLowerCase();
}

export function breachProgress(commitment: Commitment): { count: number; required: number; claimed: boolean; explanation: string } {
  const count = Math.min(commitment.consecutive_negative_count, 2);
  return {
    count,
    required: 2,
    claimed: commitment.status !== "ACTIVE" && count >= 2,
    explanation: count >= 2 ? "Two distinct qualified negative points are recorded." : count === 1 ? "One qualified negative point is recorded; a second distinct point is required." : "No qualified negative point is currently recorded.",
  };
}
