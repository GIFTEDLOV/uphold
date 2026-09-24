# Uphold V1.2 — canonical Studio-dev proof

This is the canonical V1.2 deployment package. It is separate from the
historical V1.1 package and preserves the failed V1.2 attempt without treating
it as a deployment.

- Network: GenLayer Studio-dev
- RPC: `https://studio-dev.genlayer.com/api`
- Chain ID: `61997`
- Contract: `0x5C2C0827B08C720787673dE325a36886e8Ec8645`
- Version: `live-snapshot-v1.2`
- Source SHA-256: `5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401`
- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Deployment transaction: `0x4605905ffcfc3e9c070f857b0fde1a77976fbcae56330c3695b9f27e62a55356`
- Deployment result: `FINALIZED` / `FINISHED_WITH_RETURN`

## Parity and qualification

`source-readback.json` proves byte/source SHA parity. `schema.json` proves 15
methods, 7 views, and 8 writes. `contract-info-readback.json` proves the final
`contract_info` name and version using `LATEST_FINAL`. `qualification.json`
records the create and positive check transactions, authenticated baseline,
immutable history, ledger conservation, address record, and final-state
readbacks. The qualification source is a controlled `example.com` fixture; it
is not natural breach evidence.

## Fee profile

The official measured fee profile is `../../frontend/fee-profile.json` with
SHA-256 `F4A85DF9AB5DDB2F19A8F7B303594B1876DCE552DEF3EABDE0D7AC7D787EDB3E`.
It is validated in CI and uses resource allocation fields rather than a live
fee value as a reusable suggestion.

## Historical records retained

- `manifest.pending.json` — failed original V1.2 deployment with the malformed
  contiguous runner-comment header, `FINALIZED / FINISHED_WITH_ERROR`, and
  `invalid_contract runner malformed`.
- `manifest.corrected.pending.json` — one-shot corrected deployment record.
- `../../../artifacts/runner-probe/` — failed 1jb diagnostics, corrected 5jyc
  probe v2, and exact-source schema evidence.
- Historical V1.1 address: `0x23786A52b62DC489A5f69653dedD68d1fc56c231`.

The external EOA transfer boundary remains an honest limitation: the contract
records pending payout/refund requests, but no contract-level external receipt
is claimed here.
