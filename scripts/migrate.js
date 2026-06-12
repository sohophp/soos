import { neon } from "@neondatabase/serverless";
import { ensureDatabaseSchema } from "../server/db-migrations.js";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exitCode = 1;
} else {
  const result = await ensureDatabaseSchema(neon(databaseUrl));
  const executed = result.executed.length ? result.executed.join(", ") : "none";
  console.log(`Database schema version ${result.currentVersion}; migrations applied: ${executed}.`);
}
