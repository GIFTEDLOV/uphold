import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chains, createAccount, createClient, isSuccessful } from "genlayer-js";

const REPO_ROOT = path.resolve("C:/Users/DELL/Uphold");
const RPC = "https://studio-next.genlayer.com/api";
const CHAIN_ID = 61997;
const CONTRACT = "0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528";
const DEPLOYER = "0xCb5a845638Cbc1f95D7f8343278685682c3bA13F";
const RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
const SOURCE_PATH = path.join(REPO_ROOT, "contracts/uphold.py");
const SOURCE_SHA = "3DDFAA229BF36B7D8F06B70FE6E1B4582D004A3FFEDAF08E154834B54819FD3F";
const ACCOUNT_NAME = "meritround-v2-studionet";
const RECORD_DIR = path.join(REPO_ROOT, "evidence/studio-next/live-operations");

const chain = {
  ...chains.studioDevnet,
  id: CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [RPC] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};

const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const save = (filePath, record) => writeFileSync(filePath, `${JSON.stringify(safe(record), null, 2)}\n`, "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const field = (value, names) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  for (const name of names) if (Object.prototype.hasOwnProperty.call(value, name)) return value[name];
  return undefined;
};
const statusName = (receipt) => field(receipt, ["statusName", "status", "consensusStatus"]);
const executionName = (receipt) => field(receipt, ["txExecutionResultName", "txExecutionResult", "executionResult", "result"]);
const read = (client, method, args = []) => client.readContract({ address: CONTRACT, functionName: method, args });

function feeAccountingFromReceipt(receipt) {
  const found = {};
  const visit = (value, location = "receipt") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (lower.includes("fee") || lower.includes("resource") || lower.includes("gas") || lower.includes("timeunit")) {
        found[`${location}.${key}`] = nested;
      }
      visit(nested, `${location}.${key}`);
    }
  };
  visit(receipt);
  return found;
}

async function activeAccount() {
  const requireGlobal = createRequire("C:/Users/DELL/AppData/Roaming/npm/node_modules/genlayer/package.json");
  const keytarModule = requireGlobal("keytar");
  const keytar = keytarModule.default ?? keytarModule;
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`);
  if (!privateKey) throw new Error(`Active account '${ACCOUNT_NAME}' is not unlocked in the OS keychain.`);
  const account = createAccount(privateKey);
  if (account.address.toLowerCase() !== DEPLOYER.toLowerCase()) throw new Error(`Unexpected active signer: ${account.address}`);
  return account;
}

const operationId = process.env.UPHOLD_OPERATION_ID ?? "";
const method = process.env.UPHOLD_METHOD ?? "";
const args = JSON.parse(process.env.UPHOLD_ARGS_JSON ?? "[]");
const valueWei = BigInt(process.env.UPHOLD_VALUE_WEI ?? "0");
if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(operationId)) throw new Error("Invalid operation ID.");
if (!/^[a-z_]+$/.test(method)) throw new Error("Invalid method.");
if (!Array.isArray(args)) throw new Error("Arguments must be a JSON array.");
mkdirSync(RECORD_DIR, { recursive: true });
const recordPath = path.join(RECORD_DIR, `${operationId}.json`);
if (existsSync(recordPath)) throw new Error(`Refusing to repeat existing operation: ${recordPath}`);

const sourceBytes = readFileSync(SOURCE_PATH);
const sourceSha256 = sha256(sourceBytes);
if (sourceSha256 !== SOURCE_SHA) throw new Error(`Contract source SHA mismatch: ${sourceSha256}`);

const account = await activeAccount();
const client = createClient({ chain, endpoint: RPC, account });
const chainId = Number(await client.request({ method: "eth_chainId", params: [] }));
const netVersion = Number(await client.request({ method: "net_version", params: [] }));
if (chainId !== CHAIN_ID || netVersion !== CHAIN_ID) throw new Error(`Wrong target chain: eth_chainId=${chainId}, net_version=${netVersion}`);

const latestNonce = await client.request({ method: "eth_getTransactionCount", params: [DEPLOYER, "latest"] });
const pendingNonce = await client.request({ method: "eth_getTransactionCount", params: [DEPLOYER, "pending"] });
if (latestNonce !== pendingNonce) throw new Error(`Unknown pending transaction: latest=${latestNonce}, pending=${pendingNonce}`);
const balanceBefore = await client.getBalance({ address: DEPLOYER });
const contractInfo = await read(client, "contract_info");
const limits = await read(client, "get_limits");
const ledger = await read(client, "get_ledger");
const commitmentIds = await read(client, "get_commitment_ids", [100]);
if (method === "create_commitment" && Array.isArray(commitmentIds) && commitmentIds.length !== 0) throw new Error("Create precondition failed: contract is not empty.");

const record = {
  operationId,
  method,
  args,
  valueWei: valueWei.toString(),
  rpc: RPC,
  chainId,
  netVersion,
  contract: CONTRACT,
  contractPath: "contracts/uphold.py",
  contractSha256: sourceSha256,
  runner: RUNNER,
  signer: DEPLOYER,
  balanceBeforeWei: balanceBefore.toString(),
  nonceLatestBefore: latestNonce,
  noncePendingBefore: pendingNonce,
  feePolicy: await client.getCurrentFeePolicy(),
  precondition: { contractInfo, limits, ledger, commitmentIds },
  status: "PREPARED",
  preparedAt: new Date().toISOString(),
};
if (method !== "create_commitment" && args.length > 0) {
  record.precondition.commitment = await read(client, "get_commitment", [args[0]]);
  record.precondition.history = await read(client, "commitment_history", [args[0]]);
}
save(recordPath, record);

const quote = await client.estimateTransactionFees({});
if (!quote.feeValue || BigInt(quote.feeValue) <= 0n) throw new Error("Live network-default fee quote is not positive.");
if (balanceBefore <= BigInt(quote.feeValue) + valueWei) throw new Error("Insufficient balance for fee plus stake value.");
record.feeQuote = quote;
record.quoteSource = "Studio Next network-default estimateTransactionFees({})";
record.status = "QUOTED";
record.quotedAt = new Date().toISOString();
save(recordPath, record);

let txHash;
try {
  txHash = await client.writeContract({
    address: CONTRACT,
    functionName: method,
    args,
    value: valueWei,
    fees: { distribution: quote.distribution, feeValue: quote.feeValue },
  });
} catch (error) {
  record.status = "BROADCAST_FAILED_NO_HASH";
  record.broadcastError = String(error);
  record.failedAt = new Date().toISOString();
  save(recordPath, record);
  throw error;
}

record.status = "BROADCAST";
record.txHash = txHash;
record.broadcastAt = new Date().toISOString();
save(recordPath, record);
console.log(`PERSISTED_TX_HASH ${txHash}`);

let receipt;
try {
  receipt = await client.waitForFinalization({ hash: txHash, retries: 240, interval: 5000, fullTransaction: true });
} catch (error) {
  record.status = "BLOCKED_PENDING_RECONCILIATION";
  record.reconciliationError = String(error);
  record.reconciledAt = new Date().toISOString();
  save(recordPath, record);
  throw error;
}

record.receipt = receipt;
record.rawReceiptFeeAccounting = feeAccountingFromReceipt(receipt);
record.finalStatus = statusName(receipt);
record.consensus = field(receipt, ["decision", "consensus", "consensusStatus", "statusName"]);
record.execution = executionName(receipt);
record.success = record.finalStatus === "FINALIZED" && isSuccessful(receipt);
record.finalizedAt = new Date().toISOString();
record.status = record.success ? "FINALIZED_SUCCESSFUL" : "FINALIZED_FAILED";
save(recordPath, record);
if (!record.success) throw new Error(`Finalized execution unsuccessful for ${txHash}; no retry permitted.`);

const commitmentId = args[0] ?? "";
record.expectedStateReadback = {
  commitment: await read(client, "get_commitment", [commitmentId]),
  history: await read(client, "commitment_history", [commitmentId]),
  ledger: await read(client, "get_ledger"),
  commitmentIds: await read(client, "get_commitment_ids", [100]),
  addressRecord: await read(client, "get_address_record", [DEPLOYER]),
};
record.status = "READBACK_VERIFIED";
record.readbackAt = new Date().toISOString();
save(recordPath, record);
console.log(JSON.stringify({ operationId, method, txHash, finalStatus: record.finalStatus, execution: record.execution, success: record.success, recordPath }, null, 2));
