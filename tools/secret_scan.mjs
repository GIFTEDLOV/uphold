import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(file))
  .filter((file) => file !== ".github/workflows/ci.yml" && file !== "tools/secret_scan.mjs");

const findings = [];
const pem = /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----/;
const assignedSecret = /(?:PRIVATE_KEY|MNEMONIC|SEED_PHRASE|SECRET_KEY|PASSWORD|KEYSTORE_PASSWORD)\s*=\s*["'][^$<{][^"']+["']/i;

for (const file of tracked) {
  const text = readFileSync(file, "utf8");
  if (pem.test(text) || assignedSecret.test(text)) findings.push(file);
}

if (findings.length) {
  console.error(`tracked secret material detected in: ${findings.join(", ")}`);
  process.exit(1);
}

console.log(`secret-scan: clean (${tracked.length} tracked files inspected)`);
