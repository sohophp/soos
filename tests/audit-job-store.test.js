import assert from "node:assert/strict";
import { createAuditJobStore } from "../server/audit-job-store.js";

let currentTime = 1000;
const scheduledDelays = [];
const clearedTimers = [];
let nextTimerId = 1;
const store = createAuditJobStore({
  getSql: async () => null,
  ensureDatabase: async () => {},
  memoryTtlMs: 100,
  persistedTtlDays: 7,
  persistIntervalMs: 60000,
  heartbeatTimeoutMs: 45000,
  leaseSeconds: 120,
  now: () => currentTime,
  logger: { error: () => {} },
  setTimer: (callback, delay) => {
    scheduledDelays.push(delay);
    return { id: nextTimerId += 1, callback, unref() {} };
  },
  clearTimer: (timer) => clearedTimers.push(timer.id),
});

const job = store.create("session-a", {
  sitemapUrl: "https://example.com/sitemap.xml",
  options: { internalCrawl: true },
});
assert.equal(job.sessionId, "session-a");
assert.equal(job.status, "queued");
assert.equal(job.progress.stage, "queued");

store.update(job, {
  status: "running",
  progress: { stage: "inspecting", processedUrls: 3, totalUrls: 10 },
  recoverable: true,
});
assert.equal(scheduledDelays.at(-1), 60000);
assert.equal(job.status, "running");
assert.equal(job.progress.processedUrls, 3);
assert.equal(job.progress.totalUrls, 10);
assert.equal(job.recoverable, true);

const snapshot = store.snapshot(job);
assert.equal(snapshot.request.sitemapUrl, "https://example.com/sitemap.xml");
assert.equal(snapshot.progress.stage, "inspecting");
assert.equal(snapshot.result, null);

assert.equal(await store.find(job.id, "session-b"), null);
assert.equal((await store.find(job.id, "session-a")).id, job.id);
assert.equal((await store.list("session-a")).total, 1);
assert.equal((await store.list("session-b")).total, 0);

assert.equal(store.isActive(job.id), false);
store.markActive(job.id);
assert.equal(store.isActive(job.id), true);
assert.deepEqual(store.memorySummary("session-a"), { jobs: 1, leases: 1 });
assert.equal(await store.claimLease(job.id), null);
store.markInactive(job.id);
assert.match(await store.claimLease(job.id), /^[0-9a-f]{32}$/);

store.update(job, { status: "done" });
assert.equal(scheduledDelays.at(-1), 0);
assert.equal(clearedTimers.length > 0, true);
currentTime = 1200;
store.cleanup();
assert.equal((await store.list("session-a")).total, 0);

store.retireSession("session-retired");
assert.equal(store.isSessionRetired("session-retired"), true);
assert.throws(
  () => store.create("session-retired", { sitemapUrl: "https://example.com/" }),
  (error) => error.code === "SESSION_RETIRED",
);

const removable = store.create("session-remove", { sitemapUrl: "https://example.com/" });
store.update(removable, { status: "paused" });
assert.equal(await store.remove(removable.id, "session-remove"), true);
assert.equal(await store.find(removable.id, "session-remove"), null);

store.create("session-clear", { sitemapUrl: "https://example.com/a.xml" });
store.create("session-clear", { sitemapUrl: "https://example.com/b.xml" });
assert.equal(store.removeSessionFromMemory("session-clear"), 2);
assert.deepEqual(store.memorySummary("session-clear"), { jobs: 0, leases: 0 });

const stopped = store.create("session-stop", { sitemapUrl: "https://example.com/" });
stopped.status = "stopped";
await assert.rejects(
  () => store.wait(stopped),
  (error) => error.code === "JOB_STOPPED",
);

console.log("audit-job-store-tests-passed");
