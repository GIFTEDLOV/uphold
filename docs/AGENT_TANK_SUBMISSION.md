# Agent Tank submission

## Project name

Uphold

## One-line description

Uphold turns public promises into enforceable onchain commitments by combining GEN-backed stakes with GenLayer-authenticated web snapshots and validator-backed semantic judgment.

## Short description

Public promises are difficult to enforce when their meaning depends on changing web content. A conventional deterministic contract can hold stake and timestamps, but it cannot reliably retrieve public pages or interpret natural-language evidence as the promise changes.

Uphold combines a published promise with a GEN stake and an immutable, authenticated snapshot captured from a live public source. GenLayer validators independently capture and assess the stored evidence using a bounded result: HOLDS, WEAKENED, ABSENT, or INDETERMINATE. The real Studio Next proof created commitment live-proof-20260917, stored baseline and later snapshots, classified the later evidence HOLDS, increased stake to 0.002 GEN, and extended the expiry.

This is a practical trust layer for commitments whose truth lives partly outside the chain: validators handle web retrieval and semantic judgment, while contract logic remains responsible for authorization, stake, timing, breach thresholds, contests, settlement, expiry, and accounting.

## Track and category

- Track: Agentic Commerce Infrastructure
- Category: Project

## Links

- GitHub: to be recorded after the release push
- Live app: to be recorded after the Vercel production deployment
- Contract explorer/address: https://explorer-studio-dev.genlayer.com/ · 0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528
- Demo video: not yet created

## Why GenLayer

Deterministic EVM-style execution is well suited to balances and state transitions, but not to independently retrieving changing public web content or evaluating natural-language promises. GenLayer supplies validator-backed retrieval and semantic assessment while preserving consensus and an auditable execution record. Uphold narrows the semantic output and stores the evidence snapshot so the contract does not rely on arbitrary caller-supplied text.

## Architecture

~~~text
live public source
  -> independent validator capture
  -> immutable authenticated snapshot
  -> semantic assessment from stored snapshot
  -> deterministic stake and lifecycle transition
~~~

Wayback/CDX is not required for normal operation. The live source is captured and authenticated at the contract operation, and later semantic assessment uses the stored snapshot.

## Live proof

- Network: GenLayer Studio Next, chain 61997
- Contract: 0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528
- Commitment: live-proof-20260917
- Source: https://www.iana.org/help/example-domains
- Create: 0x651fab5959bc6228a9df3a16f4185eb7793e7bf085d7613b44dd50be492a969d
- Check: 0xcc8c1d43edad2068c79184f5da0b0fc9fe8bbeb1f177c31b2135145f31bba1b5
- Classification: HOLDS
- Increase stake: 0xbd09e3a0cac0e3b045f0dfa8555056a1b72bc10e40312e8554feded2b19a3cbe
- Extend expiry: 0x75788a94725bcbb134709d4478702c08321d508f711f71530e6fe2888f0eaeef
- Final stake: 0.002 GEN

Machine-readable evidence is in evidence/studio-next/uphold-live-proof.json.

## Differentiation

Uphold combines economic skin in the game with authenticated web evidence and bounded semantic judgment. The promise, source, snapshots, stake, and lifecycle history are all connected to a contract record rather than being an offchain reputation claim.

## Security model

The contract controls authorized writes, immutable commitment fields, evidence admission, snapshot history, timing, stake arithmetic, contest windows, and accounting. Validator judgment cannot select a beneficiary or move funds directly. The frontend reads the chain and surfaces transaction status; it is not a source of truth.

## Known limitations

- Breach and contest paths are not live-demonstrated.
- Beneficiary payout and promisor refund/expiry are not live-demonstrated.
- Studio Next does not fully prove production Ghost/EVM semantics.
- External payout completion remains observed off-contract.

## Demo sequence

1. Landing
2. Create commitment
3. Show authenticated baseline snapshot
4. Open commitment detail
5. Show HOLDS check
6. Show stake increase
7. Show expiry extension
8. Show activity
9. Show transparency / proof
10. Show Studio Next contract and transaction evidence

No breach or settlement live proof is claimed in this submission.
