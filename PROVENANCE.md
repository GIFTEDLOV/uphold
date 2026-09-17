# Uphold release provenance

This file records the current public Uphold release. Historical deployments are retained below for auditability and are not current targets.

## Canonical contract

- Branch: uphold/app
- Source commit: 2064950cfe1ee353772df6027e1660326e83c792
- Contract source: contracts/uphold.py
- Contract SHA-256: 3DDFAA229BF36B7D8F06B70FE6E1B4582D004A3FFEDAF08E154834B54819FD3F
- Contract version: live-snapshot-v1.0
- Address: 0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528
- Deployment transaction: 0x187a259c1763c762409be1c8c294b5a2b8b76b09dca7bd0a737760f16ce9a3f4
- RPC: https://studio-next.genlayer.com/api
- Chain ID: 61997
- Runner dependency: py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng

## Evidence

- Deployment proof: deployments/studio-next/uphold-corrected.json
- Live lifecycle proof: evidence/studio-next/uphold-live-proof.json
- Raw lifecycle operation receipts: evidence/studio-next/live-operations/
- Fee profile: frontend/fee-profile.json
- Fee profile SHA-256: 0A3B40FF7963C7488C5CFEBB92BF05E85EA61B87E0978DD0E4E5827C7457DDEE

The live proof covers creation, an authenticated baseline snapshot, a successful check classified HOLDS, a later authenticated snapshot, a stake increase, expiry extension, ledger invariants, and address records. Breach, contest, payout, and expiry/refund remain documented limitations because they were not naturally exercised.

## Public frontend configuration

The public build is configured with:

~~~text
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio-next.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61997
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studio Next
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
NEXT_PUBLIC_CONTRACT_ADDRESS=0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528
~~~

The GitHub repository, release commit, Vercel project, deployment ID, production URL, and deployed Git SHA are recorded here after the public deployment is completed.

## Historical records

The following are retained for provenance and must not be confused with the current contract:

- Historical old successful but superseded contract: 0x96671389548f170A6f02BC3017495d157d827599
- Historical failed old-runner deployment transaction: 0x5f37c53acfe9af24f212f4b117067ca899bb2ad8d7461e328c0af5b6c7fc4b62
- Failed Wayback/CDX experiments and disposable live-snapshot smoke evidence remain in evidence/studio-next/.
