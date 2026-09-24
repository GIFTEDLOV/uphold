# Studio-dev Runner Resolution Incident

**Captured:** 2026-09-24T11:55:44Z
**Repository:** `GIFTEDLOV/uphold`
**Branch:** `uphold/app`
**Canonical RPC:** `https://studio-dev.genlayer.com/api`
**Chain ID:** `61997`

## Scope and safety

This package contains read-only diagnostics only. No transaction was submitted,
no deployment was attempted, and no contract, frontend, main branch, Vercel,
tag, release, or branch-protection setting was changed.

The two transactions below predate this diagnostic and are preserved as failed
historical evidence.

## Failed hosted executions

| Case | Runner | Transaction | Final status | Execution result | Exact error |
| --- | --- | --- | --- | --- | --- |
| Uphold V1.2 | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` | `0x06e758820d433baa29061b7dd432042dcefd8ec40749b53982bafa9cd9841f86` | `FINALIZED` | `FINISHED_WITH_ERROR` | `invalid_contract runner malformed` |
| Minimal official-runner probe | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` | `0x414d53befcc5bd9acc37b82b0053cb447d679e7077663f8a16f8568699b51abf` | `FINALIZED` | `FINISHED_WITH_ERROR` | `invalid_contract runner malformed` |

The receipt `data.contract_address` observations are candidates only:

| Case | Candidate address | `receipt.contractAddress` | `receipt.txDataDecoded.contractAddress` |
| --- | --- | --- | --- |
| Uphold V1.2 | `0xeFCD758f43C16eE2eCF4361934F6DE0AD7F019C5` | `null` | `null` |
| Minimal probe | `0x604556b09fD8642E5a5394C6d7De093b7D90A042` | `null` | `null` |

## `gen_getContractSchema` probes

Each request used the exact source bytes, base64 encoded in the documented
`params: [{"code":"..."}]` shape. Complete request and response JSON is
persisted in the corresponding files below.

| Host | Input | Source SHA-256 | HTTP | JSON-RPC result |
| --- | --- | --- | ---: | --- |
| Studio-dev | official 1jb probe | `B9F5A1F7E9B7B9D26C811F25E7FC475965DC1C51C516FF10EF92BA8722A0C392` | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |
| Studio-dev | tiny 5jyc probe | `3B9E7F28E69505CB219F14644FA5A2CBC82F31218B0B66B04350921FA2353EFE` | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |
| Studio-dev | exact Uphold V1.2 source | recorded in JSON | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |
| Studio-next (diagnostic only) | official 1jb probe | same as Studio-dev 1jb | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |
| Studio-next (diagnostic only) | tiny 5jyc probe | same as Studio-dev 5jyc | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |
| Studio-next (diagnostic only) | exact Uphold V1.2 source | same as Studio-dev Uphold | 200 | Error `-32603`: `(psycopg2.ProgrammingError) can't adapt type 'dict'` |

The complete evidence files are:

- `schema-1jb-studio-dev.json`
- `schema-5jyc-studio-dev.json`
- `schema-uphold-v12-studio-dev.json`
- `schema-1jb-studio-next.json`
- `schema-5jyc-studio-next.json`
- `schema-uphold-v12-studio-next.json`

No schema result was returned for any input. The error includes a SQL query
where the entire request object is bound as `current_state.id`, producing the
server-side `can't adapt type 'dict'` failure. Because the endpoint failed
before returning a schema, this is not a runner-specific schema verdict and
does not prove that either runner is schema-resolvable through this method.

## Failed-address code lookups

`gen_getContractCode` was attempted with `status: "finalized"` for both
candidate addresses. Both requests returned HTTP 200 with JSON-RPC error
`-32603` and the same server-side `can't adapt type 'dict'` failure.

The equivalent read-only `eth_getCode` check returned `"0x"` for both
addresses at both `latest` and `finalized` block tags. Therefore:

`FAILED_ADDRESS_NOT_LIVE=PASS`

Evidence:

- `failed-address-code-lookups.json`
- `failed-address-eth-code-lookups.json`

The candidate addresses are not called deployed contracts. Neither has usable
finalized code according to the empty-code readback, and neither failed
execution produced a successful execution result.

## Toolchain and previously verified local gates

The release branch records this exact RC family:

| Component | Version |
| --- | --- |
| `genlayer-js` | `2.0.0-rc.1` |
| `genlayer-py` | `0.19.0rc2` |
| `genlayer-test` / `gltest` | `0.30.0rc2` |
| `genvm-linter` | `0.11.1rc2` |
| GenLayer CLI | `0.40.0-rc.3` |
| Transaction Kit | `0.1.0-rc.2` |

The pre-existing hardening verification preserved on `uphold/app` records:

- `genvm-lint check`, schema, and typecheck: PASS.
- Uphold Direct Mode: `80/80 PASS`.
- Total Direct Mode: `126/126 PASS`.
- GLSim consensus integration: PASS in the recorded green CI run `35991688717`.
- The release branch's frontend regression baseline: `36/36 PASS`.

These are prior local/CI gate results; this incident run intentionally did not
rerun state-changing integration or deployment workflows.

## Classification

`RUNNER_FAILURE_CLASSIFICATION=HOSTED_RPC_SCHEMA_DIAGNOSTIC_BLOCK`

Both runner pins produced the same prior hosted execution error, while the
read-only schema endpoint produced a non-discriminating server-side database
adaptation error for both runners, the exact Uphold source, and both hostnames.
The available evidence therefore does not distinguish RPC-node runner loading
from validator-fleet runner loading through `gen_getContractSchema`.

The prior on-chain failures remain exactly documented as
`FINALIZED / FINISHED_WITH_ERROR` with `invalid_contract runner malformed`.
No further deployment is authorized by this diagnostic.

## Copy-ready GenLayer support report

```text
Subject: Studio-dev rejects both documented py-genlayer runners; gen_getContractSchema also fails server-side

Network: Studio-dev, chain 61997, https://studio-dev.genlayer.com/api

We observed two finalized transactions with the same execution failure:

1. py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
   tx 0x06e758820d433baa29061b7dd432042dcefd8ec40749b53982bafa9cd9841f86
2. py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
   tx 0x414d53befcc5bd9acc37b82b0053cb447d679e7077663f8a16f8568699b51abf

Both receipts are FINALIZED / FINISHED_WITH_ERROR with:
invalid_contract runner malformed

Read-only gen_getContractSchema requests using exact base64 source bytes for
the 1jb probe, a 5jyc probe, and the Uphold source returned HTTP 200 but JSON-
RPC -32603 for every input on both studio-dev.genlayer.com and the historical
studio-next.genlayer.com hostname. The exact server error is:
(psycopg2.ProgrammingError) can't adapt type 'dict'

The error binds the request object as current_state.id, so no schema was
returned and the endpoint did not provide a runner-specific resolution result.

The receipt data.contract_address candidates were:
  Uphold: 0xeFCD758f43C16eE2eCF4361934F6DE0AD7F019C5
  Probe:  0x604556b09fD8642E5a5394C6d7De093b7D90A042
eth_getCode returned 0x for both at latest and finalized; neither is live.

Please confirm whether Studio-dev's schema handler is currently binding the
request incorrectly and whether the hosted validator fleet has the published
runner archives for these exact identifiers. No further transaction was sent.
Complete request/response evidence is attached in the schema and code-lookup
JSON files in artifacts/runner-probe/.
```
