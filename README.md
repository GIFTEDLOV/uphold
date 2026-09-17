# Uphold

Uphold turns public promises into enforceable commitments. Users stake GEN behind a published promise; GenLayer independently captures and authenticates the public source over time and determines whether the commitment still holds.

## Why GenLayer

Deterministic contracts cannot reliably interpret changing natural-language promises or fetch public web sources. Uphold uses GenLayer validators to independently capture public evidence and store authenticated snapshots immutably. Semantic judgment is bounded to `HOLDS`, `WEAKENED`, `ABSENT`, or `INDETERMINATE`; deterministic contract logic handles stake, timing, breach thresholds, contests, settlement, expiry, and accounting.

## Evidence Architecture

The authoritative evidence model is:

```text
live public source
  -> independent validator capture
  -> immutable authenticated snapshot
  -> semantic assessment from the stored snapshot
```

Wayback/CDX is **not required for normal operation**. A live public HTTPS response is captured and authenticated by the validators, then the semantic assessment is made from the stored snapshot rather than from an untrusted later fetch.

## Contract

- Network: GenLayer Studio Next
- Chain: `61997`
- Address: `0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528`
- Deployment tx: `0x187a259c1763c762409be1c8c294b5a2b8b76b09dca7bd0a737760f16ce9a3f4`
- Source commit: `2064950cfe1ee353772df6027e1660326e83c792`
- Source SHA-256: `3DDFAA229BF36B7D8F06B70FE6E1B4582D004A3FFEDAF08E154834B54819FD3F`
- Contract version: `live-snapshot-v1.0`

## Core Actions

The contract supports creating and checking commitments, increasing stake, extending expiry, contesting a breach, adjudicating a contest, settling a breach, and expiring a commitment.

## Live Proof

The real Studio Next lifecycle proof uses commitment `live-proof-20260917` against [IANA Example Domains](https://www.iana.org/help/example-domains):

- Create tx: `0x651fab5959bc6228a9df3a16f4185eb7793e7bf085d7613b44dd50be492a969d`
- Check tx: `0xcc8c1d43edad2068c79184f5da0b0fc9fe8bbeb1f177c31b2135145f31bba1b5`
- Classification: `HOLDS`
- Increase tx: `0xbd09e3a0cac0e3b045f0dfa8555056a1b72bc10e40312e8554feded2b19a3cbe`
- Extend tx: `0x75788a94725bcbb134709d4478702c08321d508f711f71530e6fe2888f0eaeef`
- Final stake: `2000000000000000 wei` (`0.002 GEN`)

The complete machine-readable proof is in [evidence/studio-next/uphold-live-proof.json](evidence/studio-next/uphold-live-proof.json), with raw operation receipts under `evidence/studio-next/live-operations/`.

## Tests

The final verified regression counts are:

- Frontend: `34/34`
- Uphold Direct Mode: `46/46`
- Total Direct Mode: `91/91`
- AST lint: PASS
- Semantic lint: PASS
- GenVM lint: PASS
- Typecheck/lint: PASS
- Production build: PASS

## Known Limitations

- Breach path, contest, payout, and expiry/refund are not live-demonstrated in the current proof.
- Studio Next does not fully prove production Ghost/EVM semantics.
- External payout completion remains observed off-contract.

## Local setup

Requirements: Node 24.x, npm, Python 3.12 or 3.13 for contract tests, and the GenLayer CLI.

```shell
npm ci
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` for local development. The public defaults target Studio Next and the canonical contract above. The frontend reads chain state; it does not fabricate statistics, commitments, transaction hashes, or evidence.

## Repository map

```text
contracts/uphold.py             Uphold intelligent contract
tests/direct/                    Direct Mode and evidence regression tests
frontend/app/                   Next.js App Router application
frontend/components/uphold/     Product UI and transaction experience
frontend/lib/uphold/             Typed contract client and protocol helpers
evidence/studio-next/            Canonical deployment and lifecycle proof
deployments/studio-next/         Deployment manifests and receipts
tools/studio-next/               Lifecycle and verification tooling
docs/UPHOLD_PROTOCOL.md          Contract trust model
PROVENANCE.md                    Release provenance
```

## License

The Uphold implementation in this repository remains under the repository's existing project license. Holdfast was used as an architectural reference only; no substantial Holdfast source is copied into this phase. If source code from the Apache-2.0 Holdfast project is later reused, retain its copyright, license, and NOTICE obligations and document the derived portions.
