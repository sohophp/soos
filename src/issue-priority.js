export const SEVERITY_WEIGHTS = {
  critical: 500,
  high: 380,
  medium: 240,
  low: 120,
  info: 40,
};

export const CATEGORY_WEIGHTS = {
  indexability: 160,
  crawlability: 150,
  canonical: 130,
  sitemap: 115,
  redirect: 110,
  hreflang: 80,
  internal_links: 75,
  structured_data: 65,
  search_visibility: 60,
  googlebot: 60,
  performance: 45,
  content: 30,
};

export function affectedUrlWeight(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  if (safeCount >= 500) return 140;
  if (safeCount >= 100) return 110;
  if (safeCount >= 25) return 80;
  if (safeCount >= 5) return 45;
  if (safeCount >= 1) return 15;
  return 0;
}

export function searchVisibilityWeight(metrics = {}) {
  const impressions = Math.max(0, Number(metrics.impressions) || 0);
  const clicks = Math.max(0, Number(metrics.clicks) || 0);
  if (clicks >= 20 || impressions >= 5000) return 100;
  if (clicks >= 5 || impressions >= 1000) return 70;
  if (clicks > 0 || impressions >= 100) return 40;
  return 0;
}

export function confidenceWeight(confidence) {
  if (confidence === "confirmed") return 70;
  if (confidence === "likely") return 30;
  return 0;
}

export function regressionWeight(change = "") {
  if (change === "new" || change === "worsened" || change === "regressed") return 55;
  if (change === "persistent") return 15;
  if (change === "resolved" || change === "improved") return -80;
  return 0;
}

export function priorityBreakdown(issue) {
  const severity = SEVERITY_WEIGHTS[issue?.severity] || 0;
  const category = CATEGORY_WEIGHTS[issue?.category] || 0;
  const affectedUrls = affectedUrlWeight(issue?.affectedUrlCount);
  const searchVisibility = searchVisibilityWeight(issue?.searchVisibility);
  const googleConfirmed = issue?.sourceCapabilities?.includes("google") && issue?.confidence === "confirmed" ? 90 : 0;
  const confidence = confidenceWeight(issue?.confidence);
  const regression = regressionWeight(issue?.changeState || issue?.historyState);
  const indexability = ["indexability", "crawlability", "canonical"].includes(issue?.category) ? 70 : 0;
  return {
    severity,
    category,
    affectedUrls,
    searchVisibility,
    indexability,
    googleConfirmed,
    confidence,
    regression,
  };
}

export function scoreIssuePriority(issue) {
  const breakdown = priorityBreakdown(issue);
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return Math.max(0, Math.round(total));
}

export function sortIssuesByPriority(issues) {
  return [...(issues || [])].sort((a, b) => (
    (b.priorityScore || 0) - (a.priorityScore || 0)
    || (b.affectedUrlCount || 0) - (a.affectedUrlCount || 0)
    || String(a.title || "").localeCompare(String(b.title || ""))
  ));
}
