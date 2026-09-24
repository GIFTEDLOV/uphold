"""Regenerate the official gltest fee profile from finalized receipt evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from gltest.fees import get_fee_profile_collector, reset_fee_profile_collector


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--deploy-receipt", type=Path, required=True)
    parser.add_argument("--operations", type=Path, required=True)
    parser.add_argument("--headroom", type=float, default=1.25)
    parser.add_argument("--network", default="studio-dev")
    parser.add_argument("--chain-id", type=int, default=61997)
    args = parser.parse_args()

    collector = reset_fee_profile_collector()
    deployment = json.loads(args.deploy_receipt.read_text(encoding="utf-8"))
    receipt = deployment.get("receipt", deployment)
    if deployment.get("finalStatus") not in (None, "FINALIZED"):
        raise SystemExit("deployment receipt is not finalized")
    collector.record_deploy(receipt)

    observed_methods: set[str] = set()
    for path in sorted(args.operations.glob("*.json")):
        operation = json.loads(path.read_text(encoding="utf-8"))
        if operation.get("finalStatus") != "FINALIZED":
            continue
        if operation.get("execution") != "FINISHED_WITH_RETURN":
            continue
        method = operation.get("method")
        if not method:
            continue
        collector.record_method(method, operation.get("receipt", {}))
        observed_methods.add(method)

    required = {
        "create_commitment",
        "check_commitment",
        "increase_stake",
        "extend_commitment",
        "contest_breach",
        "adjudicate_contest",
        "settle_breach",
        "expire_commitment",
    }
    missing = sorted(required - observed_methods)
    if missing:
        raise SystemExit(f"missing finalized method receipts: {', '.join(missing)}")

    profile = collector.write(
        args.output,
        network=args.network,
        headroom=args.headroom,
        chain_id=args.chain_id,
    )
    for section in [profile.get("deploy", {}), *profile.get("methods", {}).values()]:
        if any(int(value) < 0 for value in section.values()):
            raise SystemExit("fee profile contains a negative resource value")
    print(json.dumps({"methods": sorted(observed_methods), "output": str(args.output)}))


if __name__ == "__main__":
    main()
