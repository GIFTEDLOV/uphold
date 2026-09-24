import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chains, createAccount, createClient, isSuccessful } from "genlayer-js";
import { TransactionHashVariant } from "genlayer-js/types";

const root = process.cwd();
const rpc = "https://studio-dev.genlayer.com/api";
const chainId = 61997;
const contract = "0x5C2C0827B08C720787673dE325a36886e8Ec8645";
const runner = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
const sourcePath = path.resolve(root, "contracts/uphold.py");
const profilePath = path.resolve(root, "frontend/fee-profile.json");
const proofDir = path.resolve(root, "deployments/studio-dev/v1.2");
const operationsDir = path.join(proofDir, "qualification-operations");
const sourceSha256 = createHash("sha256").update(readFileSync(sourcePath)).digest("hex").toUpperCase();
const profileBytes = readFileSync(profilePath);
const profile = JSON.parse(profileBytes);
const profileSha256 = createHash("sha256").update(profileBytes).digest("hex").toUpperCase();
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const save = (file, value) => writeFileSync(path.join(proofDir, file), `${JSON.stringify(safe(value), null, 2)}\n`, "utf8");
const saveOperation = (id, value) => save(path.join("qualification-operations", `${id}.json`), value);
const field = (value, names) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  for (const name of names) if (Object.prototype.hasOwnProperty.call(value, name)) return value[name];
  return undefined;
};
const statusName = (receipt) => field(receipt, ["statusName", "status", "consensusStatus"]);
const executionName = (receipt) => field(receipt, ["txExecutionResultName", "txExecutionResult", "executionResult", "result"]);

if (sourceSha256 !== "5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401") throw new Error(`unexpected source sha ${sourceSha256}`);
if (profile.network !== "studio-dev" || Number(profile.chainId) !== chainId) throw new Error("fee profile is not canonical Studio-dev");
mkdirSync(operationsDir, { recursive: true });
const requireProject = createRequire(path.resolve(root, "package.json"));
let keytar;
try {
  keytar = requireProject("keytar");
} catch {
  const globalPackage = path.join(process.env.APPDATA ?? process.env.XDG_DATA_HOME ?? ".", "npm", "node_modules", "genlayer", "package.json");
  keytar = createRequire(globalPackage)("keytar");
}
const accountName = process.env.GENLAYER_ACCOUNT_NAME ?? "agentpact-requester";
const privateKey = await keytar.getPassword("genlayer-cli", `account:${accountName}`);
if (!privateKey) throw new Error(`active local account '${accountName}' is not unlocked`);
const account = createAccount(privateKey);
const chain = {
  ...chains.studioDevnet,
  id: chainId,
  name: "GenLayer Studio-dev",
  rpcUrls: { default: { http: [rpc] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};
const client = createClient({ chain, endpoint: rpc, account });
const read = (functionName, args = []) => client.readContract({ address: contract, functionName, args, transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
const actualChain = Number(await client.request({ method: "eth_chainId", params: [] }));
const actualNetwork = Number(await client.request({ method: "net_version", params: [] }));
if (actualChain !== chainId || actualNetwork !== chainId) throw new Error(`wrong chain: ${actualChain}/${actualNetwork}`);
const signer = account.address;
const beneficiary = "0x000000000000000000000000000000000000dEaD";
const commitmentId = `v12-live-${Date.now().toString(36)}`;
const sourceUrl = "https://example.com";
const commitmentText = "The Example Domain page remains available for illustrative examples.";
const stake = 1000000000000000n;
const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
const common = {
  rpc,
  chainId,
  contract,
  contractPath: "contracts/uphold.py",
  contractSha256: sourceSha256,
  runner,
  signer,
  beneficiary,
  commitmentId,
  sourceUrl,
  commitmentText,
  feeProfileSha256: profileSha256,
  quotePolicy: "official measured profile entry plus current live prices",
};

const initialIds = await read("get_commitment_ids", [100]);
if (!Array.isArray(initialIds) || initialIds.length !== 0) throw new Error("fresh qualification requires an empty deployed contract");
const beforeLedger = await read("get_ledger");
const beforeAddress = await read("get_address_record", [signer]);
const info = await read("contract_info");
if (info?.name !== "Uphold" || info?.version !== "live-snapshot-v1.2") throw new Error("contract_info precondition mismatch");

const feeEntry = (method) => profile.methods[method];
const quoteFor = async (method) => {
  const entry = feeEntry(method);
  const rotations = Number(entry.rotationsPerRound);
  return client.estimateTransactionFees({
    leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
    executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
    totalMessageFees: BigInt(entry.totalMessageFees),
    appealRounds: 0n,
    rotations: [rotations],
  });
};

async function writeOnce(operationId, method, args, value = 0n) {
  const record = { ...common, operationId, method, args, value: value.toString(), status: "PREPARED", preparedAt: new Date().toISOString() };
  const entry = feeEntry(method);
  const quote = await quoteFor(method);
  record.feeQuote = quote;
  record.status = "QUOTED";
  record.quotedAt = new Date().toISOString();
  saveOperation(operationId, record);
  let txHash;
  try {
    txHash = await client.writeContract({ address: contract, functionName: method, args, ...(value > 0n ? { value } : {}), fees: { distribution: quote.distribution, feeValue: quote.feeValue } });
  } catch (error) {
    record.status = "BROADCAST_FAILED_NO_HASH";
    record.error = String(error);
    saveOperation(operationId, record);
    throw error;
  }
  record.txHash = txHash;
  record.status = "BROADCAST";
  record.broadcastAt = new Date().toISOString();
  saveOperation(operationId, record);
  const receipt = await client.waitForFinalization({ hash: txHash, retries: 240, interval: 5000, fullTransaction: true });
  record.receipt = receipt;
  record.finalStatus = statusName(receipt);
  record.execution = executionName(receipt);
  record.success = record.finalStatus === "FINALIZED" && isSuccessful(receipt);
  record.status = record.success ? "FINALIZED_SUCCESSFUL" : "FINALIZED_FAILED";
  record.finalizedAt = new Date().toISOString();
  saveOperation(operationId, record);
  if (!record.success) throw new Error(`${operationId} finalized unsuccessfully: ${record.finalStatus}/${record.execution}`);
  return record;
}

const createArgs = [commitmentId, "Example Domain reference", "public-accountability", sourceUrl, commitmentText, beneficiary, "20260101000000", expiry, 3600];
const creation = await writeOnce("create-commitment", "create_commitment", createArgs, stake);
const afterCreate = await read("get_commitment", [commitmentId]);
const baselineHistory = await read("commitment_history", [commitmentId]);
if (afterCreate?.commitment_id !== commitmentId || afterCreate?.status !== "ACTIVE" || BigInt(afterCreate?.original_stake ?? 0) !== stake) throw new Error("creation readback failed");
const check = await writeOnce("positive-check", "check_commitment", [commitmentId]);
const afterCheck = await read("get_commitment", [commitmentId]);
const history = await read("commitment_history", [commitmentId]);
const ledger = await read("get_ledger");
const addressRecord = await read("get_address_record", [signer]);
const ids = await read("get_commitment_ids", [100]);
if (afterCheck?.commitment_id !== commitmentId || afterCheck?.status !== "ACTIVE" || BigInt(afterCheck?.checks_run ?? 0) < 1n) throw new Error("positive check readback failed");
if (!Array.isArray(history) || history.length < 2) throw new Error("immutable history readback failed");
if (!Array.isArray(ids) || !ids.includes(commitmentId)) throw new Error("commitment id readback failed");
if (BigInt(ledger?.total_escrowed ?? 0) !== stake) throw new Error("ledger escrow mismatch");
if (BigInt(addressRecord?.total_gen_bonded ?? 0) !== stake) throw new Error("address record mismatch");

const qualification = {
  result: "PASS",
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  contract,
  contractVersion: "live-snapshot-v1.2",
  sourceSha256,
  runner,
  signer,
  beneficiary,
  fixtureDisclosure: "The source is the public example.com reference page and the qualification is a controlled release fixture; it is not natural breach evidence.",
  transactionHashes: { create_commitment: creation.txHash, check_commitment: check.txHash },
  transactions: [
    { operationId: creation.operationId, method: creation.method, txHash: creation.txHash, status: creation.finalStatus, execution: creation.execution },
    { operationId: check.operationId, method: check.method, txHash: check.txHash, status: check.finalStatus, execution: check.execution },
  ],
  reads: {
    transactionHashVariant: "LATEST_FINAL",
    initialCommitmentIds: initialIds,
    beforeLedger,
    beforeAddress,
    contractInfo: info,
    baselineCommitment: afterCreate,
    baselineHistory,
    finalCommitment: afterCheck,
    finalHistory: history,
    finalLedger: ledger,
    finalAddressRecord: addressRecord,
    finalCommitmentIds: ids,
  },
  accounting: {
    stakeWei: stake.toString(),
    ledgerEscrowWei: String(ledger.total_escrowed),
    addressBondedWei: String(addressRecord.total_gen_bonded),
    conserved: BigInt(ledger.total_escrowed) === stake && BigInt(addressRecord.total_gen_bonded) === stake,
  },
  qualifiedAt: new Date().toISOString(),
};
save("qualification.json", qualification);
console.log(JSON.stringify({
  QUALIFICATION: qualification.result,
  CONTRACT: contract,
  CREATE_TX: creation.txHash,
  CHECK_TX: check.txHash,
  FINAL_STATUS: [creation.finalStatus, check.finalStatus],
  EXECUTION: [creation.execution, check.execution],
  LATEST_FINAL_READS: "PASS",
}, null, 2));
