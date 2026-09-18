# Uphold frontend

The Uphold frontend is the Next.js application for GEN-backed public commitments. It reads the real Studio Next contract and displays authenticated live-snapshot evidence, semantic findings, stake, expiry, activity, and transparency data.

## Local setup

From the repository root:

```shell
npm ci
Copy-Item frontend/.env.example frontend/.env
npm run dev
```

The public configuration targets GenLayer Studio Next, chain `61997`, RPC `https://studio-next.genlayer.com/api`, and the canonical Uphold contract `0x23786A52b62DC489A5f69653dedD68d1fc56c231`.

## Frontend architecture

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Shared Studio Next wallet/network configuration in `lib/genlayer`
- Typed Uphold reads, write payloads, normalization, lifecycle actions, and error mapping in `lib/uphold`
- `@genlayer/transaction-kit` and `@genlayer/transaction-kit-react` for fee estimation, wallet submission, tracking, execution verification, and state readback
- No backend, database, fake indexer, or client-side protocol state

The UI explicitly distinguishes broadcast, consensus, finalization, successful execution, and expected state confirmation. Pending GenLayer transaction IDs are stored locally so the same transaction can be reconciled after a refresh; the app never blindly rebroadcasts after a timeout.

## Routes

`/` landing · `/app` overview · `/app/explore` discovery · `/app/create` commitment workflow · `/app/commitments/[id]` detail and evidence timeline · `/app/activity` public history · `/app/profile/[address]` Uphold Record · `/transparency` methodology.

## Checks

```shell
npm test
npm run lint
npm run build
```

The authoritative contract runner remains WSL Ubuntu with Python 3.12.3 and GenVM v0.6.0-rc5. The active fee profile is the measured Studio Next profile in `fee-profile.json`; uncertified methods continue to use the network-default fallback.
