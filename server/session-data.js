function normalizedCount(value) {
  return Math.max(0, Number(value) || 0);
}

export async function readSessionDataFromDatabase(sql, sessionId) {
  const rows = await sql`
    WITH owned_jobs AS MATERIALIZED (
      SELECT value->>'id' AS job_id
      FROM soos_config
      WHERE key ~ '^audit_job:'
        AND value->>'sessionId' = ${sessionId}
    )
    SELECT
      EXISTS (
        SELECT 1 FROM soos_config WHERE key = ${`gsc_config:${sessionId}`}
      ) AS gsc_config,
      (SELECT count(*)::int FROM owned_jobs) AS jobs,
      (
        SELECT count(*)::int
        FROM soos_config AS batch
        WHERE batch.key ~ '^audit_job_batch:'
          AND EXISTS (
            SELECT 1
            FROM owned_jobs
            WHERE left(
              batch.key,
              char_length('audit_job_batch:' || owned_jobs.job_id || ':')
            ) = 'audit_job_batch:' || owned_jobs.job_id || ':'
          )
      ) AS batches,
      (
        SELECT count(*)::int
        FROM soos_job_lease
        WHERE job_id IN (SELECT job_id FROM owned_jobs)
      ) AS leases
  `;
  const row = rows[0] || {};
  return {
    gscConfig: Boolean(row.gsc_config),
    jobs: normalizedCount(row.jobs),
    batches: normalizedCount(row.batches),
    leases: normalizedCount(row.leases),
  };
}

export async function deleteSessionDataFromDatabase(sql, sessionId) {
  const rows = await sql`
    WITH owned_jobs AS MATERIALIZED (
      SELECT value->>'id' AS job_id
      FROM soos_config
      WHERE key ~ '^audit_job:'
        AND value->>'sessionId' = ${sessionId}
    ),
    deleted_leases AS (
      DELETE FROM soos_job_lease
      WHERE job_id IN (SELECT job_id FROM owned_jobs)
      RETURNING job_id
    ),
    deleted_config AS (
      DELETE FROM soos_config AS config
      WHERE config.key = ${`gsc_config:${sessionId}`}
        OR (
          config.key ~ '^audit_job:'
          AND config.value->>'sessionId' = ${sessionId}
        )
        OR (
          config.key ~ '^audit_job_batch:'
          AND EXISTS (
            SELECT 1
            FROM owned_jobs
            WHERE left(
              config.key,
              char_length('audit_job_batch:' || owned_jobs.job_id || ':')
            ) = 'audit_job_batch:' || owned_jobs.job_id || ':'
          )
        )
      RETURNING config.key
    )
    SELECT
      count(*) FILTER (WHERE key = ${`gsc_config:${sessionId}`})::int AS gsc_configs,
      count(*) FILTER (WHERE key ~ '^audit_job:')::int AS jobs,
      count(*) FILTER (WHERE key ~ '^audit_job_batch:')::int AS batches,
      (SELECT count(*)::int FROM deleted_leases) AS leases
    FROM deleted_config
  `;
  const row = rows[0] || {};
  return {
    gscConfigs: normalizedCount(row.gsc_configs),
    jobs: normalizedCount(row.jobs),
    batches: normalizedCount(row.batches),
    leases: normalizedCount(row.leases),
  };
}
