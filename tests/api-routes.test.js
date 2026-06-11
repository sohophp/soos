import assert from "node:assert/strict";
import http from "node:http";

process.env.SOOS_DISABLE_DOTENV = "1";
delete process.env.DATABASE_URL;

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
  assert.deepEqual(preflight.body, {});

  const missingRoute = await jsonRequest("/api/not-found");
  assert.equal(missingRoute.response.status, 404);
  assert.deepEqual(missingRoute.body, { error: "Not found" });
  assert.match(missingRoute.response.headers.get("set-cookie") || "", /^soos_session=/);

  const malformed = await jsonRequest("/api/googlebot/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.response.status, 400);
  assert.match(malformed.body.error, /JSON/i);

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

  const isolated = await jsonRequest(`/api/audit-jobs/${created.body.id}`);
  assert.equal(isolated.response.status, 404);

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
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("api-route-tests-passed");
