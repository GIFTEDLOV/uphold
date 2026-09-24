# Uphold frontend

The Uphold frontend is the Next.js application for GEN-backed public commitments. It reads the real Studio-dev contract and displays authenticated live-snapshot evidence, semantic findings, stake, expiry, activity, and transparency data.

## Local setup

From the repository root:

```shell
npm ci
Copy-Item frontend/.env.example frontend/.env
npm run dev
```

The V1.2 configuration targets GenLayer Studio-dev, chain `61997`, RPC `https://studio-dev.genlayer.com/api`; the V1.2 contract address is supplied by the release proof package.

## Frontend architecture

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Shared Studio-dev wallet/network configuration in `lib/genlayer`
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

The active fee profile is the official measured Studio-dev profile in `fee-profile.json`; Transaction Kit uses it as suggestions and reports network-default fallback when a method is not covered.
