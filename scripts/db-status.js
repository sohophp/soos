import { neon } from "@neondatabase/serverless";
import { readDatabaseSchemaStatus } from "../server/db-migrations.js";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exitCode = 1;
} else {
  const status = await readDatabaseSchemaStatus(neon(databaseUrl));
  const tablesReady = Object.values(status.tables).every(Boolean);
  const ready = !status.pending.length && tablesReady;
  console.log(JSON.stringify({
    ready,
    currentVersion: status.currentVersion,
    latestVersion: status.latestVersion,
    pending: status.pending,
    tables: status.tables,
    applied: status.applied,
  }, null, 2));
  if (!ready) process.exitCode = 2;
}
