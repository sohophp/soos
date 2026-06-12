import assert from "node:assert/strict";
import { handleAuditJobRoute } from "../server/routes/audit-job-routes.js";
import { handleGscRoute } from "../server/routes/gsc-routes.js";
import { handleSessionDataRoute } from "../server/routes/session-data-routes.js";
import { handleSystemRoute } from "../server/routes/system-routes.js";

function createResponse() {
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  return {
    headers: new Map(),
    statusCode: 0,
    body: null,
    soosRequestId: "route-module-test",
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
    writeHead(status, headers) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(headers || {})) {
        this.headers.set(name.toLowerCase(), value);
      }
    },
    end(body) {
      const contentType = String(this.headers.get("content-type") || "");
      this.body = body && contentType.includes("application/json") ? JSON.parse(body) : body || null;
      this.writableEnded = true;
      resolveFinished();
    },
    finished,
  };
}

async function responseFrom(handler) {
  const response = createResponse();
  assert.equal(handler(response), true);
  await response.finished;
  return response;
}

const health = await responseFrom((res) => handleSystemRoute(
  { method: "GET" },
  res,
  "/api/health",
  {
    runtimeMetrics: { snapshot: () => ({}) },
    now: () => Date.UTC(2026, 5, 12),
    uptime: () => 42.9,
  },
));
assert.equal(health.statusCode, 200);
assert.equal(health.body.status, "ok");
assert.equal(health.body.uptimeSeconds, 42);
assert.equal(health.body.requestId, "route-module-test");
assert.equal(health.headers.has("set-cookie"), false);

const metrics = await responseFrom((res) => handleSystemRoute(
  { method: "GET" },
  res,
  "/api/metrics",
  { runtimeMetrics: { snapshot: () => ({ http: { requests: 3 } }) } },
));
assert.deepEqual(metrics.body, { http: { requests: 3 } });
assert.equal(handleSystemRoute({ method: "GET" }, createResponse(), "/api/other", {}), false);

let rotated = false;
const deletedSession = await responseFrom((res) => handleSessionDataRoute(
  { method: "POST", body: { confirm: "DELETE" } },
  res,
  "/api/session-data/delete",
  {
    sessionId: "session-a",
    sessionDataSummary: async () => ({}),
    deleteAllSessionData: async (sessionId) => ({
      deleted: { jobs: sessionId === "session-a" ? 2 : 0 },
      revoke: { revoked: true },
    }),
    rotateSession: () => {
      rotated = true;
    },
    persistentConfigEnabled: async () => true,
    sendRouteError: (res, error, status) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error.message, code: error.code }));
    },
  },
));
assert.equal(rotated, true);
assert.equal(deletedSession.statusCode, 200);
assert.equal(deletedSession.body.deleted.jobs, 2);
assert.equal(deletedSession.body.remaining.storage, "neon");

const missingConfirmation = await responseFrom((res) => handleSessionDataRoute(
  { method: "POST", body: {} },
  res,
  "/api/session-data/delete",
  {
    sessionId: "session-a",
    sessionDataSummary: async () => ({}),
    deleteAllSessionData: async () => {
      throw new Error("must not run");
    },
    rotateSession: () => {},
    persistentConfigEnabled: async () => false,
    sendRouteError: (res, error, status) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error.message, code: error.code }));
    },
  },
));
assert.equal(missingConfirmation.statusCode, 400);
assert.equal(missingConfirmation.body.code, "CONFIRMATION_REQUIRED");

const jobs = new Map();
const auditDependencies = {
  sessionId: "session-a",
  listAuditJobs: async (sessionId, options) => ({
    sessionId,
    options,
    items: [],
  }),
  deleteAuditJob: async (id) => jobs.delete(id),
  findAuditJob: async (id) => jobs.get(id) || null,
  jobSnapshot: (job) => ({ ...job }),
  claimAuditJobLease: async () => "lease-a",
  releaseAuditJobLease: async () => {},
  runAuditJob: async (job) => {
    job.status = "done";
  },
  updateJob: (job, patch) => {
    Object.assign(job, patch);
    job.progress = { ...(job.progress || {}), ...(patch.progress || {}) };
  },
  flushAuditJob: async () => {},
  createJob: (sessionId, request) => {
    const job = {
      id: "job-created",
      sessionId,
      status: "queued",
      request,
      progress: { stage: "preparing", label: "Preparing" },
      createdAt: Date.now(),
    };
    jobs.set(job.id, job);
    return job;
  },
  runtimeMetrics: { recordAuditFinished: () => {} },
  sendRouteError: (res, error, status) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error.message, code: error.code }));
  },
};

const listed = await responseFrom((res) => handleAuditJobRoute(
  { method: "GET", url: "/api/audit-jobs?page=2&pageSize=25&query=docs&status=done" },
  res,
  "/api/audit-jobs",
  auditDependencies,
));
assert.deepEqual(listed.body.options, {
  page: "2",
  pageSize: "25",
  query: "docs",
  status: "done",
});

const created = await responseFrom((res) => handleAuditJobRoute(
  {
    method: "POST",
    body: {
      sitemapUrl: "https://example.com/sitemap.xml",
      options: { internalCrawl: true },
    },
  },
  res,
  "/api/audit-jobs",
  auditDependencies,
));
assert.equal(created.statusCode, 202);
assert.equal(created.body.id, "job-created");
assert.equal(created.body.request.options.internalCrawl, true);

const paused = await responseFrom((res) => handleAuditJobRoute(
  { method: "POST", body: { action: "pause" } },
  res,
  "/api/audit-jobs/job-created/control",
  auditDependencies,
));
assert.equal(paused.body.status, "paused");
assert.equal(paused.body.progress.label, "Paused");

const resumed = await responseFrom((res) => handleAuditJobRoute(
  { method: "POST", body: { action: "resume" } },
  res,
  "/api/audit-jobs/job-created/control",
  auditDependencies,
));
assert.equal(resumed.body.status, "queued");

assert.equal(handleAuditJobRoute(
  { method: "GET", url: "/api/other" },
  createResponse(),
  "/api/other",
  auditDependencies,
), false);

const gscWrites = [];
const gscClears = [];
let validatedState = null;
const gscConfig = {
  siteUrl: "https://example.com/",
  accessToken: "",
  refreshToken: "",
  oauthClientId: "client-id",
  oauthClientSecret: "client-secret",
  oauthState: "expected-state",
  oauthStateCreatedAt: Date.now(),
  databaseConfigured: true,
};
const gscDependencies = {
  sessionId: "session-old",
  isServerlessRuntime: () => false,
  persistentConfigEnabled: async () => true,
  readConfig: async () => ({ ...gscConfig }),
  readConfigWithEnv: async () => ({ ...gscConfig }),
  writeConfig: async (config, sessionId) => {
    gscWrites.push({ config, sessionId });
  },
  clearConfig: async (sessionId) => {
    gscClears.push(sessionId);
  },
  statusFromConfig: (config) => ({ configured: Boolean(config.siteUrl && config.refreshToken), siteUrl: config.siteUrl }),
  revokeGoogleToken: async () => ({ revoked: true }),
  rotateSession: () => "session-new",
  buildOAuthUrl: () => ({
    authUrl: "https://accounts.example/authorize",
    redirectUri: "https://soos.example/api/gsc/oauth/callback",
    state: "new-state",
    stateCreatedAt: 123,
  }),
  validateOAuthState: (...values) => {
    validatedState = values;
  },
  postGoogleToken: async () => ({
    access_token: "access-new",
    refresh_token: "refresh-new",
    expires_in: 3600,
  }),
  oauthRedirectUri: () => "https://soos.example/api/gsc/oauth/callback",
  fetchGoogleAccount: async () => ({ googleAccountEmail: "owner@example.com" }),
  testConnection: async (options) => ({ ok: true, options }),
  listSites: async (options) => ({ sites: [], options }),
  querySearchAnalytics: async (options) => ({ mode: "current", options }),
  compareSearchAnalytics: async (options) => ({ mode: "comparison", options }),
  listSitemaps: async (options) => ({ sitemaps: [], options }),
  inspectUrls: async (urls, options) => ({ urls, options }),
  sendRouteError: (res, error, status) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error.message, code: error.code }));
  },
};

const gscStatus = await responseFrom((res) => handleGscRoute(
  { method: "GET" },
  res,
  "/api/gsc/status",
  gscDependencies,
));
assert.equal(gscStatus.statusCode, 200);
assert.equal(gscStatus.body.siteUrl, "https://example.com/");

const oauthStart = await responseFrom((res) => handleGscRoute(
  { method: "POST", body: { siteUrl: "  sc-domain:example.com  " } },
  res,
  "/api/gsc/oauth/start",
  gscDependencies,
));
assert.equal(oauthStart.statusCode, 200);
assert.equal(oauthStart.body.authUrl, "https://accounts.example/authorize");
assert.equal(gscWrites.some(({ config }) => config.oauthState === "new-state"), true);

const oauthCallback = await responseFrom((res) => handleGscRoute(
  {
    method: "GET",
    url: "/api/gsc/oauth/callback?code=auth-code&state=expected-state",
  },
  res,
  "/api/gsc/oauth/callback",
  gscDependencies,
));
assert.equal(oauthCallback.statusCode, 200);
assert.match(oauthCallback.body, /OAuth connected/);
assert.deepEqual(validatedState, ["expected-state", "expected-state", gscConfig.oauthStateCreatedAt]);
assert.equal(gscWrites.some(({ config, sessionId }) => (
  sessionId === "session-old"
  && config.oauthState === ""
  && !config.accessToken
)), true);
assert.equal(gscWrites.some(({ config, sessionId }) => (
  sessionId === "session-new"
  && config.refreshToken === "refresh-new"
  && config.googleAccountEmail === "owner@example.com"
)), true);
assert.deepEqual(gscClears, ["session-old"]);

const comparedAnalytics = await responseFrom((res) => handleGscRoute(
  { method: "POST", body: { siteUrl: "https://example.com/", comparePrevious: true } },
  res,
  "/api/gsc/search-analytics",
  gscDependencies,
));
assert.equal(comparedAnalytics.body.mode, "comparison");
assert.equal(comparedAnalytics.body.options.sessionId, "session-old");

const callbackError = await responseFrom((res) => handleGscRoute(
  { method: "GET", url: "/api/gsc/oauth/callback?state=bad" },
  res,
  "/api/gsc/oauth/callback",
  {
    ...gscDependencies,
    readConfigWithEnv: async () => {
      throw new Error("<script>unsafe</script>");
    },
  },
));
assert.equal(callbackError.statusCode, 400);
assert.doesNotMatch(callbackError.body, /<script>unsafe/);
assert.match(callbackError.body, /&lt;script&gt;unsafe&lt;\/script&gt;/);

assert.equal(handleGscRoute(
  { method: "GET", url: "/api/other" },
  createResponse(),
  "/api/other",
  gscDependencies,
), false);

console.log("server-routes-tests-passed");
