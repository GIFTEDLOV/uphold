import { readFileSync } from "node:fs";
import process from "node:process";

const file = process.argv[2] ?? "frontend/fee-profile.json";
const profile = JSON.parse(readFileSync(file, "utf8"));
const requiredMethods = [
  "create_commitment",
  "check_commitment",
  "increase_stake",
  "extend_commitment",
  "contest_breach",
  "adjudicate_contest",
  "settle_breach",
  "expire_commitment",
];
const requiredFields = [
  "leaderTimeunitsAllocation",
  "validatorTimeunitsAllocation",
  "executionBudgetPerRound",
  "totalMessageFees",
  "rotationsPerRound",
];

const canonical = profile.network === "studio-dev" && Number(profile.chainId) === 61997;
const reproducibleLocalnet = profile.network === "localnet" && Number(profile.chainId) === 61127;
if (profile.version !== 1 || (!canonical && !reproducibleLocalnet)) {
  throw new Error("fee profile must be official v1 for Studio-dev 61997 or reproducible localnet 61127");
}
if (!profile.deploy || !profile.methods || Object.keys(profile.methods).sort().join() !== requiredMethods.slice().sort().join()) {
  throw new Error("fee profile must contain deploy plus every Uphold V1.2 write method");
}
for (const [name, entry] of Object.entries({ deploy: profile.deploy, ...profile.methods })) {
  for (const field of requiredFields) {
    if (!(field in entry)) throw new Error(`${name} is missing ${field}`);
    if (!/^\d+$/.test(String(entry[field]))) throw new Error(`${name}.${field} must be an integer string`);
  }
  if ("feeValue" in entry || "recommendedFeeValue" in entry) throw new Error(`${name} persists live feeValue`);
}
console.log(`FEE_PROFILE_VALID=PASS network=${profile.network} chainId=${profile.chainId} methods=${requiredMethods.length}`);
