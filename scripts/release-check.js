import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runScript(name) {
  console.log(`\n> npm run ${name}`);
  const result = spawnSync(npmCommand, ["run", name], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runScript("audit:dependencies");
runScript("check");

if (process.env.DATABASE_URL) {
  runScript("db:status");
} else {
  console.log("\n> db:status skipped because DATABASE_URL is not set");
}
