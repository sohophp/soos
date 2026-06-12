import { normalizeReportUrl } from "./url-policy.js";

const SEVERITY_RANK = { notice: 1, warning: 2, critical: 3 };

export const COMPARISON_CONFIG_FIELDS = [
  "contentChecks",
  "performanceChecks",
  "internalCrawl",
  "robotsSource",
  "urlQueryPolicy",
  "trailingSlashPolicy",
  "maxUrls",
  "maxSitemaps",
];

function issueMap(items) {
  return new Map((items || []).map((item) => [item.key, item]));
}

export function reportIssueFingerprints(report) {
  return (report?.pages || []).flatMap((page) =>
    (page.issues || []).map((issue) => ({
      key: `${normalizeReportUrl(page.url)}|${issue.type}`,
      url: page.url,
      type: issue.type,
      severity: issue.severity,
    })),
  );
}

export function reportComparisonConfig(report) {
  const options = report?.options || {};
  const limits = report?.limits || {};
  return {
    contentChecks: Boolean(options.contentChecks),
    performanceChecks: Boolean(options.performanceChecks),
    internalCrawl: Boolean(options.internalCrawl),
    robotsSource: options.robotsSource || "root",
    urlQueryPolicy: options.urlQueryPolicy || "preserve",
    trailingSlashPolicy: options.trailingSlashPolicy || "preserve",
    maxUrls: Number(limits.maxUrls) || null,
    maxSitemaps: Number(limits.maxSitemaps) || null,
  };
}

export function compareIssueFingerprints(previousItems, currentItems) {
  const previous = issueMap(previousItems);
  const current = issueMap(currentItems);
  const introduced = [];
  const resolved = [];
  const worsened = [];
  const improved = [];
  const persistent = [];

  for (const [key, item] of current) {
    const before = previous.get(key);
    if (!before) {
      introduced.push(item);
      continue;
    }
    const beforeRank = SEVERITY_RANK[before.severity] || 0;
    const afterRank = SEVERITY_RANK[item.severity] || 0;
    const detail = { ...item, beforeSeverity: before.severity, afterSeverity: item.severity };
    if (afterRank > beforeRank) worsened.push(detail);
    else if (afterRank < beforeRank) improved.push(detail);
    else persistent.push(detail);
  }
  for (const [key, item] of previous) {
    if (!current.has(key)) resolved.push(item);
  }
  return { introduced, resolved, worsened, improved, persistent };
}

export function compareScanConfig(previousConfig, currentConfig) {
  if (!previousConfig) return { available: false, changes: [] };
  const changes = COMPARISON_CONFIG_FIELDS
    .filter((field) => previousConfig[field] !== currentConfig?.[field])
    .map((field) => ({
      field,
      before: previousConfig[field],
      after: currentConfig?.[field],
    }));
  return { available: true, changes };
}
