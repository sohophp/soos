const SITEMAP_BLOCKERS = new Set([
  "robots_disallow",
  "noindex",
  "http_error",
  "fetch_failed",
  "canonical_blocked",
  "canonical_cross_host",
  "not_html",
]);

const SITEMAP_SIGNAL_ISSUES = new Set([
  "redirect",
  "canonical_mismatch",
  "canonical_not_in_sitemap",
  "canonical_missing",
]);

export function inspectionCandidateKey(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function gscPage(row) {
  return String(row?.page || (row?.dimension === "page" ? row?.keys?.[0] || "" : ""));
}

export function buildUrlInspectionCandidates(report, gscRows = []) {
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

  for (const page of pages) {
    const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
    const demand = Number(gscByKey.get(inspectionCandidateKey(page.url))?.impressions) || 0;
    const blockerTypes = [...issueTypes].filter((type) => SITEMAP_BLOCKERS.has(type));
    const signalTypes = [...issueTypes].filter((type) => SITEMAP_SIGNAL_ISSUES.has(type));
    if (blockerTypes.length) add(page.url, 10, "sitemap", `technical_blocker:${blockerTypes.join(",")}`, demand);
    if (signalTypes.length) add(page.url, 15, "sitemap", `url_signal:${signalTypes.join(",")}`, demand);
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
