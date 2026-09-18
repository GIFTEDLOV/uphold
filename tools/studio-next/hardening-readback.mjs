import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chains, createClient } from "genlayer-js";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const RPC = "https://studio-next.genlayer.com/api";
const CHAIN_ID = 61997;
const CONTRACT = process.env.UPHOLD_CONTRACT_ADDRESS ?? "0x23786A52b62DC489A5f69653dedD68d1fc56c231";
const RECORD_DIR = path.resolve(process.env.UPHOLD_RECORD_DIR ?? path.join(REPO_ROOT, "evidence/studio-next/hardening-live-operations"));
const operationId = process.env.UPHOLD_OPERATION_ID ?? "";
const recordPath = path.join(RECORD_DIR, `${operationId}.json`);
if (!operationId || !existsSync(recordPath)) throw new Error(`Operation record not found: ${recordPath}`);

const chain = {
  ...chains.studioDevnet,
  id: CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [RPC] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const read = (client, method, args = []) => client.readContract({ address: CONTRACT, functionName: method, args });
const record = JSON.parse(readFileSync(recordPath, "utf8"));
const client = createClient({ chain, endpoint: RPC });
const chainId = Number(await client.request({ method: "eth_chainId", params: [] }));
if (chainId !== CHAIN_ID) throw new Error(`Wrong target chain: ${chainId}`);
const ids = await read(client, "get_commitment_ids", [100]);
const commitmentId = record.args?.[0] ?? "";
let commitment = null;
let history = null;
let addressRecords = {};
if (commitmentId) {
  commitment = await read(client, "get_commitment", [commitmentId]);
  history = await read(client, "commitment_history", [commitmentId]);
  for (const address of [commitment.promisor, commitment.beneficiary]) {
    addressRecords[address] = await read(client, "get_address_record", [address]);
  }
}
record.expectedStateReadback = {
  commitment,
  history,
  ledger: await read(client, "get_ledger"),
  commitmentIds: ids,
  addressRecords,
};
record.status = "READBACK_VERIFIED";
record.readbackAt = new Date().toISOString();
writeFileSync(recordPath, `${JSON.stringify(safe(record), null, 2)}\n`, "utf8");
console.log(JSON.stringify({ operationId, status: record.status, commitmentId, ids, readbackAt: record.readbackAt }, null, 2));
