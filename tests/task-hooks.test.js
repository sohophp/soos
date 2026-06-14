import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { auditJobStep } from "../src/audit-runner-state.js";
import {
  EMPTY_RETAINED_JOBS_META,
  normalizeRetainedJobsResponse,
} from "../src/retained-jobs-state.js";

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

const running = auditJobStep({
  status: "running",
  leaseBusy: true,
  progress: { stage: "inspecting", percent: 45, processedUrls: 9, totalUrls: 20 },
}, copy);
assert.equal(running.terminal, null);
assert.equal(running.progress.label, "Inspecting");
assert.equal(running.delayMs, 1000);

const done = auditJobStep({
  status: "done",
  progress: { percent: 95, processedUrls: 20, totalUrls: 20 },
  result: { scannedAt: "2026-06-12T00:00:00.000Z" },
}, copy);
assert.equal(done.terminal, "done");
assert.equal(done.progress.value, 100);
assert.equal(done.progress.label, "Finalizing");
assert.equal(done.result.scannedAt, "2026-06-12T00:00:00.000Z");

const stopped = auditJobStep({
  status: "stopped",
  progress: { percent: 37 },
}, copy);
assert.equal(stopped.terminal, "stopped");
assert.equal(stopped.progress.value, 37);

const failed = auditJobStep({ status: "error", error: "Network failed", progress: {} }, copy);
assert.equal(failed.terminal, "error");
assert.equal(failed.error, "Network failed");

assert.deepEqual(normalizeRetainedJobsResponse(), {
  jobs: [],
  meta: EMPTY_RETAINED_JOBS_META,
});
assert.deepEqual(normalizeRetainedJobsResponse({
  items: [{ id: "job-1" }],
  total: 21,
  page: 2,
  pageSize: 5,
  pageCount: 5,
  retentionSeconds: 86400,
  storage: "neon",
}), {
  jobs: [{ id: "job-1" }],
  meta: {
    total: 21,
    page: 2,
    pageSize: 5,
    pageCount: 5,
    retentionSeconds: 86400,
    storage: "neon",
  },
});

const [mainSource, auditHookSource, retainedHookSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useAuditRunner.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useRetainedJobs.js", import.meta.url), "utf8"),
]);
assert.match(mainSource, /const auditRunner = useAuditRunner/);
assert.match(mainSource, /const retainedJobs = useRetainedJobs/);
assert.doesNotMatch(mainSource, /async function pollAuditJob/);
assert.doesNotMatch(mainSource, /async function loadRetainedJobs/);
assert.match(auditHookSource, /readActiveAuditJob\(\)/);
assert.match(auditHookSource, /auditJobStep\(body, copy\)/);
assert.match(auditHookSource, /controlAuditJob\(job\.id, "restart"/);
assert.match(retainedHookSource, /normalizeRetainedJobsResponse\(body\)/);
assert.match(retainedHookSource, /onDeleteActiveJob\?\.\(jobId\)/);

console.log("task hooks tests passed");
