import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

process.env.SOOS_DISABLE_DOTENV = "1";
delete process.env.DATABASE_URL;
delete process.env.SOOS_GSC_ACCESS_TOKEN;
delete process.env.GSC_ACCESS_TOKEN;
delete process.env.GOOGLE_OAUTH_CLIENT_ID;
delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "soos-api-routes-"));
const testGscConfigPath = path.join(testDirectory, ".soos-gsc.json");
process.env.SOOS_GSC_CONFIG_PATH = testGscConfigPath;

const { handleRequest } = await import("../server/api.js");
const server = http.createServer(handleRequest);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

try {
  const preflight = await jsonRequest("/api/anything", { method: "OPTIONS" });
  assert.equal(preflight.response.status, 200);
  assert.equal(preflight.response.headers.get("access-control-allow-methods"), "GET, POST, DELETE, OPTIONS");
  assert.match(preflight.response.headers.get("x-request-id") || "", /^[0-9a-f-]{36}$/);
  assert.equal(preflight.response.headers.get("x-frame-options"), "DENY");
  assert.equal(preflight.response.headers.get("referrer-policy"), "no-referrer");
  assert.match(preflight.response.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.deepEqual(preflight.body, {});

  const health = await jsonRequest("/api/health", {
    headers: { "x-request-id": "route-health-test-123" },
  });
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.service, "soos-api");
  assert.equal(health.body.requestId, "route-health-test-123");
  assert.equal(health.response.headers.get("x-request-id"), "route-health-test-123");
  assert.equal(health.response.headers.get("cache-control"), "no-store");
  assert.equal(health.response.headers.get("set-cookie"), null);

  const metrics = await jsonRequest("/api/metrics");
  assert.equal(metrics.response.status, 200);
  assert.equal(metrics.response.headers.get("set-cookie"), null);
  assert.ok(metrics.body.http.requests >= 2);
  assert.equal(typeof metrics.body.http.errorRate, "number");
  assert.equal(typeof metrics.body.google.failureRate, "number");
  assert.equal(typeof metrics.body.audits.completionRate, "number");
  assert.equal(JSON.stringify(metrics.body).includes("example.com"), false);

  const missingRoute = await jsonRequest("/api/not-found");
  assert.equal(missingRoute.response.status, 404);
  assert.equal(missingRoute.body.error, "Not found");
  assert.equal(missingRoute.body.code, "ROUTE_NOT_FOUND");
  assert.equal(missingRoute.body.retryable, false);
  assert.equal(missingRoute.body.requestId, missingRoute.response.headers.get("x-request-id"));
  assert.match(missingRoute.response.headers.get("set-cookie") || "", /^soos_session=/);

  const malformed = await jsonRequest("/api/googlebot/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.response.status, 400);
  assert.match(malformed.body.error, /JSON/i);
  assert.equal(malformed.body.code, "INVALID_JSON");
  assert.equal(malformed.body.retryable, false);

  const sitesWithoutConnection = await jsonRequest("/api/gsc/sites");
  assert.equal(sitesWithoutConnection.response.status, 400);
  assert.equal(sitesWithoutConnection.body.code, "BAD_REQUEST");
  assert.match(sitesWithoutConnection.body.error, /not configured/i);

  const tooLarge = await jsonRequest("/api/googlebot/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(50050) }),
  });
  assert.equal(tooLarge.response.status, 413);
  assert.equal(tooLarge.body.code, "REQUEST_TOO_LARGE");
  assert.equal(tooLarge.body.retryable, false);

  const rejectedOrigin = await jsonRequest("/api/audit-jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ sitemapUrl: "https://example.com/sitemap.xml" }),
  });
  assert.equal(rejectedOrigin.response.status, 403);
  assert.equal(rejectedOrigin.body.code, "ORIGIN_REJECTED");
  assert.equal(rejectedOrigin.body.retryable, false);

  const savedGsc = await jsonRequest("/api/gsc/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ siteUrl: "https://example.com/" }),
  });
  assert.equal(savedGsc.response.status, 200);
  const gscCookie = (savedGsc.response.headers.get("set-cookie") || "").split(";")[0];
  assert.match(gscCookie, /^soos_session=/);
  assert.equal(savedGsc.body.siteUrl, "https://example.com/");

  const disconnectedGsc = await jsonRequest("/api/gsc/clear", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: gscCookie },
    body: "{}",
  });
  assert.equal(disconnectedGsc.response.status, 200);
  assert.equal(disconnectedGsc.body.configured, false);
  assert.equal(disconnectedGsc.body.revoke.revoked, false);
  const rotatedGscCookie = (disconnectedGsc.response.headers.get("set-cookie") || "").split(";")[0];
  assert.match(rotatedGscCookie, /^soos_session=/);
  assert.notEqual(rotatedGscCookie, gscCookie);
  await assert.rejects(fs.stat(testGscConfigPath), { code: "ENOENT" });

  const allowedOrigin = `${baseUrl}`;
  const sameOriginPreflight = await jsonRequest("/api/audit-jobs", {
    method: "OPTIONS",
    headers: { origin: allowedOrigin },
  });
  assert.equal(sameOriginPreflight.response.headers.get("access-control-allow-origin"), allowedOrigin);

  const created = await jsonRequest("/api/audit-jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sitemapUrl: "https://example.com/sitemap.xml",
      options: { contentChecks: false },
    }),
  });
  assert.equal(created.response.status, 202);
  assert.equal(created.body.status, "queued");
  assert.ok(created.body.id);
  const cookie = (created.response.headers.get("set-cookie") || "").split(";")[0];
  assert.match(cookie, /^soos_session=/);

  const listed = await jsonRequest("/api/audit-jobs?page=1&pageSize=5&query=example.com&status=queued", {
    headers: { cookie },
  });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.total, 1);
  assert.equal(listed.body.page, 1);
  assert.equal(listed.body.pageSize, 5);
  assert.equal(listed.body.pageCount, 1);
  assert.equal(listed.body.storage, "memory");
  assert.equal(listed.body.retentionSeconds, 4 * 60 * 60);
  assert.equal(listed.body.items[0].id, created.body.id);
  assert.match(listed.body.items[0].expiresAt, /^\d{4}-\d{2}-\d{2}T/);

  let rateLimitedInspection = null;
  for (let index = 0; index < 21; index += 1) {
    rateLimitedInspection = await jsonRequest("/api/gsc/inspect", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ urls: [], siteUrl: "https://example.com/" }),
    });
  }
  assert.equal(rateLimitedInspection.response.status, 429);
  assert.equal(rateLimitedInspection.body.code, "RATE_LIMITED");
  assert.equal(rateLimitedInspection.body.retryable, true);
  assert.match(rateLimitedInspection.response.headers.get("retry-after") || "", /^\d+$/);
  assert.equal(rateLimitedInspection.response.headers.get("x-ratelimit-limit"), "20");

  const isolatedList = await jsonRequest("/api/audit-jobs?query=example.com");
  assert.equal(isolatedList.response.status, 200);
  assert.equal(isolatedList.body.total, 0);

  const isolated = await jsonRequest(`/api/audit-jobs/${created.body.id}`);
  assert.equal(isolated.response.status, 404);
  assert.equal(isolated.body.code, "JOB_NOT_FOUND");

  const opened = await jsonRequest(`/api/audit-jobs/${created.body.id}`, {
    headers: { cookie },
  });
  assert.equal(opened.response.status, 200);
  assert.equal(opened.body.id, created.body.id);
  assert.equal(opened.body.status, "queued");

  const paused = await jsonRequest(`/api/audit-jobs/${created.body.id}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "pause" }),
  });
  assert.equal(paused.response.status, 200);
  assert.equal(paused.body.status, "paused");

  const resumed = await jsonRequest(`/api/audit-jobs/${created.body.id}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "resume" }),
  });
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.body.status, "queued");

  const stopped = await jsonRequest(`/api/audit-jobs/${created.body.id}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "stop" }),
  });
  assert.equal(stopped.response.status, 200);
  assert.equal(stopped.body.status, "stopped");

  const deleted = await jsonRequest(`/api/audit-jobs/${created.body.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleted.body, { deleted: true });

  const deletedLookup = await jsonRequest(`/api/audit-jobs/${created.body.id}`, {
    headers: { cookie },
  });
  assert.equal(deletedLookup.response.status, 404);
  assert.equal(deletedLookup.body.code, "JOB_NOT_FOUND");

  const privacyConfig = await jsonRequest("/api/gsc/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ siteUrl: "https://privacy.example/" }),
  });
  const privacyCookie = (privacyConfig.response.headers.get("set-cookie") || "").split(";")[0];
  const privacyJob = await jsonRequest("/api/audit-jobs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: privacyCookie },
    body: JSON.stringify({ sitemapUrl: "https://privacy.example/sitemap.xml" }),
  });
  const otherJob = await jsonRequest("/api/audit-jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sitemapUrl: "https://other.example/sitemap.xml" }),
  });
  const otherCookie = (otherJob.response.headers.get("set-cookie") || "").split(";")[0];

  const privacySummary = await jsonRequest("/api/session-data", {
    headers: { cookie: privacyCookie },
  });
  assert.equal(privacySummary.response.status, 200);
  assert.equal(privacySummary.body.gscConfig, true);
  assert.equal(privacySummary.body.jobs, 1);

  const missingConfirmation = await jsonRequest("/api/session-data/delete", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: privacyCookie },
    body: "{}",
  });
  assert.equal(missingConfirmation.response.status, 400);
  assert.equal(missingConfirmation.body.code, "CONFIRMATION_REQUIRED");

  const privacyDeleted = await jsonRequest("/api/session-data/delete", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: privacyCookie },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  assert.equal(privacyDeleted.response.status, 200);
  assert.equal(privacyDeleted.body.deleted.gscConfigs, 1);
  assert.equal(privacyDeleted.body.deleted.jobs, 1);
  assert.deepEqual(privacyDeleted.body.remaining, {
    gscConfig: false,
    jobs: 0,
    batches: 0,
    leases: 0,
    storage: "memory",
  });
  const privacyRotatedCookie = (privacyDeleted.response.headers.get("set-cookie") || "").split(";")[0];
  assert.notEqual(privacyRotatedCookie, privacyCookie);

  const deletedPrivacyJob = await jsonRequest(`/api/audit-jobs/${privacyJob.body.id}`, {
    headers: { cookie: privacyCookie },
  });
  assert.equal(deletedPrivacyJob.response.status, 404);
  const preservedOtherJob = await jsonRequest(`/api/audit-jobs/${otherJob.body.id}`, {
    headers: { cookie: otherCookie },
  });
  assert.equal(preservedOtherJob.response.status, 200);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(testDirectory, { recursive: true, force: true });
}

console.log("api-route-tests-passed");
