import { buildInternalLinkGraph } from "./link-graph.js";
import { canonicalAuditUrl } from "./url-policy.js";
import {
  compareIssueFingerprints,
  reportIssueFingerprints,
} from "./version-comparison.js";

const SITEMAP_BLOCKERS = new Set([
  "robots_disallow",
  "noindex",
  "http_error",
  "fetch_failed",
  "canonical_blocked",
  "canonical_cross_host",
  "canonical_conflict",
  "canonical_invalid",
  "canonical_header_mismatch",
  "not_html",
  "redirect_loop",
  "redirect_invalid_location",
  "redirect_limit",
  "redirect_https_downgrade",
]);

const SITEMAP_SIGNAL_ISSUES = new Set([
  "redirect",
  "canonical_mismatch",
  "canonical_not_in_sitemap",
  "canonical_missing",
  "canonical_multiple",
  "redirect_chain",
  "redirect_cross_host",
]);

export function inspectionCandidateKey(value) {
  return canonicalAuditUrl(value).replace(/\/$/, "");
}

function gscPage(row) {
  return String(row?.page || (row?.dimension === "page" ? row?.keys?.[0] || "" : ""));
}

export function buildUrlInspectionCandidates(report, gscRows = [], comparisonEntry = null) {
  const pages = Array.isArray(report?.pages) ? report.pages : [];
  const discoveredPages = Array.isArray(report?.discoveredPages) ? report.discoveredPages : [];
  const allScannedPages = [...pages, ...discoveredPages];
  const sitemapKeys = new Set(pages.map((page) => inspectionCandidateKey(page.url)).filter(Boolean));
  const candidates = new Map();

  function add(url, priority, source, reason, demand = 0) {
    const key = inspectionCandidateKey(url);
    if (!key) return;
    const current = candidates.get(key) || {
      url: String(url),
      key,
      priority,
      sources: [],
      reasons: [],
      demand: 0,
    };
    current.priority = Math.min(current.priority, priority);
    current.demand = Math.max(current.demand, Number(demand) || 0);
    if (!current.sources.includes(source)) current.sources.push(source);
    if (!current.reasons.includes(reason)) current.reasons.push(reason);
    candidates.set(key, current);
  }

  const gscByKey = new Map();
  for (const row of gscRows || []) {
    const page = gscPage(row);
    const key = inspectionCandidateKey(page);
    if (!key) continue;
    const demand = Number(row?.impressions) || 0;
    const current = gscByKey.get(key);
    if (!current || demand > (Number(current.impressions) || 0)) gscByKey.set(key, { ...row, page });
  }

  if (comparisonEntry?.issueFingerprints) {
    const delta = compareIssueFingerprints(
      comparisonEntry.issueFingerprints,
      reportIssueFingerprints(report),
    );
    for (const item of delta.worsened) {
      add(item.url, 4, "history", `history_severity_worsened:${item.type}`);
    }
    for (const item of delta.introduced) {
      add(item.url, 6, "history", `history_issue_introduced:${item.type}`);
    }
  }

  if (Array.isArray(comparisonEntry?.pageUrls)) {
    const previousPageKeys = new Set(
      comparisonEntry.pageUrls.map((url) => inspectionCandidateKey(url)).filter(Boolean),
    );
    for (const page of pages) {
      if (!previousPageKeys.has(inspectionCandidateKey(page.url))) {
        add(page.url, 8, "history", "history_new_page");
      }
    }
  }

  for (const page of pages) {
    const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
    const demand = Number(gscByKey.get(inspectionCandidateKey(page.url))?.impressions) || 0;
    const blockerTypes = [...issueTypes].filter((type) => SITEMAP_BLOCKERS.has(type));
    const signalTypes = [...issueTypes].filter((type) => SITEMAP_SIGNAL_ISSUES.has(type));
    if (blockerTypes.length) add(page.url, 10, "sitemap", `technical_blocker:${blockerTypes.join(",")}`, demand);
    if (signalTypes.length) add(page.url, 15, "sitemap", `url_signal:${signalTypes.join(",")}`, demand);
  }

  const linkGraph = buildInternalLinkGraph(report);
  for (const row of linkGraph.rows) {
    if (row.state === "unreachable") add(row.url, 12, "internal", "homepage_unreachable");
    else if (row.clickDepth != null && row.clickDepth >= 3) add(row.url, 35, "internal", "homepage_deep");
  }

  for (const [key, row] of gscByKey) {
    if (!sitemapKeys.has(key)) {
      add(row.page, 20, "gsc", "gsc_missing_sitemap", row.impressions);
    }
  }

  for (const page of allScannedPages) {
    for (const link of page.internalLinks || []) {
      const key = inspectionCandidateKey(link);
      if (key && !sitemapKeys.has(key)) add(link, 30, "internal", "internal_missing_sitemap");
    }
  }

  for (const page of discoveredPages) {
    const key = inspectionCandidateKey(page.url);
    if (key && !sitemapKeys.has(key)) add(page.url, 25, "internal", "internal_missing_sitemap");
  }

  for (const page of pages) {
    const key = inspectionCandidateKey(page.url);
    const demand = Number(gscByKey.get(key)?.impressions) || 0;
    if (!demand) add(page.url, 40, "sitemap", "sitemap_no_gsc_impressions");
    else add(page.url, 50, "sitemap", "sitemap_baseline", demand);
  }

  return [...candidates.values()].sort((a, b) => (
    a.priority - b.priority
    || b.demand - a.demand
    || a.url.localeCompare(b.url)
  ));
}
