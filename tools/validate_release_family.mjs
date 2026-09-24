import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), "utf8"));
const family = readJson("docs/genlayer-release-family.json");
const rootPackage = readJson("package.json");
const frontendPackage = readJson("frontend/package.json");
const requirements = readFileSync(resolve(root, "requirements.txt"), "utf8");

const exact = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
};

exact(rootPackage.devDependencies.genlayer, family.versions["genlayer-cli"], "GenLayer CLI");
exact(rootPackage.devDependencies["genlayer-js"], family.versions["genlayer-js"], "root genlayer-js");
exact(frontendPackage.dependencies["genlayer-js"], family.versions["genlayer-js"], "frontend genlayer-js");
exact(frontendPackage.dependencies["@genlayer/transaction-kit"], family.versions["transaction-kit"], "Transaction Kit");
exact(frontendPackage.dependencies["@genlayer/transaction-kit-react"], family.versions["transaction-kit-react"], "Transaction Kit React");
exact(frontendPackage.license, "MIT", "frontend license");

for (const [name, version] of Object.entries({
  "genlayer-py": family.versions["genlayer-py"],
  "genlayer-test": family.versions["genlayer-test"],
  "genvm-linter": family.versions["genvm-linter"],
})) {
  if (!new RegExp(`^${name}==${version.replaceAll(".", "\\.")}$`, "m").test(requirements)) {
    throw new Error(`${name} is not pinned to ${version}`);
  }
}

const activeFiles = [
  "frontend/lib/genlayer/network.ts",
  "frontend/lib/uphold/config.ts",
  "frontend/.env.example",
  "deploy/deployScript.ts",
  "docs/TOOLCHAIN.md",
  "docs/genlayer-release-family.json",
];
const oldAlias = "studio-next.genlayer.com/api";
for (const file of activeFiles) {
  if (readFileSync(resolve(root, file), "utf8").includes(oldAlias)) {
    throw new Error(`historical Studio Next alias remains active in ${file}`);
  }
}

const oldAddress = "0x23786A52b62DC489A5f69653dedD68d1fc56c231";
if (readFileSync(resolve(root, "frontend/.env.example"), "utf8").includes(oldAddress)) {
  throw new Error("historical V1.1 address remains in the active frontend template");
}

if (family.network.rpc !== "https://studio-dev.genlayer.com/api" || family.network.chainId !== 61997) {
  throw new Error("canonical Studio-dev network record is invalid");
}

console.log("release-family: coherent");
