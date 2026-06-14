import crypto from "node:crypto";
import { normalizeAuditJobListOptions, paginateAuditJobs } from "./audit-job-list.js";

function jobError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function auditJobSnapshot(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result || null,
    error: job.error || null,
    recoverable: Boolean(job.recoverable),
    checkpoint: job.checkpoint ? {
      phase: job.checkpoint.phase,
      processedUrls: job.checkpoint.pages?.length || 0,
      totalUrls: job.checkpoint.pageUrls?.length || 0,
    } : null,
    request: job.request || null,
    summary: job.summary || job.result?.summary || null,
    scannedAt: job.scannedAt || job.result?.scannedAt || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function storedAuditJob(job) {
  const checkpoint = job.checkpoint ? {
    ...job.checkpoint,
    processedUrls: job.checkpoint.pages?.length || job.checkpoint.processedUrls || 0,
    pages: undefined,
  } : null;
  return {
    id: job.id,
    sessionId: job.sessionId,
    request: job.request,
    status: job.status,
    progress: job.progress,
    result: job.result || null,
    summary: job.result?.summary || job.summary || null,
    scannedAt: job.result?.scannedAt || job.scannedAt || null,
    error: job.error || null,
    recoverable: Boolean(job.recoverable),
    checkpoint,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function jobKey(jobId) {
  return `audit_job:${jobId}`;
}

function batchPrefix(jobId) {
  return `audit_job_batch:${jobId}:`;
}

function batchKey(jobId, batchIndex) {
  return `${batchPrefix(jobId)}${String(batchIndex).padStart(6, "0")}`;
}

function rememberBounded(set, value, limit) {
  set.add(value);
  if (set.size > limit) set.delete(set.values().next().value);
}

export function createAuditJobStore(options) {
  const {
    getSql,
    ensureDatabase,
    memoryTtlMs,
    persistedTtlDays,
    persistIntervalMs,
    heartbeatTimeoutMs,
    leaseSeconds,
    logger = console,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;
  const jobs = new Map();
  const activeRuns = new Set();
  const persistTimers = new Map();
  const retiredSessions = new Set();
  const deletedJobs = new Set();

  async function persist(job) {
    if (deletedJobs.has(job?.id) || retiredSessions.has(job?.sessionId)) return false;
    const sql = await getSql();
    if (!sql) return false;
    await ensureDatabase(sql);
    const stored = storedAuditJob(job);
    await sql`
      INSERT INTO soos_config (key, value, updated_at)
      VALUES (${jobKey(job.id)}, ${JSON.stringify(stored)}::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    return true;
  }

  function schedulePersistence(job, immediate = false) {
    if (!job?.id) return;
    const existing = persistTimers.get(job.id);
    const terminal = ["done", "error", "stopped", "interrupted"].includes(job.status);
    if (existing && !immediate && !terminal) return;
    if (existing) clearTimer(existing);
    const delay = immediate || terminal ? 0 : persistIntervalMs;
    const timer = setTimer(() => {
      persistTimers.delete(job.id);
      persist(job).catch((error) => logger.error?.(`Could not persist audit job ${job.id}:`, error));
    }, delay);
    timer.unref?.();
    persistTimers.set(job.id, timer);
  }

  function update(job, patch) {
    if (patch.status) job.status = patch.status;
    if (patch.result !== undefined) job.result = patch.result;
    if (patch.error !== undefined) job.error = patch.error;
    if (patch.recoverable !== undefined) job.recoverable = Boolean(patch.recoverable);
    if (patch.checkpoint !== undefined) job.checkpoint = patch.checkpoint;
    if (patch.progress) job.progress = { ...job.progress, ...patch.progress };
    job.updatedAt = now();
    schedulePersistence(job);
  }

  async function flush(job) {
    const timer = persistTimers.get(job.id);
    if (timer) {
      clearTimer(timer);
      persistTimers.delete(job.id);
    }
    await persist(job);
  }

  async function persistBatch(jobId, batchIndex, pages) {
    if (deletedJobs.has(jobId)) return false;
    const sql = await getSql();
    if (!sql) return false;
    await ensureDatabase(sql);
    await sql`
      INSERT INTO soos_config (key, value, updated_at)
      VALUES (${batchKey(jobId, batchIndex)}, ${JSON.stringify({ pages })}::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    return true;
  }

  async function readBatches(sql, jobId) {
    const prefix = batchPrefix(jobId);
    const rows = await sql`
      SELECT value - 'result' AS value
      FROM soos_config
      WHERE left(key, char_length(${prefix})) = ${prefix}
      ORDER BY key
    `;
    return rows.flatMap((row) => {
      const value = typeof row.value === "string" ? JSON.parse(row.value || "{}") : row.value || {};
      return Array.isArray(value.pages) ? value.pages : [];
    });
  }

  async function clearBatches(jobId) {
    const sql = await getSql();
    if (!sql) return false;
    await ensureDatabase(sql);
    const prefix = batchPrefix(jobId);
    await sql`DELETE FROM soos_config WHERE left(key, char_length(${prefix})) = ${prefix}`;
    return true;
  }

  async function readPersisted(jobId, sessionId, readOptions = {}) {
    const sql = await getSql();
    if (!sql) return null;
    await ensureDatabase(sql);
    const rows = await sql`SELECT value FROM soos_config WHERE key = ${jobKey(jobId)} LIMIT 1`;
    const value = rows[0]?.value;
    const stored = typeof value === "string" ? JSON.parse(value || "{}") : value || null;
    if (!stored || stored.sessionId !== sessionId) return null;
    const job = {
      ...stored,
      createdAt: Number(stored.createdAt) || now(),
      updatedAt: Number(stored.updatedAt) || now(),
    };
    if (job.checkpoint && !Array.isArray(job.checkpoint.pages)) {
      job.checkpoint.pages = await readBatches(sql, job.id);
    }
    const runningElsewhere = job.status === "running" && !activeRuns.has(job.id);
    if (runningElsewhere && now() - job.updatedAt > heartbeatTimeoutMs) {
      job.status = "interrupted";
      job.error = "The previous worker stopped before this audit completed. Restart the audit to continue.";
      job.recoverable = true;
      job.updatedAt = now();
      await persist(job);
    }
    if (readOptions.cache !== false && (!["running", "queued", "paused"].includes(job.status) || activeRuns.has(job.id))) {
      jobs.set(job.id, job);
    }
    return job;
  }

  async function find(jobId, sessionId, readOptions = {}) {
    const memoryJob = jobs.get(jobId);
    if (memoryJob?.sessionId === sessionId && readOptions.cache !== false) return memoryJob;
    return readPersisted(jobId, sessionId, readOptions);
  }

  async function list(sessionId, listOptions = {}) {
    const normalized = normalizeAuditJobListOptions(listOptions);
    const sql = await getSql();
    if (!sql) {
      return {
        ...paginateAuditJobs(
          [...jobs.values()].filter((job) => job.sessionId === sessionId).map(auditJobSnapshot),
          listOptions,
          memoryTtlMs,
        ),
        retentionSeconds: Math.floor(memoryTtlMs / 1000),
        storage: "memory",
      };
    }
    await ensureDatabase(sql);
    const queryPattern = `%${normalized.query}%`;
    const countRows = await sql`
      SELECT count(*)::int AS total
      FROM soos_config
      WHERE key ~ '^audit_job:'
        AND value->>'sessionId' = ${sessionId}
        AND (${normalized.status === ""} OR value->>'status' = ${normalized.status})
        AND (
          ${normalized.query === ""}
          OR lower(
            coalesce(value->>'id', '') || ' ' ||
            coalesce(value->>'status', '') || ' ' ||
            coalesce(value->'request'->>'sitemapUrl', '') || ' ' ||
            coalesce(value->'request'->>'url', '') || ' ' ||
            coalesce(value->'request'->>'inputUrl', '') || ' ' ||
            coalesce(value->'result'->'input'->>'originalUrl', '') || ' ' ||
            coalesce(value->'result'->'input'->>'sitemapUrl', '')
          ) LIKE ${queryPattern}
        )
    `;
    const total = Number(countRows[0]?.total) || 0;
    const pageCount = Math.max(1, Math.ceil(total / normalized.pageSize));
    const page = Math.min(normalized.page, pageCount);
    const offset = (page - 1) * normalized.pageSize;
    const rows = await sql`
      SELECT value
      FROM soos_config
      WHERE key ~ '^audit_job:'
        AND value->>'sessionId' = ${sessionId}
        AND (${normalized.status === ""} OR value->>'status' = ${normalized.status})
        AND (
          ${normalized.query === ""}
          OR lower(
            coalesce(value->>'id', '') || ' ' ||
            coalesce(value->>'status', '') || ' ' ||
            coalesce(value->'request'->>'sitemapUrl', '') || ' ' ||
            coalesce(value->'request'->>'url', '') || ' ' ||
            coalesce(value->'request'->>'inputUrl', '') || ' ' ||
            coalesce(value->'result'->'input'->>'originalUrl', '') || ' ' ||
            coalesce(value->'result'->'input'->>'sitemapUrl', '')
          ) LIKE ${queryPattern}
        )
      ORDER BY updated_at DESC
      LIMIT ${normalized.pageSize}
      OFFSET ${offset}
    `;
    const retentionMs = persistedTtlDays * 24 * 60 * 60 * 1000;
    return {
      items: rows.map((row) => {
        const value = typeof row.value === "string" ? JSON.parse(row.value || "{}") : row.value || {};
        const job = auditJobSnapshot(value);
        return {
          ...job,
          expiresAt: job.updatedAt ? new Date(Number(job.updatedAt) + retentionMs).toISOString() : null,
        };
      }),
      total,
      page,
      pageSize: normalized.pageSize,
      pageCount,
      retentionSeconds: Math.floor(retentionMs / 1000),
      storage: "neon",
    };
  }

  async function remove(jobId, sessionId) {
    const job = await find(jobId, sessionId);
    if (!job) return false;
    if (["running", "queued"].includes(job.status)) {
      throw new Error("Stop the active task before deleting it.");
    }
    jobs.delete(jobId);
    rememberBounded(deletedJobs, jobId, 10000);
    const timer = persistTimers.get(jobId);
    if (timer) clearTimer(timer);
    persistTimers.delete(jobId);
    const sql = await getSql();
    if (!sql) return true;
    await ensureDatabase(sql);
    const prefix = batchPrefix(jobId);
    await sql`
      DELETE FROM soos_config
      WHERE key = ${jobKey(jobId)}
        OR left(key, char_length(${prefix})) = ${prefix}
    `;
    await sql`DELETE FROM soos_job_lease WHERE job_id = ${jobId}`;
    return true;
  }

  return {
    snapshot: auditJobSnapshot,
    create(sessionId, request) {
      if (retiredSessions.has(sessionId)) {
        throw jobError("SESSION_RETIRED", "This browser session was retired. Retry with the new session.");
      }
      const id = `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timestamp = now();
      const job = {
        id,
        sessionId,
        request,
        status: "queued",
        progress: {
          stage: "queued",
          label: "Queued",
          percent: 0,
          processedUrls: 0,
          totalUrls: 0,
          processedSitemaps: 0,
          discoveredSitemaps: 0,
        },
        result: null,
        error: null,
        recoverable: false,
        checkpoint: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      jobs.set(id, job);
      return job;
    },
    cleanup() {
      const cutoff = now() - memoryTtlMs;
      for (const [id, job] of jobs.entries()) {
        if (["done", "error", "stopped"].includes(job.status) && job.updatedAt < cutoff) jobs.delete(id);
      }
    },
    update,
    async wait(job) {
      while (job?.status === "paused") {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (job?.status === "stopped") throw jobError("JOB_STOPPED", "Audit stopped");
    },
    flush,
    async saveCheckpoint(job, checkpoint, batch = null, batchIndex = 0) {
      if (!job) return;
      if (batch?.length) await persistBatch(job.id, batchIndex, batch);
      update(job, { checkpoint });
      await flush(job);
    },
    find,
    list,
    remove,
    clearBatches,
    retireSession(sessionId) {
      rememberBounded(retiredSessions, sessionId, 5000);
    },
    isSessionRetired(sessionId) {
      return retiredSessions.has(sessionId);
    },
    removeSessionFromMemory(sessionId) {
      let removed = 0;
      for (const [jobId, job] of jobs.entries()) {
        if (job.sessionId !== sessionId) continue;
        job.status = "stopped";
        rememberBounded(deletedJobs, jobId, 10000);
        jobs.delete(jobId);
        const timer = persistTimers.get(jobId);
        if (timer) clearTimer(timer);
        persistTimers.delete(jobId);
        removed += 1;
      }
      return removed;
    },
    memorySummary(sessionId) {
      return {
        jobs: [...jobs.values()].filter((job) => job.sessionId === sessionId).length,
        leases: [...jobs.values()].filter((job) => job.sessionId === sessionId && activeRuns.has(job.id)).length,
      };
    },
    isActive(jobId) {
      return activeRuns.has(jobId);
    },
    markActive(jobId) {
      activeRuns.add(jobId);
    },
    markInactive(jobId) {
      activeRuns.delete(jobId);
    },
    async claimLease(jobId) {
      const sql = await getSql();
      const leaseToken = crypto.randomBytes(16).toString("hex");
      if (!sql) return activeRuns.has(jobId) ? null : leaseToken;
      await ensureDatabase(sql);
      const rows = await sql`
        INSERT INTO soos_job_lease (job_id, lease_token, leased_until)
        VALUES (${jobId}, ${leaseToken}, now() + (${leaseSeconds} * interval '1 second'))
        ON CONFLICT (job_id)
        DO UPDATE SET
          lease_token = EXCLUDED.lease_token,
          leased_until = EXCLUDED.leased_until
        WHERE soos_job_lease.leased_until < now()
        RETURNING lease_token
      `;
      return rows[0]?.lease_token === leaseToken ? leaseToken : null;
    },
    async releaseLease(jobId, leaseToken) {
      const sql = await getSql();
      if (!sql || !leaseToken) return;
      await ensureDatabase(sql);
      await sql`
        DELETE FROM soos_job_lease
        WHERE job_id = ${jobId} AND lease_token = ${leaseToken}
      `;
    },
  };
}
