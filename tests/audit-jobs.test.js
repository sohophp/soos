import assert from "node:assert/strict";
import {
  ACTIVE_AUDIT_JOB_KEY,
  auditProgressView,
  clearActiveAuditJob,
  readActiveAuditJob,
  saveActiveAuditJob,
} from "../src/audit-jobs.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const storage = memoryStorage();
saveActiveAuditJob({ id: "job-1", startedAt: 1234 }, storage);
assert.deepEqual(readActiveAuditJob(storage), { id: "job-1", startedAt: 1234 });
clearActiveAuditJob(storage);
assert.equal(readActiveAuditJob(storage), null);

const invalidStorage = memoryStorage({ [ACTIVE_AUDIT_JOB_KEY]: "{" });
assert.equal(readActiveAuditJob(invalidStorage), null);
assert.equal(invalidStorage.getItem(ACTIVE_AUDIT_JOB_KEY), null);

const copy = {
  progressPaused: "Paused",
  progressStopped: "Stopped",
  progressInterrupted: "Interrupted",
  progressFetching: "Fetching",
  progressInspecting: "Inspecting",
  progressDiscovering: "Discovering",
  progressFinalizing: "Finalizing",
  progressPreparing: "Preparing",
};

assert.deepEqual(auditProgressView({
  status: "running",
  progress: {
    stage: "inspecting",
    percent: 45,
    processedSitemaps: 2,
    discoveredSitemaps: 3,
    processedUrls: 20,
    totalUrls: 50,
  },
}, copy), {
  label: "Inspecting",
  value: 45,
  meta: "2/3 sitemap | 20/50 URLs",
});
assert.equal(auditProgressView({ status: "paused", progress: {} }, copy).label, "Paused");
assert.equal(auditProgressView({ status: "interrupted", progress: {} }, copy).label, "Interrupted");
assert.equal(auditProgressView({ status: "running", progress: { stage: "discovering" } }, copy).label, "Discovering");

console.log("audit-jobs-tests-passed");
