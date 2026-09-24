import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dir = resolve(root, "deployments/studio-dev/v1.2");
const required = ["manifest.json", "README.md", "source-readback.json", "schema.json", "qualification.json", "proof-index.json"];
for (const file of required) {
  if (!existsSync(resolve(dir, file))) throw new Error(`proof package missing ${file}`);
}

const json = (file) => JSON.parse(readFileSync(resolve(dir, file), "utf8"));
const manifest = json("manifest.json");
const sourceReadback = json("source-readback.json");
const schema = json("schema.json");
const qualification = json("qualification.json");
const index = json("proof-index.json");
const expectedSha = readFileSync(resolve(root, "contracts/uphold.py"));
const localSha = createHash("sha256").update(expectedSha).digest("hex").toUpperCase();

if (manifest.network !== "GenLayer Studio-dev" || manifest.rpc !== "https://studio-dev.genlayer.com/api" || Number(manifest.chainId) !== 61997) {
  throw new Error("proof manifest network identity is invalid");
}
if (manifest.status !== "FINALIZED_SUCCESSFUL" || manifest.finalStatus !== "FINALIZED" || manifest.executionResult !== "FINISHED_WITH_RETURN") {
  throw new Error("proof manifest does not prove finalized successful execution");
}
if (!/^0x[a-fA-F0-9]{40}$/.test(manifest.contractAddress ?? "")) throw new Error("proof manifest contract address is invalid");
if (manifest.contractSha256 !== localSha) throw new Error("proof manifest source hash differs from local source");
if (sourceReadback.sourceSha256 !== localSha || sourceReadback.parity !== "PASS") throw new Error("source parity proof is not PASS");
if (qualification.result !== "PASS") throw new Error("qualification result is not PASS");
if (Number(index.schemaCounts?.total) !== 15 || Number(index.schemaCounts?.views) !== 7 || Number(index.schemaCounts?.writes) !== 8) {
  throw new Error("proof index schema counts are not 15/7/8");
}
if (!Array.isArray(schema.methods) || schema.methods.length !== 15) throw new Error("schema does not contain 15 methods");

console.log("PROOF_VALIDATOR=PASS network=studio-dev chainId=61997 methods=15 sourceParity=PASS qualification=PASS");
