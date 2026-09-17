# Agent Tank submission

## Project

Uphold

## Track and category

- Track: Agentic Commerce Infrastructure
- Category: Project

## One-line description

Uphold turns public promises into enforceable onchain commitments by combining GEN-backed stakes with GenLayer-authenticated web snapshots and validator-backed semantic judgment.

## Problem

Many commitments are stated on public websites, but their truth changes outside a deterministic blockchain execution environment. A contract can hold stake and timestamps, yet cannot independently retrieve a changing page or determine whether natural-language evidence still supports the promise.

## Solution

Uphold lets a promisor publish a commitment, stake GEN, and nominate a public source. GenLayer validators capture that source and store an authenticated immutable snapshot. Later checks compare a new authenticated observation with the commitment and record a bounded semantic result: `HOLDS`, `WEAKENED`, `ABSENT`, or `INDETERMINATE`. Deterministic contract logic handles authorization, stake, timing, breach thresholds, contests and accounting.

## Why GenLayer

GenLayer is necessary at the boundary where public web retrieval and natural-language interpretation meet onchain state. Validators independently retrieve and assess evidence, while the contract stores the evidence identity and limits semantic authority. Consensus selects the bounded judgment; consensus does not authenticate the evidence. Wayback/CDX is not required for normal operation.

## How it works

```text
public source
  -> validator capture
  -> immutable authenticated snapshot
  -> bounded semantic judgment
  -> deterministic stake and lifecycle consequence
```

## Architecture

See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for system components, trust boundaries, state transitions, accounting, contest flow, transaction safety, and Studio Next context.

## Live proof

The real Studio Next proof used the canonical contract `0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528` on chain `61997`:

- Commitment: `live-proof-20260917`
- Source: https://www.iana.org/help/example-domains
- Create: `0x651fab5959bc6228a9df3a16f4185eb7793e7bf085d7613b44dd50be492a969d`
- Check: `0xcc8c1d43edad2068c79184f5da0b0fc9fe8bbeb1f177c31b2135145f31bba1b5`
- Classification: `HOLDS`
- Increase stake: `0xbd09e3a0cac0e3b045f0dfa8555056a1b72bc10e40312e8554feded2b19a3cbe`
- Extend expiry: `0x75788a94725bcbb134709d4478702c08321d508f711f71530e6fe2888f0eaeef`
- Final stake: `0.002 GEN`

Machine-readable proof: [`evidence/studio-next/uphold-live-proof.json`](../evidence/studio-next/uphold-live-proof.json).

## Security model

The contract internally hashes snapshot content, derives exact byte length, keeps the baseline and historical snapshots immutable, and performs semantic assessment from stored authenticated snapshots. Qualified weakening observations are required for breach. Accounting separates escrow from pending and completed outflows. The frontend reads chain state; it is not evidence authority.

## Differentiation

Uphold combines economic skin in the game with authenticated web evidence and bounded semantic judgment. It connects the promise, source, snapshots, stake, and lifecycle history to a verifiable contract record instead of treating reputation as an offchain claim.

## Known limitations

- Breach, contest, settlement/payout, and expiry/refund were not live-demonstrated.
- Studio Next does not fully prove production Ghost/EVM semantics.
- External payout completion remains observed off-contract.

## Links

- GitHub: https://github.com/GIFTEDLOV/uphold
- Live app: https://uphold-sable.vercel.app
- Contract: `0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528` on chain `61997`
- Deployment transaction: `0x187a259c1763c762409be1c8c294b5a2b8b76b09dca7bd0a737760f16ce9a3f4`
- Demo video: not yet created

## Demo sequence

1. Landing
2. Dashboard
3. Create Commitment
4. Existing live commitment
5. Authenticated baseline snapshot
6. `HOLDS` check
7. `0.002 GEN` stake
8. Extended expiry
9. Activity
10. Transparency
11. GitHub proof
12. Studio Next contract

No breach or settlement live proof is claimed in this submission.
