import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chains, createClient, isSuccessful } from "genlayer-js";
import { TransactionHashVariant } from "genlayer-js/types";

const root = process.cwd();
const rpc = "https://studio-dev.genlayer.com/api";
const chainId = 61997;
const contract = "0x5C2C0827B08C720787673dE325a36886e8Ec8645";
const proofDir = path.resolve(root, "deployments/studio-dev/v1.2");
const operationPath = path.join(proofDir, "qualification-operations", "positive-check.json");
const record = JSON.parse(readFileSync(operationPath, "utf8"));
if (!record.txHash) throw new Error("positive-check record has no persisted transaction hash");
if (record.status === "FINALIZED_SUCCESSFUL") throw new Error("positive-check is already finalized; refusing duplicate reconciliation");
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const save = (file, value) => writeFileSync(file, `${JSON.stringify(safe(value), null, 2)}\n`, "utf8");
const field = (value, names) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  for (const name of names) if (Object.prototype.hasOwnProperty.call(value, name)) return value[name];
  return undefined;
};
const statusName = (receipt) => field(receipt, ["statusName", "status", "consensusStatus"]);
const executionName = (receipt) => field(receipt, ["txExecutionResultName", "txExecutionResult", "executionResult", "result"]);
const chain = {
  ...chains.studioDevnet,
  id: chainId,
  name: "GenLayer Studio-dev",
  rpcUrls: { default: { http: [rpc] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};
const client = createClient({ chain, endpoint: rpc });
const receipt = await client.waitForFinalization({ hash: record.txHash, retries: 240, interval: 5000, fullTransaction: true });
record.receipt = receipt;
record.finalStatus = statusName(receipt);
record.execution = executionName(receipt);
record.success = record.finalStatus === "FINALIZED" && isSuccessful(receipt);
record.status = record.success ? "FINALIZED_SUCCESSFUL" : "FINALIZED_FAILED";
record.reconciledAt = new Date().toISOString();
save(operationPath, record);
if (!record.success) throw new Error(`positive-check finalized unsuccessfully: ${record.finalStatus}/${record.execution}`);

const read = (functionName, args = []) => client.readContract({ address: contract, functionName, args, transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
const info = await read("contract_info");
const commitment = await read("get_commitment", [record.commitmentId]);
const history = await read("commitment_history", [record.commitmentId]);
const ledger = await read("get_ledger");
const addressRecord = await read("get_address_record", [record.signer]);
const ids = await read("get_commitment_ids", [100]);
const createPath = path.join(proofDir, "qualification-operations", "create-commitment.json");
const creation = JSON.parse(readFileSync(createPath, "utf8"));
if (info?.name !== "Uphold" || info?.version !== "live-snapshot-v1.2") throw new Error("contract_info mismatch");
if (commitment?.commitment_id !== record.commitmentId || commitment?.status !== "ACTIVE" || BigInt(commitment?.checks_run ?? 0) < 1n) throw new Error("positive-check commitment readback failed");
if (!Array.isArray(history) || history.length < 2) throw new Error("positive-check history readback failed");
if (!Array.isArray(ids) || !ids.includes(record.commitmentId)) throw new Error("positive-check id readback failed");
const stake = BigInt(creation.value ?? 0);
if (BigInt(ledger?.total_escrowed ?? 0) !== stake || BigInt(addressRecord?.total_gen_bonded ?? 0) !== stake) throw new Error("qualification accounting mismatch");
const localSourceSha256 = createHash("sha256").update(readFileSync(path.join(root, "contracts/uphold.py"))).digest("hex").toUpperCase();
const qualification = {
  result: "PASS",
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  contract,
  contractVersion: "live-snapshot-v1.2",
  sourceSha256: localSourceSha256,
  runner: record.runner,
  signer: record.signer,
  beneficiary: record.beneficiary,
  commitmentId: record.commitmentId,
  sourceUrl: record.sourceUrl,
  commitmentText: record.commitmentText,
  fixtureDisclosure: "The source is the public example.com reference page and the qualification is a controlled release fixture; it is not natural breach evidence.",
  transactionHashes: { create_commitment: creation.txHash, check_commitment: record.txHash },
  transactions: [
    { operationId: creation.operationId, method: creation.method, txHash: creation.txHash, status: creation.finalStatus, execution: creation.execution },
    { operationId: record.operationId, method: record.method, txHash: record.txHash, status: record.finalStatus, execution: record.execution },
  ],
  reads: {
    transactionHashVariant: "LATEST_FINAL",
    contractInfo: info,
    commitment,
    history,
    ledger,
    addressRecord,
    commitmentIds: ids,
  },
  accounting: {
    stakeWei: stake.toString(),
    ledgerEscrowWei: String(ledger.total_escrowed),
    addressBondedWei: String(addressRecord.total_gen_bonded),
    conserved: BigInt(ledger.total_escrowed) === stake && BigInt(addressRecord.total_gen_bonded) === stake,
  },
  reconciledAt: new Date().toISOString(),
};
save(path.join(proofDir, "qualification.json"), qualification);
console.log(JSON.stringify({
  QUALIFICATION: "PASS",
  CREATE_TX: creation.txHash,
  CHECK_TX: record.txHash,
  FINAL_STATUS: [creation.finalStatus, record.finalStatus],
  EXECUTION: [creation.execution, record.execution],
  LATEST_FINAL_READS: "PASS",
  ACCOUNTING: qualification.accounting,
}, null, 2));
