export const ISSUE_STATUSES = Object.freeze(["open", "resolved", "ignored"]);

function sitePart(report) {
  const site = report?.input?.siteRootUrl || report?.input?.originalUrl || "unknown-site";
  return String(site)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown-site";
}

export function issueStatusStorageKey(report) {
  return `soos:issue-status:${sitePart(report)}`;
}

export function normalizeIssueStatus(value) {
  return ISSUE_STATUSES.includes(value) ? value : "open";
}

export function loadIssueStatuses(report, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(issueStatusStorageKey(report));
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.fromEntries(Object.entries(parsed)
      .map(([fingerprint, status]) => [fingerprint, normalizeIssueStatus(status)])
      .filter(([fingerprint]) => fingerprint));
  } catch {
    return {};
  }
}

export function saveIssueStatuses(report, statuses, storage = globalThis.localStorage) {
  const normalized = Object.fromEntries(Object.entries(statuses || {})
    .map(([fingerprint, status]) => [fingerprint, normalizeIssueStatus(status)])
    .filter(([fingerprint, status]) => fingerprint && status !== "open"));
  storage?.setItem(issueStatusStorageKey(report), JSON.stringify(normalized));
  return normalized;
}

export function setIssueStatus(statuses, fingerprint, status) {
  if (!fingerprint) return { ...(statuses || {}) };
  const next = { ...(statuses || {}) };
  const normalized = normalizeIssueStatus(status);
  if (normalized === "open") delete next[fingerprint];
  else next[fingerprint] = normalized;
  return next;
}

export function applyIssueStatuses(issues, statuses = {}) {
  return (issues || []).map((issue) => ({
    ...issue,
    status: normalizeIssueStatus(statuses[issue.fingerprint] || issue.status),
  }));
}
