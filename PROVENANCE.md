# Uphold release provenance

This file records the blocked V1.2 release attempt and preserves the complete historical V1.1 production evidence. No V1.2 address, frontend promotion, Vercel deployment, GitHub release, or branch-protection change is claimed after the failed hosted execution.

## Current V1.2 candidate — blocked

- Branch: uphold/app
- Final source commit: 1e1c22ab6180329154f4a432e80ab308982dbe96
- Contract source: contracts/uphold.py
- Candidate source SHA-256: EC4BD059AC218BA3E9151EE34C6B41F8810B371FF95F9A153B1D0BCB98EBB71C
- Contract version: live-snapshot-v1.2
- Network: GenLayer Studio-dev
- RPC: https://studio-dev.genlayer.com/api
- Chain ID: 61997
- Deployment attempt: 0x06e758820d433baa29061b7dd432042dcefd8ec40749b53982bafa9cd9841f86
- Deployment status: FINALIZED
- Execution: FINISHED_WITH_ERROR
- Receipt error: invalid_contract runner malformed
- Contract address: none
- Evidence: deployments/studio-dev/v1.2/manifest.pending.json
- Exact RC family: docs/genlayer-release-family.json
- GitHub CI: run 35990628506, success on all five jobs

The candidate passed local and reproducible CI gates, but the canonical hosted runner was not compatible with this deployment attempt. Resolve and independently audit runner compatibility before any new release attempt. The first deployment transaction must not be retried blindly.

## Current official runner probe — failed

The current official `write-contract` skill documents `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`. A disposable one-view probe using that exact header passed local `genvm-lint check`, schema, and typecheck, but its single Studio-dev deployment finalized with `FINISHED_WITH_ERROR` and `invalid_contract runner malformed`:

- Probe source: `artifacts/runner-probe/studio-dev-runner-probe.py`
- Probe SHA-256: `B9F5A1F7E9B7B9D26C811F25E7FC475965DC1C51C516FF10EF92BA8722A0C392`
- Probe transaction: `0x414d53befcc5bd9acc37b82b0053cb447d679e7077663f8a16f8568699b51abf`
- Raw receipt: `artifacts/runner-probe/manifest.pending.json`
- Probe address/readback: none

The active Uphold source and runner were not changed after this failure. No random runner substitution or third Uphold deployment was attempted.

## Historical V1.1 contract

- Branch: uphold/app
- Source commit: 536346f00f158f374f6e5e28112a0fc06a9065a4
- Contract source: contracts/uphold.py
- Contract SHA-256: 090BA710374AC156B8D2CA72001E20F1CDA8482F5530A7C8570357F847D2A1F8
- Contract version: live-snapshot-v1.1
- Address: 0x23786A52b62DC489A5f69653dedD68d1fc56c231
- Deployment transaction: 0x50c4b9ba6daa08e23eee1926bafc9fddc2b23d9c2afed971cc4fb26e16348a3f
- RPC: https://studio-next.genlayer.com/api
- Chain ID: 61997
- Runner dependency: py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng

## Historical V1.1 evidence

- Deployment proof: deployments/studio-next/uphold-hardening.json
- Live lifecycle proof: evidence/studio-next/uphold-hardening-live-proof.json
- Raw lifecycle operation receipts: evidence/studio-next/hardening-live-operations/
- Fee profile: frontend/fee-profile.json
- Fee profile SHA-256: 9BDF64B9C58F2DCBF8DC7CB66D74C18DB0CD7D50A5EE2E039CEDC8C67D59A072

The real positive proof covers creation, an authenticated baseline snapshot, a successful check classified HOLDS, a later authenticated snapshot, a stake increase, expiry extension, ledger invariants, and address records. Controlled adversarial A/B/C evidence additionally covers fresh contest capture, upheld and rejected contest adjudication, payout-pending, and refund-pending states. These controlled results are not presented as natural production breach evidence.

## Historical V1.1 frontend configuration

The public build is configured with:

~~~text
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio-next.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61997
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studio Next
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
NEXT_PUBLIC_CONTRACT_ADDRESS=0x23786A52b62DC489A5f69653dedD68d1fc56c231
~~~

## Existing production configuration

- GitHub repository: https://github.com/GIFTEDLOV/uphold
- Release source commit before final production metadata: 22dca3e5a09f699d6b39a5374c2c559f855a65ef
- Vercel project: `uphold`
- Vercel project ID: `prj_YqhtNLEgwPPj7nhGoamGr6vbMd67`
- Vercel root directory: `frontend`
- Production URL: https://uphold-sable.vercel.app
- Existing production remains https://uphold-sable.vercel.app and was not changed by the blocked V1.2 attempt.

The production project is the new Uphold project and is not the historical UptimeBond project. The final metadata commit and its resulting Vercel deployment are reported in the release audit.

## Historical records

The following are retained for provenance and must not be confused with the current contract:

- Historical old successful but superseded contract: 0x96671389548f170A6f02BC3017495d157d827599
- Historical failed old-runner deployment transaction: 0x5f37c53acfe9af24f212f4b117067ca899bb2ad8d7461e328c0af5b6c7fc4b62
- Failed Wayback/CDX experiments and disposable live-snapshot smoke evidence remain in evidence/studio-next/.
