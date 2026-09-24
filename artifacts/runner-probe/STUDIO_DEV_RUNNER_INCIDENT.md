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

## Final header-fix schema attempt

The contract was changed only by inserting one blank line between the
dependency header and the adjacent Pyright directive. The corrected source
SHA-256 is:

`5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401`

The historical V1.1 source has the dependency header followed immediately by
the module docstring. The V1.2 candidate had a second contiguous leading
comment line containing the Pyright directive. The corrected exact Uphold
source now returns a schema, which confirms that this header-separation change
removed the malformed runner-descriptor failure for Uphold.

`ROOT_CAUSE_CONFIRMED=YES`
`HEADER_FIX_ONLY=YES`
`RUNNER_HASH=py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

### Corrected 5jyc disposable probe

The in-memory probe used the requested form:

```python
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl

class RunnerProbe(gl.Contract):
    def __init__(self):
        pass
```

Studio-dev loaded the 5jyc runner, but the probe failed before schema
generation with:

`AttributeError: module 'genlayer' has no attribute 'Contract'. Did you mean: 'contract'?`

This is a probe-source/API compatibility failure, not the earlier
`runner malformed` response. Because the required zero-cost probe schema did
not succeed, the release stop condition applies. No alternate probe syntax was
attempted and no deployment was authorized.

Evidence: `schema-final-5jyc-probe.json`.

### Corrected exact Uphold schema

The exact corrected `contracts/uphold.py` source returned a successful schema:

- Total methods: `15`
- Views: `7`
- Writes: `8`
- Constructor: present with no parameters

Evidence: `schema-final-uphold-v12.json`.

The 1jb runner remains unsupported by this hosted Studio-dev schema path and
was not used for the corrected source. The 5jyc runner remains the only active
candidate; the schema proof for the exact Uphold source passed, but the
required minimal-probe proof did not.

### SDK cross-check status

The required SDK cross-check was not run after the corrected probe failure.
`SDK_SCHEMA_PASS=NOT_RUN_STOP_CONDITION`.

The earlier SDK evidence in `sdk-schema-crosscheck.json` belongs to the prior
diagnostic source set and is preserved unchanged.

### Release disposition

`RUNNER_FAILURE_CLASSIFICATION=ZERO_COST_PROBE_SOURCE_COMPATIBILITY_BLOCK`
`RELEASE_READY=NO`
`DEPLOYMENT_ATTEMPTED_AFTER_HEADER_FIX=NO`

The corrected Uphold schema is evidence that the header-format fix addresses
the original malformed runner descriptor. The release cannot proceed because
the separately required corrected 5jyc probe did not return a schema, and the
user-mandated stop condition forbids deployment or further release gates.

## Corrected Studio RPC semantics

The official `genlayer-studio` `main` branch was inspected at source revision
`c94072951e483510329670aa427fba3fa6944f45` on 2026-09-24. The inspected
implementation is available at:

`https://github.com/genlayerlabs/genlayer-studio/tree/c94072951e483510329670aa427fba3fa6944f45`

The inspected Studio implementation registers:

- `gen_getContractSchema(contract_address)` for an address lookup.
- `gen_getContractSchemaForCode(contract_code_hex)` for source-code schema.
- `gen_getContractCode(contract_address)` with a bare address parameter.

The Studio frontend service calls `gen_getContractSchemaForCode` with one code
argument and `gen_getContractCode` with one address argument. The alignment
plan documents this as a Studio/Node RPC semantic divergence: Studio uses
`gen_getContractSchemaForCode(hex_or_utf8)` while the public Node surface uses
`gen_getContractSchema({code: base64})` for source code.

The previous `gen_getContractSchema` request used the public Node object shape
against the Studio handler. Its `can't adapt type 'dict'` response was caused
by that RPC-surface divergence and is not a valid runner-resolution test. It is
preserved above as historical diagnostic evidence, not treated as user error.

The pinned `genlayer-js` `2.0.0-rc.1` cross-check uses the Studio equivalent
`getContractSchemaForCode(source)`, which internally calls
`gen_getContractSchemaForCode` with Studio hex encoding.

## Corrected `gen_getContractSchemaForCode` results

All three corrected requests used `params: ["0x" + UTF-8 source hex]` against
`https://studio-dev.genlayer.com/api`, chain `61997`. Complete requests and
responses are in:

- `schema-for-code-1jb-studio-dev.json`
- `schema-for-code-5jyc-studio-dev.json`
- `schema-for-code-uphold-v12-studio-dev.json`
- `schema-for-code-summary.json`

| Input | HTTP | Result | Methods | Views | Writes | Exact diagnostic |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| 1jb minimal probe | 200 | FAIL | 0 | 0 | 0 | `invalid_contract runner malformed` |
| 5jyc minimal probe | 200 | FAIL | 0 | 0 | 0 | `NameError: name 'gl' is not defined` after `py-genlayer:5jyc...` runner-load event |
| Exact Uphold V1.2 source, 1jb header | 200 | FAIL | 0 | 0 | 0 | `invalid_contract runner malformed` |

The 5jyc response is materially different from a runner-malformed response:
its GenVM log explicitly contains a charged and cached
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` runner-load
event before the Python traceback. This is evidence that the Studio schema
execution path reached that runner, but the exact probe source did not produce
a schema under it. No deployment compatibility is inferred from this result.

## SDK cross-check

`genlayer-js 2.0.0-rc.1` was called read-only through
`getContractSchemaForCode` for the same three exact source strings. The SDK
matched the raw Studio results:

| Input | SDK result | SDK method/view/write count |
| --- | --- | ---: |
| 1jb minimal probe | FAIL: `invalid_contract runner malformed` | `0 / 0 / 0` |
| 5jyc minimal probe | FAIL: `NameError: name 'gl' is not defined` | `0 / 0 / 0` |
| Exact Uphold V1.2 source | FAIL: `invalid_contract runner malformed` | `0 / 0 / 0` |

Full SDK errors and source hashes are persisted in
`sdk-schema-crosscheck.json`.

## Corrected Studio contract-code lookups

Using the corrected Studio shape `gen_getContractCode` with
`params: [address]`:

| Candidate | HTTP | Result |
| --- | ---: | --- |
| `0xeFCD758f43C16eE2eCF4361934F6DE0AD7F019C5` | 200 | JSON-RPC `-32001`: Contract not found |
| `0x604556b09fD8642E5a5394C6d7De093b7D90A042` | 200 | JSON-RPC `-32001`: Contract not found |

Complete corrected-shape evidence is in
`studio-code-lookups-correct-shape.json`. These remain receipt candidate
addresses only and are not deployed-contract addresses.

## Corrected classification

`RUNNER_FAILURE_CLASSIFICATION=STUDIO_RPC_RUNNER_COMPATIBILITY_SPLIT`

The corrected diagnostic does not exactly match Cases A-E:

- 1jb fails at the Studio GenVM boundary with `invalid_contract runner malformed`.
- 5jyc reaches a runner-load event, then the exact minimal probe fails with a
  Python `NameError` before schema generation.
- The exact Uphold source fails with the 1jb runner-malformed result.

Therefore the evidence supports a split between the two runner/source
combinations, not a successful schema for either input. No deployment is
authorized by this diagnostic.

## Corrected copy-ready support report

```text
Subject: Corrected Studio schema diagnostics distinguish 1jb runner failure from 5jyc runner load

Network: Studio-dev, chain 61997, https://studio-dev.genlayer.com/api
Studio source revision inspected: c94072951e483510329670aa427fba3fa6944f45

The Studio-specific read-only method is gen_getContractSchemaForCode with
params: ["0x" + UTF-8 source hex]. The previous Node-style
gen_getContractSchema params: [{code: base64}] test is preserved but was
inconclusive because Studio interpreted the object as a database address.

Corrected results:

1. 1jb minimal probe:
   JSON-RPC -32603, invalid_contract runner malformed.
2. 5jyc minimal probe:
   GenVM log shows py-genlayer:5jyc... loaded; execution then fails with
   NameError: name 'gl' is not defined in the exact probe source.
3. Exact Uphold V1.2 source with 1jb header:
   JSON-RPC -32603, invalid_contract runner malformed.

The pinned genlayer-js 2.0.0-rc.1 getContractSchemaForCode cross-check matches
all three raw RPC results. The two failed receipt candidate addresses return
gen_getContractCode -32001 Contract not found using Studio's params: [address]
shape, and eth_getCode returns 0x at latest and finalized.

This evidence does not authorize deployment. Please confirm the Studio-hosted
runner/source compatibility expected for 1jb and the legacy import semantics
of 5jyc. Complete JSON request/response evidence is attached.
```

## Authoritative corrected probe and source proof

The probe-source issue is resolved for evidence purposes by using the actual
5jyc API surface:

```python
class RunnerProbe(gl.contract.Contract):
```

with `import genlayer as gl` and the required blank line after the dependency
header. The corrected probe v2 returned a schema from canonical Studio-dev:

- Result: PASS
- Methods: `1`
- Views: `1`
- Writes: `0`
- Method: `ping`

Evidence: `schema-final-5jyc-probe-v2.json`.

The exact corrected `contracts/uphold.py` source returned the authoritative
schema:

- Result: PASS
- Methods: `15`
- Views: `7`
- Writes: `8`
- Constructor: present with no parameters

Evidence: `schema-final-uphold-v12.json`.

The pinned `genlayer-js 2.0.0-rc.1` `getContractSchemaForCode()` call against
the same exact source also returned `15 / 7 / 8`:

`SDK_SCHEMA_PASS=YES`

Evidence: `sdk-schema-crosscheck-final.json`.

The original V1.2 failure is now confirmed as a header-format defect: GenVM
consumed contiguous leading comment lines into the runner descriptor, so the
adjacent Pyright directive made the descriptor malformed. The historical V1.1
header did not contain that adjacent directive. The first 5jyc probe failure
was caused by `from genlayer import *` combined with `gl` references; the
second was caused by `gl.Contract` instead of `gl.contract.Contract`. Neither
was an Uphold source failure. The exact corrected Uphold schema is the
authoritative predeployment proof.

`UPHOLD_RUNNER_AND_SOURCE_SCHEMA_RESOLUTION=PASS`
`RELEASE_DEPLOYMENT_GATE=PASS`

## Corrected V1.2 deployment outcome

The exact corrected Uphold source was deployed once after the schema and local
release gates passed. The same 5jyc runner was retained; no runner hash change
was made.

- Contract: `0x5C2C0827B08C720787673dE325a36886e8Ec8645`
- Deployment transaction: `0x4605905ffcfc3e9c070f857b0fde1a77976fbcae56330c3695b9f27e62a55356`
- Status: `FINALIZED`
- Execution: `FINISHED_WITH_RETURN`
- Source parity: `PASS`
- Live schema: `15` methods / `7` views / `8` writes
- `contract_info`: `Uphold`, `live-snapshot-v1.2`
- Qualification: `PASS` using create plus one positive check and `LATEST_FINAL` readbacks

The first V1.2 deployment remains historical failure evidence: the contiguous
runner-comment defect produced `invalid_contract runner malformed`. The 1jb
runner remains unsupported by the hosted Studio-dev environment and is not
used. The corrected 5jyc probe v2 and exact Uphold source are the authoritative
schema evidence for this release.
