import assert from "node:assert/strict";
import {
  DATABASE_MIGRATIONS,
  REQUIRED_DATABASE_CONSTRAINTS,
  REQUIRED_DATABASE_INDEXES,
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

assert.deepEqual(DATABASE_MIGRATIONS.map((migration) => migration.version), [1, 2, 3, 4]);
assert.equal(new Set(DATABASE_MIGRATIONS.map((migration) => migration.version)).size, DATABASE_MIGRATIONS.length);

const fresh = createFakeSql();
const freshResult = await ensureDatabaseSchema(fresh.sql);
assert.deepEqual(freshResult, { currentVersion: 4, executed: [1, 2, 3, 4] });
assert.equal(fresh.transactions.length, 4);
assert.match(fresh.transactions[0][0].text, /CREATE TABLE IF NOT EXISTS soos_config/);
assert.match(fresh.transactions[0].at(-1).text, /INSERT INTO soos_schema_migration/);
assert.match(fresh.transactions[1][0].text, /CREATE TABLE IF NOT EXISTS soos_job_lease/);
assert.match(fresh.transactions[2][0].text, /soos_config_value_object_check/);
assert.match(fresh.transactions[2][1].text, /VALIDATE CONSTRAINT soos_schema_migration_name_check/);
assert.match(fresh.transactions[2].at(-3).text, /soos_config_audit_session_updated_idx/);
assert.match(fresh.transactions[2].at(-2).text, /soos_config_audit_session_status_updated_idx/);
assert.match(fresh.transactions[2].at(-1).text, /INSERT INTO soos_schema_migration/);
assert.match(fresh.transactions[3][1].text, /key = 'audit_job:' \|\| \(value->>'id'\)/);
assert.match(fresh.transactions[3][3].text, /audit_job_batch:\[a-z0-9-\]/);
assert.match(fresh.transactions[3].at(-2).text, /soos_schema_migration_name_uidx/);

const current = createFakeSql([1, 2, 3, 4]);
const currentResult = await ensureDatabaseSchema(current.sql);
assert.deepEqual(currentResult, { currentVersion: 4, executed: [] });
assert.equal(current.transactions.length, 0);

const partiallyCurrent = createFakeSql([1]);
const partialResult = await ensureDatabaseSchema(partiallyCurrent.sql);
assert.deepEqual(partialResult.executed, [2, 3, 4]);
assert.equal(partiallyCurrent.transactions.length, 3);

function completeMap(names, value = true) {
  return Object.fromEntries(names.map((name) => [name, value]));
}

function createStatusSql({
  tables = {},
  migrations = [],
  constraints = {},
  indexes = {},
  integrity = {},
} = {}) {
  return async (strings) => {
    const text = strings.join(" ").replace(/\s+/g, " ").trim();
    if (text.includes("to_regclass")) {
      return [{
        migration_table: tables.migration ? "soos_schema_migration" : null,
        config_table: tables.config ? "soos_config" : null,
        lease_table: tables.lease ? "soos_job_lease" : null,
        constraints,
        indexes,
      }];
    }
    if (text.includes("invalid_migration_names")) {
      return [{
        invalid_migration_names: integrity.invalidMigrationNames || 0,
        invalid_config_keys: integrity.invalidConfigKeys || 0,
        invalid_config_values: integrity.invalidConfigValues || 0,
        invalid_audit_jobs: integrity.invalidAuditJobs || 0,
        invalid_audit_batches: integrity.invalidAuditBatches || 0,
        invalid_lease_job_ids: integrity.invalidLeaseJobIds || 0,
        invalid_lease_tokens: integrity.invalidLeaseTokens || 0,
      }];
    }
    if (text.includes("FROM soos_schema_migration")) return migrations;
    return [];
  };
}

const missingStatus = await readDatabaseSchemaStatus(createStatusSql());
assert.equal(missingStatus.currentVersion, 0);
assert.deepEqual(missingStatus.pending, [1, 2, 3, 4]);
assert.equal(missingStatus.tables.migration, false);
assert.deepEqual(missingStatus.constraints, completeMap(REQUIRED_DATABASE_CONSTRAINTS, false));
assert.deepEqual(missingStatus.indexes, completeMap(REQUIRED_DATABASE_INDEXES, false));
assert.ok(Object.values(missingStatus.integrity).every((value) => value === null));

const readyStatus = await readDatabaseSchemaStatus(createStatusSql({
  tables: { migration: true, config: true, lease: true },
  migrations: [
    { version: 1, name: "create_config_store", applied_at: "2026-06-12T00:00:00.000Z" },
    { version: 2, name: "create_job_leases", applied_at: "2026-06-12T00:01:00.000Z" },
    { version: 3, name: "add_storage_integrity_constraints", applied_at: "2026-06-13T00:00:00.000Z" },
    { version: 4, name: "tighten_storage_key_shapes", applied_at: "2026-06-13T00:01:00.000Z" },
  ],
  constraints: completeMap(REQUIRED_DATABASE_CONSTRAINTS),
  indexes: JSON.stringify(completeMap(REQUIRED_DATABASE_INDEXES)),
}));
assert.equal(readyStatus.currentVersion, 4);
assert.deepEqual(readyStatus.pending, []);
assert.deepEqual(readyStatus.tables, { migration: true, config: true, lease: true });
assert.ok(Object.values(readyStatus.constraints).every(Boolean));
assert.ok(Object.values(readyStatus.indexes).every(Boolean));
assert.ok(Object.values(readyStatus.integrity).every((value) => value === 0));

const invalidStatus = await readDatabaseSchemaStatus(createStatusSql({
  tables: { migration: true, config: true, lease: true },
  migrations: [
    { version: 1, name: "create_config_store", applied_at: "2026-06-12T00:00:00.000Z" },
    { version: 2, name: "create_job_leases", applied_at: "2026-06-12T00:01:00.000Z" },
  ],
  integrity: { invalidAuditJobs: 2, invalidLeaseTokens: 1 },
}));
assert.equal(invalidStatus.integrity.invalidAuditJobs, 2);
assert.equal(invalidStatus.integrity.invalidLeaseTokens, 1);

console.log("db-migration-tests-passed");
