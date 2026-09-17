import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import type {
  GenLayerClient,
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";

const requireFromProject = createRequire(
  path.resolve(process.cwd(), "package.json"),
);
const { isSuccessful } = requireFromProject("genlayer-js") as {
  isSuccessful: (transaction: GenLayerTransaction) => boolean;
};

export const DEPLOYMENT_CONTRACT_PATH = "contracts/uphold.py";
export const EXPECTED_CONTRACT_SHA256 =
  "090BA710374AC156B8D2CA72001E20F1CDA8482F5530A7C8570357F847D2A1F8";
export const EXPECTED_RPC = "https://studio-next.genlayer.com/api";
export const EXPECTED_CHAIN_ID = 61997;

const deploymentDir = path.resolve(process.cwd(), "deployments/studio-next");
// Keep the superseded deployment manifests immutable. This release gets its
// own provenance pair so a second, corrected deployment is still one-shot.
const pendingManifestPath = path.join(
  deploymentDir,
  "uphold-hardening.pending.json",
);
const completedManifestPath = path.join(
  deploymentDir,
  "uphold-hardening.json",
);
const contractPath = path.resolve(process.cwd(), DEPLOYMENT_CONTRACT_PATH);

type JsonRecord = Record<string, unknown>;

const stringify = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
    2,
  ) + "\n";

const writeManifest = (manifest: JsonRecord): void => {
  mkdirSync(deploymentDir, { recursive: true });
  writeFileSync(pendingManifestPath, stringify(manifest), "utf8");
};

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex").toUpperCase();

export const verifyUpholdSourceSha = (sourceBytes: Uint8Array): string => {
  const contractSha256 = sha256(sourceBytes);
  if (contractSha256 !== EXPECTED_CONTRACT_SHA256) {
    throw new Error(`Contract SHA256 mismatch: ${contractSha256}`);
  }
  return contractSha256;
};

export const hasExistingBroadcast = (manifest: unknown): boolean => {
  if (!manifest || typeof manifest !== "object") return false;
  const record = manifest as JsonRecord;
  return (
    (typeof record.txHash === "string" && record.txHash.length > 0) ||
    record.status === "FINALIZED_SUCCESSFUL"
  );
};

const requireNoExistingBroadcast = (): void => {
  for (const manifestPath of [pendingManifestPath, completedManifestPath]) {
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as JsonRecord;
    if (hasExistingBroadcast(manifest)) {
      throw new Error(
        `Refusing a second deployment: existing broadcast in ${manifestPath}`,
      );
    }
  }
};

export const assertDeploymentTarget = (rpcUrl: string, chainId: number): void => {
  if (rpcUrl !== EXPECTED_RPC) {
    throw new Error(`Wrong deployment RPC: ${rpcUrl}`);
  }
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong deployment chain: ${chainId}`);
  }
};

const rpc = async (
  client: GenLayerClient<any>,
  method: string,
  params: unknown[] = [],
): Promise<any> => client.request({ method, params } as never);

const configuredRpcUrls = (client: GenLayerClient<any>): string[] => {
  const chainRpc = client.chain?.rpcUrls?.default?.http?.[0];
  const transport = (client as any).transport;
  const transportRpc = transport?.config?.url ?? transport?.url;
  return [chainRpc, transportRpc].filter(
    (url): url is string => typeof url === "string",
  );
};

const extractContractAddress = (receipt: GenLayerTransaction): string | undefined => {
  const decoded = receipt.txDataDecoded ?? receipt.data;
  const record = decoded as Record<string, any> | undefined;
  return (
    record?.contractAddress ??
    record?.contract_address ??
    (receipt as any).contractAddress ??
    (receipt.data as any)?.contractAddress
  );
};

type DeploymentReceiptLike = {
  status?: number | string;
  statusName?: number | string;
  txExecutionResult?: number | string;
  txExecutionResultName?: string;
};

export const isSuccessfulDeploymentReceipt = (
  receipt: DeploymentReceiptLike,
): boolean => {
  const finalized =
    receipt.statusName === "FINALIZED" || Number(receipt.status) === 7;
  return finalized && isSuccessful(receipt as GenLayerTransaction);
};

export default async function main(client: GenLayerClient<any>): Promise<void> {
  const sourceBytes = new Uint8Array(readFileSync(contractPath));
  const contractSha256 = verifyUpholdSourceSha(sourceBytes);

  const rpcUrls = configuredRpcUrls(client);
  if (rpcUrls.length === 0 || rpcUrls.some((rpcUrl) => rpcUrl !== EXPECTED_RPC)) {
    throw new Error(
      `Wrong deployment RPC configuration: ${rpcUrls.join(", ") || "unavailable"}`,
    );
  }

  const chainId = Number(await rpc(client, "eth_chainId"));
  const netVersion = Number(await rpc(client, "net_version"));
  assertDeploymentTarget(EXPECTED_RPC, Number(client.chain.id));
  if (chainId !== EXPECTED_CHAIN_ID || netVersion !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong target chain: eth_chainId=${chainId}, net_version=${netVersion}`,
    );
  }

  requireNoExistingBroadcast();

  const signer = (client as any).account?.address as string | undefined;
  if (!signer) throw new Error("No active deployer account");

  const balanceWei = BigInt(await rpc(client, "eth_getBalance", [signer, "latest"]));
  const latestNonce = Number(
    BigInt(await rpc(client, "eth_getTransactionCount", [signer, "latest"])),
  );
  const pendingNonce = Number(
    BigInt(await rpc(client, "eth_getTransactionCount", [signer, "pending"])),
  );
  if (latestNonce !== pendingNonce) {
    throw new Error(
      `Unknown pending nonce detected: latest=${latestNonce}, pending=${pendingNonce}`,
    );
  }

  const feePolicy = await client.getCurrentFeePolicy();
  const estimate = await client.estimateTransactionFees({});
  const feeValue = BigInt(estimate.feeValue);
  if (feeValue <= 0n) throw new Error("Live deployment fee quote is zero");
  if (balanceWei <= feeValue) throw new Error("Insufficient balance for deployment fee");

  const manifest: JsonRecord = {
    network: "GenLayer Studio Next",
    rpc: EXPECTED_RPC,
    chainId: EXPECTED_CHAIN_ID,
    contractPath: DEPLOYMENT_CONTRACT_PATH,
    contractSha256,
    cliVersion: "0.40.0-rc.3",
    genlayerJsVersion: "2.0.0-rc.1",
    transactionKitVersion: "0.1.0-rc.2",
    deploymentAttempt: 1,
    supersedes: "0x51A1B4eFC6Be539C54C642515d3c537dd2D3e528",
    historicalSupersededDeployment: "0x96671389548f170A6f02BC3017495d157d827599",
    historicalFailedDeployment:
      "0x5f37c53acfe9af24f212f4b117067ca899bb2ad8d7461e328c0af5b6c7fc4b62",
    status: "PREPARED",
    txHash: null,
    contractAddress: null,
    deployer: signer,
    nonceLatest: latestNonce,
    noncePending: pendingNonce,
    unknownPendingTx: "NOT_OBSERVED; RPC pending-pool enumeration unavailable",
    quoteSource: "network-default",
    feePolicy,
    estimatedFeeValue: feeValue,
    estimatedFeeDistribution: estimate.distribution,
    createdAt: new Date().toISOString(),
  };
  writeManifest(manifest);

  console.log(
    stringify({
      DEPLOYER_ADDRESS: signer,
      BALANCE_WEI: balanceWei,
      CONTRACT_SHA256: contractSha256,
      RPC: EXPECTED_RPC,
      CHAIN_ID: EXPECTED_CHAIN_ID,
      ESTIMATED_FEE_VALUE: feeValue,
      BOOTSTRAP_QUOTE_SOURCE: "network-default",
    }),
  );

  let txHash: TransactionHash;
  try {
    txHash = (await client.deployContract({
      code: sourceBytes,
      args: [],
      fees: {
        distribution: estimate.distribution,
        feeValue,
      },
    })) as TransactionHash;
  } catch (error) {
    manifest.status = "BROADCAST_FAILED_NO_HASH";
    manifest.broadcastError = String(error);
    writeManifest(manifest);
    throw error;
  }

  manifest.status = "BROADCAST";
  manifest.txHash = txHash;
  manifest.broadcastAt = new Date().toISOString();
  writeManifest(manifest);
  console.log(`DEPLOYMENT_TX_HASH: ${txHash}`);

  let receipt: GenLayerTransaction;
  try {
    receipt = await client.waitForFinalization({
      hash: txHash,
      retries: 240,
      interval: 5000,
      fullTransaction: true,
    });
  } catch (error) {
    manifest.status = "BLOCKED_PENDING_RECONCILIATION";
    manifest.reconciliationError = String(error);
    writeManifest(manifest);
    throw error;
  }

  manifest.finalStatus = receipt.statusName ?? receipt.status;
  manifest.executionResult =
    receipt.txExecutionResultName ?? receipt.txExecutionResult ?? null;
  manifest.finalizedAt = new Date().toISOString();
  manifest.receipt = receipt;

  if (!isSuccessfulDeploymentReceipt(receipt)) {
    manifest.status = "FINALIZED_EXECUTION_FAILED";
    writeManifest(manifest);
    throw new Error(`Deployment finalized unsuccessfully: ${stringify(receipt)}`);
  }

  const contractAddress = extractContractAddress(receipt);
  if (!contractAddress) {
    manifest.status = "FINALIZED_SUCCESSFUL_ADDRESS_UNAVAILABLE";
    writeManifest(manifest);
    throw new Error("Successful deployment receipt did not contain a contract address");
  }

  const code = await client.getContractCode(contractAddress as any);
  manifest.codePresent = typeof code === "string" ? code.length > 0 : Boolean(code);
  if (!manifest.codePresent) {
    manifest.status = "FINALIZED_SUCCESSFUL_CODE_UNAVAILABLE";
    writeManifest(manifest);
    throw new Error("Successful deployment returned no contract code");
  }

  const readback = await client.readContract({
    address: contractAddress as any,
    functionName: "contract_info",
    args: [],
  });
  if (readback === undefined || readback === null) {
    manifest.status = "FINALIZED_SUCCESSFUL_READBACK_UNAVAILABLE";
    writeManifest(manifest);
    throw new Error("Successful deployment returned no contract_info readback");
  }
  manifest.readback = readback;
  manifest.status = "FINALIZED_SUCCESSFUL";
  manifest.contractAddress = contractAddress;
  writeManifest(manifest);
  writeFileSync(completedManifestPath, stringify(manifest), "utf8");
  console.log(
    stringify({
      DEPLOYMENT_FINAL_STATUS: manifest.finalStatus,
      DEPLOYMENT_EXECUTION_RESULT: manifest.executionResult,
      CONTRACT_ADDRESS: contractAddress,
      CODE_PRESENT: manifest.codePresent,
      READBACK: readback,
    }),
  );
}
