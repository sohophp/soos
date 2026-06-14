import { normalizeReportUrl } from "./url-policy.js";
import { gscSupportingText } from "./i18n.js";

export function buildGscRowMap(rows) {
  return new Map((rows || []).map((row) => [row.key, row]));
}

export function uniqueGscRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.key || normalizeReportUrl(row.page || "");
    if (!key) continue;
    const current = byKey.get(key);
    if (!current || (row.impressions || 0) > (current.impressions || 0)) {
      byKey.set(key, row.key === key ? row : { ...row, key });
    }
  }
  return [...byKey.values()];
}

export function isTechnicallyIndexablePage(page) {
  const blockers = new Set([
    "fetch_failed",
    "http_error",
    "robots_disallow",
    "noindex",
    "canonical_blocked",
    "canonical_cross_host",
    "canonical_conflict",
    "canonical_invalid",
    "canonical_header_mismatch",
    "canonical_mismatch",
  ]);
  return !(page.issues || []).some((issue) => blockers.has(issue.type));
}

export function buildGscOpportunities(report, rows, language = "en") {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const pages = report?.pages || [];
  const gscRows = uniqueGscRows(rows);
  if (!gscRows.length || !pages.length) return [];

  const gscByUrl = buildGscRowMap(gscRows);
  const sitemapKeys = new Set(pages.map((page) => normalizeReportUrl(page.url)));
  const technicallyIndexableNoImpressions = pages
    .filter((page) => isTechnicallyIndexablePage(page))
    .filter((page) => (gscByUrl.get(normalizeReportUrl(page.url))?.impressions || 0) === 0);
  const lowRanking = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    return row && isTechnicallyIndexablePage(page) && (row.impressions || 0) > 0 && typeof row.position === "number" && row.position > 20;
  });
  const lowCtr = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    if (!row || !isTechnicallyIndexablePage(page) || (row.impressions || 0) < 100) return false;
    const ctr = row.clicks != null && row.impressions ? row.clicks / row.impressions : null;
    return ctr != null && ctr < 0.01;
  });
  const blockedWithVisibility = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    return row && (row.impressions || 0) > 0 && !isTechnicallyIndexablePage(page);
  });
  const gscNotInSitemap = gscRows.filter((row) => !sitemapKeys.has(row.key));

  const makeItem = (key, title, severity, urls, detail) => ({
    key,
    title,
    severity,
    count: urls.length,
    detail,
    sampleUrls: urls.slice(0, 5).map((item) => item.url || item.page),
  });

  return [
    makeItem(
      "indexable_no_impressions",
      copy.indexableNoImpressions[0],
      "warning",
      technicallyIndexableNoImpressions,
      copy.indexableNoImpressions[1],
    ),
    makeItem("low_ranking", copy.lowRanking[0], "notice", lowRanking, copy.lowRanking[1]),
    makeItem("low_ctr", copy.lowCtr[0], "notice", lowCtr, copy.lowCtr[1]),
    makeItem(
      "blocked_with_visibility",
      copy.blockedVisibility[0],
      "critical",
      blockedWithVisibility,
      copy.blockedVisibility[1],
    ),
    makeItem("gsc_not_in_sitemap", copy.missingSitemap[0], "notice", gscNotInSitemap, copy.missingSitemap[1]),
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const severityRank = { critical: 3, warning: 2, notice: 1 };
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.count - a.count;
    });
}

export function buildSearchVisibility(report) {
  const pages = report?.pages || [];
  const hasIssue = (page, types) => page.issues?.some((issue) => types.includes(issue.type));
  const hardBlockers = [
    "fetch_failed",
    "http_error",
    "robots_disallow",
    "noindex",
    "canonical_blocked",
    "canonical_cross_host",
  ];
  const canonicalNotSelected = ["canonical_mismatch"];
  const hardBlocked = pages.filter((page) => hasIssue(page, hardBlockers));
  const canonicalized = pages.filter((page) => hasIssue(page, canonicalNotSelected));
  const technicallyIndexable = pages.filter((page) => !hasIssue(page, hardBlockers) && !hasIssue(page, canonicalNotSelected));
  const total = pages.length || 0;
  const readiness = total ? Math.round((technicallyIndexable.length / total) * 100) : 0;
  return {
    total,
    readiness,
    technicallyIndexable: technicallyIndexable.length,
    hardBlocked: hardBlocked.length,
    canonicalized: canonicalized.length,
  };
}
