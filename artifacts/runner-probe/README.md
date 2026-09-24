# Studio-dev runner probes — historical diagnostics

These are disposable compatibility probes, not Uphold deployments. The first
1jb probe is preserved as a failed historical diagnostic. The corrected 5jyc
probe v2 below is the successful schema-only probe used for release evidence.

- Runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- Source: `studio-dev-runner-probe.py`
- Source SHA-256: `B9F5A1F7E9B7B9D26C811F25E7FC475965DC1C51C516FF10EF92BA8722A0C392`
- Network: GenLayer Studio-dev, chain `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Transaction: `0x414d53befcc5bd9acc37b82b0053cb447d679e7077663f8a16f8568699b51abf`
- Status: `FINALIZED`
- Execution: `FINISHED_WITH_ERROR`
- Contract address: none
- `ping()` readback: none
- Failure: `invalid_contract runner malformed`

## Corrected 5jyc probe v2

- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Source: `schema-final-5jyc-probe-v2.json`
- Method: `gen_getContractSchemaForCode` with UTF-8 hex source
- Result: `PASS`, one view method (`ping`)
- Writes: none; no probe deployment was made

The exact corrected Uphold source is the authoritative release gate and
returned 15 methods, 7 views, and 8 writes before its successful deployment.

The raw receipt, fee quote, settlement, and validator result are preserved in `manifest.pending.json`. The probe stop condition prohibits another runner or Uphold deployment in this run.
