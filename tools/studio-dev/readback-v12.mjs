import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chains, createClient } from "genlayer-js";
import { TransactionHashVariant } from "genlayer-js/types";

const root = process.cwd();
const rpc = "https://studio-dev.genlayer.com/api";
const chainId = 61997;
const address = "0x5C2C0827B08C720787673dE325a36886e8Ec8645";
const txHash = "0x4605905ffcfc3e9c070f857b0fde1a77976fbcae56330c3695b9f27e62a55356";
const sourcePath = path.resolve(root, "contracts/uphold.py");
const proofDir = path.resolve(root, "deployments/studio-dev/v1.2");
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const save = (file, value) => writeFileSync(path.join(proofDir, file), `${JSON.stringify(safe(value), null, 2)}\n`, "utf8");

const chain = {
  ...chains.studioDevnet,
  id: chainId,
  name: "GenLayer Studio-dev",
  rpcUrls: { default: { http: [rpc] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};
const client = createClient({ chain, endpoint: rpc });
const request = async (method, params) => client.request({ method, params });
const localSource = readFileSync(sourcePath);
const localSha = sha256(localSource);

const rawCodeRequest = { jsonrpc: "2.0", method: "gen_getContractCode", params: [address], id: 1 };
const rawCodeResponse = await request(rawCodeRequest.method, rawCodeRequest.params);
const deployedSource = await client.getContractCode(address);
const deployedSourceBytes = Buffer.from(deployedSource, "utf8");
const deployedSha = sha256(deployedSourceBytes);
save("source-readback.json", {
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  contractAddress: address,
  deploymentTx: txHash,
  request: rawCodeRequest,
  response: rawCodeResponse,
  sourceEncoding: "gen_getContractCode base64 decoded as UTF-8",
  localSourceSha256: localSha,
  deployedSourceSha256: deployedSha,
  sourceSha256: deployedSha,
  localSourceBytes: localSource.length,
  deployedSourceBytes: deployedSourceBytes.length,
  parity: localSha === deployedSha ? "PASS" : "FAIL",
});
if (localSha !== deployedSha) throw new Error(`source parity failed: local=${localSha} deployed=${deployedSha}`);

const rawSchemaRequest = { jsonrpc: "2.0", method: "gen_getContractSchema", params: [address], id: 2 };
const rawSchemaResponse = await request(rawSchemaRequest.method, rawSchemaRequest.params);
const sdkSchema = await client.getContractSchema(address);
const methods = Object.entries(rawSchemaResponse?.methods ?? {}).map(([name, value]) => ({ name, ...value }));
const views = methods.filter((method) => method.readonly === true).map((method) => method.name);
const writes = methods.filter((method) => method.readonly !== true).map((method) => method.name);
const schema = {
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  contractAddress: address,
  deploymentTx: txHash,
  request: rawSchemaRequest,
  response: rawSchemaResponse,
  sdkSchema,
  constructor: rawSchemaResponse?.ctor ?? null,
  methods,
  counts: { total: methods.length, views: views.length, writes: writes.length },
  expectedCounts: { total: 15, views: 7, writes: 8 },
  parity: JSON.stringify(rawSchemaResponse) === JSON.stringify(sdkSchema) ? "PASS" : "REVIEW",
};
save("schema.json", schema);
if (methods.length !== 15 || views.length !== 7 || writes.length !== 8) throw new Error("live schema is not 15/7/8");

const contractInfo = await client.readContract({
  address,
  functionName: "contract_info",
  args: [],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
});
save("contract-info-readback.json", {
  network: "GenLayer Studio-dev",
  rpc,
  chainId,
  contractAddress: address,
  deploymentTx: txHash,
  transactionHashVariant: "LATEST_FINAL",
  contractInfo,
  expected: { name: "Uphold", version: "live-snapshot-v1.2" },
  result: contractInfo?.name === "Uphold" && contractInfo?.version === "live-snapshot-v1.2" ? "PASS" : "FAIL",
});
if (contractInfo?.name !== "Uphold" || contractInfo?.version !== "live-snapshot-v1.2") throw new Error("contract_info mismatch");

console.log(JSON.stringify({
  SOURCE_PARITY: "PASS",
  DEPLOYED_SOURCE_SHA256: deployedSha,
  LIVE_SCHEMA: "PASS",
  METHODS: methods.length,
  VIEWS: views.length,
  WRITES: writes.length,
  CONTRACT_INFO: { name: contractInfo.name, version: contractInfo.version },
}, null, 2));
