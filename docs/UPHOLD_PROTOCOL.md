# Uphold Protocol

## Trust problem

Uphold lets a promisor lock GEN behind a public, time-bounded commitment. A beneficiary can receive the bond only after authenticated archived evidence shows that the published commitment was materially weakened or removed. If the commitment survives expiry, the bond returns to the promisor.

The protocol is designed to make an economic decision auditable. It does not treat an AI opinion, an unavailable website, or a transaction status as proof of breach.

## Why GenLayer is necessary

The archive document is external, while the question “does this document still substantially carry the original promise?” is semantic. GenLayer provides validator-backed execution for that bounded question. The contract still owns all authorization, admissibility, lifecycle, timing, and payment decisions.

## Responsibility split

Deterministic contract code owns:

- callers, addresses, stake/value arithmetic, deadlines, and lifecycle transitions;
- URL and archive timestamp validation, capture uniqueness, byte limits, digests, and bounded history;
- the two-point breach gate, contest window, settlement, expiry, and ledger invariants.

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
6. The model receives the authenticated commitment and bounded excerpt and must return a strict JSON object. Only `classification` can affect state.

An admitted capture is replay-protected by its strictly advancing timestamp. The same capture cannot advance a check or streak twice.

## Lifecycle and breach rule

The normal lifecycle is:

`ACTIVE → BREACH_CLAIMED → CONTESTED → ACTIVE`

or:

`ACTIVE → BREACH_CLAIMED → BREACH_CONFIRMED → SETTLED`

and clean expiry is:

`ACTIVE → COMPLETED`.

`WEAKENED` and `ABSENT` are qualified negative observations. One negative is never enough. Two distinct, strictly advancing qualified negatives are required. `HOLDS` resets the negative streak. `INDETERMINATE`, archive failures, and validator disagreement do not add to or reset the streak.

The second qualified negative creates a contest deadline but does not pay anyone.

## Contest

Only the promisor may file one contest for an open breach claim, before the deterministic deadline. The supplied evidence must reference the original source and pass the same CDX/replay admission pipeline. Adjudication asks only whether that authenticated evidence still supports the original commitment.

`HOLDS` upholds the contest, restores `ACTIVE`, and resets the streak. A valid qualified negative confirms the breach. Insufficient or failed model evidence remains fail-closed and does not silently convert infrastructure failure into punishment.

## Settlement and clean expiry

After a contest window elapses without a contest, or after a contest is rejected, anyone may call `settle_breach`. The contract zeroes the current stake, records the ledger transition, and emits a finalized transfer to the beneficiary. Settlement arithmetic is deterministic and has no model dependency.

After expiry, while the commitment is still cleanly `ACTIVE`, anyone may call `expire_commitment`; the remaining stake is returned to the promisor. A claimed, contested, confirmed, settled, or completed commitment cannot use the clean-expiry path.

## Accounting invariants

The contract tracks total deposits, escrow, beneficiary payments, promisor returns, and protocol counters. The primary value invariant tested in Direct Mode is:

`total_deposited = total_escrowed + total_paid_to_beneficiaries + total_returned_to_promisors`

For each commitment, `current_stake` is the only unsettled bonded value. Stake can increase but cannot decrease before a terminal transition. Terminal transitions zero the stake and reject repeat settlement/refund/top-up attempts.

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

This Phase 2 implementation uses one evidence provider: Internet Archive Wayback CDX plus pinned replay. It stores bounded proof metadata rather than document bodies. Contest filing is non-payable in this phase; the existing commitment bond remains locked while the evidence is adjudicated. The v0.6 Direct VM does not emulate outbound account transfers, so Direct Mode tests replace only the transfer boundary with a recording stub while asserting recipient, amount, finalized stage, state zeroing, and ledger effects. Production uses `gl.chain.Account.emit_transfer`.

The contract remains a single file because the current v0.6 starter runner packages the contract source as one mapped file; helper-module extraction should be validated against deployment packaging before Phase 3.

Holdfast was used as an architectural reference only; no substantial Holdfast source is copied into this contract. If source is reused in a later phase, its Apache-2.0 notice and license obligations must be preserved.
