"""Direct Mode coverage for the Uphold commitment-bond contract."""

import json
import sys

import pytest

from tests.direct.conftest import mock_json_llm, to_hex


SOURCE_URL = "https://example.com/public/commitment"
BASELINE_TIMESTAMP = "20260101000000"
BASELINE_NOW = "2026-01-10T00:00:00Z"
DEFAULT_EXPIRY = "2026-02-10T00:00:00Z"
COMMITMENT_TEXT = "I will publish a monthly transparency report every month."
BASELINE_BODY = (
    "<html><body>I will publish a monthly transparency report every month "
    "for the public.</body></html>"
)


def _deploy(direct_deploy, monkeypatch):
    contract = direct_deploy("contracts/uphold.py")
    sent = []

    class _ImmediateResult:
        def get(self):
            return None

    def record_external_message(request, _decoder):
        sent.append(request)
        return _ImmediateResult()

    import genlayer._internal.on_chain.gl_call as gl_call

    original_gl_call_generic = gl_call.gl_call_generic

    def record_or_delegate(request, decoder):
        if isinstance(request, dict) and "EmitExternalMessage" in request:
            return record_external_message(request, decoder)
        return original_gl_call_generic(request, decoder)

    monkeypatch.setattr(gl_call, "gl_call_generic", record_or_delegate)
    return contract, sent


def _assert_external_transfer(sent, recipient, amount):
    assert len(sent) == 1
    request = sent[0]
    assert set(request) == {"EmitExternalMessage"}
    message = request["EmitExternalMessage"]
    assert message["address"].as_hex == to_hex(recipient)
    assert message["calldata"] == b""
    assert int(message["value"]) == amount
    assert "on" not in message
    return message


def _tx(vm, sender, *, value=0, timestamp=BASELINE_NOW):
    vm.sender = sender
    vm.value = value
    vm.warp(timestamp)


def _archive_mock(
    vm,
    timestamp,
    body,
    *,
    original=SOURCE_URL,
    digest=None,
    status=200,
    declared_length=None,
    mimetype="text/html",
):
    if digest is None:
        digest = "digest-" + timestamp
    if declared_length is None:
        declared_length = len(body.encode("utf-8"))
    row = {
        "timestamp": timestamp,
        "original": original,
        "digest": digest,
        "length": declared_length,
        "statuscode": status,
        "mimetype": mimetype,
    }
    vm.mock_web(
        r".*cdx/search/cdx.*",
        {"status": 200, "body": json.dumps({"captures": [row]})},
    )
    vm.mock_web(
        r".*web\.archive\.org/web/.*",
        {"status": 200, "body": body},
    )


def _semantic_mock(vm, classification, *, excerpt="The archived commitment text", reason="bounded test judgment"):
    mock_json_llm(
        vm,
        r".*Uphold semantic adjudicator.*",
        {
            "classification": classification,
            "excerpt": excerpt,
            "short_reason": reason,
        },
    )


def _create(
    vm,
    contract,
    alice,
    bob,
    *,
    stake=100,
    expiry=DEFAULT_EXPIRY,
    window=86400,
    body=BASELINE_BODY,
    baseline_timestamp=BASELINE_TIMESTAMP,
):
    _tx(vm, alice, value=stake)
    _archive_mock(vm, baseline_timestamp, body)
    _semantic_mock(vm, "HOLDS", excerpt="I will publish a monthly transparency report")
    result = contract.create_commitment(
        "commitment-1",
        "Monthly transparency",
        "public-accountability",
        SOURCE_URL,
        COMMITMENT_TEXT,
        to_hex(bob),
        baseline_timestamp,
        expiry,
        window,
    )
    vm.clear_mocks()
    vm.value = 0
    return result


def _check_with_capture(vm, contract, alice, timestamp, classification, *, body=BASELINE_BODY):
    _tx(vm, alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(vm, timestamp, body)
    _semantic_mock(vm, classification)
    result = contract.check_commitment("commitment-1")
    vm.clear_mocks()
    return result


def _claim_breach(vm, contract, alice):
    first = _check_with_capture(vm, contract, alice, "20260111000000", "WEAKENED")
    second = _check_with_capture(vm, contract, alice, "20260112000000", "ABSENT")
    return first, second


def _assert_ledger_invariant(contract):
    commitment = contract.get_commitment("commitment-1")
    ledger = contract.get_ledger()
    assert ledger["total_escrowed"] == commitment["current_stake"]
    assert (
        ledger["total_deposited"]
        == ledger["total_escrowed"]
        + ledger["total_pending_outflows"]
        + ledger["total_paid_to_beneficiaries"]
        + ledger["total_returned_to_promisors"]
    )


def test_valid_creation_readback_history_listing_and_limits(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    assert _create(direct_vm, contract, direct_alice, direct_bob) == "commitment-1"

    view = contract.get_commitment("commitment-1")
    assert view["status"] == "ACTIVE"
    assert view["promisor"] == to_hex(direct_alice)
    assert view["beneficiary"] == to_hex(direct_bob)
    assert view["original_stake"] == 100
    assert view["current_stake"] == 100
    assert view["baseline_archive_timestamp"] == BASELINE_TIMESTAMP
    assert len(view["baseline_body_digest"]) == 64
    assert contract.get_commitment_ids(10) == ["commitment-1"]
    assert contract.commitment_history("commitment-1")[0]["event"] == "CREATED"
    assert contract.get_limits()["max_archive_bytes"] == 32768
    assert contract.contract_info()["evidence_provider"].startswith("Internet Archive")
    _assert_ledger_invariant(contract)


def test_creation_rejects_zero_stake(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _tx(direct_vm, direct_alice, value=0)
    with direct_vm.expect_revert("stake must be positive"):
        contract.create_commitment(
            "zero", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            to_hex(direct_bob), BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 86400,
        )


def test_creation_rejects_invalid_source_and_unsupported_baseline(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _tx(direct_vm, direct_alice, value=100)
    with direct_vm.expect_revert("invalid source url"):
        contract.create_commitment(
            "bad-url", "Title", "category", "javascript:alert(1)", COMMITMENT_TEXT,
            to_hex(direct_bob), BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 86400,
        )

    _archive_mock(direct_vm, BASELINE_TIMESTAMP, "<html><body>Unrelated page.</body></html>")
    with direct_vm.expect_revert("baseline evidence was not admitted"):
        contract.create_commitment(
            "unsupported", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            to_hex(direct_bob), BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 86400,
        )
    direct_vm.clear_mocks()


def test_creation_rejects_invalid_beneficiary_expiry_and_contest_window(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _tx(direct_vm, direct_alice, value=100)
    with direct_vm.expect_revert("beneficiary must differ from promisor"):
        contract.create_commitment(
            "same-party", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            to_hex(direct_alice), BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 86400,
        )
    with direct_vm.expect_revert("invalid beneficiary"):
        contract.create_commitment(
            "zero-party", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            "0x" + "00" * 20, BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 86400,
        )
    with direct_vm.expect_revert("invalid expiry"):
        contract.create_commitment(
            "bad-expiry", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            to_hex(direct_bob), BASELINE_TIMESTAMP, "not-a-date", 86400,
        )
    with direct_vm.expect_revert("invalid contest window"):
        contract.create_commitment(
            "bad-window", "Title", "category", SOURCE_URL, COMMITMENT_TEXT,
            to_hex(direct_bob), BASELINE_TIMESTAMP, DEFAULT_EXPIRY, 10,
        )


def test_increase_stake_is_promisor_only_and_updates_accounting(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _tx(direct_vm, direct_bob, value=40)
    with direct_vm.expect_revert("only promisor may increase stake"):
        contract.increase_stake("commitment-1")
    _tx(direct_vm, direct_alice, value=40)
    assert contract.increase_stake("commitment-1") == "STAKE_INCREASED"
    view = contract.get_commitment("commitment-1")
    assert view["current_stake"] == 140
    assert view["total_stake_added"] == 40
    assert view["stake_additions_count"] == 1
    assert contract.get_ledger()["total_deposited"] == 140
    assert contract.commitment_history("commitment-1")[-1]["event"] == "STAKE_INCREASED"
    _tx(direct_vm, direct_alice, value=0)
    with direct_vm.expect_revert("stake increase must be positive"):
        contract.increase_stake("commitment-1")
    _assert_ledger_invariant(contract)


def test_stake_cannot_decrease_and_terminal_commitments_cannot_receive_topup(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, expiry="2026-01-11T00:00:00Z")
    _tx(direct_vm, direct_alice, timestamp="2026-01-12T00:00:00Z", value=0)
    assert contract.expire_commitment("commitment-1") == "REFUND_PENDING"
    _tx(direct_vm, direct_alice, timestamp="2026-01-12T00:00:00Z", value=1)
    with direct_vm.expect_revert("commitment is not active"):
        contract.increase_stake("commitment-1")
    with direct_vm.expect_revert("commitment is not active"):
        contract.extend_commitment("commitment-1", "2026-02-01T00:00:00Z")
    view = contract.get_commitment("commitment-1")
    assert view["current_stake"] == 0


def test_extension_only_moves_expiry_forward_and_is_audited(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _tx(direct_vm, direct_bob)
    with direct_vm.expect_revert("only promisor may extend"):
        contract.extend_commitment("commitment-1", "2026-03-01T00:00:00Z")
    _tx(direct_vm, direct_alice)
    assert contract.extend_commitment("commitment-1", "2026-03-01T00:00:00Z") == "EXTENDED"
    with direct_vm.expect_revert("expiry must move forward"):
        contract.extend_commitment("commitment-1", DEFAULT_EXPIRY)
    assert contract.get_commitment("commitment-1")["extensions_count"] == 1
    assert contract.commitment_history("commitment-1")[-1]["event"] == "EXTENDED"


@pytest.mark.parametrize("classification", ["HOLDS", "WEAKENED", "ABSENT", "INDETERMINATE"])
def test_admitted_semantic_classifications_are_recorded(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch, classification
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    assert _check_with_capture(direct_vm, contract, direct_alice, "20260111000000", classification) == classification
    view = contract.get_commitment("commitment-1")
    assert view["checks_run"] == 1
    assert contract.commitment_history("commitment-1")[-1]["classification"] == classification
    assert view["status"] == "ACTIVE"
    assert view["consecutive_negative_count"] == (1 if classification in ("WEAKENED", "ABSENT") else 0)


def test_archive_unavailable_does_not_become_absent_or_breach(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _tx(direct_vm, direct_alice)
    result = contract.check_commitment("commitment-1")
    assert result.startswith("[EXTERNAL]")
    view = contract.get_commitment("commitment-1")
    assert view["consecutive_negative_count"] == 0
    assert view["status"] == "ACTIVE"
    assert contract.commitment_history("commitment-1")[-1]["domain"] == "EXTERNAL"


def test_invalid_oversized_and_stale_captures_are_not_admitted(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)

    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260111000000", "<html><body>small</body></html>", original="https://other.example")
    assert contract.check_commitment("commitment-1").startswith("[NO_EVIDENCE]")
    direct_vm.clear_mocks()

    oversized = "<html><body>" + ("x" * 40_000) + "</body></html>"
    _archive_mock(direct_vm, "20260111000000", oversized, declared_length=100)
    assert contract.check_commitment("commitment-1").startswith("[EVIDENCE]")
    direct_vm.clear_mocks()

    _archive_mock(direct_vm, BASELINE_TIMESTAMP, BASELINE_BODY)
    assert contract.check_commitment("commitment-1").startswith("[NO_EVIDENCE]")
    direct_vm.clear_mocks()
    assert contract.get_commitment("commitment-1")["consecutive_negative_count"] == 0


def test_malformed_model_response_fails_closed(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260111000000", BASELINE_BODY)
    mock_json_llm(direct_vm, r".*Uphold semantic adjudicator.*", "not-json")
    result = contract.check_commitment("commitment-1")
    assert result.startswith("[LLM]")
    view = contract.get_commitment("commitment-1")
    assert view["consecutive_negative_count"] == 0
    assert view["status"] == "ACTIVE"
    direct_vm.clear_mocks()


@pytest.mark.parametrize("classification", ["HOLDS", "WEAKENED", "ABSENT", "INDETERMINATE"])
def test_semantic_validator_independently_agrees_on_each_decision(
    direct_vm, direct_deploy, monkeypatch, classification
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    module = sys.modules["_contract_uphold"]
    direct_vm.clear_validators()
    _semantic_mock(direct_vm, classification)
    result = module._semantic_judgment(COMMITMENT_TEXT, BASELINE_BODY)
    assert result["ok"] is True
    direct_vm.clear_mocks()
    _semantic_mock(direct_vm, classification, excerpt="independent excerpt", reason="independent reason")
    assert direct_vm.run_validator() is True


def test_semantic_validator_rejects_schema_valid_but_substantively_different_decision(
    direct_vm, direct_deploy, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    module = sys.modules["_contract_uphold"]
    direct_vm.clear_validators()
    _semantic_mock(direct_vm, "HOLDS")
    result = module._semantic_judgment(COMMITMENT_TEXT, BASELINE_BODY)
    assert result["classification"] == "HOLDS"
    direct_vm.clear_mocks()
    _semantic_mock(direct_vm, "WEAKENED", excerpt="different substance", reason="different conclusion")
    assert direct_vm.run_validator() is False
    assert contract.get_ledger()["total_deposited"] == 0


def test_malformed_leader_output_is_rejected_by_independent_validator(
    direct_vm, direct_deploy, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    module = sys.modules["_contract_uphold"]
    direct_vm.clear_validators()
    mock_json_llm(direct_vm, r".*Uphold semantic adjudicator.*", "not-json")
    result = module._semantic_judgment(COMMITMENT_TEXT, BASELINE_BODY)
    assert result == {"ok": False, "domain": "LLM", "reason": "unknown_classification"}
    direct_vm.clear_mocks()
    _semantic_mock(direct_vm, "HOLDS")
    assert direct_vm.run_validator() is False
    assert contract.get_ledger()["total_deposited"] == 0


def test_duplicate_capture_does_not_increment_streak(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    assert _check_with_capture(direct_vm, contract, direct_alice, "20260111000000", "WEAKENED") == "WEAKENED"
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260111000000", BASELINE_BODY)
    assert contract.check_commitment("commitment-1").startswith("[NO_EVIDENCE]")
    direct_vm.clear_mocks()
    assert contract.get_commitment("commitment-1")["consecutive_negative_count"] == 1


def test_one_negative_does_not_claim_breach_and_two_distinct_negatives_do(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    first, second = _claim_breach(direct_vm, contract, direct_alice)
    assert first == "WEAKENED"
    assert second == "BREACH_CLAIMED"
    view = contract.get_commitment("commitment-1")
    assert view["status"] == "BREACH_CLAIMED"
    assert view["breach_capture_1"] == "20260111000000"
    assert view["breach_capture_2"] == "20260112000000"
    assert view["consecutive_negative_count"] == 2


def test_holds_resets_streak_and_indeterminate_does_not_increment(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    assert _check_with_capture(direct_vm, contract, direct_alice, "20260111000000", "WEAKENED") == "WEAKENED"
    assert _check_with_capture(direct_vm, contract, direct_alice, "20260112000000", "INDETERMINATE") == "INDETERMINATE"
    assert contract.get_commitment("commitment-1")["consecutive_negative_count"] == 1
    assert _check_with_capture(direct_vm, contract, direct_alice, "20260113000000", "HOLDS") == "HOLDS"
    assert contract.get_commitment("commitment-1")["consecutive_negative_count"] == 0


def test_non_promisor_cannot_extend_or_contest(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _tx(direct_vm, direct_charlie)
    with direct_vm.expect_revert("only promisor may extend"):
        contract.extend_commitment("commitment-1", "2026-03-01T00:00:00Z")
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_charlie)
    with direct_vm.expect_revert("only promisor may contest"):
        contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000")


def test_contest_filing_requires_admitted_original_evidence(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, window=7200)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    assert contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000").startswith("[EXTERNAL]")
    assert contract.get_commitment("commitment-1")["status"] == "BREACH_CLAIMED"

    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    assert contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000") == "CONTESTED"
    direct_vm.clear_mocks()
    assert contract.get_commitment("commitment-1")["status"] == "CONTESTED"


def test_contest_after_deadline_and_duplicate_active_contest_rejected(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, window=3600)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-21T01:00:00Z")
    with direct_vm.expect_revert("contest window expired"):
        contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000")

    # Return to the open window and exercise the one-active-contest gate.
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000")
    direct_vm.clear_mocks()
    with direct_vm.expect_revert("commitment is not contestable"):
        contract.contest_breach("commitment-1", SOURCE_URL, "20260114000000")


def test_successful_contest_restores_active_and_resets_streak(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000")
    direct_vm.clear_mocks()
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    _semantic_mock(direct_vm, "HOLDS")
    assert contract.adjudicate_contest("commitment-1") == "CONTEST_UPHELD"
    direct_vm.clear_mocks()
    view = contract.get_commitment("commitment-1")
    assert view["status"] == "ACTIVE"
    assert view["consecutive_negative_count"] == 0
    assert view["contest_result"] == "UPHELD"
    assert contract.get_ledger()["contests_upheld"] == 1
    assert contract.get_address_record(to_hex(direct_alice))["contests_won"] == 1


def test_rejected_contest_confirms_breach_and_settlement_pays_beneficiary(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    contract.contest_breach("commitment-1", SOURCE_URL, "20260113000000")
    direct_vm.clear_mocks()
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:00:00Z")
    _archive_mock(direct_vm, "20260113000000", BASELINE_BODY)
    _semantic_mock(direct_vm, "ABSENT")
    assert contract.adjudicate_contest("commitment-1") == "BREACH_CONFIRMED"
    direct_vm.clear_mocks()
    assert contract.settle_breach("commitment-1") == "PAYOUT_PENDING"
    _assert_external_transfer(sent, direct_bob, 100)
    view = contract.get_commitment("commitment-1")
    assert view["current_stake"] == 0
    assert view["pending_transfer_recipient"] == to_hex(direct_bob)
    assert view["pending_transfer_amount"] == 100
    assert view["pending_transfer_kind"] == "PAYOUT"
    assert view["pending_transfer_requested_at"]
    ledger = contract.get_ledger()
    assert ledger["total_pending_outflows"] == 100
    assert ledger["total_pending_payouts"] == 100
    assert ledger["total_paid_to_beneficiaries"] == 0
    assert contract.get_address_record(to_hex(direct_bob))["gen_received"] == 0
    assert contract.get_address_record(to_hex(direct_alice))["contests_lost"] == 1
    _assert_ledger_invariant(contract)
    with direct_vm.expect_revert("breach is not settleable"):
        contract.settle_breach("commitment-1")


def test_no_contest_elapsed_claim_pays_and_early_settlement_rejected(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, window=3600)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T00:30:00Z")
    with direct_vm.expect_revert("contest window is still open"):
        contract.settle_breach("commitment-1")
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T01:00:00Z")
    assert contract.settle_breach("commitment-1") == "PAYOUT_PENDING"
    _assert_external_transfer(sent, direct_bob, 100)


def test_clean_expiry_returns_stake_and_pending_breach_cannot_bypass_settlement(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, expiry="2026-01-11T00:00:00Z")
    _tx(direct_vm, direct_alice, timestamp="2026-01-10T23:59:59Z")
    with direct_vm.expect_revert("commitment has not expired"):
        contract.expire_commitment("commitment-1")
    _tx(direct_vm, direct_alice, timestamp="2026-01-11T00:00:00Z")
    assert contract.expire_commitment("commitment-1") == "REFUND_PENDING"
    _assert_external_transfer(sent, direct_alice, 100)
    view = contract.get_commitment("commitment-1")
    assert view["pending_transfer_kind"] == "REFUND"
    assert contract.get_ledger()["total_pending_refunds"] == 100
    assert contract.get_ledger()["total_returned_to_promisors"] == 0
    assert contract.get_address_record(to_hex(direct_alice))["gen_returned"] == 0
    with direct_vm.expect_revert("commitment is not cleanly active"):
        contract.expire_commitment("commitment-1")



def test_pending_breach_cannot_bypass_settlement_through_expiry(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, expiry="2026-01-30T00:00:00Z")
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-02-01T00:00:00Z")
    with direct_vm.expect_revert("commitment is not cleanly active"):
        contract.expire_commitment("commitment-1")


def test_pending_payout_is_single_use_and_blocks_topup_extension_and_expiry(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, window=3600)
    _claim_breach(direct_vm, contract, direct_alice)
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T01:00:00Z")
    assert contract.settle_breach("commitment-1") == "PAYOUT_PENDING"
    with direct_vm.expect_revert("breach is not settleable"):
        contract.settle_breach("commitment-1")
    with direct_vm.expect_revert("commitment is not cleanly active"):
        contract.expire_commitment("commitment-1")
    _tx(direct_vm, direct_alice, timestamp="2026-01-20T01:00:00Z", value=1)
    with direct_vm.expect_revert("commitment is not active"):
        contract.increase_stake("commitment-1")
    with direct_vm.expect_revert("commitment is not active"):
        contract.extend_commitment("commitment-1", "2026-03-01T00:00:00Z")
    assert len(sent) == 1


def test_pending_refund_is_single_use_and_blocks_topup_and_extension(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, expiry="2026-01-11T00:00:00Z")
    _tx(direct_vm, direct_alice, timestamp="2026-01-12T00:00:00Z")
    assert contract.expire_commitment("commitment-1") == "REFUND_PENDING"
    with direct_vm.expect_revert("commitment is not cleanly active"):
        contract.expire_commitment("commitment-1")
    _tx(direct_vm, direct_alice, timestamp="2026-01-12T00:00:00Z", value=1)
    with direct_vm.expect_revert("commitment is not active"):
        contract.increase_stake("commitment-1")
    with direct_vm.expect_revert("commitment is not active"):
        contract.extend_commitment("commitment-1", "2026-03-01T00:00:00Z")
    assert len(sent) == 1


def test_rc5_external_message_is_an_eoa_transfer(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, expiry="2026-01-11T00:00:00Z")
    _tx(direct_vm, direct_alice, timestamp="2026-01-12T00:00:00Z")

    assert contract.expire_commitment("commitment-1") == "REFUND_PENDING"
    _assert_external_transfer(sent, direct_alice, 100)
    assert contract.get_commitment("commitment-1")["status"] == "REFUND_PENDING"


def test_transfer_helper_rejects_zero_and_invalid_recipients(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, sent = _deploy(direct_deploy, monkeypatch)
    instance = contract._instance
    import genlayer as gl

    with direct_vm.expect_revert("transfer amount must be positive"):
        instance._pay(gl.Address(direct_bob), gl.u256(0))
    with direct_vm.expect_revert("invalid transfer recipient"):
        instance._pay(gl.Address.ZERO, gl.u256(1))
    assert sent == []


def test_accounting_topup_refund_and_address_history(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob, stake=250)
    _tx(direct_vm, direct_alice, value=75)
    contract.increase_stake("commitment-1")
    assert contract.get_ledger()["total_escrowed"] == 325
    assert contract.get_address_record(to_hex(direct_alice))["total_gen_bonded"] == 325
    _tx(direct_vm, direct_alice, timestamp="2026-02-10T00:00:00Z")
    contract.expire_commitment("commitment-1")
    ledger = contract.get_ledger()
    assert ledger["total_deposited"] == 325
    assert ledger["total_escrowed"] == 0
    assert ledger["total_pending_outflows"] == 325
    assert ledger["total_pending_refunds"] == 325
    assert ledger["total_returned_to_promisors"] == 0
    _assert_ledger_invariant(contract)


def test_views_are_bounded_and_contract_info_is_explicit(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    contract, _ = _deploy(direct_deploy, monkeypatch)
    _create(direct_vm, contract, direct_alice, direct_bob)
    with direct_vm.expect_revert("invalid listing limit"):
        contract.get_commitment_ids(101)
    info = contract.contract_info()
    assert info["semantic_classifications"] == ["HOLDS", "WEAKENED", "ABSENT", "INDETERMINATE"]
    record = contract.get_address_record(to_hex(direct_alice))
    assert record["commitments_created"] == 1
    assert record["contests_won"] == 0
