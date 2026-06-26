import { fixInstructionFor, verificationFor } from "./fix-instructions.js";
import { scoreIssuePriority, sortIssuesByPriority } from "./issue-priority.js";
import { normalizeReportUrl } from "./url-policy.js";

const CATEGORY_BY_TYPE = {
  robots_disallow: "crawlability",
  canonical_blocked: "crawlability",
  alternate_blocked: "crawlability",
  fetch_failed: "crawlability",
  http_error: "indexability",
  noindex: "indexability",
  not_html: "indexability",
  redirect: "redirect",
  redirect_chain: "redirect",
  redirect_loop: "redirect",
  redirect_invalid_location: "redirect",
  redirect_limit: "redirect",
  redirect_cross_host: "redirect",
  redirect_https_downgrade: "redirect",
  canonical_missing: "canonical",
  canonical_mismatch: "canonical",
  canonical_not_in_sitemap: "canonical",
  canonical_cross_host: "canonical",
  canonical_conflict: "canonical",
  canonical_multiple: "canonical",
  canonical_invalid: "canonical",
  canonical_header_mismatch: "canonical",
  alternate_invalid: "hreflang",
  alternate_hreflang_invalid: "hreflang",
  alternate_duplicate_language: "hreflang",
  alternate_duplicate_target: "hreflang",
  alternate_not_reciprocal: "hreflang",
  alternate_target_canonical_mismatch: "hreflang",
  alternate_self_missing: "hreflang",
  internal_missing_sitemap: "sitemap",
  gsc_missing_sitemap: "sitemap",
  google_missing_sitemap: "sitemap",
  sitemap_orphan: "internal_links",
  unreachable_sitemap: "internal_links",
  google_missing_referrer: "internal_links",
  title_missing: "content",
  title_short: "content",
  title_long: "content",
  title_duplicate: "content",
  description_missing: "content",
  description_short: "content",
  description_long: "content",
  description_duplicate: "content",
  h1_missing: "content",
  h1_multiple: "content",
  html_lang_missing: "content",
  viewport_missing: "content",
  structured_data_invalid: "structured_data",
  structured_data_validation: "structured_data",
  structured_data_recommended: "structured_data",
  rich_results: "structured_data",
  low_ctr: "search_visibility",
  snippet_gap: "search_visibility",
  cannibalization: "search_visibility",
  branded_cannibalization: "search_visibility",
  local_cannibalization: "search_visibility",
  navigational_cannibalization: "search_visibility",
  stale_google_crawl: "googlebot",
  perf_ttfb_slow: "performance",
  perf_html_large: "performance",
  perf_many_scripts: "performance",
  perf_many_stylesheets: "performance",
  perf_many_images: "performance",
  google_selected_canonical_differs: "canonical",
  google_not_indexed: "indexability",
};

const HIGH_IMPACT_TYPES = new Set([
  "robots_disallow",
  "canonical_blocked",
  "fetch_failed",
  "http_error",
  "noindex",
  "not_html",
  "redirect_loop",
  "redirect_invalid_location",
  "redirect_limit",
  "redirect_https_downgrade",
  "canonical_conflict",
  "canonical_header_mismatch",
  "google_selected_canonical_differs",
  "google_not_indexed",
]);

const TITLE_BY_TYPE = {
  robots_disallow: "Sitemap URLs blocked by robots.txt",
  noindex: "Sitemap URLs marked noindex",
  http_error: "Sitemap URLs return HTTP errors",
  fetch_failed: "Submitted URLs cannot be fetched",
  redirect: "Sitemap URLs redirect before the final page",
  redirect_chain: "Redirect chains are longer than necessary",
  redirect_loop: "Redirect loops block crawlers",
  redirect_limit: "Redirect chains exceed the crawl limit",
  redirect_https_downgrade: "Redirect chains downgrade HTTPS to HTTP",
  canonical_mismatch: "Submitted URLs canonicalize elsewhere",
  canonical_not_in_sitemap: "Canonical targets are missing from the sitemap",
  canonical_conflict: "Canonical declarations conflict",
  canonical_header_mismatch: "HTML and HTTP canonical declarations disagree",
  canonical_multiple: "Pages expose multiple canonical declarations",
  alternate_not_reciprocal: "Hreflang alternates do not link back",
  alternate_target_canonical_mismatch: "Hreflang targets canonicalize elsewhere",
  internal_missing_sitemap: "Indexable internal URLs are missing from the sitemap",
  sitemap_orphan: "Sitemap URLs have no detected internal links",
  unreachable_sitemap: "Sitemap pages are not reachable from the homepage crawl",
  low_ctr: "High impressions with low CTR",
  stale_google_crawl: "Important pages have stale Google crawl signals",
  structured_data_invalid: "Invalid JSON-LD structured data",
  structured_data_validation: "Structured data validation issues",
  google_selected_canonical_differs: "Google selected a different canonical",
  google_not_indexed: "Google reports URLs are not indexed",
};

function stablePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "issue";
}

export function issueFingerprint({ type, category, evidence = [] }) {
  const firstEvidence = evidence[0]?.url || evidence[0]?.detail || "";
  return `${category || "unknown"}:${type}:${stablePart(firstEvidence)}`;
}

export function classifyIssueConfidence({ type, sourceCapabilities = [], evidence = [] }) {
  if (sourceCapabilities.includes("google")) return "confirmed";
  if (evidence.some((item) => item.source === "google")) return "confirmed";
  if (sourceCapabilities.includes("scan") || evidence.some((item) => item.source === "scan")) {
    return "likely";
  }
  return "inferred";
}

export function normalizeIssueSeverity(severity, type) {
  if (HIGH_IMPACT_TYPES.has(type)) return "critical";
  if (severity === "critical") return "critical";
  if (severity === "warning") return "medium";
  if (severity === "notice") return "low";
  if (["critical", "high", "medium", "low", "info"].includes(severity)) return severity;
  return "info";
}

function summarizeIssue(type, category, count) {
  const readableType = type.replace(/_/g, " ");
  const title = TITLE_BY_TYPE[type] || `${readableType[0]?.toUpperCase() || "I"}${readableType.slice(1)}`;
  return {
    title,
    summary: `${count} affected URL${count === 1 ? "" : "s"} need ${category.replace(/_/g, " ")} review.`,
  };
}

function impactFor(category, type) {
  if (["indexability", "crawlability"].includes(category)) {
    return "This can prevent important pages from being crawled or indexed.";
  }
  if (category === "canonical") {
    return "Conflicting canonical signals can cause Google to index or rank a different URL than intended.";
  }
  if (category === "redirect") {
    return "Redirect problems waste crawl signals and can stop crawlers from reaching a stable final URL.";
  }
  if (category === "sitemap") {
    return "Sitemaps should describe the canonical URLs that are worth crawling and indexing.";
  }
  if (category === "hreflang") {
    return "Broken hreflang clusters can weaken international targeting and canonical consolidation.";
  }
  if (category === "search_visibility") {
    return "Google data shows search demand where the current result may not earn its available clicks.";
  }
  if (category === "googlebot") {
    return "Google crawl evidence suggests important URLs may need verification or stronger crawl signals.";
  }
  if (category === "structured_data") {
    return "Invalid or incomplete structured data can reduce rich result eligibility.";
  }
  if (type.startsWith("perf_")) {
    return "Performance signals can affect crawling efficiency and user experience, but should not outrank indexability blockers.";
  }
  return "This is a supporting technical SEO cleanup item and should be prioritized after indexing and crawl blockers.";
}

function evidenceFromPageIssue(page, issue, scannedAt) {
  return {
    source: "scan",
    confidence: "likely",
    label: issue.message || issue.type,
    url: page.url,
    detail: issue.detail || page.finalUrl || page.canonical || "",
    observedAt: scannedAt || "",
  };
}

function groupPageIssues(report) {
  const groups = new Map();
  for (const page of report?.pages || []) {
    for (const issue of page.issues || []) {
      const type = issue.type;
      const category = CATEGORY_BY_TYPE[type] || "content";
      const key = `${category}:${type}`;
      if (!groups.has(key)) {
        groups.set(key, {
          type,
          category,
          rawSeverity: issue.severity,
          urls: new Set(),
          evidence: [],
        });
      }
      const group = groups.get(key);
      group.urls.add(page.url);
      if (group.evidence.length < 12) group.evidence.push(evidenceFromPageIssue(page, issue, report?.scannedAt));
      if (issue.severity === "critical") group.rawSeverity = "critical";
      else if (issue.severity === "warning" && group.rawSeverity !== "critical") group.rawSeverity = "warning";
    }
  }
  return groups;
}

function searchMetricsForUrls(urls, gscRows = []) {
  const keys = new Set([...urls].map(normalizeReportUrl).filter(Boolean));
  return (gscRows || []).reduce((total, row) => {
    const key = normalizeReportUrl(row.page || row.url || row.key || "");
    if (!key || !keys.has(key)) return total;
    total.clicks += Number(row.clicks) || 0;
    total.impressions += Number(row.impressions) || 0;
    return total;
  }, { clicks: 0, impressions: 0 });
}

function toSeoIssue(group, context = {}) {
  const affectedUrls = [...group.urls].filter(Boolean);
  const severity = normalizeIssueSeverity(group.rawSeverity, group.type);
  const sourceCapabilities = group.sourceCapabilities || ["scan"];
  const confidence = classifyIssueConfidence({
    type: group.type,
    sourceCapabilities,
    evidence: group.evidence,
  });
  const category = group.category || CATEGORY_BY_TYPE[group.type] || "content";
  const { title, summary } = summarizeIssue(group.type, category, affectedUrls.length);
  const recommendedFix = fixInstructionFor(group.type);
  const issue = {
    id: `${category}-${stablePart(group.type)}`,
    fingerprint: issueFingerprint({ type: group.type, category, evidence: group.evidence }),
    type: group.type,
    category,
    severity,
    priorityScore: 0,
    confidence,
    title: group.title || title,
    summary: group.summary || summary,
    impact: group.impact || impactFor(category, group.type),
    evidence: group.evidence || [],
    affectedUrlCount: affectedUrls.length,
    affectedUrls: affectedUrls.slice(0, 500),
    recommendedFix,
    verification: verificationFor(group.type, { requiresGoogleData: sourceCapabilities.includes("google") }),
    sourceCapabilities,
    searchVisibility: group.searchVisibility || searchMetricsForUrls(affectedUrls, context.gscRows),
    status: "open",
  };
  issue.priorityScore = scoreIssuePriority(issue);
  return issue;
}

export function normalizeReportIssues(report, context = {}) {
  const groups = groupPageIssues(report);
  for (const issue of normalizeGoogleInspectionIssues(report, context.inspectionResults || [])) {
    const key = `${issue.category}:${issue.type}`;
    const existing = groups.get(key);
    if (existing) {
      for (const url of issue.affectedUrls || []) existing.urls.add(url);
      existing.evidence = [...(existing.evidence || []), ...(issue.evidence || [])].slice(0, 50);
      existing.sourceCapabilities = [...new Set([...(existing.sourceCapabilities || []), ...(issue.sourceCapabilities || [])])];
      if (issue.severity === "critical") existing.rawSeverity = "critical";
    } else {
      groups.set(key, {
        type: issue.type,
        category: issue.category,
        rawSeverity: issue.severity,
        urls: new Set(issue.affectedUrls),
        evidence: issue.evidence,
        sourceCapabilities: issue.sourceCapabilities,
        title: issue.title,
        summary: issue.summary,
        impact: issue.impact,
      });
    }
  }
  for (const issue of normalizeSearchInsightIssues(context.searchInsights || [])) {
    groups.set(`${issue.category}:${issue.type}:${stablePart(issue.evidence[0]?.detail)}`, {
      type: issue.type,
      category: issue.category,
      rawSeverity: issue.severity,
      urls: new Set(issue.affectedUrls),
      evidence: issue.evidence,
      sourceCapabilities: issue.sourceCapabilities,
      title: issue.title,
      summary: issue.summary,
      impact: issue.impact,
      searchVisibility: issue.searchVisibility,
    });
  }
  return sortIssuesByPriority([...groups.values()].map((group) => toSeoIssue(group, context)));
}

export function normalizeGoogleInspectionIssues(report, inspectionResults = []) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  const issues = [];
  for (const item of inspectionResults || []) {
    if (!item?.ok) continue;
    const submittedKey = normalizeReportUrl(item.url);
    const googleCanonicalKey = normalizeReportUrl(item.googleCanonical || "");
    const userCanonicalKey = normalizeReportUrl(item.userCanonical || "");
    const page = pagesByUrl.get(submittedKey);
    const localCanonical = page?.canonical || item.userCanonical || "";
    if (googleCanonicalKey && submittedKey && googleCanonicalKey !== submittedKey && googleCanonicalKey !== normalizeReportUrl(localCanonical)) {
      issues.push({
        type: "google_selected_canonical_differs",
        category: "canonical",
        severity: "high",
        title: "Google selected a different canonical",
        summary: "Google URL Inspection reports a canonical that differs from the submitted or declared canonical URL.",
        impact: "Google has confirmed that its selected canonical may not match the URL you expect to index or rank.",
        affectedUrls: [item.url],
        sourceCapabilities: ["google", "scan"],
        evidence: [{
          source: "google",
          confidence: "confirmed",
          label: "Google selected canonical",
          url: item.url,
          detail: `Google: ${item.googleCanonical} | User canonical: ${item.userCanonical || localCanonical || ""}`,
          observedAt: item.inspectedAt || report?.scannedAt || "",
        }],
      });
    }
    const verdict = String(item.verdict || "").toUpperCase();
    const coverage = String(item.coverageState || "");
    if (verdict === "FAIL" || /not indexed|excluded/i.test(coverage)) {
      issues.push({
        type: "google_not_indexed",
        category: "indexability",
        severity: "critical",
        title: "Google reports affected URLs are not indexed",
        summary: "URL Inspection confirms that Google is not indexing sampled affected URLs.",
        impact: "This is Google-confirmed evidence, but it applies only to inspected URLs and must not be treated as full-site coverage.",
        affectedUrls: [item.url],
        sourceCapabilities: ["google"],
        evidence: [{
          source: "google",
          confidence: "confirmed",
          label: "URL Inspection coverage",
          url: item.url,
          detail: coverage || item.verdict || "",
          observedAt: item.inspectedAt || report?.scannedAt || "",
        }],
      });
    }
  }
  return issues;
}

function extractInsightUrls(insight = {}) {
  const candidates = [
    ...(Array.isArray(insight.urls) ? insight.urls : []),
    insight.page,
  ];
  const text = [insight.detail, insight.metrics].filter(Boolean).join(" ");
  const matches = text.match(/https?:\/\/[^\s),;|]+/g) || [];
  candidates.push(...matches);
  const seen = new Set();
  return candidates
    .map((url) => String(url || "").trim().replace(/[.,;:]+$/, ""))
    .filter(Boolean)
    .filter((url) => {
      const key = normalizeReportUrl(url) || url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeSearchInsightIssues(insights = []) {
  return (insights || []).map((insight) => {
    const urls = extractInsightUrls(insight);
    const url = urls[0] || "";
    const category = "search_visibility";
    const type = insight.type || "search_visibility";
    return {
      type,
      category,
      severity: insight.severity === "warning" ? "medium" : "low",
      title: insight.title || TITLE_BY_TYPE[type] || "Search visibility opportunity",
      summary: insight.detail || "Search Console data suggests a search visibility opportunity.",
      impact: impactFor(category, type),
      affectedUrls: urls,
      sourceCapabilities: ["google"],
      searchVisibility: {
        impressions: Number(insight.impressions || insight.evidence?.minimumImpressions || 0),
        clicks: Number(insight.clicks || 0),
      },
      evidence: [{
        source: "google",
        confidence: "confirmed",
        label: insight.title || type,
        url,
        detail: [insight.detail, insight.metrics].filter(Boolean).join(" | "),
        observedAt: insight.dateRange || "",
      }],
    };
  });
}

export function issueCountsBySeverity(issues) {
  return (issues || []).reduce((counts, issue) => {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
}
