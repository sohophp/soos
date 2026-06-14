import { auditProgressView } from "./audit-jobs.js";

export function auditJobStep(job, copy) {
  const progress = auditProgressView(job, copy);
  if (job.status === "done") {
    return {
      terminal: "done",
      progress: { label: copy.progressFinalizing, value: 100, meta: progress.meta },
      result: job.result,
      delayMs: 0,
    };
  }
  if (job.status === "stopped") {
    return {
      terminal: "stopped",
      progress: {
        label: copy.progressStopped,
        value: job.progress?.percent || 0,
        meta: progress.meta,
      },
      delayMs: 0,
    };
  }
  if (job.status === "error") {
    return {
      terminal: "error",
      progress,
      error: job.error || "Audit failed",
      delayMs: 0,
    };
  }
  return {
    terminal: null,
    progress,
    delayMs: job.leaseBusy ? 1000 : 250,
  };
}
