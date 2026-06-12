import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [operations, workflow, packageJson] = await Promise.all([
  fs.readFile(new URL("../OPERATIONS.md", import.meta.url), "utf8"),
  fs.readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  fs.readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
]);

for (const heading of [
  "Release Preconditions",
  "Database Backup And Migration",
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
  "npm run audit:dependencies",
  "npm run check",
  "npm run db:status",
  "npm run db:migrate",
]) {
  assert.ok(operations.includes(command), command);
}
assert.match(workflow, /npm ci/);
assert.match(workflow, /npm run audit:dependencies/);
assert.match(workflow, /npm run check/);
assert.equal(packageJson.scripts["db:status"], "node --env-file-if-exists=.env scripts/db-status.js");
assert.equal(packageJson.scripts["audit:dependencies"], "npm audit --audit-level=high");
assert.equal(packageJson.engines.node, ">=20.18.1");

console.log("operations-tests-passed");
