import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const npm = "npm";
const env = {
  ...process.env,
  NEXT_PUBLIC_CONTRACT_ADDRESS: "0x3333333333333333333333333333333333333333",
  NEXT_PUBLIC_E2E_FIXTURES: "1",
};

const build = spawnSync(npm, ["run", "build"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: true,
});
if (build.error) {
  console.error(build.error);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(npm, ["run", "start", "--", "-p", "3100"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: true,
});
if (server.stdout) server.stdout.pipe(process.stdout);
if (server.stderr) server.stderr.pipe(process.stderr);

const stop = () => {
  if (!server.killed) server.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
