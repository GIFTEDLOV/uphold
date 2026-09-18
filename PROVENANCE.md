# Uphold release provenance

This file records the current public Uphold release. Historical deployments are retained below for auditability and are not current targets.

## Canonical contract

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

## Evidence

- Deployment proof: deployments/studio-next/uphold-hardening.json
- Live lifecycle proof: evidence/studio-next/uphold-hardening-live-proof.json
- Raw lifecycle operation receipts: evidence/studio-next/hardening-live-operations/
- Fee profile: frontend/fee-profile.json
- Fee profile SHA-256: 9BDF64B9C58F2DCBF8DC7CB66D74C18DB0CD7D50A5EE2E039CEDC8C67D59A072

The real positive proof covers creation, an authenticated baseline snapshot, a successful check classified HOLDS, a later authenticated snapshot, a stake increase, expiry extension, ledger invariants, and address records. Controlled adversarial A/B/C evidence additionally covers fresh contest capture, upheld and rejected contest adjudication, payout-pending, and refund-pending states. These controlled results are not presented as natural production breach evidence.

## Public frontend configuration

The public build is configured with:

~~~text
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio-next.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61997
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studio Next
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
NEXT_PUBLIC_CONTRACT_ADDRESS=0x23786A52b62DC489A5f69653dedD68d1fc56c231
~~~

## Public release configuration

- GitHub repository: https://github.com/GIFTEDLOV/uphold
- Release source commit: b56465e1f95295497d715f894a30096071685422
- Vercel project: `uphold`
- Vercel project ID: `prj_YqhtNLEgwPPj7nhGoamGr6vbMd67`
- Vercel root directory: `frontend`
- Production URL: https://uphold-sable.vercel.app
- Verified production deployment: `dpl_CPfPAWFFt9JiRquE7ciWTSeuicmK`
- Immutable deployment URL: https://uphold-szhqx7kqm-kolofahkelvin16-6437s-projects.vercel.app
- Deployed Git SHA: b56465e1f95295497d715f894a30096071685422

The deployment above is the first READY GitHub-linked production build for the new Uphold project. The final metadata commit and its resulting Vercel deployment are reported in the release audit.

## Historical records

The following are retained for provenance and must not be confused with the current contract:

- Historical old successful but superseded contract: 0x96671389548f170A6f02BC3017495d157d827599
- Historical failed old-runner deployment transaction: 0x5f37c53acfe9af24f212f4b117067ca899bb2ad8d7461e328c0af5b6c7fc4b62
- Failed Wayback/CDX experiments and disposable live-snapshot smoke evidence remain in evidence/studio-next/.
