# Agent Tank submission

## Project

Uphold

## Release status

V1.2 is deployed and qualified on GenLayer Studio-dev, chain `61997`, with the exact Consensus v0.6 / Studio v0.123 RC family and prompt-injection hardening. The canonical address is `0x5C2C0827B08C720787673dE325a36886e8Ec8645`, source SHA-256 is `5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401`, and deployment is `FINALIZED / FINISHED_WITH_RETURN`. The earlier malformed-header attempt and all V1.1 lifecycle evidence remain explicitly historical.

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

See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for system components, trust boundaries, state transitions, accounting, contest flow, transaction safety, and the current Studio-dev / historical Studio Next separation. Machine-readable V1.2 deployment evidence is in [`deployments/studio-dev/v1.2/`](../deployments/studio-dev/v1.2/).

## Historical V1.1 live proof

The historical Studio Next proof uses the hardened V1.1 contract `0x23786A52b62DC489A5f69653dedD68d1fc56c231` on chain `61997`:

- Commitment: `live-proof-v2-20260918`
- Source: https://www.iana.org/help/example-domains
- Create: `0x99dbe6d38bfd12ba38566d5d19faf0b26d2547559c0bd5a07e3e3566ea758328`
- Check: `0xa435018c7e6bef1bb33245b2d2fb1c21af94858f9706ff6a7abdae354432b389`
- Classification: `HOLDS`
- Increase stake: `0xfdbbbefb9738f203f9b0634a23976f48454b73952d5734ec5c6956a39c93c43e`
- Extend expiry: `0xbbd945983a6b539a18f1c4c252a175f3dc56580273157ab54a7f9a537e0d8df5`
- Final stake: `0.002 GEN`

Machine-readable proof: [`evidence/studio-next/uphold-hardening-live-proof.json`](../evidence/studio-next/uphold-hardening-live-proof.json).

Controlled adversarial evidence also covers fresh locked-source contest capture,
upheld and rejected adjudication, payout-pending, and refund-pending states.
Those results are explicitly controlled testing infrastructure, not natural
production breach evidence.

## Security model

The contract internally hashes snapshot content, derives exact byte length, keeps the baseline and historical snapshots immutable, and performs semantic assessment from stored authenticated snapshots. Qualified weakening observations are required for breach. Accounting separates escrow from pending and completed outflows. The frontend reads chain state; it is not evidence authority.

## Differentiation

Uphold combines economic skin in the game with authenticated web evidence and bounded semantic judgment. It connects the promise, source, snapshots, stake, and lifecycle history to a verifiable contract record instead of treating reputation as an offchain claim.

## Known limitations

- Natural public-source breach and settlement were not organically demonstrated; controlled A/B/C lifecycle evidence is included separately.
- The historical Studio Next environment does not fully prove production Ghost/EVM semantics.
- External payout completion remains observed off-contract.

## Links

- GitHub: https://github.com/GIFTEDLOV/uphold
- Live app: https://genlayer-commitment-bond.vercel.app
- Current V1.2 contract explorer: https://explorer-studio-dev.genlayer.com/address/0x5C2C0827B08C720787673dE325a36886e8Ec8645
- Current V1.2 contract address: `0x5C2C0827B08C720787673dE325a36886e8Ec8645`
- Current V1.2 deployment transaction: `0x4605905ffcfc3e9c070f857b0fde1a77976fbcae56330c3695b9f27e62a55356`
- GitHub release: https://github.com/GIFTEDLOV/uphold/releases/tag/v1.2.0
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
12. Current Studio-dev V1.2 contract

No natural breach or external settlement receipt is claimed in this submission; controlled fixture evidence is labeled as controlled.
