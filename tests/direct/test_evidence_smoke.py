"""Local Direct Mode proof for the disposable live-source smoke."""

import hashlib


SOURCE_URL = "https://example.com/evidence-smoke"
BODY = "<html><head><style>.hidden{display:none}</style></head><body>live authenticated evidence smoke</body></html>"


def test_live_fetch_and_two_immutable_snapshots(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/_studio_next_live_evidence_smoke.py")
    direct_vm.mock_web(
        r"https://example\.com/evidence-smoke$",
        {"status": 200, "body": BODY},
    )

    assert contract.capture(SOURCE_URL) == "snapshot:0"
    assert contract.capture(SOURCE_URL) == "snapshot:1"
    snapshots = contract.get_snapshots()
    raw = BODY.encode("utf-8")
    assert len(snapshots) == 2
    assert snapshots[0]["sequence"] == 0
    assert snapshots[1]["sequence"] == 1
    assert snapshots[0]["source_url"] == SOURCE_URL
    assert snapshots[0]["http_status"] == 200
    assert snapshots[0]["sha256"] == hashlib.sha256(raw).hexdigest()
    assert snapshots[0]["byte_length"] == len(raw)
    assert snapshots[0]["normalized_content"] == "live authenticated evidence smoke"
    assert snapshots[0]["captured_state"] == "AUTHENTICATED"
    assert snapshots[0]["capture_timestamp"]
    assert snapshots[1]["capture_timestamp"]
    assert contract.contract_info() == "UPHOLD_LIVE_EVIDENCE_SMOKE"
