# Uphold

**Put money behind your word.**

Uphold is a commitment-bond application for GenLayer. A promisor publishes an exact commitment, anchors it to an authenticated Internet Archive capture, and locks GEN behind it. Over time, GenLayer validators answer one bounded question: whether a later admitted document still substantially carries the original promise.

The contract owns authorization, evidence admission, timestamps, lifecycle transitions, stake arithmetic, contests, settlement, and accounting. Validators do not choose beneficiaries, decide deadlines, or move funds. A breach claim requires two distinct consecutive qualified negative evidence points; archive or model failure never becomes breach evidence.

## Current status

The Uphold contract and frontend are implemented locally and tested in Direct Mode. The project is **not yet deployed**. No Studio Next transaction is required for local frontend development. Before demo or production use, Phase 4 must deploy to Studio Next and verify real value transfers; Direct Mode records transfer calls but does not execute wallet balances.

Target network:

- GenLayer Studio Next
- RPC: `https://studio-next.genlayer.com/api`
- Chain ID: `61997`
- Explorer: `https://explorer-studio-dev.genlayer.com/`

## Repository map

```text
contracts/uphold.py             Uphold intelligent contract
tests/direct/test_uphold.py     Uphold Direct Mode coverage
frontend/app/                   Next.js App Router application
frontend/components/uphold/     Product UI and transaction experience
frontend/lib/uphold/             Typed contract client and protocol helpers
docs/UPHOLD_PROTOCOL.md          Contract trust model
docs/UPHOLD_PHASE1_BASELINE.md  Baseline and compatibility evidence
deploy/                          Deployment scripts, unused until Phase 4
```

The original starter contracts and regression infrastructure remain in the repository while Uphold is developed. The retired starter-contract fee data is preserved as `frontend/fee-profile.football-legacy.json` and is not active for Uphold. The frontend uses network-default fee estimation until a new Uphold profile is measured after deployment.

## Local setup

Requirements: Node 24.x, npm, Python 3.12 or 3.13 for contract tests, and the GenLayer CLI. Copy `frontend/.env.example` to `frontend/.env`; leave `NEXT_PUBLIC_CONTRACT_ADDRESS` as the placeholder until deployment.

```shell
npm ci
npm run dev
```

The frontend remains usable as an honest pre-deployment shell. It does not fabricate chain statistics, commitments, transaction hashes, or a contract address.

## Contract interface

Payable writes: `create_commitment`, `increase_stake`.

State-changing writes: `check_commitment`, `extend_commitment`, `contest_breach`, `adjudicate_contest`, `settle_breach`, `expire_commitment`.

Views: `get_commitment`, `get_commitment_ids`, `commitment_history`, `get_ledger`, `get_limits`, `contract_info`, and `get_address_record`.

## Testing

Frontend gates:

```shell
npm test
npm run lint
npm run build
```

Authoritative contract gates run in WSL Ubuntu with Python 3.12.3 and GenVM v0.6.0-rc2:

```shell
wsl.exe -d Ubuntu --cd /mnt/c/Users/DELL/Uphold -- env GENVM_VERSION=v0.6.0-rc2 /home/dell/Uphold/.venv-genlayer/bin/python -m pytest tests/direct/ -v
wsl.exe -d Ubuntu --cd /mnt/c/Users/DELL/Uphold -- genvm-lint check contracts/uphold.py
```

Do not use Bradbury, stable Studionet 61999, or the obsolete Studio Dev RPC for this branch.

## License

The Uphold implementation in this repository remains under the repository’s existing project license. Holdfast was used as an architectural reference only; no substantial Holdfast source is copied into this phase. If source code from the Apache-2.0 Holdfast project is later reused, retain its copyright, license, and NOTICE obligations and document the derived portions.
