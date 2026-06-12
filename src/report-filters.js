import { normalizeReportUrl } from "./url-policy.js";

export const URL_SOURCE_FILTERS = ["all", "sitemap", "internal", "gsc", "google"];
export const URL_CHANGE_FILTERS = ["all", "regressed", "persistent", "improved", "unchanged", "unavailable"];
export const URL_FINDINGS_PAGE_SIZE = 50;

function normalizedUrl(value) {
  return normalizeReportUrl(value || "");
}

function addUrl(set, value) {
  const key = normalizedUrl(value);
  if (key) set.add(key);
}

function issueTypesByUrl(issueFingerprints) {
  const result = new Map();
  for (const item of issueFingerprints || []) {
    const url = normalizedUrl(item.url);
    if (!url || !item.type) continue;
    if (!result.has(url)) result.set(url, new Set());
    result.get(url).add(item.type);
  }
  return result;
}

export function buildUrlSourceSets(report, gscRows, inspectionResults) {
  const sitemap = new Set();
  const internal = new Set();
  const gsc = new Set();
  const google = new Set();

  for (const page of report?.pages || []) addUrl(sitemap, page.url);
  for (const page of [...(report?.pages || []), ...(report?.discoveredPages || [])]) {
    for (const link of page.internalLinks || []) addUrl(internal, link);
  }
  for (const page of report?.discoveredPages || []) addUrl(internal, page.url);
  for (const row of gscRows || []) addUrl(gsc, row.page || row.url);
  for (const item of inspectionResults || []) addUrl(google, item.url);

  return { sitemap, internal, gsc, google };
}

export function urlChangeState(page, comparisonEntry) {
  if (!comparisonEntry?.issueFingerprints) return "unavailable";
  const previousByUrl = issueTypesByUrl(comparisonEntry.issueFingerprints);
  const previousTypes = previousByUrl.get(normalizedUrl(page?.url)) || new Set();
  const currentTypes = new Set((page?.issues || []).map((issue) => issue.type).filter(Boolean));
  const newTypes = [...currentTypes].filter((type) => !previousTypes.has(type));
  const resolvedTypes = [...previousTypes].filter((type) => !currentTypes.has(type));

  if (newTypes.length) return "regressed";
  if (resolvedTypes.length) return "improved";
  if (currentTypes.size && [...currentTypes].every((type) => previousTypes.has(type))) return "persistent";
  return "unchanged";
}

export function pageMatchesUrlFilters(page, options) {
  const {
    severity = "all",
    issueType = "",
    query = "",
    source = "all",
    change = "all",
    sourceSets,
    comparisonEntry,
  } = options || {};

  if (severity === "ok" && (page.issues || []).length) return false;
  if (!["all", "ok"].includes(severity) && !(page.issues || []).some((issue) => issue.severity === severity)) return false;
  if (issueType && !(page.issues || []).some((issue) => issue.type === issueType)) return false;

  const urlKey = normalizedUrl(page.url);
  if (source !== "all" && !sourceSets?.[source]?.has(urlKey)) return false;
  if (change !== "all" && urlChangeState(page, comparisonEntry) !== change) return false;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const issueText = (page.issues || []).map((issue) => `${issue.type} ${issue.message} ${issue.detail || ""}`).join(" ");
  const reasonText = (page.googleReasons || []).map((reason) => `${reason.label} ${reason.detail}`).join(" ");
  return [
    page.url,
    page.finalUrl,
    page.canonical,
    page.title,
    page.description,
    issueText,
    reasonText,
  ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
}

export function urlFilterCounts(pages, sourceSets, comparisonEntry) {
  const counts = {
    sources: Object.fromEntries(URL_SOURCE_FILTERS.map((key) => [key, 0])),
    changes: Object.fromEntries(URL_CHANGE_FILTERS.map((key) => [key, 0])),
  };
  counts.sources.all = (pages || []).length;
  counts.changes.all = (pages || []).length;
  for (const page of pages || []) {
    const urlKey = normalizedUrl(page.url);
    for (const source of URL_SOURCE_FILTERS.slice(1)) {
      if (sourceSets?.[source]?.has(urlKey)) counts.sources[source] += 1;
    }
    counts.changes[urlChangeState(page, comparisonEntry)] += 1;
  }
  return counts;
}

export function paginateUrlFindings(pages, requestedPage, pageSize = URL_FINDINGS_PAGE_SIZE) {
  const safePageSize = Math.max(1, Number(pageSize) || URL_FINDINGS_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil((pages || []).length / safePageSize));
  const page = Math.min(pageCount, Math.max(1, Number(requestedPage) || 1));
  return {
    page,
    pageCount,
    items: (pages || []).slice((page - 1) * safePageSize, page * safePageSize),
  };
}
