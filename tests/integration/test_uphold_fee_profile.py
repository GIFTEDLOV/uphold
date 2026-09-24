"""Official gltest fee-profile coverage for every Uphold V1.2 write branch."""

from __future__ import annotations

import pytest
from gltest.assertions import tx_execution_succeeded
from gltest.fees import get_fee_profile_collector
from gltest.clients import get_gl_client
from genlayer_py.types import TransactionHashVariant

from tests.integration.test_uphold_v12 import (
    _context,
    _create,
    _deploy,
    _fee_options,
)


def _send(contract, method: str, args: list, *, value: int = 0, context=None, triggered=False):
    return getattr(contract, method)(args=args).transact(
        value=value,
        fees=get_gl_client().estimate_transaction_fees(_fee_options(method)),
        wait_until="finalized",
        wait_triggered_transactions=triggered,
        transaction_context=context,
    )


@pytest.mark.integration
def test_uphold_official_fee_profile_all_writes():
    contract = _deploy()

    # Clean positive path plus the largest ordinary accounting inputs.
    assert tx_execution_succeeded(_create(contract, "profile-positive"))
    assert tx_execution_succeeded(
        _send(
            contract,
            "check_commitment",
            ["profile-positive"],
            context=_context("HOLDS", timestamp="2026-01-05T00:00:00Z"),
        )
    )
    assert tx_execution_succeeded(
        _send(contract, "increase_stake", ["profile-positive"], value=25, context={"genvm_datetime": "2026-01-06T00:00:00Z"})
    )
    assert tx_execution_succeeded(
        _send(contract, "extend_commitment", ["profile-positive", "2026-01-25T00:00:00Z"], context={"genvm_datetime": "2026-01-07T00:00:00Z"})
    )

    # Negative and contest path, including semantic adjudication and payout.
    assert tx_execution_succeeded(
        _create(
            contract,
            "profile-breach",
            expiry="2026-02-10T00:00:00Z",
            timestamp="2026-01-01T00:00:00Z",
        )
    )
    assert tx_execution_succeeded(
        _send(contract, "check_commitment", ["profile-breach"], context=_context("WEAKENED", timestamp="2026-01-01T01:00:00Z"))
    )
    assert tx_execution_succeeded(
        _send(contract, "check_commitment", ["profile-breach"], context=_context("ABSENT", timestamp="2026-01-01T02:00:00Z"))
    )
    contest_receipt = _send(
        contract,
        "contest_breach",
        ["profile-breach"],
        context=_context("HOLDS", timestamp="2026-01-01T03:00:00Z"),
    )
    assert tx_execution_succeeded(contest_receipt), contest_receipt
    assert tx_execution_succeeded(
        _send(contract, "adjudicate_contest", ["profile-breach"], context=_context("ABSENT", timestamp="2026-01-01T04:00:00Z"))
    )
    assert tx_execution_succeeded(
        _send(contract, "settle_breach", ["profile-breach"], context={"genvm_datetime": "2026-01-15T00:00:00Z"}, triggered=True)
    )

    # Expiry/refund path.
    assert tx_execution_succeeded(_create(contract, "profile-expiry", expiry="2026-01-02T00:00:00Z"))
    assert tx_execution_succeeded(
        _send(contract, "expire_commitment", ["profile-expiry"], context={"genvm_datetime": "2026-01-03T00:00:00Z"}, triggered=True)
    )

    final = contract.get_ledger(args=[]).call(
        transaction_hash_variant=TransactionHashVariant.LATEST_FINAL
    )
    assert int(final["commitments_created"]) == 3

    profile = get_fee_profile_collector().build_profile(
        network="studio-dev", headroom=1.25, chain_id=61997
    )
    expected = {
        "create_commitment",
        "check_commitment",
        "increase_stake",
        "extend_commitment",
        "contest_breach",
        "adjudicate_contest",
        "settle_breach",
        "expire_commitment",
    }
    assert set(profile["methods"]) == expected
    for entry in [profile["deploy"], *profile["methods"].values()]:
        assert int(entry["executionBudgetPerRound"]) >= 0
        assert set(entry) >= {
            "leaderTimeunitsAllocation",
            "validatorTimeunitsAllocation",
            "executionBudgetPerRound",
            "totalMessageFees",
            "rotationsPerRound",
        }
        assert "feeValue" not in entry
