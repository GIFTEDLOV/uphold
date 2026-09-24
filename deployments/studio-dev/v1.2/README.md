# Uphold V1.2 deployment attempt — blocked

This directory preserves the first and only V1.2 deployment attempt. The transaction reached `FINALIZED`, but execution returned `FINISHED_WITH_ERROR`; therefore this is not a V1.2 deployment proof package and must not be promoted.

- Network: GenLayer Studio-dev, chain `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Transaction: `0x06e758820d433baa29061b7dd432042dcefd8ec40749b53982bafa9cd9841f86`
- Final status: `FINALIZED`
- Execution: `FINISHED_WITH_ERROR`
- Receipt result: `MAJORITY_AGREE`
- Contract address: none
- Source SHA-256: `EC4BD059AC218BA3E9151EE34C6B41F8810B371FF95F9A153B1D0BCB98EBB71C`
- Receipt contract error: `invalid_contract runner malformed`

No V1.2 source readback, schema parity, qualification, frontend promotion, Vercel production deployment, GitHub release, or branch protection change is valid after this failure. Do not submit a second deployment from this release attempt. Resolve and independently audit the runner compatibility before restarting the release.

The complete raw receipt and fee settlement are retained in `manifest.pending.json`. The historical V1.1 deployment remains unchanged elsewhere in the repository.
