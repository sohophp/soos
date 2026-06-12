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
];

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
      to_regclass('public.soos_job_lease')::text AS lease_table
  `;
  const tables = tableRows[0] || {};
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
  };
}
