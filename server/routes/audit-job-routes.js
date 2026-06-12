import { readJsonBody, sendError, sendJson } from "../http.js";

const JOB_PATH = /^\/api\/audit-jobs\/[^/]+$/;
const JOB_RUN_PATH = /^\/api\/audit-jobs\/[^/]+\/run$/;
const JOB_CONTROL_PATH = /^\/api\/audit-jobs\/[^/]+\/control$/;

export function handleAuditJobRoute(req, res, requestPath, dependencies) {
  const {
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
  } = dependencies;

  if (req.method === "GET" && requestPath === "/api/audit-jobs") {
    const requestUrl = new URL(req.url || "/api/audit-jobs", "http://localhost");
    listAuditJobs(sessionId, {
      page: requestUrl.searchParams.get("page"),
      pageSize: requestUrl.searchParams.get("pageSize") || requestUrl.searchParams.get("limit"),
      query: requestUrl.searchParams.get("query"),
      status: requestUrl.searchParams.get("status"),
    })
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "DELETE" && JOB_PATH.test(requestPath)) {
    const id = requestPath.split("/").pop();
    deleteAuditJob(id, sessionId)
      .then((deleted) => deleted
        ? sendJson(res, 200, { deleted: true })
        : sendError(res, 404, "Job not found", { code: "JOB_NOT_FOUND" }))
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "GET" && JOB_PATH.test(requestPath)) {
    const id = requestPath.split("/").pop();
    findAuditJob(id, sessionId)
      .then((job) => job
        ? sendJson(res, 200, jobSnapshot(job))
        : sendError(res, 404, "Job not found", { code: "JOB_NOT_FOUND" }))
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "POST" && JOB_RUN_PATH.test(requestPath)) {
    const id = requestPath.split("/")[3];
    findAuditJob(id, sessionId)
      .then(async (job) => {
        if (!job) return sendError(res, 404, "Job not found", { code: "JOB_NOT_FOUND" });
        if (["done", "stopped", "error", "paused"].includes(job.status)) {
          return sendJson(res, 200, jobSnapshot(job));
        }
        const leaseToken = await claimAuditJobLease(job.id);
        if (!leaseToken) {
          return sendJson(res, 202, { ...jobSnapshot(job), leaseBusy: true });
        }
        try {
          await runAuditJob(job, { maxBatches: 1 });
          return sendJson(res, job.status === "done" ? 200 : 202, jobSnapshot(job));
        } finally {
          await releaseAuditJobLease(job.id, leaseToken);
        }
      })
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && JOB_CONTROL_PATH.test(requestPath)) {
    const id = requestPath.split("/")[3];
    readJsonBody(req, 20000)
      .then(async (body) => {
        const job = await findAuditJob(id, sessionId);
        if (!job) return sendError(res, 404, "Job not found", { code: "JOB_NOT_FOUND" });
        if (body.action === "pause" && (job.status === "running" || job.status === "queued")) {
          updateJob(job, { status: "paused", progress: { label: "Paused" } });
        } else if (body.action === "resume" && job.status === "paused") {
          updateJob(job, {
            status: "queued",
            progress: {
              label: job.progress.stage === "inspecting" ? "Inspecting URLs" : job.progress.label,
            },
          });
        } else if (body.action === "stop" && ["running", "queued", "paused"].includes(job.status)) {
          updateJob(job, {
            status: "stopped",
            progress: { label: "Stopped" },
            error: null,
            recoverable: true,
          });
          runtimeMetrics.recordAuditFinished(job.id, "stopped", Date.now() - job.createdAt);
        } else if (body.action === "restart" && ["interrupted", "error", "stopped"].includes(job.status)) {
          updateJob(job, { status: "queued", error: null, recoverable: true });
          await flushAuditJob(job);
          return sendJson(res, 202, jobSnapshot(job));
        }
        await flushAuditJob(job);
        return sendJson(res, 200, jobSnapshot(job));
      })
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/audit-jobs") {
    readJsonBody(req, 100000)
      .then(async (body) => {
        const job = createJob(sessionId, {
          sitemapUrl: body.sitemapUrl,
          options: body.options || {},
        });
        await flushAuditJob(job);
        return sendJson(res, 202, jobSnapshot(job));
      })
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  return false;
}
