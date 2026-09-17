# Uphold Phase 1 Baseline

Audit date: 2026-09-14

This document records the untouched `v2-dev` starter baseline before any Uphold
contract or product implementation. No contract was deployed, no blockchain
transaction was broadcast, no commit was created, and nothing was pushed.

## 1. Starting repository and immutable baseline

- Repository: `<local checkout>`
- Origin: `https://github.com/genlayerlabs/genlayer-project-boilerplate.git`
- Starting branch: `v2-dev`
- Starting HEAD (`STARTING_HEAD`): `816f3b88175032f10242e278c0d13d75f185c882`
- Starting worktree: clean; `git status --short` returned no entries.
- Current HEAD: unchanged from `STARTING_HEAD`.

The starter contract, frontend, deployment script, and tests were not redesigned
or replaced. Phase 1 added this document; Phase 1.5 adds only the ignore rule
needed for the project-local test environment. An ignored `frontend/.env` was
created from `frontend/.env.example` for the local configuration check.

## 2. Current toolchain versions

| Tool | Observed version | Notes |
|---|---:|---|
| Node.js | `v24.14.0` | Local version; frontend CI uses Node 22. |
| npm | `11.9.0` | `npm ci` completed successfully. |
| Python | `3.14.3` | Local version; Python CI uses 3.12. |
| Git | `2.53.0.windows.2` |  |
| GenLayer CLI | `0.40.0-rc.3` | Installed at the user npm Scripts directory. |
| `genlayer-py` | `0.19.0rc2` | Installed from the `v0.19-dev` requirement. |
| `genlayer-test` / `gltest` | `0.30.0rc2` | Installed from the `v0.30-dev` requirement; executable is not on the current PATH. |
| `genvm-linter` | `0.11.0` | Installed from the `v0.11-dev` requirement. |
| pytest | `8.4.1` |  |
| requests | `2.34.2` |  |
| web3 | `8.0.0` |  |
| pydantic | `2.13.5` |  |

`pyproject.toml` is not present. `requirements.txt` points to the repository's
GenLayer development references:

```text
genlayer-py @ git+https://github.com/genlayerlabs/genlayer-py@v0.19-dev
genlayer-test @ git+https://github.com/genlayerlabs/genlayer-testing-suite@v0.30-dev
genvm-linter @ git+https://github.com/genlayerlabs/genvm-linter@v0.11-dev
```

The installed normalized RC versions match those repository requirements. No
Python dependency was upgraded or downgraded during this audit.

## 3. Starter inspection and release coherence

The following areas were read without redesigning them:

- Root `package.json` and workspace lockfile.
- `frontend/package.json`, `frontend/.env.example`, and `frontend/fee-profile.json`.
- `contracts/`, `deploy/`, `tests/direct/`, and `tests/integration/`.
- `gltest.config.yaml`, `requirements.txt`, and GitHub workflows.
- `frontend/lib/genlayer/`, wallet/network consumers, and Transaction Kit panels.

The JavaScript dependency family is exact and coherent with the checked-in
v2-dev starter:

| Package | Required and installed |
|---|---:|
| `genlayer-js` | `2.0.0-rc.1` |
| `@genlayer/transaction-kit` | `0.1.0-rc.2` |
| `@genlayer/transaction-kit-react` | `0.1.0-rc.2` |

`npm ls` resolved these exact versions, and the lockfile contains the matching
package versions and registry integrity entries. The root workspace also pins
`genlayer-js` to `2.0.0-rc.1`; the frontend pins the same SDK plus both
Transaction Kit RC.2 packages. No older stable GenLayer package was substituted.

The frontend already contains:

- A shared network object consumed by MetaMask, `genlayer-js`, and Transaction Kit.
- Studio Next defaults and chain ID validation in `frontend/lib/genlayer/network.ts`.
- `createTransactionKit` setup in `frontend/lib/genlayer/kit.ts`.
- React transaction panels in the create-bet and resolve-bet flows.
- Fee profile and release-dependency tests in the existing frontend test suite.
- A deployment receipt helper that does not treat `UNDETERMINED` as successful.

The starter contract remains the Football Bets sample. It was not changed.

## 4. Studio Next configuration

Authoritative network used for this audit:

| Setting | Value |
|---|---|
| Network name | `GenLayer Studio Next` |
| RPC URL | `https://studio-next.genlayer.com/api` |
| Chain ID | `61997` (`0xf22d`) |
| Explorer | `https://explorer-studio-dev.genlayer.com/` |
| Native symbol | `GEN` |

`frontend/.env` now contains these values and retains
`NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address` as an obvious undeployed
placeholder. The file is ignored by the repository's `*.env` rule and was not
tracked.

The frontend's `network.ts` starts from the SDK's `studioDevnet` type/preset,
whose ID is also `61997`, then explicitly overrides the preset name and RPC URL
to Studio Next. The obsolete `studio-dev` RPC is therefore not used by the
frontend's shared runtime configuration.

The direct/integration Python configuration is different: `gltest.config.yaml`
defaults to localnet at `http://127.0.0.1:4000/api`; its hosted `studionet` entry
is empty and relies on the test tool's preset. This was not treated as proof of
Studio Next, and the hosted integration suite was not executed. Read-only RPC
checks against the authoritative endpoint returned:

- `eth_chainId` = `0xf22d` = `61997`.
- `net_version` = `61997`.
- `eth_blockNumber` returned a current block value.

No state-changing RPC method was called.

## 5. Install result

The repository-supported command was run exactly from the root:

```text
npm ci
```

Result: PASS. npm installed 857 packages, audited 859 packages, and reported 56
audit findings (2 low, 35 moderate, 18 high, 1 critical). The lockfile was not
rewritten. `npm audit fix` was not run because it could change the pinned
baseline.

## 6. Validation matrix

| Area | Command or scope | Result | Evidence / reason |
|---|---|---|---|
| npm install | `npm ci` | PASS | 857 packages installed; lockfile unchanged. |
| Frontend tests | `npm run test --workspace frontend` | PASS | 5 files, 17 tests passed in the isolated rerun. A first concurrent run hit Vitest worker timeouts while other checks were running; the clean rerun passed. |
| Typecheck/lint | `npm run lint --workspace frontend` | PASS | `tsc --noEmit` exited 0. |
| Production build | `npm run build` | PASS | Next production build compiled, typechecked, and generated the static pages. |
| Frontend network tests | Included in frontend suite | PASS | Studio Next URL, name, ID, hex ID, and shared consumer configuration are asserted. |
| Transaction Kit tests | Included in frontend suite | PASS, mocked | Fee quote/panel behavior, developer-fee source, shared kit chain, and decision tracking are covered without wallet signing or broadcast. |
| SDK compatibility test | `tests/direct/test_v2_dev_sdk_compat.py` | BLOCKED in default runner; PASS in diagnostic runner | With cached `v0.6.0-rc2`, the isolated compatibility test passed. The default runner could not load the contract's pinned `py-genlayer` archive. |
| Contract static lint | `genvm-lint lint contracts/football_bets.py --json` | PASS | 3 lint checks passed. `PatternTest.py` also passed the static lint command. |
| Contract validation | `genvm-lint check contracts/football_bets.py` | PASS with explicit cached `GENVM_VERSION=v0.6.0-rc2` | Contract loaded with 5 methods, 3 view methods, and 2 write methods. |
| Contract validation default | `genvm-lint check contracts/football_bets.py` | BLOCKED | Default local cache selected v0.6.0-rc5, which lacks the `py-genlayer:9b8k...9p0` archive required by the starter contract. |
| Direct-mode suite | `python -m pytest tests/direct/ -v` | BLOCKED | 45 collected: 10 passed and 35 failed before contract execution because the required runner archive was absent. With `GENVM_VERSION=v0.6.0-rc2`, 11 passed and 34 failed on Windows `WinError 32` while the runner tried to unlink a still-open temporary stdin file. |
| Integration collection | `python -m pytest tests/integration --collect-only -q` | PASS, collection only | 15 tests collected. No integration test body ran. |
| Network integration tests | Hosted `gltest` tests | SKIPPED | Existing integration tests deploy and call `.transact()`; execution would broadcast/state-change and was prohibited. |
| Fee profile test | `test_fee_profile_create_bet` | SKIPPED, collection only | The test deploys and calls `.transact(wait_until="finalized")`. Collection with `--fee-profile` also rewrote the profile; the original file was restored exactly. |
| Python tooling install | Requirements inspection and installed metadata | PASS | Installed RC versions match the repository's `v0.19-dev`, `v0.30-dev`, and `v0.11-dev` references. |

The direct-mode failures were investigated rather than attributed to the
Football Bets contract. The first failure is a local GenVM cache selection issue;
the second is a Windows file-handle cleanup issue in the installed direct runner.
The safest remediation is to run the repository's pinned Python tooling in the
supported CI/runtime environment or repair the matching local GenVM cache and
Windows runner behavior. The contract dependency header should not be changed
just to make this audit green.

## 7. Transaction Kit findings

The installed RC.2 code and declarations were inspected together with the
starter integration.

### Current path

1. `createTransactionKit` receives the shared `GENLAYER_CHAIN`, the injected
   wallet provider, and the connected account.
2. `estimate` uses the GenLayer client fee-policy and queue endpoints. Developer
   suggestions are only considered when their network/chain identity is an
   applicable match and are compared with the active policy.
3. The React panel moves through estimating, review, signing, tracking, and
   done/error states. Verification mismatch blocks approval unless explicitly
   allowed by kit configuration.
4. Approval calls `kit.submit`, which passes fee distribution, fee value, and
   transaction value to `genlayer-js` for wallet signing and broadcast.
5. `kit.track` polls `getTransaction`, maps consensus lifecycle statuses, and
   exposes both the consensus phase and execution-result information.

### Consensus versus application outcome

The kit distinguishes processing, decision, and finalization phases. It also
maps execution results such as `FINISHED_WITH_RETURN`, `FINISHED_WITH_ERROR`,
`TIMEOUT`, `NONDET_DISAGREE`, and `DETERMINISTIC_VIOLATION`; the React
`describeOutcome` helper only classifies a successful application outcome when
the consensus status is accepted/finalized and the execution result is
`FINISHED_WITH_RETURN`.

The starter UI still has a gap for Uphold's eventual requirements:

- Both sample panels explicitly use `trackUntil="decided"`, not finalized.
- Their `onDone` handlers invalidate the query and show success when
  `status.successful !== false`; they do not perform an explicit expected
  contract-state readback before declaring the application action complete.
- The panel displays execution-aware outcome information and has a generic UI
  error path, but the Football Bets handlers do not yet expose a domain-specific
  distinction between broadcast, consensus decision, finalization, execution
  success, and verified state readback.
- The deploy helper checks receipt status, including `FINALIZED`, but is a
  deployment utility and is not the full application-success policy needed by
  Uphold.

Required Uphold design: broadcast must be recorded separately from consensus
decision; decision separately from finalization; finalization separately from
execution success; and execution success separately from the expected read-only
state transition.

## 8. Fee-profile findings

`frontend/fee-profile.json` is present and remains unchanged from the starter:

- `version`: `1`.
- `network`: `localnet`.
- `measuredAt`: `2026-06-15T17:26:36Z`.
- Profiles exist for deploy and `create_bet`.
- No `chainId` is recorded.
- The profile is not imported or passed as `suggestions` by
  `frontend/lib/genlayer/kit.ts`.

The repository README states that profiles are contract-build, GenVM-version,
and network-specific. The installed Transaction Kit also treats network/chain
identity as part of whether a developer profile is applicable. Therefore this
localnet profile must not be reused for Studio Next Uphold transactions. A new
profile should be measured for the final Uphold contract build and explicitly
passed to the kit only in a later phase.

The root `npm run test:fees` script runs the integration fee-profile scenario.
That scenario deploys Football Bets and calls `create_bet(...).transact(...)`,
so it was not executed. Frontend fee behavior was verified only through mocks.

## 9. Holdfast reference audit

Holdfast was reviewed as a public reference at
`https://github.com/ometere123/holdfast`, including its README, current contract,
tests, package metadata, `LICENSE`, and `NOTICE`. It was audited in a separate
temporary checkout and was not copied over Uphold. The reviewed source snapshot
was the current shallow checkout at commit
`d70572d5bfb2c99c3ee5c4eb67de412c6e82507c`.

The useful architecture is:

- A single intelligent contract plus a Next.js client, with no backend,
  database, indexer, or scheduled worker. Evidence retrieval and state
  transitions are initiated by permissionless calls.
- Wayback CDX change-point discovery and `id_` replay retrieval, with exact
  timestamps rather than nearest-match lookup.
- Authentication/admission before semantic judgment: raw-byte digest checks,
  compressed/decoded size caps, decompression handling, URL/timestamp binding,
  structural document gates, and explicit qualification results.
- Bounded validator judgment: a small fixed classification vocabulary, bounded
  excerpts/rationales, quote-presence checks, injection-guard text, and a model
  that judges commitment meaning rather than payout or admission.
- Deterministic gates and bounded work: anchor, section, term, length, cursor,
  change-point, and consecutiveness checks are deterministic; rejected or
  unavailable evidence does not silently become a breach.
- A five-state commitment lifecycle: `ACTIVE`, `BREACH_CLAIMED`, `CONTESTED`,
  `BREACHED`, and `RETURNED`.
- Breach detection based on two consecutive weakened/absent readings, with the
  claim separated from payout.
- A time-bounded contest that is restricted to the two captures supporting the
  breach claim, requires a contest bond, and lets a permissionless adjudication
  either restore the active bond or pay the payee.
- Settlement that re-verifies pinned evidence, does not re-run semantic
  judgment, and moves funds only after the contest window has closed.
- Expiry that returns the stake only for an active bond after the archive cursor
  has caught up; a claimed breach cannot time out into a refund.
- Accounting checks over exact wei movements, single-transfer payout behavior,
  counters, terminal states, and no retained escrow on settled paths.
- Replay protection through unique bond IDs, URL/commitment pairing, restricted
  contest citations, stored digests/decoded hashes, and stable replay checks.
- Error-domain separation: expected caller/state errors, external-source errors,
  transient retrieval/digest errors, and unusable LLM output are handled as
  distinct fail-closed conditions.
- Evidence/audit history: baseline, examined captures, blank frames,
  classifications, citations, digests, encodings, excerpts, and settlement data
  remain queryable rather than being collapsed into a boolean.

These are design patterns for the next phase, not source to transplant. Uphold
must define its own commitment schema, participants, authorization rules, stake
economics, evidence policy, and lifecycle invariants.

## 10. Holdfast incompatibilities and migration risks

- Holdfast declares `genlayer-js` `1.1.8` and does not use the current
  `@genlayer/transaction-kit` RC family. Uphold must remain on
  `genlayer-js` `2.0.0-rc.1`, Transaction Kit `0.1.0-rc.2`, and the React
  adapter `0.1.0-rc.2` unless the repository itself later requires a coordinated
  release change.
- Holdfast's contract dependency header and direct-test assumptions use an
  older GenVM/SDK runner. They cannot be copied into the current Consensus v0.6
  starter without migration and fresh direct compatibility tests.
- Holdfast's `gltest.config.yaml` defaults to hosted `studionet`, while Uphold's
  authoritative hackathon target is Studio Next at chain `61997`. Network names,
  RPCs, fee profiles, and explorer links must be revalidated independently.
- The archive/decompression pipeline is large and tightly coupled to its
  contract fixtures. It should be extracted into a deliberately bounded Uphold
  design, not pasted wholesale into `football_bets.py` or a replacement
  contract.
- Holdfast's permissionless-call model is not automatically correct for every
  Uphold actor action. Promisor, payee, contesters, keepers, and settlement
  callers need explicit authorization and replay rules.
- External evidence availability, archive mutation, LLM disagreement, model
  prompt injection, payload caps, and gas/fee budgets need current v0.6 tests.
- The current frontend's decision-oriented panel behavior is insufficient for
  a payable commitment bond. Uphold needs finalization tracking, failed
  execution handling, readback verification, idempotent UI state, and clear
  error-domain presentation.
- Holdfast is Apache-2.0 licensed. If substantial source is reused later, retain
  the Apache-2.0 license and copyright notices, preserve its `NOTICE` material
  where applicable, mark modified files, and do not imply trademark or warranty
  rights. Architectural ideas alone do not require copying its source.

## 11. Blockers

1. The direct-mode baseline is not green in this Windows environment. The
   default cached GenVM release lacks the starter's pinned runner archive; the
   matching cached RC exposes a Windows temporary-file handle failure in the
   direct runner. This blocks a clean claim that the full Python contract test
   suite passes.
2. The current Python configuration defaults to localnet, and the hosted
   integration tests are state-changing. They require a separately authorized
   network-test decision in a later phase; they were correctly not run here.
3. The checked-in fee profile is localnet-specific, lacks chain identity, and is
   not wired into the frontend. It is not evidence of Studio Next fee
   correctness.
4. Local Node 24/Python 3.14 differ from the CI Node 22/Python 3.12 matrix.
   The frontend passed locally, but the Python runner issue should be resolved
   in a CI-compatible environment before contract conversion.

## 12. Recommended Phase 2 implementation order

1. Resolve and pin the supported v0.6 direct-test environment first: use the
   CI-compatible Python/GenVM runner combination, repair the Windows runner/cache
   issue if Windows remains in scope, and make the untouched starter direct
   suite reproducibly green.
2. Write Uphold's domain specification before code: actors, commitment schema,
   stake/contest economics, state machine, terminal states, error domains,
   replay keys, and accounting invariants.
3. Build an isolated archived-evidence fixture corpus and deterministic
   admission layer: exact timestamp, URL binding, raw digest, encoding/decode,
   payload caps, structural gates, and explicit external/transient refusal
   behavior. Do not involve payout logic yet.
4. Implement the Uphold contract lifecycle around those gates: commitment
   creation, escrow, bounded checks, breach claim, contest, adjudication,
   settlement, expiry, withdrawals, history, and invariant-preserving
   accounting. Keep semantic judgment bounded and separate from deterministic
   money-moving gates.
5. Add direct-mode, SDK-compatibility, linter, fixture, and failure-domain tests
   for the new contract before connecting a frontend. No hosted deployment is
   needed for this step.
6. Design the frontend read model and transaction state machine on the existing
   RC.2 Transaction Kit. Add fee-profile suggestions only after measuring the
   final contract against Studio Next chain `61997`.
7. Implement wallet signing and broadcast UI with distinct broadcast,
   decision, finalization, execution-result, and expected-state-readback states;
   make failed execution and readback mismatch visible and retry-safe.
8. Only after explicit authorization, run isolated Studio Next integration tests
   against a legitimate test contract and verify fee estimates, finalization,
   execution result, and readback. Then perform browser/build verification and
   the Apache attribution review.

## Baseline conclusion

The JavaScript dependency family, frontend build, frontend tests, shared Studio
Next configuration, read-only Studio Next RPC identity, static contract lint,
and Transaction Kit wiring are verified. The starter is structurally suitable
for a later Uphold conversion, but Phase 2 should not begin contract conversion
until the direct-mode tooling blocker is resolved and the fee/network test plan
is explicitly authorized.

## Phase 1.5: Direct Mode reliability audit

### Exact native failure and diagnosis

The exact native command was:

```text
python -m pytest tests/direct/ -v
```

It ran under:

```text
Python 3.14.3 -- <local Python executable>
pytest 8.4.1
genlayer-test 0.30.0rc2
```

The full run collected 45 tests and ended with 35 failures and 10 passes. The
first complete failure was:

```text
FileNotFoundError: runner py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0 not under <local GenVM test cache>
```

The contract header pins the exact runner hash
`py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0`. The local
cache contained trees for `v0.6.0-rc2`, `v0.6.0-rc3`, and `v0.6.0-rc5`.
The required hash exists in the `v0.6.0-rc2` tree, while the `rc3` and `rc5`
trees contain different `py-genlayer` hashes. The repository does not explicitly
pin the GenVM release name; it pins the runner hash. In practice, `v0.6.0-rc2`
is the cached v0.6 release coherent with this starter.

The resolver in `genlayer-test 0.30.0rc2` prefers `GENVM_VERSION`, otherwise
tries the GitHub release API, and then falls back to the newest local bundle.
The API returned HTTP 403 rate limiting during the native run, so the default
path selected cached `v0.6.0-rc5`. No cache entry was deleted or replaced.

For completeness, forcing the existing native `v0.6.0-rc2` cache reproduced the
second failure with this command:

```text
$env:GENVM_VERSION='v0.6.0-rc2'; python -m pytest tests/direct/test_patterns.py::TestGlVmReturn::test_isinstance_return_on_success -v --tb=long -x
```

The complete traceback identified the lock target and operation:

```text
gltest.direct.loader._inject_message_to_fd0
...
fd, path = tempfile.mkstemp()
...
os.dup2(fd, 0)
...
os.close(fd)
os.unlink(path)
PermissionError: [WinError 32] The process cannot access the file because it is being used by another process: '<local temp file>'
```

This is the runner's own fd-0 replacement path: Windows will not unlink the
temporary file while fd 0 still has an open handle. Defender (`MsMpEng`) and
Windows Search (`SearchIndexer`) were running, but no evidence identified either
as the holder. No file-lock diagnostic tool was installed. Several unrelated
pytest/genvm processes were active during the audit; they were not killed.

### Selected supported environment

Native Windows `py -0p` exposed only Python 3.14.3. Native Python 3.12 and 3.13
were not installed. WSL Ubuntu was available and provided Python 3.12.3.

The usable isolated environment is:

```text
Environment: WSL2 Ubuntu
Python: 3.12.3
Python executable: /home/dell/Uphold/.venv-genlayer/bin/python
Source tree: <WSL checkout>
GenVM: v0.6.0-rc2
GenVM cache tree: /home/dell/.cache/gltest-direct/trees-v2/v0.6.0-rc2
```

The WSL environment was created without changing system Python. Ubuntu lacked
`python3.12-venv`, and sudo required an interactive password, so the environment
was created with the standard library's `venv --without-pip` plus the repository
requirements installed into that environment's site-packages using WSL's local
Python pip. This is isolated from Windows Python and uses the same mounted source
tree; no second source repository was created. The attempted partial venv under
the Windows workspace remains ignored by `/.venv-genlayer/` and is not used.

Exact WSL GenLayer-related package versions:

```text
genlayer-py==0.19.0rc2
genlayer-test==0.30.0rc2
genvm-linter==0.11.1rc2
pytest==9.1.1
```

### Cache repair decision

`CACHE_REPAIR_PERFORMED: NO` for the native cache. The native `v0.6.0-rc2`
artifact and extracted tree already contained the required runner and were not
corrupt; the failure was version selection followed by a Windows fd-0 unlink
limitation. WSL downloaded/prepared its own `v0.6.0-rc2` tree normally. No
unrelated cache was cleared.

### Complete Direct Mode results

The exact repeatable command is:

```text
wsl.exe -d Ubuntu --cd <WSL checkout> -- env GENVM_VERSION=v0.6.0-rc2 /home/dell/Uphold/.venv-genlayer/bin/python -m pytest tests/direct/ -v
```

Cold-cache execution:

```text
45 collected, 45 passed, 0 failed, 0 skipped, 0 errors
```

Warm-cache repeat execution:

```text
45 collected, 45 passed, 0 failed, 0 skipped, 0 errors
```

The SDK compatibility test `test_v2_dev_sdk_compat.py` passed as part of both
complete runs. No contract or test source was modified to achieve this result.

### Windows versus WSL status

- Windows-native status: NOT USABLE for this baseline on the available Python
  3.14.3 installation. Default resolution selects an incompatible cached tree;
  forcing the compatible v0.6.0-rc2 tree reaches the intrinsic Windows
  `WinError 32` in `gltest.direct.loader._inject_message_to_fd0`. Whether a
  separately installed native Python 3.12/3.13 would avoid that runner bug is
  untested because those interpreters are unavailable.
- WSL status: PASS and repeatable. WSL Ubuntu Python 3.12.3 is the authoritative
  Direct Mode environment for future contract edits until native support is
  separately proven.

### Phase 1.5 regression gates

| Gate | Result | Evidence |
|---|---|---|
| Full Direct Mode | PASS | 45/45 twice under WSL Python 3.12.3 and GenVM v0.6.0-rc2. |
| SDK compatibility | PASS | Included in both full Direct Mode runs. |
| Contract lint | PASS | WSL Football Bets `genvm-lint check`: 3 lint checks; 5 methods (3 view, 2 write). `PatternTest.py` static lint also passed. |
| Frontend tests | PASS | 5 files, 17 tests. |
| Typecheck/lint | PASS | `npm run lint --workspace frontend`. |
| Production build | PASS | `npm run build`; Next.js 16.0.3 build completed. |
| Chain writes | NOT RUN | No deploy, broadcast, or state-changing RPC was used. |

Future contract-edit rule: run the exact WSL command above after every contract
change. Keep `GENVM_VERSION=v0.6.0-rc2` process-local, keep the source tree at
`<WSL checkout>`, and do not change the starter contract dependency
header merely to accommodate a different cache.

### Phase 1.5 conclusion

The full official Direct Mode suite now executes reliably in WSL with the
repository's required Python RC family and a coherent v0.6.0-rc2 GenVM tree.
Contract lint and all JavaScript baseline gates remain green. The only remaining
environment limitation is native Windows runner compatibility; WSL is the
required authoritative contract-test environment for future contract edits.

### Phase 2 execution reference

Phase 2 contract work uses the same WSL runner and pinned GenVM version. The
repeatable command is:

```text
wsl.exe -d Ubuntu --cd <WSL checkout> -- env GENVM_VERSION=v0.6.0-rc2 /home/dell/Uphold/.venv-genlayer/bin/python -m pytest tests/direct/ -v
```

Phase 2 must preserve the original starter contracts and rerun this complete
suite after every contract edit. No Studio Next deployment or state-changing
RPC is part of the Direct Mode verification.
