# Final reviewer hardening audit

This audit distinguishes protocol behavior from frontend presentation and points to the direct regression suite. The original stale-contest finding was confirmed, fixed, deployed in the release candidate, and exercised through controlled A/B/C lifecycle evidence.

## Findings

| Failure class | Classification | Evidence |
| --- | --- | --- |
| A. Round / evidence liveness | APPLICABLE_AND_SAFE | `_authenticated_live_capture` fails closed; hardened `contest_breach` has one bounded 900-second outage grace and remains retryable without semantic classification. There is no finalist/operator-controlled set; `commitment_ids_json` is append-only from `create_commitment`. |
| B. Unassessed vs consensus-cleared state | APPLICABLE_AND_SAFE | `EvidenceSnapshot` stores `captured_state` and `classification`; contest captures are `AUTHENTICATED` / `UNASSESSED` until adjudication. `EvidenceTimeline.tsx` renders the explicit pending state. |
| C. Permissionless adverse checking | APPLICABLE_AND_SAFE | `check_commitment` has no sender restriction and calls `_get` plus `_require_active`; the existing `test_non_promisor_cannot_extend_or_contest` establishes sender restrictions only for protected methods. A dedicated third-party check regression is added in this hardening run. |
| D. Source authentication and authority | APPLICABLE_AND_SAFE | `_valid_url` requires HTTPS, no credentials, no fragment, and valid host/port. The contract locks `source_url` and explicitly does not claim domain ownership or legal identity. |
| E. Challenge reassessment | APPLICABLE_AND_SAFE | The stale path was confirmed and removed. `contest_breach(commitment_id)` captures the locked source fresh; `adjudicate_contest` assesses only the immutable contest snapshot. |
| F. Multiple/open challenge behavior | APPLICABLE_AND_SAFE | Status gates allow one active contest, monotonic contest nonces prevent namespace reuse, and resolved contests cannot be adjudicated again. |
| G. Repeated-notice / evidence priority | APPLICABLE_AND_SAFE | Normal checks use `commitment_id:<sequence>`, increment `checks_run` only after semantic success, and `_store_snapshot` rejects conflicting rewrites. `test_repeated_live_capture_creates_a_new_immutable_snapshot` and `test_authenticated_snapshot_is_immutable_and_conflicting_rewrite_is_rejected` cover these properties. Contest snapshots need their own namespace. |
| H. Settlement liveness | APPLICABLE_AND_SAFE | `_request_transfer` requires no existing pending transfer, zeros `current_stake`, moves value from escrow to pending outflows, and emits one external EOA transfer. `settle_breach` and `expire_commitment` are status-gated. The existing settlement/refund tests cover single-use behavior. External EOA completion has no contract-level receipt and remains an honest limitation. |

## Required hardening outcome

The candidate contract makes `contest_breach(commitment_id)` capture `commitment.source_url` itself, store an immutable `<commitment_id>:contest:<nonce>` snapshot as `AUTHENTICATED` / `UNASSESSED`, and make `adjudicate_contest` assess only that exact snapshot. A single consensus-observed capture outage may extend the contest deadline by the bounded protocol grace; the failure remains infrastructure evidence and never becomes `WEAKENED` or `ABSENT`.

The behavioral test matrix, candidate deployment proof, controlled adversarial lifecycle proof, and row-by-row live reviewer matrix are included below. The real IANA positive proof remains separate from controlled fixture evidence.

## Final candidate audit

The hardened candidate is `0x23786A52b62DC489A5f69653dedD68d1fc56c231`, deployed by
`0x50c4b9ba6daa08e23eee1926bafc9fddc2b23d9c2afed971cc4fb26e16348a3f`, with
source SHA `090BA710374AC156B8D2CA72001E20F1CDA8482F5530A7C8570357F847D2A1F8`.
The controlled lifecycle evidence is explicitly separate from the real IANA
positive proof in `evidence/studio-next/uphold-hardening-live-proof.json`.

| Reviewer failure mode | Uphold control | Test proof | Live proof | Status |
| --- | --- | --- | --- | --- |
| Unavailable committed evidence liveness | Capture failure remains retryable; no semantic result; one bounded grace | `test_hardening_contest_outage_stays_retryable_and_nonsemantic`, `test_hardening_outage_grace_applies_at_most_once`, `test_hardening_outage_grace_is_bounded_by_protocol_limit` | No outage was manufactured; controlled A/B captures succeeded | PASS — local control; no artificial outage claim |
| Operator/finalist-set control | No finalist/operator result set; commitment IDs are append-only | `test_views_are_bounded_and_contract_info_is_explicit` | Candidate readback lists four commitments without privileged result-set mutation | NOT_APPLICABLE — no finalist set exists |
| Unassessed vs consensus-cleared state | Contest snapshot stores `AUTHENTICATED` / `UNASSESSED`; adjudication stores result separately | `test_hardening_fresh_contest_snapshot_is_authenticated_but_unassessed`, `test_hardening_adjudication_is_bound_to_exact_fresh_contest_snapshot` | A `:contest:1` and B `:contest:1` both read back unassessed before adjudication | PASS |
| Owner suppression of adverse checks | `check_commitment` has no promisor-only gate | `test_hardening_promisor_has_no_check_suppression_gate` | Third-party sender check: `0xba997ed8443ff6ac430fc5946c2722d7626ef6733005cc0efc1a4802993210f4` | PASS |
| Third-party assessment authorization | Any caller may initiate a valid check; protected lifecycle methods remain gated | `test_hardening_third_party_can_call_permissionless_check` | Third-party A check finalized successfully | PASS |
| Caller-selected semantic URL substitution | Contest API accepts only commitment ID and uses locked source | `test_hardening_contest_has_no_caller_selected_url_or_timestamp`, `test_hardening_contest_uses_locked_source_url` | A/B contest calldata contained only the commitment ID; stored URL matched the original | PASS |
| Stale challenge evidence | Contest snapshot is fresh and uses a separate nonce namespace | `test_hardening_baseline_cannot_be_contest_evidence`, `test_hardening_prebreach_snapshot_cannot_be_contest_evidence`, `test_hardening_breach_snapshot_cannot_be_reused_as_contest_evidence` | A restored contest used `controlled-a-20260917:contest:1`, SHA `b131e6ba…e8a753`, not any prior snapshot | PASS |
| First-challenge-only reassessment | Each breach claim gets a fresh contest nonce and exact snapshot binding | `test_hardening_adjudication_is_bound_to_exact_fresh_contest_snapshot`, `test_hardening_resolved_contest_cannot_be_adjudicated_again` | A contest was independently captured and adjudicated after the later negative breach | PASS |
| Multiple/open challenge ambiguity | One active contest per commitment; resolved contests cannot replay | `test_hardening_only_one_active_contest_exists`, `test_hardening_resolved_contest_cannot_be_adjudicated_again` | A and B each show one contest namespace and one adjudication | PASS |
| Repeated-evidence priority | Snapshots are write-once, sequence-based, and never relabeled | `test_repeated_live_capture_creates_a_new_immutable_snapshot`, `test_hardening_immutable_snapshots_cannot_be_overwritten`, `test_hardening_old_positive_snapshot_is_not_relabelled_fresh` | A history preserves baseline, checks, and contest snapshot separately | PASS |
| Identity/source overclaiming | Documentation and contract claim content authentication only, not domain ownership | `test_hardening_contract_does_not_claim_domain_ownership` | Contract `source_claim` readback explicitly denies ownership/legal-identity proof | PASS |
| Double settlement | Pending transfer and terminal status gates make settlement single-use | `test_hardening_settlement_is_single_use`, `test_pending_payout_is_single_use_and_blocks_topup_extension_and_expiry` | B has one successful settlement and `PAYOUT_PENDING`; no duplicate broadcast | PASS |
| Ambiguous transaction rebroadcast | Hash is persisted before polling and reconciled unchanged | lifecycle writer records; `test_hardening_settlement_is_single_use` | A contest and positive increase both reconciled their original hashes after RPC readback limits; duplicate broadcasts: 0 | PASS |
| HTTPS-only source validation | New sources require HTTPS, no credentials, fragments, or invalid hosts | `test_hardening_new_sources_require_valid_https_urls`, `test_creation_rejects_invalid_source_and_unsupported_baseline` | IANA and fixture sources are HTTPS and remain locked | PASS |
| Exact source lock | Commitment URL is immutable and reused by checks/contests | `test_hardening_contest_uses_locked_source_url` | A/B contest readbacks match the original fixture URL exactly | PASS |
| Infrastructure failure becoming negative evidence | Capture failure returns a retryable failure domain and leaves streak/state unchanged | `test_hardening_source_failure_does_not_increment_negative_count`, `test_hardening_source_failure_never_creates_absent` | No live infrastructure failure was converted to a semantic result | PASS — local control; no false live claim |
| Settlement before effective deadline | Effective contest deadline includes only the bounded outage grace | `test_hardening_settlement_respects_effective_grace_deadline` | B was settled only after rejected adjudication, not by deadline bypass | PASS |
| Payout/refund mutual exclusion | One pending transfer kind blocks the other and preserves ledger buckets | `test_hardening_payout_and_refund_are_mutually_exclusive`, `test_hardening_pending_payout_preserves_ledger_invariant`, `test_hardening_pending_refund_preserves_ledger_invariant` | Final ledger has exactly one pending payout for B and one pending refund for C | PASS |
| Finality, execution, and readback | Promotion evidence requires `FINALIZED`, `isSuccessful`, expected execution, and state readback | full candidate operation records and deployment manifest | All eight public writes finalized with `FINISHED_WITH_RETURN`; readbacks verified | PASS |

## Live proof qualification

The real positive proof is `live-proof-v2-20260918` against IANA and is the
headline proof. A/B/C are controlled adversarial tests using the fixture
repository `GIFTEDLOV/uphold-lifecycle-fixture`. Controlled payout and refund
states are contract-level `PAYOUT_PENDING` / `REFUND_PENDING`; completion of
external EOA transfers remains observed off-contract.
