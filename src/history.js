import {
  compareIssueFingerprints,
  reportComparisonConfig,
  reportIssueFingerprints,
} from "./version-comparison.js";

export const HISTORY_KEY = "soos.auditHistory.v1";
export const HISTORY_LIMIT_KEY = "soos.auditHistory.limit.v1";
export const HISTORY_LIMIT_OPTIONS = [5, 10, 12, 20, 30];

export function loadHistory(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries, storage = globalThis.localStorage) {
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Ignore unavailable or full browser storage.
  }
}

export function loadHistoryLimit(storage = globalThis.localStorage) {
  try {
    const raw = Number(storage?.getItem(HISTORY_LIMIT_KEY) || 12);
    return HISTORY_LIMIT_OPTIONS.includes(raw) ? raw : 12;
  } catch {
    return 12;
  }
}

export function saveHistoryLimit(limit, storage = globalThis.localStorage) {
  try {
    storage?.setItem(HISTORY_LIMIT_KEY, String(limit));
  } catch {
    // Ignore unavailable or full browser storage.
  }
}

export function toHistoryEntry(report, now = Date.now, random = Math.random) {
  return {
    id: `${now().toString(36)}-${random().toString(36).slice(2, 8)}`,
    scannedAt: report.scannedAt,
    input: report.input,
    summary: report.summary,
    executiveSummary: report.executiveSummary,
    statusFlags: report.statusFlags,
    scanConfig: reportComparisonConfig(report),
    issueFingerprints: reportIssueFingerprints(report).slice(0, 10000),
  };
}

export function trendLabel(current, previous, copy) {
  if (previous == null || current == null) return null;
  if (current > previous) return copy.trendUp;
  if (current < previous) return copy.trendDown;
  return copy.trendFlat;
}

export function buildIssueDelta(previousEntry, currentReport) {
  if (!previousEntry || !currentReport) {
    return {
      improved: [],
      worsened: [],
      introduced: [],
      resolved: [],
      severityWorsened: [],
      severityImproved: [],
      persistent: [],
    };
  }

  const previousCounts = previousEntry.summary?.issueCounts || {};
  const currentCounts = currentReport.summary?.issueCounts || {};
  const improved = [];
  const worsened = [];

  for (const severity of ["critical", "warning", "notice"]) {
    const before = previousCounts[severity] || 0;
    const after = currentCounts[severity] || 0;
    if (after < before) improved.push({ severity, delta: before - after });
    else if (after > before) worsened.push({ severity, delta: after - before });
  }

  const details = compareIssueFingerprints(
    previousEntry.issueFingerprints || [],
    reportIssueFingerprints(currentReport),
  );
  return {
    improved,
    worsened,
    introduced: details.introduced,
    resolved: details.resolved,
    severityWorsened: details.worsened,
    severityImproved: details.improved,
    persistent: details.persistent,
  };
}

function summarizeCategoryCounts(reportLike) {
  const counts = {
    robots: 0,
    sitemap: 0,
    canonical: 0,
    international: 0,
    content: 0,
    fetch: 0,
  };
  for (const flag of reportLike?.statusFlags || []) {
    if (flag.key === "robots_blocked") counts.robots += 1;
    if (flag.key === "sitemap_misaligned") counts.sitemap += 1;
    if (flag.key === "canonical_conflict") counts.canonical += 1;
    if (flag.key === "international_mismatch") counts.international += 1;
  }
  return counts;
}

export function buildCategoryDelta(previousEntry, currentReport) {
  const previous = summarizeCategoryCounts(previousEntry);
  const current = summarizeCategoryCounts(currentReport);
  return ["robots", "sitemap", "canonical", "international", "content", "fetch"]
    .map((key) => ({
      key,
      before: previous[key] || 0,
      after: current[key] || 0,
      delta: (current[key] || 0) - (previous[key] || 0),
    }))
    .filter((item) => item.before !== item.after);
}
