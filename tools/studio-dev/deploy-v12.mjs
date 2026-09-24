import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chains, createAccount, createClient, isSuccessful } from "genlayer-js";
import { TransactionHashVariant } from "genlayer-js/types";

const root = process.cwd();
const rpc = "https://studio-dev.genlayer.com/api";
const chainId = 61997;
const sourcePath = path.resolve(root, "contracts/uphold.py");
const profilePath = path.resolve(root, "frontend/fee-profile.json");
const deploymentDir = path.resolve(root, "deployments/studio-dev/v1.2");
// Preserve manifest.pending.json as the historical failed V1.2 attempt.
// The corrected header deployment gets its own one-shot reconciliation file.
const pendingPath = path.join(deploymentDir, "manifest.corrected.pending.json");
const completedPath = path.join(deploymentDir, "manifest.json");
const runner = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
const expectedSourceSha256 = "5A8AE2923E28BF78E2F6E85688DE62FD9A0EFAB619C9E1EA3469A43F7BD95401";
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const save = (file, value) => writeFileSync(file, `${JSON.stringify(safe(value), null, 2)}\n`, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const source = readFileSync(sourcePath);
const sourceSha256 = sha256(source);
const profileBytes = readFileSync(profilePath);
const profile = JSON.parse(profileBytes);

if (existsSync(pendingPath)) {
  const existing = JSON.parse(readFileSync(pendingPath, "utf8"));
  if (existing.txHash || existing.status === "FINALIZED_SUCCESSFUL") throw new Error("A deployment broadcast already exists; refusing a second deployment.");
}
if (existsSync(completedPath)) throw new Error("A completed V1.2 deployment manifest already exists; refusing a second deployment.");
if (profile.network !== "studio-dev" || Number(profile.chainId) !== chainId) throw new Error("Fee profile is not the canonical Studio-dev profile.");
if (sourceSha256 !== expectedSourceSha256) throw new Error(`Unexpected corrected Uphold source SHA-256: ${sourceSha256}`);

const requireProject = createRequire(path.resolve(root, "package.json"));
let keytar;
try {
  keytar = requireProject("keytar");
} catch {
  const globalGenlayerPackage = path.join(
    process.env.APPDATA ?? process.env.XDG_DATA_HOME ?? ".",
    "npm",
    "node_modules",
    "genlayer",
    "package.json",
  );
  keytar = createRequire(globalGenlayerPackage)("keytar");
}
const accountName = process.env.GENLAYER_ACCOUNT_NAME ?? "agentpact-requester";
const privateKey = await keytar.getPassword("genlayer-cli", `account:${accountName}`);
if (!privateKey) throw new Error(`Active local account '${accountName}' is not unlocked in the OS keychain.`);
const account = createAccount(privateKey);
const chain = {
  ...chains.studioDevnet,
  id: chainId,
  name: "GenLayer Studio-dev",
  rpcUrls: { default: { http: [rpc] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};
const client = createClient({ chain, endpoint: rpc, account });
const request = (method, params = []) => client.request({ method, params });
const actualChain = Number(await request("eth_chainId"));
const actualNetwork = Number(await request("net_version"));
if (actualChain !== chainId || actualNetwork !== chainId) throw new Error(`Wrong deployment chain: eth_chainId=${actualChain}, net_version=${actualNetwork}`);

const signer = account.address;
const latestNonce = Number(BigInt(await request("eth_getTransactionCount", [signer, "latest"])));
const pendingNonce = Number(BigInt(await request("eth_getTransactionCount", [signer, "pending"])));
if (latestNonce !== pendingNonce) throw new Error(`Unknown pending nonce: latest=${latestNonce}, pending=${pendingNonce}`);
const balanceWei = BigInt(await request("eth_getBalance", [signer, "latest"]));
const feePolicy = await client.getCurrentFeePolicy();
const entry = profile.deploy;
const appealRounds = BigInt(entry.appealRounds ?? "0");
const rotationsPerRound = BigInt(entry.rotationsPerRound ?? "0");
const estimate = await client.estimateTransactionFees({
  leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
  validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
  executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
  totalMessageFees: BigInt(entry.totalMessageFees ?? "0"),
  appealRounds,
  rotations: Array.from({ length: Number(appealRounds) + 1 }, () => rotationsPerRound),
});
const feeValue = BigInt(estimate.feeValue);
if (feeValue <= 0n || balanceWei <= feeValue) throw new Error("Deployment fee quote or balance is invalid.");

mkdirSync(deploymentDir, { recursive: true });
const manifest = {
  release: "Uphold V1.2",
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  jsChain: "studioDevnet",
  contractPath: "contracts/uphold.py",
  contractSha256: sourceSha256,
  contractVersion: "live-snapshot-v1.2",
  runner,
  genlayerJsVersion: "2.0.0-rc.1",
  genlayerPyVersion: "0.19.0rc2",
  genlayerTestVersion: "0.30.0rc2",
  genvmLinterVersion: "0.11.1rc2",
  genlayerCliVersion: "0.40.0-rc.3",
  transactionKitVersion: "0.1.0-rc.2",
  transactionKitReactVersion: "0.1.0-rc.2",
  deploymentAttempt: 2,
  supersedes: "0x23786A52b62DC489A5f69653dedD68d1fc56c231",
  historicalV11SourceSha256: "090BA710374AC156B8D2CA72001E20F1CDA8482F5530A7C8570357F847D2A1F8",
  deployer: signer,
  accountName,
  nonceLatest: latestNonce,
  noncePending: pendingNonce,
  balanceBeforeWei: balanceWei,
  feeProfileSha256: sha256(profileBytes),
  feePolicy,
  quoteSource: "developer/measured profile plus current live prices",
  estimatedFeeValue: feeValue,
  estimatedFeeDistribution: estimate.distribution,
  status: "PREPARED",
  txHash: null,
  contractAddress: null,
  createdAt: new Date().toISOString(),
};
save(pendingPath, manifest);
console.log(JSON.stringify({ DEPLOYER_ADDRESS: signer, ACCOUNT_NAME: accountName, RPC: rpc, CHAIN_ID: chainId, CONTRACT_SHA256: sourceSha256, ESTIMATED_FEE_VALUE: feeValue.toString(), ESTIMATED_FEE_DISTRIBUTION: safe(estimate.distribution) }, null, 2));

let txHash;
try {
  txHash = await client.deployContract({ code: new Uint8Array(source), args: [], fees: { distribution: estimate.distribution, feeValue } });
} catch (error) {
  manifest.status = "BROADCAST_FAILED_NO_HASH";
  manifest.error = String(error);
  save(pendingPath, manifest);
  throw error;
}
manifest.status = "BROADCAST";
manifest.txHash = txHash;
manifest.broadcastAt = new Date().toISOString();
save(pendingPath, manifest);
console.log(`DEPLOYMENT_TX_HASH: ${txHash}`);

let receipt;
try {
  receipt = await client.waitForFinalization({ hash: txHash, retries: 240, interval: 5000, fullTransaction: true });
} catch (error) {
  manifest.status = "BLOCKED_PENDING_RECONCILIATION";
  manifest.error = String(error);
  save(pendingPath, manifest);
  throw error;
}
manifest.receipt = receipt;
manifest.finalStatus = receipt.statusName ?? receipt.status;
manifest.executionResult = receipt.txExecutionResultName ?? receipt.txExecutionResult ?? null;
manifest.finalizedAt = new Date().toISOString();
if (manifest.finalStatus !== "FINALIZED" || !isSuccessful(receipt)) {
  manifest.status = "FINALIZED_EXECUTION_FAILED";
  save(pendingPath, manifest);
  throw new Error(`Deployment finalized unsuccessfully: ${manifest.finalStatus}/${manifest.executionResult}`);
}
const contractAddress = receipt.txDataDecoded?.contractAddress ?? receipt.data?.contract_address ?? receipt.contractAddress;
if (!contractAddress) throw new Error("Successful deployment receipt did not include a contract address.");
manifest.contractAddress = contractAddress;
manifest.codePresent = Boolean(await client.getContractCode(contractAddress));
manifest.readback = await client.readContract({ address: contractAddress, functionName: "contract_info", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
manifest.status = "FINALIZED_SUCCESSFUL";
save(pendingPath, manifest);
save(completedPath, manifest);
console.log(JSON.stringify({ DEPLOYMENT_FINAL_STATUS: manifest.finalStatus, DEPLOYMENT_EXECUTION_RESULT: manifest.executionResult, CONTRACT_ADDRESS: contractAddress, CODE_PRESENT: manifest.codePresent, CONTRACT_INFO: safe(manifest.readback) }, null, 2));
