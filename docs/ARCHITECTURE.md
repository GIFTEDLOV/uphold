# Uphold architecture

Uphold turns a public promise into a bounded, auditable commitment. The contract holds GEN, records the immutable commitment terms, authenticates live public-source snapshots, and applies deterministic lifecycle rules to validator-backed semantic findings.

## System components

| Component | Responsibility |
| --- | --- |
| Browser frontend | Reads contract state, prepares calls, displays evidence and lifecycle history. It is not the source of truth. |
| Wallet / transaction kit | Signs user-authorized writes and exposes transaction progress. |
| Uphold intelligent contract | Owns commitment terms, snapshot history, verdict handling, stake arithmetic, timing, contests, settlement states, expiry and accounting. |
| GenLayer validators | Independently retrieve public HTTPS content and reach bounded semantic judgments through consensus. |
| Public source | The external page whose current content is captured; no authentication or JavaScript dependency is required by the live proof source. |
| Snapshot storage | Contract state containing the source URL, capture metadata, SHA-256, exact byte length, normalized content and semantic result. |

The authoritative deployed instance is the Studio Next contract `0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528` on chain `61997`, using `https://studio-next.genlayer.com/api`. The deployed source is identified by SHA-256 `3DDFAA229BF36B7D8F06B70FE6E1B4582D004A3FFEDAF08E154834B54819FD3F`.

## Trust boundaries

The public web is untrusted and mutable. A caller can nominate a URL and promise, but cannot supply arbitrary evidence bytes to the contract. Validator retrieval is nondeterministic infrastructure; it is admitted only through the contract's authenticated capture path. Semantic judgment is bounded to `HOLDS`, `WEAKENED`, `ABSENT`, or `INDETERMINATE` and cannot choose beneficiaries or directly move funds.

Consensus establishes the validator-backed result; it does not itself authenticate the evidence. Authentication comes from the capture operation storing the source response and its internal digest and byte length. Deterministic contract logic then applies authorization, timing, breach thresholds and accounting consequences.

## Evidence capture and snapshot identity

The current authoritative model is:

```text
live public source
  -> independent validator capture
  -> immutable authenticated snapshot
  -> semantic assessment from the stored snapshot
```

`create_commitment` captures the baseline. `check_commitment` captures the later observation and assesses the stored snapshot. Each snapshot records its sequence, capture time, source URL, SHA-256, exact byte length, normalized content, and any bounded semantic finding. The baseline and historical snapshots are immutable after admission. Wayback/CDX is not required for normal operation.

## State transitions

The contract's lifecycle constants are:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: create_commitment
    ACTIVE --> ACTIVE: check_commitment / HOLDS
    ACTIVE --> ACTIVE: increase_stake
    ACTIVE --> ACTIVE: extend_commitment
    ACTIVE --> BREACH_CLAIMED: qualified weakening / absence threshold
    BREACH_CLAIMED --> ACTIVE: contest succeeds
    BREACH_CLAIMED --> BREACH_CONFIRMED: contest window expires or adjudication confirms
    BREACH_CONFIRMED --> PAYOUT_PENDING: beneficiary path
    BREACH_CONFIRMED --> REFUND_PENDING: promisor path
    ACTIVE --> REFUND_PENDING: expire_commitment after expiry
    PAYOUT_PENDING --> SETTLED: external payout observed
    REFUND_PENDING --> COMPLETED: external refund observed
```

The live proof exercised `ACTIVE`, authenticated baseline and later snapshots, a `HOLDS` check, a stake increase, and an expiry extension. Breach, contest, payout, and refund paths remain documented limitations because they were not naturally live-demonstrated.

## Semantic consensus

The semantic layer answers only whether the stored later observation supports one of four findings:

| Finding | Meaning |
| --- | --- |
| `HOLDS` | The captured public evidence still supports the commitment. |
| `WEAKENED` | The evidence no longer fully supports the commitment, but is not a clear absence. |
| `ABSENT` | The commitment is not present in the captured evidence. |
| `INDETERMINATE` | The evidence or infrastructure is insufficient for a reliable semantic conclusion. |

Infrastructure failure is not converted into `ABSENT`; the contract fails closed. A breach requires the protocol's qualified observations and threshold rules rather than a single arbitrary caller assertion.

## Stake accounting and contest flow

The contract separates deposited/escrowed stake from pending outflows and paid or returned totals. The live positive-path invariant is:

```text
total_deposited = total_escrowed + total_pending_outflows
                 + total_paid_to_beneficiaries + total_returned_to_promisors
```

Before settlement or expiry, the live proof showed the full `0.002 GEN` stake as escrowed, with pending outflows, paid beneficiary totals, and returned promisor totals at zero. A claimed breach may be contested. Adjudication and timing determine whether a confirmed breach becomes a payout or refund request. Completion of the external transfer remains observed off-contract; Studio Next does not by itself prove production Ghost/EVM payout semantics.

## Transaction lifecycle

Every write follows the operational safety invariant:

```text
PRECONDITION READ
  -> LIVE FEE QUOTE
  -> BROADCAST ONCE
  -> PERSIST HASH
  -> RECONCILE SAME HASH
  -> FINALIZED
  -> EXECUTION SUCCESS
  -> STATE READBACK
```

Polling ambiguity never authorizes a second broadcast. A transaction hash is preserved and reconciled. Finality and execution success are separate checks, and expected state readback establishes the observed result.

## Studio Next deployment context

The canonical release is deployed on GenLayer Studio Next, chain `61997`, with the `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` runner dependency. The deployment transaction is `0x187a259c1763c762409be1c8c294b5a2b8b76b09dca7bd0a737760f16ce9a3f4`; the source commit is `2064950cfe1ee353772df6027e1660326e83c792`.

## Verification artifacts

- Deployment proof: [`deployments/studio-next/uphold-corrected.json`](../deployments/studio-next/uphold-corrected.json)
- Live lifecycle proof: [`evidence/studio-next/uphold-live-proof.json`](../evidence/studio-next/uphold-live-proof.json)
- Fee profile: [`frontend/fee-profile.json`](../frontend/fee-profile.json)
- Protocol detail: [`UPHOLD_PROTOCOL.md`](UPHOLD_PROTOCOL.md)
