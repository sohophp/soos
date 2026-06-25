import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [operations, workflow, packageJson, envExample, readme, releaseCheck] = await Promise.all([
  fs.readFile(new URL("../OPERATIONS.md", import.meta.url), "utf8"),
  fs.readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  fs.readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  fs.readFile(new URL("../.env.example", import.meta.url), "utf8"),
  fs.readFile(new URL("../README.md", import.meta.url), "utf8"),
  fs.readFile(new URL("../scripts/release-check.js", import.meta.url), "utf8"),
]);

for (const heading of [
  "Release Preconditions",
  "Database Backup And Migration",
  "Self-hosted VPS Release",
  "Vercel Release",
  "Application Rollback",
  "Database Restore",
  "OAuth And Encryption Incidents",
  "Incident Signals",
]) {
  assert.match(operations, new RegExp(`## ${heading}`));
}
for (const command of [
  "npm ci",
  "npm run test:e2e:install",
  "npm run check:release",
  "npm run test:e2e",
  "npm run db:migrate",
]) {
  assert.ok(operations.includes(command), command);
}
assert.match(workflow, /npm ci/);
assert.match(workflow, /npm run audit:dependencies/);
assert.match(workflow, /npm run check/);
assert.match(workflow, /playwright install --with-deps chromium/);
assert.match(workflow, /npm run test:e2e/);
assert.equal(packageJson.scripts["db:status"], "node --env-file-if-exists=.env scripts/db-status.js");
assert.equal(packageJson.scripts["audit:dependencies"], "npm audit --audit-level=high");
assert.equal(packageJson.scripts["check:release"], "node --env-file-if-exists=.env scripts/release-check.js");
assert.equal(packageJson.engines.node, "^20.19.0 || >=22.12.0");
assert.match(releaseCheck, /runScript\("audit:dependencies"\)/);
assert.match(releaseCheck, /runScript\("check"\)/);
assert.match(releaseCheck, /process\.env\.DATABASE_URL/);
assert.match(releaseCheck, /runScript\("db:status"\)/);
assert.match(envExample, /SOOS_API_PORT=4177/);
assert.match(envExample, /SOOS_ALLOW_PROXY=0/);
assert.match(readme, /### Self-hosted VPS/);
assert.match(readme, /node --env-file-if-exists=.env server\/api\.js/);
assert.match(readme, /self-hosted Postgres/);

console.log("operations-tests-passed");
