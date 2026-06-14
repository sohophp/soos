import { neon } from "@neondatabase/serverless";
import { readDatabaseSchemaStatus } from "../server/db-migrations.js";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exitCode = 1;
} else {
  const status = await readDatabaseSchemaStatus(neon(databaseUrl));
  const tablesReady = Object.values(status.tables).every(Boolean);
  const constraintsReady = Object.values(status.constraints).every(Boolean);
  const indexesReady = Object.values(status.indexes).every(Boolean);
  const integrityReady = Object.values(status.integrity).every((count) => count === 0);
  const ready = !status.pending.length
    && tablesReady
    && constraintsReady
    && indexesReady
    && integrityReady;
  console.log(JSON.stringify({
    ready,
    currentVersion: status.currentVersion,
    latestVersion: status.latestVersion,
    pending: status.pending,
    tables: status.tables,
    constraints: status.constraints,
    indexes: status.indexes,
    integrity: status.integrity,
    applied: status.applied,
  }, null, 2));
  if (!ready) process.exitCode = 2;
}
