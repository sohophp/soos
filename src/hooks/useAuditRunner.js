import { useEffect, useState } from "react";
import {
  clearActiveAuditJob,
  controlAuditJob,
  readActiveAuditJob,
  runAuditJobBatch,
  saveActiveAuditJob,
  startAuditJob,
} from "../audit-jobs.js";
import { auditJobStep } from "../audit-runner-state.js";

export function useAuditRunner({ copy, onComplete, onRefreshJobs, onError }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  function resetNow() {
    setLoading(false);
    setProgress(null);
    setCurrentJobId(null);
    setJobStatus(null);
    setStartedAt(null);
    setPauseCount(0);
    setElapsedMs(0);
  }

  function resetAfterRun() {
    window.setTimeout(resetNow, 250);
  }

  function begin(jobId, status, jobStartedAt) {
    setLoading(true);
    setCurrentJobId(jobId);
    setJobStatus(status);
    setStartedAt(jobStartedAt);
    setElapsedMs(Date.now() - jobStartedAt);
    setProgress({ label: copy.progressPreparing, value: 5, meta: "" });
    saveActiveAuditJob({ id: jobId, startedAt: jobStartedAt });
  }

  async function poll(jobId) {
    while (true) {
      let body;
      try {
        body = await runAuditJobBatch(jobId);
      } catch (error) {
        clearActiveAuditJob();
        throw error;
      }
      setJobStatus(body.status);
      const step = auditJobStep(body, copy);
      setProgress(step.progress);
      if (step.terminal === "done") {
        clearActiveAuditJob();
        onComplete(step.result);
        return;
      }
      if (step.terminal === "stopped") {
        clearActiveAuditJob();
        return;
      }
      if (step.terminal === "error") {
        clearActiveAuditJob();
        throw new Error(step.error);
      }
      await new Promise((resolve) => window.setTimeout(resolve, step.delayMs));
    }
  }

  async function start(request) {
    setLoading(true);
    setProgress({ label: copy.progressPreparing, value: 5, meta: "" });
    setPauseCount(0);
    setElapsedMs(0);
    try {
      const body = await startAuditJob(request);
      const jobStartedAt = Date.now();
      begin(body.id, body.status, jobStartedAt);
      await poll(body.id);
    } finally {
      resetAfterRun();
    }
  }

  async function continueJob(job) {
    const jobStartedAt = Number(job.createdAt) || Date.now();
    begin(job.id, job.status, jobStartedAt);
    try {
      if (["stopped", "error", "interrupted"].includes(job.status)) {
        await controlAuditJob(job.id, "restart", "Could not restart retained task");
      } else if (job.status === "paused") {
        await controlAuditJob(job.id, "resume", "Could not control retained task");
      }
      await poll(job.id);
    } finally {
      resetAfterRun();
      onRefreshJobs?.();
    }
  }

  async function control(action) {
    if (!currentJobId) return;
    const body = await controlAuditJob(currentJobId, action);
    if (action === "pause" && body.status === "paused") {
      setPauseCount((count) => count + 1);
    }
    setJobStatus(body.status);
  }

  function clearSavedJobIfActive(jobId) {
    if (currentJobId === jobId) clearActiveAuditJob();
  }

  useEffect(() => {
    if (!loading || !startedAt) return undefined;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [loading, startedAt]);

  useEffect(() => {
    const saved = readActiveAuditJob();
    if (!saved) return;
    begin(saved.id, null, saved.startedAt);
    poll(saved.id)
      .catch(onError)
      .finally(resetAfterRun);
  }, []);

  return {
    loading,
    progress,
    currentJobId,
    jobStatus,
    runtimeMeta: {
      startedAt,
      elapsedMs,
      stageElapsedMs: progress?.stageStartedAt ? Date.now() - progress.stageStartedAt : elapsedMs,
      pauseCount,
    },
    start,
    continueJob,
    control,
    clearSavedJobIfActive,
    reset: resetNow,
  };
}
