import assert from "node:assert/strict";
import {
  DATABASE_MIGRATIONS,
  ensureDatabaseSchema,
  readDatabaseSchemaStatus,
} from "../server/db-migrations.js";

function createFakeSql(appliedVersions = []) {
  const direct = [];
  const transactions = [];
  const tag = (strings, ...values) => {
    const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
    direct.push(query);
    if (query.text.startsWith("SELECT version")) {
      return Promise.resolve(appliedVersions.map((version) => ({ version })));
    }
    return Promise.resolve([]);
  };
  tag.transaction = async (factory) => {
    const queries = [];
    const transactionTag = (strings, ...values) => {
      const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
      queries.push(query);
      return query;
    };
    factory(transactionTag);
    transactions.push(queries);
    return queries.map(() => []);
  };
  return { sql: tag, direct, transactions };
}

assert.deepEqual(DATABASE_MIGRATIONS.map((migration) => migration.version), [1, 2]);
assert.equal(new Set(DATABASE_MIGRATIONS.map((migration) => migration.version)).size, DATABASE_MIGRATIONS.length);

const fresh = createFakeSql();
const freshResult = await ensureDatabaseSchema(fresh.sql);
assert.deepEqual(freshResult, { currentVersion: 2, executed: [1, 2] });
assert.equal(fresh.transactions.length, 2);
assert.match(fresh.transactions[0][0].text, /CREATE TABLE IF NOT EXISTS soos_config/);
assert.match(fresh.transactions[0].at(-1).text, /INSERT INTO soos_schema_migration/);
assert.match(fresh.transactions[1][0].text, /CREATE TABLE IF NOT EXISTS soos_job_lease/);

const current = createFakeSql([1, 2]);
const currentResult = await ensureDatabaseSchema(current.sql);
assert.deepEqual(currentResult, { currentVersion: 2, executed: [] });
assert.equal(current.transactions.length, 0);

const partiallyCurrent = createFakeSql([1]);
const partialResult = await ensureDatabaseSchema(partiallyCurrent.sql);
assert.deepEqual(partialResult.executed, [2]);
assert.equal(partiallyCurrent.transactions.length, 1);

function createStatusSql({ tables = {}, migrations = [] } = {}) {
  return async (strings) => {
    const text = strings.join(" ").replace(/\s+/g, " ").trim();
    if (text.includes("to_regclass")) {
      return [{
        migration_table: tables.migration ? "soos_schema_migration" : null,
        config_table: tables.config ? "soos_config" : null,
        lease_table: tables.lease ? "soos_job_lease" : null,
      }];
    }
    if (text.includes("FROM soos_schema_migration")) return migrations;
    return [];
  };
}

const missingStatus = await readDatabaseSchemaStatus(createStatusSql());
assert.equal(missingStatus.currentVersion, 0);
assert.deepEqual(missingStatus.pending, [1, 2]);
assert.equal(missingStatus.tables.migration, false);

const readyStatus = await readDatabaseSchemaStatus(createStatusSql({
  tables: { migration: true, config: true, lease: true },
  migrations: [
    { version: 1, name: "create_config_store", applied_at: "2026-06-12T00:00:00.000Z" },
    { version: 2, name: "create_job_leases", applied_at: "2026-06-12T00:01:00.000Z" },
  ],
}));
assert.equal(readyStatus.currentVersion, 2);
assert.deepEqual(readyStatus.pending, []);
assert.deepEqual(readyStatus.tables, { migration: true, config: true, lease: true });

console.log("db-migration-tests-passed");
