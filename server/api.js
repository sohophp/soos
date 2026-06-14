import http from "node:http";
import { URL, pathToFileURL } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { createAuditJobStore } from "./audit-job-store.js";
import { createScanFetcher } from "./scan-fetch.js";
import { createScanRunner } from "./scan-runner.js";
import { ensureDatabaseSchema } from "./db-migrations.js";
import { validateOAuthState } from "./oauth-security.js";
import { createRuntimeMetrics } from "./runtime-metrics.js";
import { createEnvReader, createGscConfigStore } from "./gsc-config-store.js";
import { createGscService } from "./gsc-service.js";
import {
  deleteSessionDataFromDatabase,
  readSessionDataFromDatabase,
} from "./session-data.js";
import {
  clientIpFromRequest,
  createRateLimiter,
  isAllowedRequestOrigin,
  rateLimitRule,
  requiresSameOrigin,
} from "./security.js";
import {
  beginRequest,
  readJsonBody,
  sendError,
  sendJson,
} from "./http.js";
import { verifyGooglebotIps } from "./googlebot-verifier.js";
import { runCrux } from "./crux-service.js";
import { runPageSpeed } from "./pagespeed-service.js";
import { handleAuditJobRoute } from "./routes/audit-job-routes.js";
import { handleCruxRoute } from "./routes/crux-routes.js";
import { handleGscRoute } from "./routes/gsc-routes.js";
import { handlePageSpeedRoute } from "./routes/pagespeed-routes.js";
import { handleSessionDataRoute } from "./routes/session-data-routes.js";
import { handleSystemRoute } from "./routes/system-routes.js";

export { isPublicIp, trustedGoogleHostname } from "./googlebot-verifier.js";
export { inspectJsonLd } from "./structured-data.js";

const PORT = Number(process.env.SOOS_API_PORT || 4177);
const JOB_TTL_MS = 1000 * 60 * 60 * 4;
const PERSISTED_JOB_TTL_DAYS = 7;
const apiRateLimiter = createRateLimiter();
const runtimeMetrics = createRuntimeMetrics();
const JOB_PERSIST_INTERVAL_MS = 1500;
const JOB_HEARTBEAT_TIMEOUT_MS = 45000;
const JOB_LEASE_SECONDS = 120;
const GSC_CONFIG_PATH = process.env.SOOS_GSC_CONFIG_PATH || path.join(process.cwd(), ".soos-gsc.json");
const ENV_PATH = path.join(process.cwd(), ".env");
const SESSION_COOKIE = "soos_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;
const envReader = createEnvReader({ envPath: ENV_PATH });
const auditJobStore = createAuditJobStore({
  getSql: getNeonSql,
  ensureDatabase: ensureNeonConfigTable,
  memoryTtlMs: JOB_TTL_MS,
  persistedTtlDays: PERSISTED_JOB_TTL_DAYS,
  persistIntervalMs: JOB_PERSIST_INTERVAL_MS,
  heartbeatTimeoutMs: JOB_HEARTBEAT_TIMEOUT_MS,
  leaseSeconds: JOB_LEASE_SECONDS,
});
const jobSnapshot = auditJobStore.snapshot;
const createJob = auditJobStore.create;
const cleanupJobs = auditJobStore.cleanup;
const updateJob = auditJobStore.update;
const waitForJob = auditJobStore.wait;
const flushAuditJob = auditJobStore.flush;
const saveAuditCheckpoint = auditJobStore.saveCheckpoint;
const findAuditJob = auditJobStore.find;
const listAuditJobs = auditJobStore.list;
const deleteAuditJob = auditJobStore.remove;
const claimAuditJobLease = auditJobStore.claimLease;
const releaseAuditJobLease = auditJobStore.releaseLease;
const clearAuditJobBatches = auditJobStore.clearBatches;
const fetchText = createScanFetcher();
const { audit } = createScanRunner({ fetchText, jobStore: auditJobStore });

function oauthRedirectUri() {
  const publicBaseUrl = process.env.SOOS_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/$/, "")}/api/gsc/oauth/callback`;
  return `http://127.0.0.1:${PORT}/api/gsc/oauth/callback`;
}

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function parseCookieHeader(header) {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const equalsAt = part.indexOf("=");
    if (equalsAt <= 0) continue;
    cookies[part.slice(0, equalsAt).trim()] = decodeURIComponent(part.slice(equalsAt + 1).trim());
  }
  return cookies;
}

function validSessionId(value) {
  return /^[a-f0-9]{32}$/i.test(String(value || ""));
}

function buildSessionCookie(sessionId) {
  const secure = process.env.VERCEL || /^https:\/\//i.test(process.env.SOOS_PUBLIC_BASE_URL || "");
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function ensureGscSession(req, res) {
  const cookies = parseCookieHeader(req.headers?.cookie || "");
  let sessionId = cookies[SESSION_COOKIE] || "";
  if (!validSessionId(sessionId) || auditJobStore.isSessionRetired(sessionId)) {
    sessionId = crypto.randomBytes(16).toString("hex");
    res.soosSessionCookie = buildSessionCookie(sessionId);
  }
  return sessionId;
}

function rotateGscSession(res) {
  const sessionId = crypto.randomBytes(16).toString("hex");
  res.soosSessionCookie = buildSessionCookie(sessionId);
  return sessionId;
}

let neonSql = null;
let neonReady = false;

async function getNeonSql() {
  const url = await envReader.databaseUrl();
  if (!url) return null;
  if (!neonSql) neonSql = neon(url);
  return neonSql;
}

async function ensureNeonConfigTable(sql) {
  if (neonReady) return;
  await ensureDatabaseSchema(sql);
  await sql`
    DELETE FROM soos_config
    WHERE key LIKE 'gsc_config:%'
      AND updated_at < now() - interval '90 days'
  `;
  await sql`
    DELETE FROM soos_config
    WHERE key ~ '^audit_job:' OR key ~ '^audit_job_batch:'
      AND updated_at < now() - (${PERSISTED_JOB_TTL_DAYS} * interval '1 day')
  `;
  await sql`DELETE FROM soos_config WHERE key ~ '^audit_schedule:'`;
  await sql`DELETE FROM soos_job_lease WHERE leased_until < now()`;
  neonReady = true;
}

const gscConfigStore = createGscConfigStore({
  configPath: GSC_CONFIG_PATH,
  envReader,
  getSql: getNeonSql,
  ensureDatabase: ensureNeonConfigTable,
  isServerlessRuntime,
});
const gscService = createGscService({
  configStore: gscConfigStore,
  oauthRedirectUri,
  runtimeMetrics,
});
const {
  clear: clearGscConfig,
  persistentEnabled: persistentGscConfigEnabled,
  read: readGscConfig,
  readWithEnv: readGscConfigWithEnv,
  write: writeGscConfig,
} = gscConfigStore;
const {
  buildOAuthUrl: buildGscOAuthUrl,
  compareSearchAnalytics: compareGscSearchAnalytics,
  fetchGoogleAccount,
  inspectUrls: inspectGscUrls,
  listSitemaps: listGscSitemaps,
  listSites: listGscSites,
  postGoogleToken,
  querySearchAnalytics: queryGscSearchAnalytics,
  revokeGoogleToken,
  statusFromConfig: gscStatusFromConfig,
  testConnection: testGscConnection,
} = gscService;

async function sessionDataSummary(sessionId) {
  const sql = await getNeonSql();
  if (sql) {
    await ensureNeonConfigTable(sql);
    return {
      ...(await readSessionDataFromDatabase(sql, sessionId)),
      storage: "neon",
    };
  }
  const storedConfig = await readGscConfig(sessionId);
  const memory = auditJobStore.memorySummary(sessionId);
  return {
    gscConfig: Boolean(Object.keys(storedConfig || {}).length),
    jobs: memory.jobs,
    batches: 0,
    leases: memory.leases,
    storage: "memory",
  };
}

async function deleteAllSessionData(sessionId) {
  auditJobStore.retireSession(sessionId);
  const config = await readGscConfig(sessionId);
  const revoke = await revokeGoogleToken(config);
  const memoryJobs = auditJobStore.removeSessionFromMemory(sessionId);
  const sql = await getNeonSql();
  let deleted;
  if (sql) {
    await ensureNeonConfigTable(sql);
    deleted = await deleteSessionDataFromDatabase(sql, sessionId);
  } else {
    const storedConfig = await readGscConfig(sessionId);
    await clearGscConfig(sessionId);
    deleted = {
      gscConfigs: Object.keys(storedConfig || {}).length ? 1 : 0,
      jobs: memoryJobs,
      batches: 0,
      leases: 0,
    };
  }
  return { deleted, revoke };
}

async function runAuditJob(job, execution = {}) {
  if (!job || auditJobStore.isActive(job.id)) return job;
  runtimeMetrics.recordAuditStarted(job.id);
  auditJobStore.markActive(job.id);
  const startingPatch = {
    status: "running",
    error: null,
    recoverable: false,
    result: null,
  };
  if (!job.checkpoint) {
    startingPatch.progress = {
      stage: "preparing",
      label: "Preparing scan",
      percent: 5,
      processedUrls: 0,
      totalUrls: 0,
      processedSitemaps: 0,
      discoveredSitemaps: 0,
    };
  }
  updateJob(job, startingPatch);
  await flushAuditJob(job);
  try {
    const result = await audit(
      job.request?.sitemapUrl,
      job.request?.options,
      (progress) => updateJob(job, { progress }),
      job,
      execution,
    );
    if (job.status === "stopped") return;
    if (result?.pending) {
      const persistedJob = await auditJobStore.find(job.id, job.sessionId, { cache: false });
      if (job.status === "paused" || job.status === "stopped") {
        updateJob(job, { recoverable: true });
      } else if (persistedJob?.status === "paused" || persistedJob?.status === "stopped") {
        updateJob(job, {
          status: persistedJob.status,
          error: persistedJob.error || null,
          recoverable: true,
          progress: persistedJob.progress,
        });
      } else {
        updateJob(job, {
          status: "queued",
          error: null,
          recoverable: true,
        });
      }
      return job;
    }
    updateJob(job, {
      status: "done",
      error: null,
      recoverable: false,
      progress: {
        stage: "done",
        label: "Completed",
        percent: 100,
        processedUrls: result.summary.urlCount + (result.summary.discoveredUrlCount || 0),
        totalUrls: result.summary.urlCount + (result.summary.discoveredUrlCount || 0),
        processedSitemaps: result.summary.sitemapCount,
        discoveredSitemaps: result.summary.sitemapCount,
      },
      result,
      checkpoint: null,
    });
  } catch (error) {
    if (error?.code === "JOB_STOPPED" || job.status === "stopped") {
      updateJob(job, {
        status: "stopped",
        progress: {
          ...job.progress,
          label: "Stopped",
        },
        error: null,
        recoverable: true,
      });
    } else {
      updateJob(job, {
        status: "error",
        error: String(error.message || error),
        recoverable: true,
      });
    }
  } finally {
    auditJobStore.markInactive(job.id);
    if (job.status === "done") {
      runtimeMetrics.recordAuditFinished(job.id, "completed", Date.now() - job.createdAt);
    } else if (job.status === "error") {
      runtimeMetrics.recordAuditFinished(job.id, "failed", Date.now() - job.createdAt);
    } else if (job.status === "stopped") {
      runtimeMetrics.recordAuditFinished(job.id, "stopped", Date.now() - job.createdAt);
    }
    await flushAuditJob(job).catch((error) => {
      console.error(`Could not finalize audit job ${job.id}:`, error);
    });
    if (job.status === "done") {
      await clearAuditJobBatches(job.id).catch((error) => {
        console.error(`Could not clear audit checkpoint batches for ${job.id}:`, error);
      });
    }
  }
  return job;
}

function sendRouteError(res, error, fallbackStatus = 400, options = {}) {
  const status = error?.code === "REQUEST_TOO_LARGE" ? 413 : fallbackStatus;
  if (status >= 500) {
    console.error(JSON.stringify({
      type: "http_error",
      requestId: res.soosRequestId || "",
      code: error?.code || options.code || "INTERNAL_ERROR",
      message: String(error?.message || error),
    }));
  }
  return sendError(res, status, error, options);
}

export function handleRequest(req, res) {
  beginRequest(req, res, console, (entry) => runtimeMetrics.recordHttp(entry));
  cleanupJobs();
  const requestPath = (req.url || "").split("?")[0];
  if (req.method === "OPTIONS") return sendJson(res, 200, {});
  if (handleSystemRoute(req, res, requestPath, { runtimeMetrics })) return;
  const sessionId = ensureGscSession(req, res);
  if (requiresSameOrigin(req.method) && !isAllowedRequestOrigin(req)) {
    return sendError(res, 403, "Cross-origin write request rejected", {
      code: "ORIGIN_REJECTED",
      retryable: false,
    });
  }
  const rateRule = rateLimitRule(req.method, requestPath);
  if (rateRule) {
    const rateKey = `${rateRule.group}:${sessionId}:${clientIpFromRequest(req)}`;
    const rate = apiRateLimiter.check(rateKey, rateRule.limit, rateRule.windowMs);
    res.setHeader?.("X-RateLimit-Limit", String(rateRule.limit));
    res.setHeader?.("X-RateLimit-Remaining", String(rate.remaining));
    res.setHeader?.("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
    if (!rate.allowed) {
      res.setHeader?.("Retry-After", String(rate.retryAfterSeconds));
      return sendError(res, 429, "Too many high-cost requests. Retry later.", {
        code: "RATE_LIMITED",
        retryable: true,
      });
    }
  }
  if (req.method === "POST" && requestPath === "/api/googlebot/verify") {
    readJsonBody(req, 50000)
      .then(async (body) => sendJson(res, 200, await verifyGooglebotIps(body.ips)))
      .catch((error) => sendRouteError(res, error, 400));
    return;
  }
  if (handleSessionDataRoute(req, res, requestPath, {
    sessionId,
    sessionDataSummary,
    deleteAllSessionData,
    rotateSession: rotateGscSession,
    persistentConfigEnabled: persistentGscConfigEnabled,
    sendRouteError,
  })) return;
  if (handleGscRoute(req, res, requestPath, {
    sessionId,
    isServerlessRuntime,
    persistentConfigEnabled: persistentGscConfigEnabled,
    readConfig: readGscConfig,
    readConfigWithEnv: readGscConfigWithEnv,
    writeConfig: writeGscConfig,
    clearConfig: clearGscConfig,
    statusFromConfig: gscStatusFromConfig,
    revokeGoogleToken,
    rotateSession: rotateGscSession,
    buildOAuthUrl: buildGscOAuthUrl,
    validateOAuthState,
    postGoogleToken,
    oauthRedirectUri,
    fetchGoogleAccount,
    testConnection: testGscConnection,
    listSites: listGscSites,
    querySearchAnalytics: queryGscSearchAnalytics,
    compareSearchAnalytics: compareGscSearchAnalytics,
    listSitemaps: listGscSitemaps,
    inspectUrls: inspectGscUrls,
    sendRouteError,
  })) return;
  if (handlePageSpeedRoute(req, res, requestPath, {
    runPageSpeed,
    sendRouteError,
  })) return;
  if (handleCruxRoute(req, res, requestPath, {
    runCrux,
    sendRouteError,
  })) return;
  if (handleAuditJobRoute(req, res, requestPath, {
    sessionId,
    listAuditJobs,
    deleteAuditJob,
    findAuditJob,
    jobSnapshot,
    claimAuditJobLease,
    releaseAuditJobLease,
    runAuditJob,
    updateJob,
    flushAuditJob,
    createJob,
    runtimeMetrics,
    sendRouteError,
  })) return;
  if (req.method !== "POST" || requestPath !== "/api/audit") return sendError(res, 404, "Not found", { code: "ROUTE_NOT_FOUND" });
  readJsonBody(req, 100000)
    .then(async (body) => {
    const metricId = `sync:${res.soosRequestId}`;
    const metricStartedAt = Date.now();
    runtimeMetrics.recordAuditStarted(metricId);
    try {
      const result = await audit(body.sitemapUrl, body.options);
      runtimeMetrics.recordAuditFinished(metricId, "completed", Date.now() - metricStartedAt);
      sendJson(res, 200, result);
    } catch (error) {
      runtimeMetrics.recordAuditFinished(metricId, "failed", Date.now() - metricStartedAt);
      sendRouteError(res, error, 400);
    }
  })
    .catch((error) => sendRouteError(res, error, 400));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  http.createServer(handleRequest).listen(PORT, "127.0.0.1", () => {
    console.log(`soos API listening on http://127.0.0.1:${PORT}`);
  });
}
