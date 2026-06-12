import { apiDelete, apiGet, apiPost } from "./api-client.js";

export const ACTIVE_AUDIT_JOB_KEY = "soos:active-audit-job";

export function readActiveAuditJob(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(ACTIVE_AUDIT_JOB_KEY) || "null");
    if (!value?.id) return null;
    return {
      id: String(value.id),
      startedAt: Number(value.startedAt) || Date.now(),
    };
  } catch {
    storage?.removeItem(ACTIVE_AUDIT_JOB_KEY);
    return null;
  }
}

export function saveActiveAuditJob(job, storage = globalThis.localStorage) {
  storage?.setItem(ACTIVE_AUDIT_JOB_KEY, JSON.stringify({
    id: job.id,
    startedAt: Number(job.startedAt) || Date.now(),
  }));
}

export function clearActiveAuditJob(storage = globalThis.localStorage) {
  storage?.removeItem(ACTIVE_AUDIT_JOB_KEY);
}

export function listAuditJobs(options = {}) {
  const normalized = typeof options === "number" ? { pageSize: options } : options;
  const params = new URLSearchParams();
  params.set("page", String(normalized.page || 1));
  params.set("pageSize", String(normalized.pageSize || 10));
  if (normalized.query) params.set("query", normalized.query);
  if (normalized.status) params.set("status", normalized.status);
  return apiGet(`/api/audit-jobs?${params.toString()}`, {
    fallbackMessage: "Could not load retained tasks",
  });
}

export function getAuditJob(jobId) {
  return apiGet(`/api/audit-jobs/${encodeURIComponent(jobId)}`, {
    fallbackMessage: "Could not open retained report",
  });
}

export function controlAuditJob(jobId, action, fallbackMessage = "Could not control audit") {
  return apiPost(`/api/audit-jobs/${encodeURIComponent(jobId)}/control`, { action }, {
    fallbackMessage,
  });
}

export function removeAuditJob(jobId) {
  return apiDelete(`/api/audit-jobs/${encodeURIComponent(jobId)}`, {
    fallbackMessage: "Could not delete retained task",
  });
}

export function runAuditJobBatch(jobId) {
  return apiPost(`/api/audit-jobs/${encodeURIComponent(jobId)}/run`, {}, {
    fallbackMessage: "Audit failed",
  });
}

export function startAuditJob(request) {
  return apiPost("/api/audit-jobs", request, {
    fallbackMessage: "Audit failed",
  });
}

export function auditProgressView(job, copy) {
  const status = job?.status || "";
  const progress = job?.progress || {};
  const label = status === "paused"
    ? copy.progressPaused
    : status === "stopped"
      ? copy.progressStopped
      : status === "interrupted"
        ? copy.progressInterrupted
        : progress.stage === "fetching"
          ? copy.progressFetching
          : progress.stage === "inspecting"
            ? copy.progressInspecting
            : progress.stage === "discovering"
              ? copy.progressDiscovering
              : progress.stage === "finalizing"
                ? copy.progressFinalizing
                : copy.progressPreparing;
  const metaParts = [];
  if (progress.discoveredSitemaps) {
    metaParts.push(`${progress.processedSitemaps || 0}/${progress.discoveredSitemaps} sitemap`);
  }
  if (progress.totalUrls) {
    metaParts.push(`${progress.processedUrls || 0}/${progress.totalUrls} URLs`);
  }
  return {
    label,
    value: progress.percent || 0,
    meta: metaParts.join(" | "),
  };
}
