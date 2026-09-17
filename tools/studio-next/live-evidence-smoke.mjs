import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Wallet } from "ethers";
import { chains, createAccount, createClient, isSuccessful } from "genlayer-js";

const RPC = "https://studio-next.genlayer.com/api";
const CHAIN_ID = 61997;
const RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
const SOURCE_PATH = "contracts/_studio_next_live_evidence_smoke.py";
const SOURCE_URL = "https://example.com/";
const RECORD_PATH = path.resolve("evidence/studio-next/live-evidence-smoke.json");
const chain = {
  ...chains.studioDevnet,
  id: CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [RPC] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  blockExplorers: { default: { name: "Studio Explorer", url: "https://explorer-studio-dev.genlayer.com/" } },
};

const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const save = (record) => { mkdirSync(path.dirname(RECORD_PATH), { recursive: true }); writeFileSync(RECORD_PATH, `${JSON.stringify(safe(record), null, 2)}\n`, "utf8"); };
const rpc = async (client, method, params = []) => client.request({ method, params });
const statusName = (receipt) => receipt?.statusName ?? receipt?.status;
const executionName = (receipt) => receipt?.txExecutionResultName ?? receipt?.txExecutionResult ?? receipt?.executionResult;
const addressFrom = (receipt) => receipt?.txDataDecoded?.contractAddress ?? receipt?.data?.contract_address ?? receipt?.contractAddress;

if (existsSync(RECORD_PATH)) throw new Error(`Refusing to repeat smoke: ${RECORD_PATH} already exists`);
const keyStorePath = process.env.SMOKE_KEYSTORE_PATH;
const keyStorePassword = process.env.SMOKE_KEYSTORE_PASSWORD;
if (!keyStorePath || !keyStorePassword) throw new Error("SMOKE_KEYSTORE_PATH and SMOKE_KEYSTORE_PASSWORD are required");
const wallet = Wallet.fromEncryptedJsonSync(readFileSync(keyStorePath, "utf8"), keyStorePassword);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain, endpoint: RPC, account });
const sourceBytes = new Uint8Array(readFileSync(path.resolve(SOURCE_PATH)));
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex").toUpperCase();
const chainId = Number(await rpc(client, "eth_chainId"));
if (chainId !== CHAIN_ID) throw new Error(`Wrong chain: ${chainId}`);
const deployer = account.address;
const latestNonce = await rpc(client, "eth_getTransactionCount", [deployer, "latest"]);
const pendingNonce = await rpc(client, "eth_getTransactionCount", [deployer, "pending"]);
if (latestNonce !== pendingNonce) throw new Error(`Unknown pending nonce: latest=${latestNonce}, pending=${pendingNonce}`);
const balanceBefore = await client.getBalance({ address: deployer });
let feePolicy = null;
try {
  feePolicy = await client.getCurrentFeePolicy();
} catch (error) {
  feePolicy = { unavailable: String(error) };
}
const record = {
  smoke: "studio-next-live-evidence-v1",
  rpc: RPC,
  chainId: CHAIN_ID,
  runner: RUNNER,
  contractPath: SOURCE_PATH,
  sourceSha256,
  sourceUrl: SOURCE_URL,
  noWayback: true,
  deployer,
  balanceBefore: balanceBefore.toString(),
  nonceLatestBefore: latestNonce,
  noncePendingBefore: pendingNonce,
  feePolicy,
  deployment: { status: "PREPARED", txHash: null, contractAddress: null },
  captures: [],
};
save(record);

const reconcile = async (entry, txHash) => {
  entry.status = "BROADCAST";
  entry.txHash = txHash;
  entry.broadcastAt = new Date().toISOString();
  save(record);
  const receipt = await client.waitForFinalization({ hash: txHash, fullTransaction: true });
  entry.finalStatus = statusName(receipt);
  entry.executionResult = executionName(receipt);
  entry.successful = statusName(receipt) === "FINALIZED" && isSuccessful(receipt);
  entry.receipt = receipt;
  entry.finalizedAt = new Date().toISOString();
  save(record);
  if (!entry.successful) throw new Error(`Smoke transaction finalized unsuccessfully: ${txHash}`);
  return receipt;
};

const deployFees = await client.estimateTransactionFees({});
if (BigInt(deployFees.feeValue) <= 0n) throw new Error("Smoke deploy fee quote is zero");
record.deployment.feeQuote = deployFees;
save(record);
const deploymentHash = await client.deployContract({ code: sourceBytes, args: [], fees: deployFees });
const deploymentReceipt = await reconcile(record.deployment, deploymentHash);
record.deployment.contractAddress = addressFrom(deploymentReceipt);
if (!record.deployment.contractAddress) throw new Error("Smoke deployment address missing");
record.deployment.codePresent = Boolean(await client.getContractCode(record.deployment.contractAddress));
record.deployment.readback = await client.readContract({ address: record.deployment.contractAddress, functionName: "contract_info", args: [] });
if (!record.deployment.codePresent || record.deployment.readback !== "UPHOLD_LIVE_EVIDENCE_SMOKE") throw new Error("Smoke deployment readback failed");
save(record);

for (const sequence of [0, 1]) {
  const entry = { sequence, status: "PREPARED", sourceUrl: SOURCE_URL };
  record.captures.push(entry);
  const fees = await client.estimateTransactionFees({});
  if (BigInt(fees.feeValue) <= 0n) throw new Error(`Capture ${sequence} fee quote is zero`);
  entry.feeQuote = fees;
  save(record);
  const txHash = await client.writeContract({ address: record.deployment.contractAddress, functionName: "capture", args: [SOURCE_URL], fees });
  await reconcile(entry, txHash);
  entry.readback = await client.readContract({ address: record.deployment.contractAddress, functionName: "get_snapshots", args: [] });
  save(record);
}
record.success = record.captures.every((entry) => entry.successful) && record.deployment.successful === true;
save(record);
console.log(JSON.stringify({ deployment: record.deployment, captures: record.captures, success: record.success }, null, 2));
if (!record.success) process.exitCode = 1;
