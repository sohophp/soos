import { useEffect, useState } from "react";
import {
  getAuditJob,
  listAuditJobs,
  removeAuditJob,
} from "../audit-jobs.js";
import {
  EMPTY_RETAINED_JOBS_META,
  normalizeRetainedJobsResponse,
} from "../retained-jobs-state.js";

export function useRetainedJobs({ onOpenReport, onDeleteActiveJob }) {
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState(EMPTY_RETAINED_JOBS_META);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(overrides = {}) {
    setLoading(true);
    try {
      const body = await listAuditJobs({
        page: overrides.page || meta.page || 1,
        pageSize: meta.pageSize || 10,
        query: overrides.query ?? query,
        status: overrides.status ?? status,
      });
      const normalized = normalizeRetainedJobsResponse(body);
      setJobs(normalized.jobs);
      setMeta(normalized.meta);
      return body;
    } finally {
      setLoading(false);
    }
  }

  async function open(jobId) {
    const body = await getAuditJob(jobId);
    if (!body.result) throw new Error("This task does not have a completed report.");
    onOpenReport(body.result);
  }

  async function remove(jobId) {
    await removeAuditJob(jobId);
    onDeleteActiveJob?.(jobId);
    await load();
  }

  function reset() {
    setJobs([]);
    setMeta(EMPTY_RETAINED_JOBS_META);
    setQuery("");
    setStatus("");
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return {
    jobs,
    meta,
    query,
    status,
    loading,
    setQuery,
    setStatus,
    load,
    open,
    remove,
    reset,
  };
}
