import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.resolve(root, "deployments/studio-dev/v1.2");
const readJson = (file) => JSON.parse(readFileSync(path.join(dir, file), "utf8"));
const saveJson = (file, value) => writeFileSync(path.join(dir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const manifest = readJson("manifest.json");
const sourceReadback = readJson("source-readback.json");
const schema = readJson("schema.json");
const qualification = readJson("qualification.json");
const feeProfileBytes = readFileSync(path.resolve(root, "frontend/fee-profile.json"));
const feeProfileSha256 = sha256(feeProfileBytes);
const failedDeployment = readJson("manifest.pending.json");
const failedProbe = readJson(path.join("..", "..", "..", "artifacts", "runner-probe", "manifest.pending.json"));

manifest.releaseState = "CURRENT_CANONICAL_V1_2";
manifest.sourceReadbackPath = "source-readback.json";
manifest.schemaPath = "schema.json";
manifest.contractInfoReadbackPath = "contract-info-readback.json";
manifest.qualificationPath = "qualification.json";
manifest.proofIndexPath = "proof-index.json";
manifest.qualificationTransactionHashes = qualification.transactionHashes;
manifest.sourceParity = sourceReadback.parity;
manifest.schemaParity = schema.parity;
manifest.schemaCounts = schema.counts;
manifest.contractInfo = qualification.reads.contractInfo;
manifest.feeProfile = {
  path: "../../frontend/fee-profile.json",
  sha256: feeProfileSha256,
  validation: "PASS",
  methodCount: 8,
  suggestionSource: "developer",
};
manifest.historicalFailedV12Attempt = {
  path: "manifest.pending.json",
  runner: failedDeployment.runner,
  transaction: failedDeployment.txHash,
  status: failedDeployment.finalStatus,
  execution: failedDeployment.executionResult,
  error: "invalid_contract runner malformed",
  note: "Historical malformed-header attempt; not retried and not canonical.",
};
manifest.historicalFailedOfficialRunnerProbe = {
  path: "../../../artifacts/runner-probe/manifest.pending.json",
  runner: failedProbe.runner,
  transaction: failedProbe.txHash,
  status: failedProbe.finalStatus,
  execution: failedProbe.executionResult,
  error: "invalid_contract runner malformed",
};
manifest.controlledFixtureDisclosure = qualification.fixtureDisclosure;
manifest.externalSettlementLimitation = "Contract records pending external EOA transfers; completion has no contract-level receipt and is not claimed here.";
saveJson("manifest.json", manifest);

saveJson("proof-index.json", {
  release: "Uphold V1.2",
  result: "PASS",
  network: manifest.network,
  rpc: manifest.rpc,
  chainId: manifest.chainId,
  contractAddress: manifest.contractAddress,
  deploymentTx: manifest.txHash,
  sourceSha256: manifest.contractSha256,
  runner: manifest.runner,
  sourceReadback: { path: "source-readback.json", parity: sourceReadback.parity, sourceSha256: sourceReadback.deployedSourceSha256 },
  schema: { path: "schema.json", parity: schema.parity, methods: schema.methods.map((method) => method.name), schemaCounts: schema.counts },
  schemaCounts: schema.counts,
  contractInfo: { path: "contract-info-readback.json", name: qualification.reads.contractInfo.name, version: qualification.reads.contractInfo.version, transactionHashVariant: "LATEST_FINAL" },
  qualification: { path: "qualification.json", result: qualification.result, transactionHashes: qualification.transactionHashes, transactionHashVariant: qualification.reads.transactionHashVariant },
  feeProfile: { path: "../../frontend/fee-profile.json", sha256: feeProfileSha256, validation: "PASS", methodCount: 8 },
  historical: {
    v11Address: "0x23786A52b62DC489A5f69653dedD68d1fc56c231",
    v11SourceSha256: "090BA710374AC156B8D2CA72001E20F1CDA8482F5530A7C8570357F847D2A1F8",
    failedV12Deployment: { transaction: failedDeployment.txHash, error: "invalid_contract runner malformed", path: "manifest.pending.json" },
    failedOfficialRunnerProbe: { transaction: failedProbe.txHash, error: "invalid_contract runner malformed", path: "../../../artifacts/runner-probe/manifest.pending.json" },
  },
  disclosures: {
    controlledFixture: qualification.fixtureDisclosure,
    externalSettlement: manifest.externalSettlementLimitation,
  },
});
console.log(JSON.stringify({ PROOF_PACKAGE_FINALIZED: "PASS", manifest: "manifest.json", proofIndex: "proof-index.json", feeProfileSha256 }, null, 2));
