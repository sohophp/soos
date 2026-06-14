export const DATABASE_MIGRATIONS = [
  {
    version: 1,
    name: "create_config_store",
    queries: (sql) => [
      sql`
        CREATE TABLE IF NOT EXISTS soos_config (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `,
      sql`
        CREATE INDEX IF NOT EXISTS soos_config_updated_at_idx
        ON soos_config (updated_at)
      `,
      sql`
        CREATE INDEX IF NOT EXISTS soos_config_key_pattern_idx
        ON soos_config (key text_pattern_ops)
      `,
    ],
  },
  {
    version: 2,
    name: "create_job_leases",
    queries: (sql) => [
      sql`
        CREATE TABLE IF NOT EXISTS soos_job_lease (
          job_id text PRIMARY KEY,
          lease_token text NOT NULL,
          leased_until timestamptz NOT NULL
        )
      `,
      sql`
        CREATE INDEX IF NOT EXISTS soos_job_lease_expiry_idx
        ON soos_job_lease (leased_until)
      `,
    ],
  },
  {
    version: 3,
    name: "add_storage_integrity_constraints",
    queries: (sql) => [
      sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_schema_migration_name_check'
              AND conrelid = 'public.soos_schema_migration'::regclass
          ) THEN
            ALTER TABLE soos_schema_migration
            ADD CONSTRAINT soos_schema_migration_name_check
            CHECK (char_length(name) BETWEEN 1 AND 120) NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_config_key_check'
              AND conrelid = 'public.soos_config'::regclass
          ) THEN
            ALTER TABLE soos_config
            ADD CONSTRAINT soos_config_key_check
            CHECK (char_length(key) BETWEEN 1 AND 512) NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_config_value_object_check'
              AND conrelid = 'public.soos_config'::regclass
          ) THEN
            ALTER TABLE soos_config
            ADD CONSTRAINT soos_config_value_object_check
            CHECK (jsonb_typeof(value) = 'object') NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_config_audit_job_shape_check'
              AND conrelid = 'public.soos_config'::regclass
          ) THEN
            ALTER TABLE soos_config
            ADD CONSTRAINT soos_config_audit_job_shape_check
            CHECK (
              NOT (key LIKE 'audit\_job:%' ESCAPE '\')
              OR (
                jsonb_typeof(value->'id') = 'string'
                AND char_length(value->>'id') BETWEEN 1 AND 128
                AND jsonb_typeof(value->'sessionId') = 'string'
                AND char_length(value->>'sessionId') BETWEEN 1 AND 256
                AND value->>'status' IN (
                  'queued', 'running', 'paused', 'stopped',
                  'done', 'error', 'interrupted'
                )
                AND jsonb_typeof(value->'createdAt') = 'number'
                AND jsonb_typeof(value->'updatedAt') = 'number'
              )
            ) NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_config_audit_batch_shape_check'
              AND conrelid = 'public.soos_config'::regclass
          ) THEN
            ALTER TABLE soos_config
            ADD CONSTRAINT soos_config_audit_batch_shape_check
            CHECK (
              NOT (key LIKE 'audit\_job\_batch:%' ESCAPE '\')
              OR jsonb_typeof(value->'pages') = 'array'
            ) NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_job_lease_job_id_check'
              AND conrelid = 'public.soos_job_lease'::regclass
          ) THEN
            ALTER TABLE soos_job_lease
            ADD CONSTRAINT soos_job_lease_job_id_check
            CHECK (char_length(job_id) BETWEEN 1 AND 128) NOT VALID;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'soos_job_lease_token_check'
              AND conrelid = 'public.soos_job_lease'::regclass
          ) THEN
            ALTER TABLE soos_job_lease
            ADD CONSTRAINT soos_job_lease_token_check
            CHECK (lease_token ~ '^[0-9a-f]{32}$') NOT VALID;
          END IF;
        END
        $$
      `,
      sql`ALTER TABLE soos_schema_migration VALIDATE CONSTRAINT soos_schema_migration_name_check`,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_key_check`,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_value_object_check`,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_audit_job_shape_check`,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_audit_batch_shape_check`,
      sql`ALTER TABLE soos_job_lease VALIDATE CONSTRAINT soos_job_lease_job_id_check`,
      sql`ALTER TABLE soos_job_lease VALIDATE CONSTRAINT soos_job_lease_token_check`,
      sql`
        CREATE INDEX IF NOT EXISTS soos_config_audit_session_updated_idx
        ON soos_config ((value->>'sessionId'), updated_at DESC)
        WHERE key LIKE 'audit\_job:%' ESCAPE '\'
      `,
      sql`
        CREATE INDEX IF NOT EXISTS soos_config_audit_session_status_updated_idx
        ON soos_config ((value->>'sessionId'), (value->>'status'), updated_at DESC)
        WHERE key LIKE 'audit\_job:%' ESCAPE '\'
      `,
    ],
  },
  {
    version: 4,
    name: "tighten_storage_key_shapes",
    queries: (sql) => [
      sql`
        ALTER TABLE soos_config
        DROP CONSTRAINT IF EXISTS soos_config_audit_job_shape_check
      `,
      sql`
        ALTER TABLE soos_config
        ADD CONSTRAINT soos_config_audit_job_shape_check
        CHECK (
          NOT (key ~ '^audit_job:')
          OR (
            jsonb_typeof(value->'id') = 'string'
            AND (value->>'id') ~ '^[a-z0-9-]{1,128}$'
            AND key = 'audit_job:' || (value->>'id')
            AND jsonb_typeof(value->'sessionId') = 'string'
            AND (value->>'sessionId') ~ '^[0-9a-f]{32}$'
            AND (value->>'status') IN (
              'queued', 'running', 'paused', 'stopped',
              'done', 'error', 'interrupted'
            )
            AND jsonb_typeof(value->'createdAt') = 'number'
            AND jsonb_typeof(value->'updatedAt') = 'number'
          )
        ) NOT VALID
      `,
      sql`
        ALTER TABLE soos_config
        DROP CONSTRAINT IF EXISTS soos_config_audit_batch_shape_check
      `,
      sql`
        ALTER TABLE soos_config
        ADD CONSTRAINT soos_config_audit_batch_shape_check
        CHECK (
          NOT (key ~ '^audit_job_batch:')
          OR (
            key ~ '^audit_job_batch:[a-z0-9-]{1,128}:[0-9]{6}$'
            AND jsonb_typeof(value->'pages') = 'array'
          )
        ) NOT VALID
      `,
      sql`
        ALTER TABLE soos_job_lease
        DROP CONSTRAINT IF EXISTS soos_job_lease_job_id_check
      `,
      sql`
        ALTER TABLE soos_job_lease
        ADD CONSTRAINT soos_job_lease_job_id_check
        CHECK (job_id ~ '^[a-z0-9-]{1,128}$') NOT VALID
      `,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_audit_job_shape_check`,
      sql`ALTER TABLE soos_config VALIDATE CONSTRAINT soos_config_audit_batch_shape_check`,
      sql`ALTER TABLE soos_job_lease VALIDATE CONSTRAINT soos_job_lease_job_id_check`,
      sql`DROP INDEX IF EXISTS soos_config_audit_session_updated_idx`,
      sql`
        CREATE INDEX soos_config_audit_session_updated_idx
        ON soos_config ((value->>'sessionId'), updated_at DESC)
        WHERE key ~ '^audit_job:'
      `,
      sql`DROP INDEX IF EXISTS soos_config_audit_session_status_updated_idx`,
      sql`
        CREATE INDEX soos_config_audit_session_status_updated_idx
        ON soos_config ((value->>'sessionId'), (value->>'status'), updated_at DESC)
        WHERE key ~ '^audit_job:'
      `,
      sql`
        CREATE UNIQUE INDEX IF NOT EXISTS soos_schema_migration_name_uidx
        ON soos_schema_migration (name)
      `,
    ],
  },
];

export const REQUIRED_DATABASE_CONSTRAINTS = [
  "soos_schema_migration_name_check",
  "soos_config_key_check",
  "soos_config_value_object_check",
  "soos_config_audit_job_shape_check",
  "soos_config_audit_batch_shape_check",
  "soos_job_lease_job_id_check",
  "soos_job_lease_token_check",
];

export const REQUIRED_DATABASE_INDEXES = [
  "soos_config_updated_at_idx",
  "soos_config_key_pattern_idx",
  "soos_job_lease_expiry_idx",
  "soos_config_audit_session_updated_idx",
  "soos_config_audit_session_status_updated_idx",
  "soos_schema_migration_name_uidx",
];

function normalizedStatusMap(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value : {};
}

export async function ensureDatabaseSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS soos_schema_migration (
      version integer PRIMARY KEY CHECK (version > 0),
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const appliedRows = await sql`
    SELECT version
    FROM soos_schema_migration
    ORDER BY version
  `;
  const applied = new Set(appliedRows.map((row) => Number(row.version)));
  const executed = [];

  for (const migration of DATABASE_MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    await sql.transaction((transactionSql) => [
      ...migration.queries(transactionSql),
      transactionSql`
        INSERT INTO soos_schema_migration (version, name)
        VALUES (${migration.version}, ${migration.name})
        ON CONFLICT (version) DO NOTHING
      `,
    ]);
    executed.push(migration.version);
  }

  return {
    currentVersion: DATABASE_MIGRATIONS.at(-1)?.version || 0,
    executed,
  };
}

export async function readDatabaseSchemaStatus(sql) {
  const tableRows = await sql`
    SELECT
      to_regclass('public.soos_schema_migration')::text AS migration_table,
      to_regclass('public.soos_config')::text AS config_table,
      to_regclass('public.soos_job_lease')::text AS lease_table,
      COALESCE((
        SELECT jsonb_object_agg(required.name, COALESCE(found.validated, false))
        FROM unnest(${REQUIRED_DATABASE_CONSTRAINTS}::text[]) AS required(name)
        LEFT JOIN (
          SELECT conname AS name, convalidated AS validated
          FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
        ) AS found USING (name)
      ), '{}'::jsonb) AS constraints,
      COALESCE((
        SELECT jsonb_object_agg(required.name, found.name IS NOT NULL)
        FROM unnest(${REQUIRED_DATABASE_INDEXES}::text[]) AS required(name)
        LEFT JOIN (
          SELECT indexname AS name
          FROM pg_indexes
          WHERE schemaname = 'public'
        ) AS found USING (name)
      ), '{}'::jsonb) AS indexes
  `;
  const tables = tableRows[0] || {};
  const constraintStatus = normalizedStatusMap(tables.constraints);
  const indexStatus = normalizedStatusMap(tables.indexes);
  const constraints = Object.fromEntries(REQUIRED_DATABASE_CONSTRAINTS.map((name) => [
    name,
    Boolean(constraintStatus[name]),
  ]));
  const indexes = Object.fromEntries(REQUIRED_DATABASE_INDEXES.map((name) => [
    name,
    Boolean(indexStatus[name]),
  ]));
  let integrity = {
    invalidMigrationNames: null,
    invalidConfigKeys: null,
    invalidConfigValues: null,
    invalidAuditJobs: null,
    invalidAuditBatches: null,
    invalidLeaseJobIds: null,
    invalidLeaseTokens: null,
  };
  if (tables.migration_table && tables.config_table && tables.lease_table) {
    const integrityRows = await sql`
      SELECT
        (
          SELECT count(*)::int
          FROM soos_schema_migration
          WHERE char_length(name) NOT BETWEEN 1 AND 120
        ) AS invalid_migration_names,
        (
          SELECT count(*)::int
          FROM soos_config
          WHERE char_length(key) NOT BETWEEN 1 AND 512
        ) AS invalid_config_keys,
        (
          SELECT count(*)::int
          FROM soos_config
          WHERE jsonb_typeof(value) <> 'object'
        ) AS invalid_config_values,
        (
          SELECT count(*)::int
          FROM soos_config
          WHERE key ~ '^audit_job:'
            AND NOT (
              jsonb_typeof(value->'id') = 'string'
              AND (value->>'id') ~ '^[a-z0-9-]{1,128}$'
              AND key = 'audit_job:' || (value->>'id')
              AND jsonb_typeof(value->'sessionId') = 'string'
              AND (value->>'sessionId') ~ '^[0-9a-f]{32}$'
              AND (value->>'status') IN (
                'queued', 'running', 'paused', 'stopped',
                'done', 'error', 'interrupted'
              )
              AND jsonb_typeof(value->'createdAt') = 'number'
              AND jsonb_typeof(value->'updatedAt') = 'number'
            )
        ) AS invalid_audit_jobs,
        (
          SELECT count(*)::int
          FROM soos_config
          WHERE key ~ '^audit_job_batch:'
            AND NOT (
              key ~ '^audit_job_batch:[a-z0-9-]{1,128}:[0-9]{6}$'
              AND jsonb_typeof(value->'pages') = 'array'
            )
        ) AS invalid_audit_batches,
        (
          SELECT count(*)::int
          FROM soos_job_lease
          WHERE job_id !~ '^[a-z0-9-]{1,128}$'
        ) AS invalid_lease_job_ids,
        (
          SELECT count(*)::int
          FROM soos_job_lease
          WHERE lease_token !~ '^[0-9a-f]{32}$'
        ) AS invalid_lease_tokens
    `;
    const row = integrityRows[0] || {};
    integrity = {
      invalidMigrationNames: Number(row.invalid_migration_names) || 0,
      invalidConfigKeys: Number(row.invalid_config_keys) || 0,
      invalidConfigValues: Number(row.invalid_config_values) || 0,
      invalidAuditJobs: Number(row.invalid_audit_jobs) || 0,
      invalidAuditBatches: Number(row.invalid_audit_batches) || 0,
      invalidLeaseJobIds: Number(row.invalid_lease_job_ids) || 0,
      invalidLeaseTokens: Number(row.invalid_lease_tokens) || 0,
    };
  }
  if (!tables.migration_table) {
    return {
      currentVersion: 0,
      latestVersion: DATABASE_MIGRATIONS.at(-1)?.version || 0,
      applied: [],
      pending: DATABASE_MIGRATIONS.map((migration) => migration.version),
      tables: {
        migration: false,
        config: Boolean(tables.config_table),
        lease: Boolean(tables.lease_table),
      },
      constraints,
      indexes,
      integrity,
    };
  }
  const rows = await sql`
    SELECT version, name, applied_at
    FROM soos_schema_migration
    ORDER BY version
  `;
  const applied = rows.map((row) => ({
    version: Number(row.version),
    name: String(row.name || ""),
    appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : "",
  }));
  const appliedVersions = new Set(applied.map((migration) => migration.version));
  return {
    currentVersion: applied.at(-1)?.version || 0,
    latestVersion: DATABASE_MIGRATIONS.at(-1)?.version || 0,
    applied,
    pending: DATABASE_MIGRATIONS
      .filter((migration) => !appliedVersions.has(migration.version))
      .map((migration) => migration.version),
    tables: {
      migration: true,
      config: Boolean(tables.config_table),
      lease: Boolean(tables.lease_table),
    },
    constraints,
    indexes,
    integrity,
  };
}
