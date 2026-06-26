import { downloadCsvFile, downloadTextFile } from "./downloads.js";
import { buildGscRowMap, isTechnicallyIndexablePage, uniqueGscRows } from "./gsc-summary.js";
import { buildStandaloneHtmlReport } from "./html-report.js";
import { normalizeReportUrl } from "./url-policy.js";

export function issueCategories(page) {
  const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
  const categories = [];
  if ([...issueTypes].some((type) => type.startsWith("robots_") || type === "canonical_blocked" || type === "alternate_blocked")) {
    categories.push("robots");
  }
  if (["redirect", "noindex", "http_error", "canonical_mismatch", "canonical_not_in_sitemap", "canonical_conflict", "canonical_invalid"].some((type) => issueTypes.has(type))) {
    categories.push("sitemap");
  }
  if ([
    "alternate_not_reciprocal",
    "alternate_target_canonical_mismatch",
    "alternate_hreflang_invalid",
    "alternate_duplicate_language",
    "alternate_duplicate_target",
    "alternate_self_missing",
  ].some((type) => issueTypes.has(type))) {
    categories.push("international");
  }
  if ([
    "title_missing",
    "description_missing",
    "h1_missing",
    "viewport_missing",
    "structured_data_invalid",
    "title_duplicate",
    "description_duplicate",
  ].some((type) => issueTypes.has(type))) {
    categories.push("content");
  }
  if (["canonical_missing", "canonical_cross_host", "canonical_multiple", "canonical_header_mismatch"].some((type) => issueTypes.has(type))) {
    categories.push("canonical");
  }
  if (["fetch_failed", "not_html"].some((type) => issueTypes.has(type))) {
    categories.push("fetch");
  }
  return categories.join(" | ");
}

export function classifyGscForPage(page, gsc) {
  if (!gsc) return "no_gsc_row";
  if ((gsc.impressions || 0) === 0) return "no_impressions";
  if (!isTechnicallyIndexablePage(page)) return "technical_blocker_with_visibility";
  if (typeof gsc.position === "number" && gsc.position > 20) return "low_ranking";
  if ((gsc.impressions || 0) >= 100 && gsc.clicks != null && gsc.clicks / gsc.impressions < 0.01) return "low_ctr";
  return "has_visibility";
}

function inspectionEvidenceForPage(page, inspectionByUrl) {
  const inspection = inspectionByUrl.get(normalizeReportUrl(page.url)) || inspectionByUrl.get(normalizeReportUrl(page.finalUrl || ""));
  if (!inspection?.ok) return null;
  return inspection;
}

function searchInsightEvidenceForPage(page, insights = []) {
  const pageKeys = new Set([normalizeReportUrl(page.url), normalizeReportUrl(page.finalUrl || "")].filter(Boolean));
  return (insights || []).filter((insight) => {
    const directUrl = normalizeReportUrl(insight.page || "");
    const detailUrl = normalizeReportUrl(String(insight.detail || "").match(/https?:\/\/\S+/)?.[0] || "");
    return (directUrl && pageKeys.has(directUrl)) || (detailUrl && pageKeys.has(detailUrl));
  });
}

function normalizeExportContext(context) {
  if (Array.isArray(context)) return { searchInsights: context };
  return context && typeof context === "object" ? context : {};
}

export function buildAuditCsvRows(report, gscRows = [], filteredPages = null, context = {}) {
  const exportContext = normalizeExportContext(context);
  const normalizedGscRows = uniqueGscRows(gscRows);
  const gscByUrl = buildGscRowMap(normalizedGscRows);
  const inspectionByUrl = new Map((exportContext.inspectionResults || [])
    .filter((item) => item?.url)
    .map((item) => [normalizeReportUrl(item.url), item]));
  const exportPages = filteredPages ?? report.pages ?? [];
  const rows = [[
    "url",
    "final_url",
    "redirect_count",
    "redirect_chain",
    "status",
    "categories",
    "severity",
    "issue_type",
    "issue_message",
    "issue_detail",
    "google_outcomes",
    "google_outcome_details",
    "canonical",
    "gsc_clicks",
    "gsc_impressions",
    "gsc_position",
    "gsc_classification",
    "inspection_verdict",
    "inspection_coverage_state",
    "inspection_google_canonical",
    "inspection_user_canonical",
    "search_insights",
  ]];

  for (const page of exportPages) {
    const gsc = gscByUrl.get(normalizeReportUrl(page.url));
    const inspection = inspectionEvidenceForPage(page, inspectionByUrl);
    const searchInsights = searchInsightEvidenceForPage(page, exportContext.searchInsights);
    const baseRow = [
      page.url,
      page.finalUrl || "",
      page.redirectChain?.length || 0,
      (page.redirectChain || []).map((hop) => `${hop.status} ${hop.url} -> ${hop.targetUrl || hop.location || ""}`).join(" | "),
      page.status || "",
      issueCategories(page),
    ];
    const tailRow = [
      (page.googleReasons || []).map((reason) => reason.label).join(" | "),
      (page.googleReasons || []).map((reason) => reason.detail).join(" | "),
      page.canonical || "",
      gsc?.clicks ?? "",
      gsc?.impressions ?? "",
      gsc?.position ?? "",
      classifyGscForPage(page, gsc),
      inspection?.verdict || "",
      inspection?.coverageState || "",
      inspection?.googleCanonical || "",
      inspection?.userCanonical || "",
      searchInsights.map((insight) => [insight.type, insight.title || insight.detail, insight.metrics].filter(Boolean).join(": ")).join(" | "),
    ];
    if (!(page.issues || []).length && !page.googleReasons?.length) {
      rows.push([...baseRow, "ok", "", "", "", ...tailRow]);
      continue;
    }
    const issues = (page.issues || []).length
      ? page.issues
      : [{ severity: "ok", type: "", message: "", detail: "" }];
    for (const issue of issues) {
      rows.push([
        ...baseRow,
        issue.severity || "",
        issue.type || "",
        issue.message || "",
        issue.detail || "",
        ...tailRow,
      ]);
    }
  }

  if (filteredPages === null) {
    const sitemapKeys = new Set((report.pages || []).map((page) => normalizeReportUrl(page.url)));
    for (const row of normalizedGscRows.filter((item) => !sitemapKeys.has(item.key))) {
      rows.push([
        row.page,
        "",
        "",
        "",
        "",
        "gsc",
        "notice",
        "gsc_not_in_sitemap",
        "GSC page missing from sitemap",
        "",
        "",
        "",
        "",
        row.clicks ?? "",
        row.impressions ?? "",
        row.position ?? "",
        "gsc_not_in_sitemap",
        "",
        "",
        "",
        "",
        "",
      ]);
    }
  }
  return rows;
}

export function buildSummaryReport(report) {
  const lines = [];
  const topBacklog = (report.backlog || []).slice(0, 5);
  const topRobots = (report.robots?.analysis?.blockedSummaries || []).slice(0, 5);
  const topSitemapSignals = (report.sitemapSignals || []).slice(0, 5);
  const topInternationalSignals = (report.internationalSignals || []).slice(0, 5);

  lines.push("soos Audit Summary");
  lines.push(`Scanned at: ${report.scannedAt}`);
  lines.push(`Input: ${report.input?.originalUrl || ""}`);
  lines.push(`Detected sitemap: ${report.input?.sitemapUrl || ""}`);
  lines.push(`Detected robots: ${report.input?.robotsUrl || ""}`);
  lines.push("");
  lines.push("Overview");
  lines.push(`- Health score: ${report.summary?.healthScore ?? ""}`);
  lines.push(`- URLs scanned: ${report.summary?.urlCount ?? 0}`);
  lines.push(`- Sitemaps scanned: ${report.summary?.sitemapCount ?? 0}`);
  lines.push(`- Affected URLs: ${report.summary?.affectedUrlCount ?? 0}`);
  lines.push(`- High-risk Google blockers: ${report.summary?.googleBlockedCount ?? 0}`);
  lines.push(`- Issues: critical ${report.summary?.issueCounts?.critical ?? 0}, warning ${report.summary?.issueCounts?.warning ?? 0}, notice ${report.summary?.issueCounts?.notice ?? 0}`);
  lines.push("");

  if (topBacklog.length) {
    lines.push("Fix First");
    topBacklog.forEach((task, index) => {
      lines.push(`${index + 1}. ${task.title} (${task.count})`);
      lines.push(`   Action: ${task.action}`);
      if (task.sampleUrls?.length) lines.push(`   Sample URLs: ${task.sampleUrls.join(" | ")}`);
    });
    lines.push("");
  }
  if (topRobots.length) {
    lines.push("Robots Impact");
    topRobots.forEach((item) => {
      lines.push(`- ${item.scope}: ${item.rule} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
    });
    lines.push("");
  }
  if (topSitemapSignals.length) {
    lines.push("Sitemap Signals");
    topSitemapSignals.forEach((item) => {
      lines.push(`- ${item.title} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
      if (item.details?.length) lines.push(`  Related targets: ${item.details.join(" | ")}`);
    });
    lines.push("");
  }
  if (topInternationalSignals.length) {
    lines.push("International Signals");
    topInternationalSignals.forEach((item) => {
      lines.push(`- ${item.title} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
      if (item.details?.length) lines.push(`  Related targets: ${item.details.join(" | ")}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

function exportTimestamp(now = new Date()) {
  return now.toISOString().slice(0, 19).replaceAll(":", "-");
}

export function downloadAuditCsv(report, gscRows, filteredPages, context) {
  downloadCsvFile(`soos-audit-${exportTimestamp()}.csv`, buildAuditCsvRows(report, gscRows, filteredPages, context));
}

export function downloadHtmlReport(report, gscRows, language) {
  downloadTextFile(
    `soos-report-${exportTimestamp()}.html`,
    buildStandaloneHtmlReport(report, { language, gscRows }),
    "text/html;charset=utf-8;",
  );
}

export function downloadSummaryReport(report) {
  downloadTextFile(`soos-summary-${exportTimestamp()}.txt`, buildSummaryReport(report));
}
