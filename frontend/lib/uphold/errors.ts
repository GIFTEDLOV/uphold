import type { ErrorDomain } from "./types";

const domains: ErrorDomain[] = ["PRECONDITION", "EXTERNAL_EVIDENCE", "SOURCE", "TRANSIENT", "MODEL_ERROR", "TRANSACTION_FAILURE", "EXECUTION_FAILURE", "STATE_CONFIRMATION_FAILURE"];

export function mapUpholdError(error: unknown, fallback: ErrorDomain = "TRANSACTION_FAILURE"): { domain: ErrorDomain; message: string } {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const tagged = message.match(/\[([A-Z_]+)\]/)?.[1] as ErrorDomain | undefined;
  if (tagged && domains.includes(tagged)) return { domain: tagged, message: message.replace(`[${tagged}]`, "").trim() };
  if (/source_unavailable|source_inaccessible|source failure|archive|capture|wayback|cdx|evidence/i.test(message)) return { domain: "EXTERNAL_EVIDENCE", message };
  if (/model|llm|semantic|classification/i.test(message)) return { domain: "MODEL_ERROR", message };
  if (/deadline|expired|authorized|promisor|beneficiary|stake|contest|not configured|network/i.test(message)) return { domain: "PRECONDITION", message };
  return { domain: fallback, message };
}

export function errorCopy(domain: ErrorDomain): string {
  return ({ PRECONDITION: "The current contract state does not allow this action.", EXTERNAL_EVIDENCE: "Evidence could not be authenticated. No breach judgment was made.", SOURCE: "The public source could not be authenticated. No breach judgment was made.", TRANSIENT: "This may be temporary. Reconcile the same transaction or try the read again.", MODEL_ERROR: "The bounded semantic result was invalid or unavailable. No breach evidence was counted.", TRANSACTION_FAILURE: "The wallet or fee flow did not submit this transaction.", EXECUTION_FAILURE: "The transaction finalized, but contract execution was not successful.", STATE_CONFIRMATION_FAILURE: "Execution completed, but the expected contract state was not confirmed yet." } as Record<ErrorDomain, string>)[domain];
}
