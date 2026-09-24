# Uphold V1.2 toolchain basis

Checked 2026-09-24 against the official GenLayer documentation and published package metadata. The selected family is the Consensus v0.6 / Studio v0.123 RC line: `genlayer-js 2.0.0-rc.1`, `genlayer-py 0.19.0rc2`, `genlayer-test 0.30.0rc2`, `genvm-linter 0.11.1rc2`, GenLayer CLI `0.40.0-rc.3`, and Transaction Kit `0.1.0-rc.2`.

The active network is canonical GenLayer Studio-dev: `https://studio-dev.genlayer.com/api`, chain ID `61997`, JS chain `studioDevnet`, and CLI alias `studio-dev`. Studio-dev is the release-candidate preview; the stable Studionet alias and RPC are not used by Uphold V1.2.

The contract retains the concrete V1.1 runner header `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`. `genvm-lint check`, schema extraction, and typecheck are the compatibility gates for that decision.

Primary guidance reviewed:

- [Consensus v0.6 Migration](https://docs.genlayer.com/developers/consensus-v06-migration)
- [Networks](https://docs.genlayer.com/developers/networks)
- [Fees & Transaction Policy](https://docs.genlayer.com/developers/decentralized-applications/fees-and-transaction-kit)
- [Fee Profiling & Estimation](https://docs.genlayer.com/developers/decentralized-applications/fee-profiling-and-estimation)
- [Transaction Kit Integration](https://docs.genlayer.com/developers/decentralized-applications/transaction-kit-integration)
- [Prompt Injection](https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection)
- [GenLayer Skills](https://github.com/genlayerlabs/skills/tree/main/plugins/genlayer-dev/skills): `write-contract`, `genvm-lint`, `direct-tests`, `integration-tests`, and `genlayer-cli`.

The complete machine-readable record is [genlayer-release-family.json](./genlayer-release-family.json).
