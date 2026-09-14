# Uphold frontend

Uphold is an evidence-backed commitment-bond application: users stake GEN behind a published promise, and GenLayer independently evaluates authenticated archived evidence over time.

## Local setup

From the repository root:

```shell
npm ci
Copy-Item frontend/.env.example frontend/.env
npm run dev
```

The default configuration is GenLayer Studio Next, chain `61997`, RPC `https://studio-next.genlayer.com/api`. Keep `NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address` until the Phase 4 deployment. The app will show a setup state and will not fabricate contract data.

## Frontend architecture

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Shared Studio Next wallet/network configuration in `lib/genlayer`
- Typed Uphold reads, write payloads, normalization, lifecycle actions, and error mapping in `lib/uphold`
- `@genlayer/transaction-kit` and `@genlayer/transaction-kit-react` RC2 for fee estimation, wallet submission, tracking, execution verification, and state readback
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

The repository’s authoritative contract runner remains WSL Ubuntu with Python 3.12.3 and GenVM v0.6.0-rc2. The existing starter fee profile is intentionally not wired to Uphold; fee measurements must be generated after deployment for the actual Uphold contract.
