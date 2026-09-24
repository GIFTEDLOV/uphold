# Uphold V1.2 toolchain basis

Checked 2026-09-24 against the official GenLayer documentation and published package metadata. The selected family is the Consensus v0.6 / Studio v0.123 RC line: `genlayer-js 2.0.0-rc.1`, `genlayer-py 0.19.0rc2`, `genlayer-test 0.30.0rc2`, `genvm-linter 0.11.1rc2`, GenLayer CLI `0.40.0-rc.3`, and Transaction Kit `0.1.0-rc.2`.

The active network is canonical GenLayer Studio-dev: `https://studio-dev.genlayer.com/api`, chain ID `61997`, JS chain `studioDevnet`, and CLI alias `studio-dev`. Studio-dev is the release-candidate preview; the stable Studionet alias and RPC are not used by Uphold V1.2.

The official `write-contract` skill documents `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, but that runner remains incompatible with the current hosted Studio-dev environment and is not used by Uphold. The active Uphold runner is `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`. The corrected exact Uphold source passes canonical Studio-dev `gen_getContractSchemaForCode` with 15 methods, 7 views, and 8 writes, and the pinned `genlayer-js 2.0.0-rc.1` SDK cross-check passes the equivalent schema. The 5jyc diagnostic probe v2 also passes with `gl.contract.Contract`.

The original hosted deployment failure was caused by contiguous leading comment
parsing: the adjacent Pyright directive was consumed into the runner descriptor
and made it malformed. The only contract change is the blank line separating
the dependency header from that directive. The first 5jyc probe failure was a
probe-source error (`from genlayer import *` while using `gl`); the second was
also probe-source-specific (`gl.Contract` instead of `gl.contract.Contract`).

The corrected probe v2 and exact Uphold source both returned schemas, and the
exact source then deployed successfully with `FINALIZED / FINISHED_WITH_RETURN`
at `0x5C2C0827B08C720787673dE325a36886e8Ec8645`.

The deployment source hash is `5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401`.
The only contract-source difference from the previous V1.2 candidate is the
blank line separating the runner header from the Pyright directive. The failed
deployment transaction `0x06e758820d433baa29061b7dd432042dcefd8ec40749b53982bafa9cd9841f86`
is retained as historical evidence.

Primary guidance reviewed:

- [Consensus v0.6 Migration](https://docs.genlayer.com/developers/consensus-v06-migration)
- [Networks](https://docs.genlayer.com/developers/networks)
- [Fees & Transaction Policy](https://docs.genlayer.com/developers/decentralized-applications/fees-and-transaction-kit)
- [Fee Profiling & Estimation](https://docs.genlayer.com/developers/decentralized-applications/fee-profiling-and-estimation)
- [Transaction Kit Integration](https://docs.genlayer.com/developers/decentralized-applications/transaction-kit-integration)
- [Prompt Injection](https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection)
- [GenLayer Skills](https://github.com/genlayerlabs/skills/tree/main/plugins/genlayer-dev/skills): `write-contract`, `genvm-lint`, `direct-tests`, `integration-tests`, and `genlayer-cli`.

The complete machine-readable record is [genlayer-release-family.json](./genlayer-release-family.json).
