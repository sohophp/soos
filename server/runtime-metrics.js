function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function durationSummary(totalMs, count, maxMs) {
  return {
    averageMs: count ? Math.round(totalMs / count) : 0,
    maxMs,
  };
}

export function createRuntimeMetrics(now = Date.now()) {
  const startedAt = now;
  const http = { requests: 0, errors: 0, serverErrors: 0, totalMs: 0, maxMs: 0 };
  const google = { requests: 0, failures: 0, totalMs: 0, maxMs: 0, services: new Map() };
  const audits = { started: 0, completed: 0, failed: 0, stopped: 0, totalMs: 0, maxMs: 0 };
  const auditStates = new Map();

  return {
    recordHttp(entry = {}) {
      const durationMs = Math.max(0, Number(entry.durationMs) || 0);
      const status = Number(entry.status) || 0;
      http.requests += 1;
      http.totalMs += durationMs;
      http.maxMs = Math.max(http.maxMs, durationMs);
      if (status >= 400) http.errors += 1;
      if (status >= 500) http.serverErrors += 1;
    },
    recordGoogle(service, ok, durationMs = 0) {
      const name = String(service || "unknown");
      const elapsed = Math.max(0, Number(durationMs) || 0);
      const current = google.services.get(name) || { requests: 0, failures: 0 };
      current.requests += 1;
      if (!ok) current.failures += 1;
      google.services.set(name, current);
      google.requests += 1;
      if (!ok) google.failures += 1;
      google.totalMs += elapsed;
      google.maxMs = Math.max(google.maxMs, elapsed);
    },
    recordAuditStarted(id) {
      const key = String(id || "");
      if (!key || auditStates.has(key)) return;
      auditStates.set(key, "started");
      audits.started += 1;
    },
    recordAuditFinished(id, status, durationMs = 0) {
      const key = String(id || "");
      if (!key || ["completed", "failed", "stopped"].includes(auditStates.get(key))) return;
      if (!auditStates.has(key)) audits.started += 1;
      auditStates.set(key, status);
      if (status === "completed") audits.completed += 1;
      else if (status === "stopped") audits.stopped += 1;
      else audits.failed += 1;
      const elapsed = Math.max(0, Number(durationMs) || 0);
      audits.totalMs += elapsed;
      audits.maxMs = Math.max(audits.maxMs, elapsed);
      if (auditStates.size > 5000) {
        const firstKey = auditStates.keys().next().value;
        auditStates.delete(firstKey);
      }
    },
    snapshot(currentTime = Date.now()) {
      const terminal = audits.completed + audits.failed + audits.stopped;
      return {
        startedAt: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.max(0, Math.floor((currentTime - startedAt) / 1000)),
        http: {
          requests: http.requests,
          errors: http.errors,
          serverErrors: http.serverErrors,
          errorRate: ratio(http.errors, http.requests),
          duration: durationSummary(http.totalMs, http.requests, http.maxMs),
        },
        google: {
          requests: google.requests,
          failures: google.failures,
          failureRate: ratio(google.failures, google.requests),
          duration: durationSummary(google.totalMs, google.requests, google.maxMs),
          services: Object.fromEntries([...google.services.entries()].sort(([a], [b]) => a.localeCompare(b))),
        },
        audits: {
          started: audits.started,
          completed: audits.completed,
          failed: audits.failed,
          stopped: audits.stopped,
          completionRate: ratio(audits.completed, terminal),
          duration: durationSummary(audits.totalMs, terminal, audits.maxMs),
        },
      };
    },
  };
}
