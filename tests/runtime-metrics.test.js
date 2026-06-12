import assert from "node:assert/strict";
import { createRuntimeMetrics } from "../server/runtime-metrics.js";

const metrics = createRuntimeMetrics(1000);
metrics.recordHttp({ status: 200, durationMs: 10 });
metrics.recordHttp({ status: 404, durationMs: 20 });
metrics.recordHttp({ status: 503, durationMs: 30 });
metrics.recordGoogle("sites", true, 40);
metrics.recordGoogle("sites", false, 60);
metrics.recordGoogle("inspection", false, 20);
metrics.recordAuditStarted("job-1");
metrics.recordAuditFinished("job-1", "completed", 1000);
metrics.recordAuditFinished("job-1", "failed", 2000);
metrics.recordAuditFinished("job-2", "failed", 500);

const snapshot = metrics.snapshot(6000);
assert.equal(snapshot.uptimeSeconds, 5);
assert.deepEqual(snapshot.http, {
  requests: 3,
  errors: 2,
  serverErrors: 1,
  errorRate: 0.6667,
  duration: { averageMs: 20, maxMs: 30 },
});
assert.equal(snapshot.google.requests, 3);
assert.equal(snapshot.google.failures, 2);
assert.equal(snapshot.google.failureRate, 0.6667);
assert.deepEqual(snapshot.google.services.sites, { requests: 2, failures: 1 });
assert.deepEqual(snapshot.audits, {
  started: 2,
  completed: 1,
  failed: 1,
  stopped: 0,
  completionRate: 0.5,
  duration: { averageMs: 750, maxMs: 1000 },
});

console.log("runtime-metrics-tests-passed");
