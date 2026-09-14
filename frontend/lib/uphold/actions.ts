import type { SubmitInput } from "@genlayer/transaction-kit";
import { getUpholdContractAddress } from "./config";
import type { ActionContext, ActionKey } from "./types";

export const UPHOLD_WRITE_METHODS = [
  "create_commitment",
  "check_commitment",
  "increase_stake",
  "extend_commitment",
  "contest_breach",
  "adjudicate_contest",
  "settle_breach",
  "expire_commitment",
] as const;

export type UpholdWriteMethod = (typeof UPHOLD_WRITE_METHODS)[number];

export function buildUpholdWrite(
  method: UpholdWriteMethod,
  args: unknown[] = [],
): SubmitInput {
  const address = getUpholdContractAddress();
  if (!address) throw new Error("Uphold contract not configured");
  return { kind: "write", address, method, args };
}

function isBefore(value: string, now: Date): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed < now.getTime();
}

function isAfter(value: string, now: Date): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > now.getTime();
}

export function allowedActions({ commitment, actor, now = new Date() }: ActionContext): ActionKey[] {
  const isPromisor = Boolean(actor && actor.toLowerCase() === commitment.promisor.toLowerCase());
  const actions: ActionKey[] = [];

  if (commitment.status === "ACTIVE" && !isBefore(commitment.expires_at, now)) {
    actions.push("check");
    if (isPromisor) actions.push("increase_stake", "extend");
  }
  if (commitment.status === "BREACH_CLAIMED") {
    if (isPromisor && isAfter(commitment.contest_deadline, now)) actions.push("contest");
    if (!isAfter(commitment.contest_deadline, now)) actions.push("settle");
  }
  if (commitment.status === "CONTESTED") actions.push("adjudicate");
  if (commitment.status === "BREACH_CONFIRMED") actions.push("settle");
  if (commitment.status === "ACTIVE" && isBefore(commitment.expires_at, now)) actions.push("expire");

  return actions;
}

export function parseGenToWei(input: string): bigint | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0");
}

export function formatGen(wei: bigint | number | string, maximumFractionDigits = 4): string {
  const amount = typeof wei === "bigint" ? wei : BigInt(wei);
  const whole = amount / 10n ** 18n;
  const fraction = (amount % 10n ** 18n).toString().padStart(18, "0").slice(0, maximumFractionDigits);
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

export function makeCommitmentId(): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 20)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `upl-${suffix}`;
}
