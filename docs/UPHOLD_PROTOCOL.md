# Uphold Protocol

## Trust problem

Uphold lets a promisor lock GEN behind a public, time-bounded commitment. A beneficiary can receive a payout request only after authenticated archived evidence shows that the published commitment was materially weakened or removed. If the commitment survives expiry, the contract records a refund request to the promisor; both external transfers remain pending until completion is observed outside the contract.

The protocol is designed to make an economic decision auditable. It does not treat an AI opinion, an unavailable website, or a transaction status as proof of breach.

## Why GenLayer is necessary

The archive document is external, while the question “does this document still substantially carry the original promise?” is semantic. GenLayer provides validator-backed execution for that bounded question. The contract still owns all authorization, admissibility, lifecycle, timing, and payment decisions.

## Responsibility split

Deterministic contract code owns:

- callers, addresses, stake/value arithmetic, deadlines, and lifecycle transitions;
- URL and archive timestamp validation, capture uniqueness, byte limits, digests, and bounded history;
- the two-point breach gate, contest window, payout/refund request lifecycle, expiry, and ledger invariants.

Validators answer only the semantic classification for an already admitted document:

- `HOLDS` — the promise still substantially carries;
- `WEAKENED` — the promise remains recognizable but is materially narrowed or reduced;
- `ABSENT` — the relevant promise is no longer present in valid evidence;
- `INDETERMINATE` — the bounded evidence is insufficient.

Validators do not select captures, authenticate evidence, choose recipients, calculate payouts, decide deadlines, or perform settlement.

## Evidence pipeline

1. The contract validates the source URL, archive timestamp, commitment bounds, and lifecycle preconditions.
2. Wayback CDX is queried for the exact source URL. A requested baseline/contest timestamp must be an exact 14-digit UTC timestamp; a routine check selects the earliest admitted capture strictly after the previous observed timestamp.
3. The exact replay is pinned with the timestamp and `id_` URL. The CDX row must identify the original URL, have HTTP 200, a supported text-like MIME type, a non-empty digest, and a bounded declared length.
4. The replay must be non-empty and within `MAX_ARCHIVE_BYTES`; the contract stores only archive metadata, SHA-256 body digest, and a bounded excerpt.
5. CDX selection and replay admission are compared with strict equality before semantic judgment. A baseline must contain enough commitment anchors to establish that the published text is supported.
6. The leader receives the authenticated commitment and the bounded, admitted archived document and returns bounded metadata. A validator independently re-runs the same semantic task over the same evidence and compares only `classification`; quote and reason prose are not consensus-critical.

An admitted capture is replay-protected by its strictly advancing timestamp. The same capture cannot advance a check or streak twice.

## Lifecycle and breach rule

The normal lifecycle is:

`ACTIVE → BREACH_CLAIMED → CONTESTED → ACTIVE`

or:

`ACTIVE → BREACH_CLAIMED → BREACH_CONFIRMED → PAYOUT_PENDING`

and clean expiry is:

`ACTIVE → REFUND_PENDING`.

`PAYOUT_PENDING` and `REFUND_PENDING` are immutable, non-replayable external-transfer requests. The current contract does not promote either state to `SETTLED` or `COMPLETED`, because the v0.6 external-message API does not expose a contract-readable completion receipt.

`WEAKENED` and `ABSENT` are qualified negative observations. One negative is never enough. Two distinct, strictly advancing qualified negatives are required. `HOLDS` resets the negative streak. `INDETERMINATE`, archive failures, and validator disagreement do not add to or reset the streak.

The second qualified negative creates a contest deadline but does not pay anyone.

## Contest

Only the promisor may file one contest for an open breach claim, before the deterministic deadline. The supplied evidence must reference the original source and pass the same CDX/replay admission pipeline. Adjudication asks only whether that authenticated evidence still supports the original commitment.

`HOLDS` upholds the contest, restores `ACTIVE`, and resets the streak. A valid qualified negative confirms the breach. Insufficient or failed model evidence remains fail-closed and does not silently convert infrastructure failure into punishment.

## Settlement and clean expiry

After a contest window elapses without a contest, or after a contest is rejected, anyone may call `settle_breach`. The contract zeroes the current stake, records the exact recipient/amount/kind/timestamp, moves the amount into `total_pending_outflows`, and emits one finalized EOA external message to the beneficiary. It returns `PAYOUT_PENDING`; it does not increment confirmed paid accounting.

After expiry, while the commitment is still cleanly `ACTIVE`, anyone may call `expire_commitment`; the remaining stake becomes a `REFUND_PENDING` request to the promisor. A claimed, contested, confirmed, pending, settled, or completed commitment cannot use the clean-expiry path. Both paths emit via `@gl.evm.contract_interface` and `emit_transfer(value=...)`; no `on='accepted'` execution is used.

## Accounting invariants

The contract tracks total deposits, current escrow, requested outflows, confirmed beneficiary payments, confirmed promisor returns, and protocol counters. The primary value invariant is:

`total_deposited = total_escrowed + total_pending_outflows + total_paid_to_beneficiaries + total_returned_to_promisors`

`total_paid_to_beneficiaries` and `total_returned_to_promisors` are confirmed-only counters. A pending request has `current_stake == 0`, a fixed `pending_transfer_amount`, and contributes to `total_pending_outflows` (and exactly one of `total_pending_payouts` or `total_pending_refunds`). No pending request can be replayed, topped up, extended, settled again, or expired again.

## Failure policy

The contract keeps these domains distinct in check results and history:

- `EXTERNAL` — archive index/replay unavailable;
- `TRANSIENT` — validator/evidence agreement failure;
- `LLM` — malformed, unknown, or overlong model output;
- `EVIDENCE`/`NO_EVIDENCE` — deterministic admission failure or no eligible capture;
- valid semantic classifications.

None of the failure domains increments the negative streak. A malformed model result is not coerced into `WEAKENED` or `ABSENT`.

## Public interface

Writes:

- `create_commitment(...)` payable
- `check_commitment(commitment_id)`
- `increase_stake(commitment_id)` payable
- `extend_commitment(commitment_id, new_expiry)`
- `contest_breach(commitment_id, evidence_url, evidence_timestamp)`
- `adjudicate_contest(commitment_id)`
- `settle_breach(commitment_id)`
- `expire_commitment(commitment_id)`

Settlement and refund writes return `PAYOUT_PENDING` and `REFUND_PENDING`. There are no `confirm_settlement` or `confirm_expiry_refund` methods in this version: the contract cannot safely prove that an asynchronous EOA message completed from a caller-supplied assertion or an ambiguous balance delta.

Views:

- `get_commitment(commitment_id)`
- `get_commitment_ids(limit)`
- `commitment_history(commitment_id)`
- `get_ledger()`
- `get_limits()`
- `contract_info()`
- `get_address_record(address)`

## Limits

The current contract exposes its bounds through `get_limits()`. Important defaults are 512 bytes for source URLs, 2,000 characters for commitment text, 32 KiB for an admitted replay, 320 characters for excerpts, 64 retained history entries per commitment, 128 checks per commitment, 1,000 commitments, and contest windows from one hour through 30 days. A commitment expiry may be no more than one year beyond creation-time protocol time.

## Known constraints

This implementation uses one evidence provider: Internet Archive Wayback CDX plus pinned replay. It stores bounded proof metadata rather than document bodies. Contest filing is non-payable; the existing commitment bond remains locked while the evidence is adjudicated. The v0.6 external-message API is asynchronous and finalization-only. The installed runtime exposes address balance reads, but not a unique external-message receipt/result, and a balance delta can be confounded by unrelated wallet activity; therefore confirmation is supplied by the frontend/client’s finalized balance observation rather than falsely recorded by the contract. Studio Direct Mode does not execute `EthSend`; tests intercept the current EVM external-message boundary and assert EOA recipient/value/finalization semantics. The production path is `@gl.evm.contract_interface` plus `_Recipient(Address(eoa)).emit_transfer(value=u256(amount))`.

The contract remains a single file because the current v0.6 starter runner packages the contract source as one mapped file; helper-module extraction should be validated against deployment packaging before Phase 4A.

Holdfast was used as an architectural reference only; no substantial Holdfast source is copied into this contract. If source is reused in a later phase, its Apache-2.0 notice and license obligations must be preserved.
