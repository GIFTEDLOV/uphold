import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import type { GenLayerClient, GenLayerTransaction } from "genlayer-js/types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RPC = "https://studio-next.genlayer.com/api";
const CHAIN_ID = 61997;
const CONTRACT = "0x96671389548f170A6f02BC3017495d157d827599" as `0x${string}`;
const CONTRACT_PATH = "contracts/uphold.py";
const CONTRACT_SHA256 = "3DDFAA229BF36B7D8F06B70FE6E1B4582D004A3FFEDAF08E154834B54819FD3F";
const RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";

const requireFromProject = createRequire(path.resolve(REPO_ROOT, "package.json"));
const { isSuccessful } = requireFromProject("genlayer-js") as {
  isSuccessful: (transaction: GenLayerTransaction) => boolean;
};

type AnyRecord = Record<string, unknown>;

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function writeRecord(filePath: string, record: AnyRecord): void {
  writeFileSync(filePath, JSON.stringify(jsonSafe(record), null, 2) + "\n", "utf8");
}

function getAccountAddress(client: GenLayerClient<any>): `0x${string}` {
  const account = (client as unknown as { account?: { address?: `0x${string}` } | `0x${string}` }).account;
  const address = typeof account === "string" ? account : account?.address;
  if (!address) throw new Error("The active signing account is unavailable.");
  return address;
}

function field(record: unknown, names: string[]): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) return (record as AnyRecord)[name];
  }
  return undefined;
}

function transactionSummary(receipt: unknown): AnyRecord {
  const status = field(receipt, ["statusName", "status", "consensusStatus"]);
  const execution = field(receipt, ["txExecutionResultName", "executionResult", "result"]);
  return {
    status,
    consensus: field(receipt, ["decision", "consensus", "consensusStatus", "statusName"]),
    execution,
    successful: isSuccessful(receipt as GenLayerTransaction),
  };
}

async function readState(client: GenLayerClient<any>, method: string, args: unknown[] = []): Promise<unknown> {
  return client.readContract({ address: CONTRACT, functionName: method, args: args as never[] });
}

async function main(client: GenLayerClient<any>): Promise<void> {
  const operationId = process.env.UPHOLD_OPERATION_ID ?? "";
  const method = process.env.UPHOLD_METHOD ?? "";
  const args = JSON.parse(process.env.UPHOLD_ARGS_JSON ?? "[]") as unknown[];
  const valueWei = BigInt(process.env.UPHOLD_VALUE_WEI ?? "0");
  const expectedReturn = process.env.UPHOLD_EXPECTED_RETURN ?? "";
  const intent = process.env.UPHOLD_PHASE4B_INTENT_CONFIRMED === "1";
  const recordDir = path.join(REPO_ROOT, "evidence", "studio-next", "live-operations");
  const recordPath = path.join(recordDir, `${operationId}.json`);

  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(operationId)) throw new Error("Invalid unique operation ID.");
  if (existsSync(recordPath)) throw new Error(`Operation record already exists: ${recordPath}`);
  if (!intent) throw new Error("Explicit Phase 4B operator intent confirmation is required.");
  if (!method) throw new Error("Operation method is required.");
  if (method === "create_commitment" && valueWei <= 0n) throw new Error("Create requires a positive stake value.");

  const sourceBytes = readFileSync(path.join(REPO_ROOT, CONTRACT_PATH));
  const sourceSha = createHash("sha256").update(sourceBytes).digest("hex").toUpperCase();
  if (sourceSha !== CONTRACT_SHA256) throw new Error(`Contract source SHA mismatch: ${sourceSha}`);
  const deployer = getAccountAddress(client);
  const chainId = Number((await client.request({ method: "eth_chainId", params: [] })) as string);
  if (chainId !== CHAIN_ID) throw new Error(`Wrong chain: ${chainId}`);
  const feePolicy = await client.getCurrentFeePolicy();
  const beforeNonceLatest = await client.request({ method: "eth_getTransactionCount", params: [deployer, "latest"] });
  const beforeNoncePending = await client.request({ method: "eth_getTransactionCount", params: [deployer, "pending"] });
  if (beforeNonceLatest !== beforeNoncePending) {
    throw new Error(`Unknown pending transaction state: latest=${beforeNonceLatest}, pending=${beforeNoncePending}`);
  }
  const balanceBefore = await client.getBalance({ address: deployer });
  const precondition: AnyRecord = {
    contractInfo: await readState(client, "contract_info"),
    limits: await readState(client, "get_limits"),
    ledger: await readState(client, "get_ledger"),
    commitmentIds: await readState(client, "get_commitment_ids", [0]),
  };
  if (method !== "create_commitment" && args[0]) {
    precondition.commitment = await readState(client, "get_commitment", [args[0]]);
    precondition.history = await readState(client, "commitment_history", [args[0]]);
  }

  const preparedAt = new Date().toISOString();
  mkdirSync(recordDir, { recursive: true });
  const record: AnyRecord = {
    operationId,
    method,
    args,
    valueWei: valueWei.toString(),
    operatorIntentConfirmed: true,
    status: "PREPARED",
    preparedAt,
    rpc: RPC,
    chainId,
    contract: CONTRACT,
    contractPath: CONTRACT_PATH,
    contractSha256: sourceSha,
    runner: RUNNER,
    deployer,
    balanceBeforeWei: balanceBefore.toString(),
    nonceLatestBefore: beforeNonceLatest,
    noncePendingBefore: beforeNoncePending,
    unknownPendingBefore: beforeNonceLatest !== beforeNoncePending,
    feePolicy,
    precondition,
  };
  writeRecord(recordPath, record);

  const estimate = await client.estimateTransactionFees({});
  if (!estimate.feeValue || BigInt(estimate.feeValue) <= 0n) throw new Error("Live fee quote is not positive.");
  record.feeQuote = estimate;
  record.quoteSource = "Studio Next network-default estimateTransactionFees({})";
  writeRecord(recordPath, record);

  const writeArgs: AnyRecord = {
    address: CONTRACT,
    functionName: method,
    args: args as never[],
    fees: estimate,
  };
  if (valueWei > 0n) writeArgs.value = valueWei;

  let txHash: `0x${string}`;
  try {
    txHash = await client.writeContract(writeArgs as never) as `0x${string}`;
  } catch (error) {
    record.status = "BROADCAST_FAILED";
    record.broadcastError = String(error);
    writeRecord(recordPath, record);
    throw error;
  }

  record.status = "BROADCAST";
  record.broadcastAt = new Date().toISOString();
  record.txHash = txHash;
  writeRecord(recordPath, record);

  let receipt: GenLayerTransaction;
  try {
    receipt = await client.waitForFinalization({ hash: txHash, fullTransaction: true });
  } catch (error) {
    record.status = "BLOCKED_PENDING_RECONCILIATION";
    record.reconciliationError = String(error);
    record.reconciledAt = new Date().toISOString();
    writeRecord(recordPath, record);
    throw error;
  }

  record.receipt = receipt;
  record.finalizedAt = new Date().toISOString();
  record.transactionSummary = transactionSummary(receipt);
  record.status = record.transactionSummary.successful === true ? "FINALIZED_SUCCESSFUL" : "FINALIZED_FAILED";
  if (record.transactionSummary.successful !== true) {
    writeRecord(recordPath, record);
    throw new Error("Finalized execution was not successful; no retry is permitted.");
  }
  if (expectedReturn && field(receipt, ["returnData", "returnValue"]) === expectedReturn) record.expectedReturnMatched = true;

  if (method === "create_commitment" || args[0]) {
    record.stateReadback = {
      commitment: await readState(client, "get_commitment", [args[0] ?? ""]),
      history: await readState(client, "commitment_history", [args[0] ?? ""]),
      ledger: await readState(client, "get_ledger"),
      commitmentIds: await readState(client, "get_commitment_ids", [0]),
    };
  } else {
    record.stateReadback = { ledger: await readState(client, "get_ledger"), commitmentIds: await readState(client, "get_commitment_ids", [0]) };
  }
  writeRecord(recordPath, record);
}

export default main;
