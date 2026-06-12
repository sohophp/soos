import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartNoAxesCombined,
  FileSearch,
  History,
  Link,
  ListChecks,
  Loader2,
  Search,
  ScanSearch,
  Settings,
} from "lucide-react";
import { absoluteLogUrl, parseAccessLog, STATIC_ASSET_PATH } from "./googlebot-log.js";
import { buildUrlInspectionCandidates, inspectionCandidateKey } from "./url-inspection-candidates.js";
import { analyzeUrlVariantGroup, comparisonUrl, normalizeReportUrl, urlVariantFamily } from "./url-policy.js";
import { apiPost, formatApiError } from "./api-client.js";
import { downloadCsvFile, downloadTextFile } from "./downloads.js";
import { buildStandaloneHtmlReport } from "./html-report.js";
import {
  loadHistory,
  loadHistoryLimit,
  saveHistory,
  saveHistoryLimit,
  toHistoryEntry,
} from "./history.js";
import {
  buildGscOpportunities,
  buildGscRowMap,
  buildSearchVisibility,
  uniqueGscRows,
} from "./gsc-summary.js";
import {
  diagnoseInspectionResult,
} from "./url-inspection-diagnostics.js";
import {
  getGscStatus,
  inspectGscUrls,
} from "./gsc-client.js";
import {
  auditProgressView,
  clearActiveAuditJob,
  controlAuditJob,
  getAuditJob,
  listAuditJobs,
  readActiveAuditJob,
  removeAuditJob,
  runAuditJobBatch,
  saveActiveAuditJob,
  startAuditJob,
} from "./audit-jobs.js";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { GscSitemapsPanel } from "./components/GscSitemapsPanel.jsx";
import { SearchAnalyticsPanel } from "./components/SearchAnalyticsPanel.jsx";
import { SearchConsoleImport } from "./components/SearchConsoleImport.jsx";
import { SearchConsoleApiConfig } from "./components/SearchConsoleApiConfig.jsx";
import { PrivacyDataPanel } from "./components/PrivacyDataPanel.jsx";
import { IssuesView } from "./components/IssuesView.jsx";
import { Badge, ReportEmptyState, Stat } from "./components/ReportUi.jsx";
import { ScanSummaryView } from "./components/ScanSummaryView.jsx";
import { UrlFindingsPanel } from "./components/UrlFindingsPanel.jsx";
import { UrlStructureView } from "./components/UrlStructureView.jsx";
import {
  ComparisonPanel,
  HistoryPanel,
  RetainedJobsPanel,
} from "./components/HistoryPanels.jsx";
import {
  ImportantPageFreshness,
  IndexCoveragePriorities,
  UrlAlignmentMatrix,
} from "./components/UrlInspectionDiagnostics.jsx";
import {
  detectLanguage,
  dictionaries,
  googlebotLogText,
  gscDataText,
  gscSupportingText,
  gscUiText,
  inspectionDiagnosisText,
  structuredDiagnosticText,
  workspaceText,
} from "./i18n.js";
import { loadWorkspaceView, saveWorkspaceView } from "./workspace-views.js";
import "./styles.css";

function ProgressBar({ progress }) {
  if (!progress) return null;
  return (
    <section
      className="progress-panel"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.max(0, Math.min(100, Number(progress.value) || 0))}
      aria-valuetext={`${progress.label}: ${progress.value}%`}
    >
      <div className="progress-top">
        <strong>{progress.label}</strong>
        <span>{progress.value}%</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress.value}%` }} />
      </div>
      {progress.meta ? <p className="progress-meta">{progress.meta}</p> : null}
    </section>
  );
}

function ProgressControls({ loading, jobStatus, onPause, onResume, onStop, t }) {
  if (!loading) return null;
  return (
    <div className="progress-controls">
      {jobStatus === "paused" ? (
        <button className="export-button" type="button" onClick={onResume}>
          {t.resume}
        </button>
      ) : (
        <button className="export-button" type="button" onClick={onPause}>
          {t.pause}
        </button>
      )}
      <button className="export-button" type="button" onClick={onStop}>
        {t.stop}
      </button>
    </div>
  );
}

function RuntimePanel({ loading, jobStatus, progress, runtimeMeta, t }) {
  if (!loading && !runtimeMeta.startedAt) return null;
  const startedText = runtimeMeta.startedAt ? new Date(runtimeMeta.startedAt).toLocaleTimeString() : "-";
  const totalSeconds = Math.max(0, Math.floor((runtimeMeta.elapsedMs || 0) / 1000));
  const elapsedText = totalSeconds >= 60 ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s` : `${totalSeconds}s`;
  const stageSeconds = Math.max(0, Math.floor((runtimeMeta.stageElapsedMs || 0) / 1000));
  const stageElapsedText = stageSeconds >= 60 ? `${Math.floor(stageSeconds / 60)}m ${stageSeconds % 60}s` : `${stageSeconds}s`;
  return (
    <section className="panel runtime-panel">
      <div className="panel-head">
        <h2>{t.runtime}</h2>
      </div>
      <div className="runtime-grid" aria-live="polite" aria-atomic="true">
        <div className="runtime-item">
          <strong>{t.status}</strong>
          <span>{jobStatus || "idle"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.currentStage}</strong>
          <span>{progress?.label || "-"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.startedAt}</strong>
          <span>{startedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.elapsed}</strong>
          <span>{elapsedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.stageElapsed || "Stage elapsed"}</strong>
          <span>{stageElapsedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.pauseCount}</strong>
          <span>{runtimeMeta.pauseCount || 0}</span>
        </div>
      </div>
    </section>
  );
}
function issueCategories(page) {
  const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
  const categories = [];

  if ([...issueTypes].some((type) => type.startsWith("robots_") || type === "canonical_blocked" || type === "alternate_blocked")) {
    categories.push("robots");
  }
  if (
    ["redirect", "noindex", "http_error", "canonical_mismatch", "canonical_not_in_sitemap"].some((type) => issueTypes.has(type))
  ) {
    categories.push("sitemap");
  }
  if (
    ["alternate_not_reciprocal", "alternate_target_canonical_mismatch", "alternate_hreflang_invalid"].some((type) =>
      issueTypes.has(type),
    )
  ) {
    categories.push("international");
  }
  if (
    [
      "title_missing",
      "description_missing",
      "h1_missing",
      "viewport_missing",
      "structured_data_invalid",
      "title_duplicate",
      "description_duplicate",
    ].some((type) => issueTypes.has(type))
  ) {
    categories.push("content");
  }
  if (["canonical_missing", "canonical_cross_host"].some((type) => issueTypes.has(type))) {
    categories.push("canonical");
  }
  if (["fetch_failed", "not_html"].some((type) => issueTypes.has(type))) {
    categories.push("fetch");
  }

  return categories.join(" | ");
}

function classifyGscForPage(page, gsc) {
  if (!gsc) return "no_gsc_row";
  if ((gsc.impressions || 0) === 0) return "no_impressions";
  if (!isTechnicallyIndexablePage(page)) return "technical_blocker_with_visibility";
  if (typeof gsc.position === "number" && gsc.position > 20) return "low_ranking";
  if ((gsc.impressions || 0) >= 100 && gsc.clicks != null && gsc.clicks / gsc.impressions < 0.01) return "low_ctr";
  return "has_visibility";
}

function downloadCsv(report, gscRows = [], filteredPages = null) {
  const gscByUrl = buildGscRowMap(gscRows);
  const exportPages = filteredPages || report.pages || [];
  const rows = [
    [
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
    ],
  ];

  for (const page of exportPages) {
    const gsc = gscByUrl.get(normalizeReportUrl(page.url));
    const gscClassification = classifyGscForPage(page, gsc);
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
      gscClassification,
    ];

    if (!page.issues.length && !page.googleReasons?.length) {
      rows.push([...baseRow, "ok", "", "", "", ...tailRow]);
      continue;
    }

    const issues = page.issues.length ? page.issues : [{ severity: "ok", type: "", message: "", detail: "" }];
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

  const sitemapKeys = new Set((report.pages || []).map((page) => normalizeReportUrl(page.url)));
  for (const row of filteredPages ? [] : (gscRows || []).filter((item) => !sitemapKeys.has(item.key))) {
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
    ]);
  }

  downloadCsvFile(`soos-audit-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, rows);
}

function downloadHtmlReport(report, gscRows, language) {
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadTextFile(
    `soos-report-${timestamp}.html`,
    buildStandaloneHtmlReport(report, { language, gscRows }),
    "text/html;charset=utf-8;",
  );
}

function buildSummaryReport(report) {
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
  lines.push(
    `- Issues: critical ${report.summary?.issueCounts?.critical ?? 0}, warning ${report.summary?.issueCounts?.warning ?? 0}, notice ${report.summary?.issueCounts?.notice ?? 0}`,
  );
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

function downloadSummary(report) {
  const filename = `soos-summary-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.txt`;
  downloadTextFile(filename, buildSummaryReport(report));
}

function summarizeGscRows(report, rows) {
  const pageKeys = new Set((report?.pages || []).map((page) => normalizeReportUrl(page.url)));
  const matched = rows.filter((row) => pageKeys.has(row.key));
  const clicks = matched.reduce((sum, row) => sum + (row.clicks || 0), 0);
  const impressions = matched.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const positionRows = matched.filter((row) => typeof row.position === "number");
  const weightedPosition =
    positionRows.length && impressions
      ? positionRows.reduce((sum, row) => sum + row.position * (row.impressions || 1), 0) /
        positionRows.reduce((sum, row) => sum + (row.impressions || 1), 0)
      : null;
  return {
    loaded: rows.length,
    matched: matched.length,
    clicks,
    impressions,
    averagePosition: weightedPosition,
  };
}




function GscOpportunities({ report, rows, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const opportunities = buildGscOpportunities(report, rows || [], language);
  if (!rows?.length || !opportunities.length) return null;
  return (
    <section className="panel gsc-opportunities">
      <div className="panel-head">
        <h2>{copy.opportunities}</h2>
        <span>{opportunities.length}</span>
      </div>
      <div className="impact-list">
        {opportunities.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={item.severity}>{item.key}</Badge>
              <strong>{item.title}</strong>
              <span>{item.count}</span>
            </div>
            <div className="impact-details">
              <small>{item.detail}</small>
            </div>
            {item.sampleUrls.length ? (
              <div className="impact-samples">
                <strong>{copy.sampleUrls}</strong>
                {item.sampleUrls.map((url) => (
                  <small key={`${item.key}-${url}`}>{url}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
function SearchVisibility({ report, t, gscRows, language }) {
  if (!report?.pages?.length) return null;
  const label = (key, fallback) => t?.[key] || fallback;
  const flaggedLabel = language === "zh-CN" ? "个标记" : language === "zh-TW" ? "個標記" : "flagged";
  const visibility = buildSearchVisibility(report);
  const gsc = summarizeGscRows(report, gscRows || []);
  return (
    <section className="panel search-visibility">
      <div className="panel-head">
        <h2>{label("searchVisibility", "Search visibility")}</h2>
        <span>{visibility.readiness}% {label("readiness", "readiness")}</span>
      </div>
      <div className="visibility-grid">
        <div className="visibility-card">
          <strong>{label("technicallyIndexable", "Technically indexable")}</strong>
          <span>{visibility.technicallyIndexable}/{visibility.total}</span>
          <small>{label("indexableHelp", "URLs without crawl, noindex, HTTP, or canonical blockers in this audit.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("gscConfirmation", "Needs GSC confirmation")}</strong>
          <span>{visibility.hardBlocked + visibility.canonicalized} {flaggedLabel}</span>
          <small>{label("gscHelp", "Confirmed indexing status requires Google Search Console URL Inspection data.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("rankingData", "Ranking data")}</strong>
          <span>GSC API</span>
          <small>{label("rankingHelp", "Clicks, impressions, and average position require Search Console Search Analytics or a rank-tracking provider.")}</small>
        </div>
      </div>
      <div className="visibility-next">
        <strong>{label("nextIntegration", "Next integration")}</strong>
        <span>{label("nextIntegrationHelp", "Connect Google Search Console to compare this technical audit with real index coverage and performance.")}</span>
      </div>
    </section>
  );
}
function normalizeSetUrl(value, policy) {
  return comparisonUrl(value, policy);
}

function normalizeVariantUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

function buildUrlSetFindings(report, gscRows, inspectionResults, copy) {
  const comparisonPolicy = {
    queryPolicy: report?.options?.urlQueryPolicy || "preserve",
    trailingSlashPolicy: report?.options?.trailingSlashPolicy || "preserve",
  };
  const pages = report?.pages || [];
  const scannedPages = [...pages, ...(report?.discoveredPages || [])];
  const hasInternalLinkData = scannedPages.some((page) => Array.isArray(page.internalLinks));
  const sitemapUrls = new Map();
  const internalUrls = new Map(
    (report?.discoveredPages || []).flatMap((page) => [page.url, ...(page.internalLinks || [])])
      .map((url) => [normalizeSetUrl(url, comparisonPolicy), url])
      .filter(([key]) => key),
  );
  const inboundSources = new Map();
  const sourceUrls = new Map();
  const addSourceUrl = (value, source) => {
    const url = normalizeVariantUrl(value);
    if (!url) return;
    if (!sourceUrls.has(url)) sourceUrls.set(url, new Set());
    sourceUrls.get(url).add(source);
  };

  for (const page of pages) {
    const pageUrl = normalizeSetUrl(page.url, comparisonPolicy);
    if (pageUrl) sitemapUrls.set(pageUrl, page.url);
    addSourceUrl(page.url, copy.sourceSitemap);
    for (const link of page.internalLinks || []) {
      const linkUrl = normalizeSetUrl(link, comparisonPolicy);
      if (!linkUrl) continue;
      internalUrls.set(linkUrl, link);
      addSourceUrl(link, copy.sourceInternal);
      if (pageUrl !== linkUrl) {
        if (!inboundSources.has(linkUrl)) inboundSources.set(linkUrl, new Set());
        inboundSources.get(linkUrl).add(pageUrl);
      }
    }
  }

  const findings = [];
  const addFinding = (type, url, source, detail, severity = "warning") => {
    findings.push({ type, url, source, detail, severity });
  };

  if (hasInternalLinkData) {
    for (const [key, url] of internalUrls) {
      if (!sitemapUrls.has(key)) addFinding("internal_missing_sitemap", url, copy.sourceInternal, copy.internalMissingSitemap);
    }
  }

  for (const row of uniqueGscRows(gscRows)) {
    const url = row.page || row.key;
    const key = normalizeSetUrl(url, comparisonPolicy);
    if (!key) continue;
    addSourceUrl(url, copy.sourceGsc);
    if (!sitemapUrls.has(key)) {
      addFinding(
        "gsc_missing_sitemap",
        url,
        copy.sourceGsc,
        `${row.clicks || 0} ${copy.clicks} / ${row.impressions || 0} ${copy.impressions}`,
        (row.impressions || 0) > 0 ? "warning" : "notice",
      );
    }
  }

  if (hasInternalLinkData) {
    for (const [key, url] of sitemapUrls) {
      const inboundCount = inboundSources.get(key)?.size || 0;
      if (!inboundCount) addFinding("sitemap_orphan", url, copy.sourceSitemap, `0 ${copy.inboundLinks}`);
    }
  }

  for (const item of inspectionResults || []) {
    addSourceUrl(item.url, copy.sourceGoogle);
    if (item.ok && !item.sitemap?.length) {
      addFinding("google_missing_sitemap", item.url, copy.sourceGoogle, copy.googleMissingSitemap, "notice");
    }
    if (item.ok && !item.referringUrls?.length) {
      addFinding("google_missing_referrer", item.url, copy.sourceGoogle, copy.googleMissingReferrer, "notice");
    }
  }

  const variantGroups = new Map();
  for (const [url, sources] of sourceUrls) {
    const family = urlVariantFamily(url);
    if (!family) continue;
    if (!variantGroups.has(family)) variantGroups.set(family, []);
    variantGroups.get(family).push({ url, sources: [...sources] });
  }
  for (const variants of variantGroups.values()) {
    if (variants.length < 2) continue;
    const diagnosis = analyzeUrlVariantGroup(variants.map((variant) => variant.url));
    if (!diagnosis?.reasons.length) continue;
    const reasonLabels = {
      protocol: copy.variantProtocol,
      hostname: copy.variantHostname,
      path_case: copy.variantPathCase,
      default_document: copy.variantDefaultDocument,
      trailing_slash: copy.variantTrailingSlash,
      query_order: copy.variantQueryOrder,
      tracking_query: copy.variantTrackingQuery,
      pagination_query: copy.variantPaginationQuery,
      functional_query: copy.variantFunctionalQuery,
      unknown_query: copy.variantUnknownQuery,
    };
    const detail = `${diagnosis.reasons.map((reason) => reasonLabels[reason] || reason).join(", ")}: ${variants
      .slice(0, 6)
      .map((variant) => variant.url)
      .join(" | ")}`;
    addFinding(`url_variant_${diagnosis.classification}`, variants[0].url, copy.sourceVariants, detail, diagnosis.severity);
  }

  return findings.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, notice: 2 };
    return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) || a.url.localeCompare(b.url);
  });
}

function UrlSetComparison({ report, gscRows, inspectionResults, copy }) {
  const [filter, setFilter] = useState("all");
  const queryPolicy = report?.options?.urlQueryPolicy || "preserve";
  const trailingSlashPolicy = report?.options?.trailingSlashPolicy || "preserve";
  const queryPolicyLabels = {
    preserve: copy.queryPreserve,
    strip_tracking: copy.queryStripTracking,
    drop_all: copy.queryDropAll,
  };
  const slashPolicyLabels = {
    preserve: copy.slashPreserve,
    remove: copy.slashRemove,
    add: copy.slashAdd,
  };
  const findings = useMemo(
    () => buildUrlSetFindings(report, gscRows, inspectionResults, copy),
    [report, gscRows, inspectionResults, copy],
  );
  const typeLabels = {
    internal_missing_sitemap: copy.internalMissingSitemap,
    gsc_missing_sitemap: copy.gscMissingSitemap,
    sitemap_orphan: copy.sitemapOrphan,
    google_missing_sitemap: copy.googleMissingSitemap,
    google_missing_referrer: copy.googleMissingReferrer,
    url_variant_reasonable: copy.urlVariantReasonable,
    url_variant_normalize: copy.urlVariantNormalize,
    url_variant_conflict: copy.urlVariantConflict,
  };
  const counts = findings.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  const visibleFindings = filter === "all" ? findings : findings.filter((item) => item.type === filter);

  function exportFindings() {
    downloadCsvFile("soos-url-set-diagnosis.csv", [
      ["type", "severity", "url", "source", "detail"],
      ...findings.map((item) => [typeLabels[item.type] || item.type, item.severity, item.url, item.source, item.detail]),
    ]);
  }

  return (
    <section className="url-set-comparison">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.urlSetsTitle}</strong>
          <small>{copy.urlSetsHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.urlSetsAll} ({findings.length})</option>
            {Object.entries(typeLabels).map(([type, label]) => (
              <option value={type} key={type}>{label} ({counts[type] || 0})</option>
            ))}
          </select>
          <button className="export-button" type="button" disabled={!findings.length} onClick={exportFindings}>
            {copy.urlSetsExport}
          </button>
        </div>
      </div>
      <small className="url-set-scope">{copy.urlSetsPartial}</small>
      <small className="url-set-scope">
        {copy.urlPolicyActive}: {queryPolicyLabels[queryPolicy]} / {slashPolicyLabels[trailingSlashPolicy]}
      </small>
      <div className="coverage-disposition-summary">
        {Object.entries(typeLabels).map(([type, label]) => (
          <span key={type}>{label}: {counts[type] || 0}</span>
        ))}
      </div>
      {visibleFindings.length ? (
        <div className="url-set-findings">
          {visibleFindings.map((item, index) => (
            <div className="url-set-row" key={`${item.type}-${item.url}-${index}`}>
              <Badge severity={item.severity}>{typeLabels[item.type] || item.type}</Badge>
              <strong title={item.url}>{item.url}</strong>
              <span>{item.source}</span>
              <small title={item.detail}>{item.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function googleRichIssues(inspection) {
  const issues = [];
  for (const detected of inspection?.richResultsDetectedItems || []) {
    const richType = detected.richResultType || detected.type || "Rich result";
    const items = detected.items || [];
    for (const item of items) {
      for (const issue of item.issues || []) {
        issues.push({
          type: richType,
          severity: String(issue.severity || "WARNING").toLowerCase(),
          detail: issue.issueMessage || issue.message || JSON.stringify(issue),
        });
      }
    }
  }
  return issues;
}

function StructuredDataDiagnostics({ report, inspectionResults, copy, language }) {
  const [filter, setFilter] = useState("all");
  const inspectionByUrl = useMemo(
    () => new Map((inspectionResults || []).map((item) => [normalizeReportUrl(item.url), item])),
    [inspectionResults],
  );
  const rows = useMemo(
    () => (report?.pages || [])
      .map((page) => {
        const local = page.structuredData;
        const inspection = inspectionByUrl.get(normalizeReportUrl(page.url));
        const googleIssues = googleRichIssues(inspection);
        const localErrors = (local?.diagnostics || []).filter((item) => item.severity === "warning");
        const recommendations = (local?.diagnostics || []).filter((item) => item.severity === "notice");
        return {
          url: page.url,
          nodeCount: local?.nodeCount || 0,
          types: local?.types || [],
          validatedTypes: local?.validatedTypes || [],
          unvalidatedTypes: local?.unvalidatedTypes || [],
          localErrors,
          recommendations,
          googleIssues,
          googleVerdict: inspection?.richResultsVerdict || "",
          hasMarkup: Boolean(local?.count || local?.nodeCount || inspection?.richResultsDetectedItems?.length),
        };
      })
      .filter((row) => row.hasMarkup),
    [inspectionByUrl, report],
  );
  if (!rows.length) return null;

  const filteredRows = rows.filter((row) => {
    if (filter === "errors") return row.localErrors.length > 0;
    if (filter === "recommendations") return row.recommendations.length > 0;
    if (filter === "google") return row.googleIssues.length > 0 || (row.googleVerdict && row.googleVerdict !== "PASS");
    return true;
  });
  const totals = rows.reduce(
    (sum, row) => ({
      errors: sum.errors + row.localErrors.length,
      recommendations: sum.recommendations + row.recommendations.length,
      google: sum.google + row.googleIssues.length,
    }),
    { errors: 0, recommendations: 0, google: 0 },
  );
  const diagnosticLabels = structuredDiagnosticText[language] || structuredDiagnosticText.en;
  const coverage = [...rows.reduce((typeMap, row) => {
    for (const type of row.types) {
      const current = typeMap.get(type) || { type, pages: 0, validated: false };
      current.pages += 1;
      current.validated = current.validated || row.validatedTypes.includes(type);
      typeMap.set(type, current);
    }
    return typeMap;
  }, new Map()).values()].sort((a, b) => Number(b.validated) - Number(a.validated) || b.pages - a.pages || a.type.localeCompare(b.type));

  function exportDiagnostics() {
    const exportRows = [["url", "source", "severity", "schema_type", "property", "detail"]];
    for (const row of rows) {
      for (const item of [...row.localErrors, ...row.recommendations]) {
        exportRows.push([row.url, "local", item.severity, item.type, item.property, item.detail]);
      }
      for (const item of row.googleIssues) {
        exportRows.push([row.url, "google", item.severity, item.type, "", item.detail]);
      }
      if (!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length) {
        exportRows.push([row.url, "local", "ok", row.types.join(" | "), "", copy.structuredNoIssues]);
      }
    }
    downloadCsvFile("soos-structured-data-diagnosis.csv", exportRows);
  }

  return (
    <section className="structured-data-diagnostics">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.structuredTitle}</strong>
          <small>{copy.structuredHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.structuredAll} ({rows.length})</option>
            <option value="errors">{copy.structuredErrors} ({totals.errors})</option>
            <option value="recommendations">{copy.structuredRecommendations} ({totals.recommendations})</option>
            <option value="google">{copy.structuredGoogle} ({totals.google})</option>
          </select>
          <button className="export-button" type="button" onClick={exportDiagnostics}>{copy.structuredExport}</button>
        </div>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.structuredErrors}: {totals.errors}</span>
        <span>{copy.structuredRecommendations}: {totals.recommendations}</span>
        <span>{copy.structuredGoogle}: {totals.google}</span>
      </div>
      <div className="structured-coverage">
        <strong>{copy.structuredCoverage}</strong>
        <div>
          {coverage.map((item) => (
            <span className={item.validated ? "validated" : "parsed"} key={item.type}>
              {item.type}: {item.pages} · {item.validated ? copy.structuredValidated : copy.structuredParsedOnly}
            </span>
          ))}
        </div>
      </div>
      <div className="structured-data-list">
        {filteredRows.map((row) => (
          <div className="structured-data-row" key={row.url}>
            <div>
              <strong title={row.url}>{row.url}</strong>
              <small>{copy.structuredTypes}: {row.types.join(", ") || "Unknown"} / {row.nodeCount} {copy.structuredNodes}</small>
            </div>
            <span>{copy.structuredLocalIssues}: {row.localErrors.length} / {row.recommendations.length}</span>
            <span>{copy.structuredGoogleVerdict}: {row.googleVerdict || "-"}</span>
            <div className="structured-data-issues">
              {[...row.localErrors, ...row.recommendations].slice(0, 4).map((item, index) => (
                <small key={`${item.code}-${item.property}-${index}`}>
                  {diagnosticLabels[item.code] || item.code} · {item.type}.{item.property || "-"}: {item.detail}
                </small>
              ))}
              {row.googleIssues.slice(0, 3).map((item, index) => (
                <small key={`google-${item.type}-${index}`}>Google {item.type}: {item.detail}</small>
              ))}
              {!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length ? <small>{copy.structuredNoIssues}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}



function UrlInspectionPanel({ report, gscStatus, siteUrl, language, gscRows, onResultsChange }) {
  const copy = gscDataText[language] || gscDataText.en;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const candidates = useMemo(
    () => buildUrlInspectionCandidates(report, gscRows),
    [gscRows, report],
  );
  useEffect(() => {
    setResult(null);
    setError("");
  }, [report?.scannedAt]);
  useEffect(() => {
    onResultsChange?.(result?.results || []);
  }, [onResultsChange, result]);
  if (!report?.pages?.length) return null;

  const inspectedUrlKeys = new Set((result?.results || []).map((item) => inspectionCandidateKey(item.url)));
  const pendingCandidates = candidates.filter((candidate) => !inspectedUrlKeys.has(candidate.key));
  const nextCandidates = pendingCandidates.slice(0, 25);
  const nextUrls = nextCandidates.map((candidate) => candidate.url);
  const anomalyCount = candidates.filter((candidate) => candidate.priority < 40).length;
  const sourceCounts = candidates.reduce((counts, candidate) => {
    for (const source of candidate.sources) counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const reasonLabel = (reason) => {
    if (reason.startsWith("technical_blocker:")) return copy.candidateTechnical;
    if (reason.startsWith("url_signal:")) return copy.candidateSignals;
    if (reason === "gsc_missing_sitemap") return copy.candidateGscMissing;
    if (reason === "internal_missing_sitemap") return copy.candidateInternalMissing;
    if (reason === "homepage_unreachable") return copy.candidateUnreachable;
    if (reason === "homepage_deep") return copy.candidateDeepPath;
    if (reason === "sitemap_no_gsc_impressions") return copy.candidateNoGsc;
    return copy.candidateBaseline;
  };
  const sourceLabel = (source) => ({
    sitemap: copy.sourceSitemapShort,
    gsc: copy.sourceGscShort,
    internal: copy.sourceInternalShort,
  })[source] || source;
  const indexedCount = (result?.results || []).filter((item) => item.verdict === "PASS").length;
  const failedCount = (result?.results || []).filter((item) => !item.ok || item.verdict === "FAIL").length;
  const diagnosedResults = (result?.results || []).map((item) => ({
    ...item,
    diagnoses: diagnoseInspectionResult(item).map((diagnosis) => {
      const localized = inspectionDiagnosisText[language]?.[diagnosis.type];
      return localized ? { ...diagnosis, title: localized[0], action: localized[1] } : diagnosis;
    }),
  }));
  const diagnosisSummary = diagnosedResults.reduce(
    (summary, item) => {
      for (const diagnosis of item.diagnoses) {
        summary[diagnosis.severity] = (summary[diagnosis.severity] || 0) + 1;
      }
      return summary;
    },
    { critical: 0, warning: 0, notice: 0 }
  );

  async function runInspection() {
    if (!siteUrl.trim()) {
      setError(copy.inspectPropertyFirst);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = await inspectGscUrls(nextUrls, siteUrl);
      const candidateByKey = new Map(nextCandidates.map((candidate) => [candidate.key, candidate]));
      setResult((current) => ({
        ...body,
        inspected: (current?.results?.length || 0) + (body.results?.length || 0),
        results: [
          ...(current?.results || []),
          ...(body.results || []).map((item) => ({
            ...item,
            candidate: candidateByKey.get(inspectionCandidateKey(item.url)) || null,
          })),
        ],
      }));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel url-inspection">
      <div className="panel-head">
        <h2>{copy.inspectionTitle}</h2>
        <span>{gscStatus?.configured ? "GSC API" : copy.configureFirst}</span>
      </div>
      <div className="url-inspection-body">
        <div className="url-inspection-copy">
          <strong>{copy.inspectStatus}</strong>
          <small>{copy.inspectionHelp}</small>
        </div>
        <button className="export-button" type="button" disabled={!gscStatus?.configured || loading || !nextUrls.length} onClick={runInspection}>
          {loading ? copy.inspecting : result ? nextUrls.length ? copy.inspectNext : copy.inspectionComplete : copy.inspect}
        </button>
      </div>
      <div className="inspection-queue">
        <div className="coverage-disposition-summary">
          <span>{candidates.length} {copy.inspectionCandidates}</span>
          <span>{anomalyCount} {copy.inspectionAnomalies}</span>
          <span>{copy.sourceSitemapShort}: {sourceCounts.sitemap || 0}</span>
          <span>{copy.sourceGscShort}: {sourceCounts.gsc || 0}</span>
          <span>{copy.sourceInternalShort}: {sourceCounts.internal || 0}</span>
        </div>
        {nextCandidates.length ? (
          <div className="inspection-queue-list">
            <strong>{copy.inspectionNextBatch}: {nextCandidates.length}</strong>
            {nextCandidates.slice(0, 6).map((candidate) => (
              <div className="inspection-queue-row" key={candidate.key}>
                <span title={candidate.url}>{candidate.url}</span>
                <small>{candidate.reasons.map(reasonLabel).join(" / ")}</small>
                <small>{copy.inspectionSources}: {candidate.sources.map(sourceLabel).join(", ")}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {result && pendingCandidates.length ? <small className="inspection-remaining">{pendingCandidates.length} {copy.remaining}</small> : null}
      {error ? <div className="url-inspection-error" role="alert">{error}</div> : null}
      <StructuredDataDiagnostics report={report} inspectionResults={result?.results || []} copy={copy} language={language} />
      <UrlSetComparison report={report} gscRows={gscRows} inspectionResults={result?.results || []} copy={copy} />
      {result ? (
        <>
          <div className="inspection-summary">
            <Stat label={copy.inspected} value={result.inspected} />
            <Stat label="PASS" value={indexedCount} tone="good" />
            <Stat label={copy.review} value={failedCount} tone="warn" />
          </div>
          <div className="inspection-diagnosis-summary">
            <span>{diagnosisSummary.critical} {copy.critical}</span>
            <span>{diagnosisSummary.warning} {copy.warnings}</span>
            <span>{diagnosisSummary.notice} {copy.notices}</span>
          </div>
          <IndexCoveragePriorities report={report} inspectionResults={result.results} gscRows={gscRows} copy={copy} Badge={Badge} />
          <ImportantPageFreshness inspectionResults={result.results} gscRows={gscRows} copy={copy} Badge={Badge} />
          <UrlAlignmentMatrix report={report} inspectionResults={result.results} copy={copy} Badge={Badge} />
          <div className="inspection-list">
            {diagnosedResults.map((item) => (
              <article className="inspection-card" key={item.url}>
                <div className="impact-top">
                  <Badge severity={item.ok && item.verdict === "PASS" ? "ok" : item.ok ? "warning" : "critical"}>{item.verdict || (item.ok ? "UNKNOWN" : "ERROR")}</Badge>
                  <strong>{item.url}</strong>
                  <span>{item.coverageState || item.error || copy.noCoverage}</span>
                </div>
                <div className="impact-details">
                  {item.candidate?.reasons?.length ? <small>{copy.inspectionQueue}: {item.candidate.reasons.map(reasonLabel).join(" / ")}</small> : null}
                  {item.candidate?.sources?.length ? <small>{copy.inspectionSources}: {item.candidate.sources.map(sourceLabel).join(", ")}</small> : null}
                  {item.indexingState ? <small>{copy.indexing}: {item.indexingState}</small> : null}
                  {item.robotsTxtState ? <small>{copy.robots}: {item.robotsTxtState}</small> : null}
                  {item.pageFetchState ? <small>{copy.fetch}: {item.pageFetchState}</small> : null}
                  {item.crawledAs ? <small>{copy.crawledAs}: {item.crawledAs}</small> : null}
                  {item.lastCrawlTime ? <small>{copy.lastCrawl}: {item.lastCrawlTime}</small> : null}
                  {item.sitemap?.length ? <small>{copy.sitemap}: {item.sitemap.slice(0, 2).join(", ")}</small> : null}
                  {item.referringUrls?.length ? <small>{copy.referrers}: {item.referringUrls.length}</small> : null}
                  {item.googleCanonical ? <small>{copy.googleCanonical}: {item.googleCanonical}</small> : null}
                  {item.userCanonical ? <small>{copy.userCanonical}: {item.userCanonical}</small> : null}
                  {item.mobileVerdict ? <small>{copy.mobile}: {item.mobileVerdict}</small> : null}
                  {item.richResultsVerdict ? <small>{copy.richResults}: {item.richResultsVerdict}</small> : null}
                </div>
                {item.diagnoses.length ? (
                  <div className="inspection-diagnoses">
                    {item.diagnoses.map((diagnosis) => (
                      <div className={`inspection-diagnosis ${diagnosis.severity}`} key={`${item.url}-${diagnosis.type}`}>
                        <strong>{diagnosis.title}</strong>
                        <small>{diagnosis.detail}</small>
                        <span>{diagnosis.action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inspection-diagnoses">
                    <div className="inspection-diagnosis good">
                      <strong>{copy.noIssue}</strong>
                      <small>{copy.noIssueDetail}</small>
                      <span>{copy.noIssueAction}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function GooglebotLogAnalysis({ report, language, gscRows }) {
  const copy = googlebotLogText[language] || googlebotLogText.en;
  const [analysis, setAnalysis] = useState(null);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLogFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage(copy.reading);
    try {
      const parsed = parseAccessLog(await file.text());
      if (!parsed.records.length) {
        setAnalysis({ fileName: file.name, ...parsed, verifications: [], findings: [] });
        setMessage(copy.noCandidates);
        return;
      }
      setMessage(copy.verifying);
      const ips = [...new Set(parsed.records.map((record) => record.ip).filter(Boolean))];
      const body = await apiPost("/api/googlebot/verify", { ips }, {
        fallbackMessage: "Googlebot verification failed",
      });
      setAnalysis({ fileName: file.name, ...parsed, verifications: body.results || [], verifiedAt: body.verifiedAt });
      setMessage("");
    } catch (err) {
      setError(formatApiError(err));
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  const diagnosis = useMemo(() => {
    if (!analysis?.records?.length) return null;
    const verificationByIp = new Map((analysis.verifications || []).map((item) => [item.ip, item]));
    const sitemapUrls = new Map(report.pages.map((page) => [normalizeReportUrl(page.url), page.url]));
    const pageByUrl = new Map(report.pages.map((page) => [normalizeReportUrl(page.url), page]));
    const verifiedRecords = [];
    const unverifiedRecords = [];
    for (const record of analysis.records) {
      const item = { ...record, url: absoluteLogUrl(record, report.input.siteRootUrl) };
      if (verificationByIp.get(record.ip)?.verified) verifiedRecords.push(item);
      else unverifiedRecords.push(item);
    }
    const byUrl = new Map();
    for (const record of verifiedRecords) {
      const key = record.url;
      const current = byUrl.get(key) || { url: key, hits: 0, statuses: new Map(), lastSeen: "", records: [] };
      current.hits += 1;
      current.statuses.set(record.status, (current.statuses.get(record.status) || 0) + 1);
      if (record.timestamp && (!current.lastSeen || record.timestamp > current.lastSeen)) current.lastSeen = record.timestamp;
      current.records.push(record);
      byUrl.set(key, current);
    }
    const findings = [];
    const addFinding = (type, severity, url, status, hits, lastSeen, detail) => findings.push({ type, severity, url, status, hits, lastSeen, detail });
    for (const item of byUrl.values()) {
      const path = (() => { try { return new URL(item.url).pathname; } catch { return item.url; } })();
      const normalized = normalizeReportUrl(item.url);
      const statuses = [...item.statuses.keys()];
      if (statuses.some((status) => status >= 400)) addFinding("errors", statuses.some((status) => status >= 500) ? "critical" : "warning", item.url, statuses.join(" / "), item.hits, item.lastSeen, "Google received an HTTP error");
      if (!sitemapUrls.has(normalized)) addFinding("nonSitemap", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.nonSitemap);
      if (String(item.url).includes("?")) addFinding("parameters", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.parameters);
      if (STATIC_ASSET_PATH.test(path)) addFinding("assets", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.assets);
      if ((pageByUrl.get(normalized)?.issues || []).some((issue) => issue.type === "robots_disallow")) {
        addFinding("blocked", "warning", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.blocked);
      }
    }
    const unverifiedByIp = new Map();
    for (const record of unverifiedRecords) {
      const current = unverifiedByIp.get(record.ip || "unknown") || { hits: 0, lastSeen: "", url: record.url };
      current.hits += 1;
      if (record.timestamp && (!current.lastSeen || record.timestamp > current.lastSeen)) current.lastSeen = record.timestamp;
      unverifiedByIp.set(record.ip || "unknown", current);
    }
    for (const [ip, item] of unverifiedByIp) addFinding("unverified", "warning", item.url, "-", item.hits, item.lastSeen, `${copy.unverified}: ${ip}`);

    const crawledKeys = new Set(verifiedRecords.map((record) => normalizeReportUrl(record.url)));
    const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows));
    if (verifiedRecords.length) {
      for (const [key, url] of sitemapUrls) {
        if (crawledKeys.has(key)) continue;
        const gsc = gscByUrl.get(key);
        addFinding("missing", (gsc?.impressions || 0) > 0 ? "warning" : "notice", url, "-", 0, "", gsc ? `GSC: ${gsc.clicks || 0} clicks / ${gsc.impressions || 0} impressions` : copy.missing);
      }
    }
    const timestamps = analysis.records.map((record) => record.timestamp).filter(Boolean).sort();
    return {
      verifiedRecords,
      unverifiedRecords,
      uniqueUrls: byUrl.size,
      findings,
      firstRequest: timestamps[0] || "",
      lastRequest: timestamps.at(-1) || "",
    };
  }, [analysis, copy, gscRows, report]);

  const visibleFindings = diagnosis?.findings?.filter((item) => filter === "all" || item.type === filter) || [];
  const counts = diagnosis?.findings?.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {}) || {};

  function exportDiagnosis() {
    downloadCsvFile("soos-googlebot-log-diagnosis.csv", [
      ["type", "severity", "url", "status", "hits", "last_seen", "detail"],
      ...(diagnosis?.findings || []).map((item) => [item.type, item.severity, item.url, item.status, item.hits, item.lastSeen, item.detail]),
    ]);
  }

  return (
    <section className="panel googlebot-log">
      <div className="panel-head">
        <h2>{copy.title}</h2>
        <span>{analysis?.fileName || copy.optional}</span>
      </div>
      <div className="googlebot-log-import">
        <div>
          <strong>{copy.help}</strong>
          <small>{copy.privacy}</small>
          {message ? <small role="status">{message}</small> : null}
          {error ? <small className="gsc-import-error" role="alert">{copy.failed}: {error}</small> : null}
        </div>
        <div className="gsc-import-actions">
          <label className="export-button file-button">
            {copy.import}
            <input type="file" accept=".log,.txt,.json,.ndjson,.csv,.tsv,text/plain,application/json,text/csv" onChange={handleLogFile} />
          </label>
          {analysis ? <button className="export-button" type="button" onClick={() => { setAnalysis(null); setMessage(""); setError(""); }}>{copy.clear}</button> : null}
        </div>
      </div>
      {analysis?.truncated ? <small className="googlebot-log-note">{copy.truncated}</small> : null}
      {diagnosis ? (
        <>
          <div className="coverage-disposition-summary googlebot-log-summary">
            <span>{analysis.records.length} {copy.requests}</span>
            <span>{diagnosis.verifiedRecords.length} {copy.verified}</span>
            <span>{diagnosis.unverifiedRecords.length} {copy.fake}</span>
            <span>{diagnosis.uniqueUrls} {copy.uniqueUrls}</span>
            <span>{counts.errors || 0} {copy.serverErrors}</span>
            <span>{counts.nonSitemap || 0} {copy.outsideSitemap}</span>
            <span>{(counts.parameters || 0) + (counts.assets || 0) + (counts.blocked || 0)} {copy.waste}</span>
            <span>{counts.missing || 0} {copy.missingCrawl}</span>
          </div>
          <div className="googlebot-log-meta">
            <small>{copy.format}: {analysis.formats.join(", ") || "-"}</small>
            <small>{copy.firstRequest}: {diagnosis.firstRequest || "-"}</small>
            <small>{copy.lastRequest}: {diagnosis.lastRequest || "-"}</small>
            <small>{copy.verificationHelp}</small>
          </div>
          <div className="url-alignment-actions googlebot-log-actions">
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">{copy.all} ({diagnosis.findings.length})</option>
              {["errors", "nonSitemap", "parameters", "assets", "blocked", "unverified", "missing"].map((type) => (
                <option value={type} key={type}>{copy[type]} ({counts[type] || 0})</option>
              ))}
            </select>
            <button className="export-button" type="button" disabled={!diagnosis.findings.length} onClick={exportDiagnosis}>{copy.export}</button>
          </div>
          {visibleFindings.length ? (
            <div className="googlebot-log-findings">
              {visibleFindings.map((item, index) => (
                <div className="googlebot-log-row" key={`${item.type}-${item.url}-${index}`}>
                  <Badge severity={item.severity}>{copy[item.type]}</Badge>
                  <strong title={item.url}>{item.url}</strong>
                  <span>{copy.status}: {item.status}</span>
                  <span>{copy.hits}: {item.hits}</span>
                  <small>{item.lastSeen || item.detail}</small>
                </div>
              ))}
            </div>
          ) : <p className="none">{copy.noFindings}</p>}
        </>
      ) : null}
    </section>
  );
}

function Report({ report, t, gscRows, gscStatus, gscSiteUrl, language, activeView, onViewChange, comparisonEntry }) {
  const [inspectionResults, setInspectionResults] = useState([]);
  const [issueFilter, setIssueFilter] = useState(null);

  function selectIssue(issue) {
    setIssueFilter(issue);
    onViewChange?.("urls");
  }

  if (!report) return ["scan", "issues", "urls"].includes(activeView) ? <ReportEmptyState t={t} /> : null;

  return (
    <>
      <div className="workspace-view" hidden={activeView !== "scan"}>
        <ScanSummaryView report={report} t={t} />
      </div>

      <div className="workspace-view" hidden={activeView !== "google"}>
        <SearchVisibility report={report} t={t} gscRows={gscRows} language={language} />
        <GscOpportunities report={report} rows={gscRows} language={language} />
        <GooglebotLogAnalysis report={report} language={language} gscRows={gscRows} />
        <UrlInspectionPanel
          report={report}
          gscStatus={gscStatus}
          siteUrl={gscSiteUrl}
          language={language}
          gscRows={gscRows}
          onResultsChange={setInspectionResults}
        />
      </div>

      <div className="workspace-view" hidden={activeView !== "issues"}>
        <IssuesView report={report} t={t} onSelectIssue={selectIssue} />
      </div>

      <div className="workspace-view" hidden={activeView !== "urls"}>
        <UrlStructureView report={report} t={t} />
        <UrlFindingsPanel
          report={report}
          gscRows={gscRows}
          inspectionResults={inspectionResults}
          comparisonEntry={comparisonEntry}
          issueFilter={issueFilter}
          t={t}
          language={language}
          onIssueFilterChange={setIssueFilter}
          onExportSummary={() => downloadSummary(report)}
          onExportHtml={() => downloadHtmlReport(report, gscRows, language)}
          onExportCsv={(pages) => downloadCsv(report, gscRows, pages)}
        />
      </div>
    </>
  );
}

function App() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [language, setLanguage] = useState(() => detectLanguage());
  const [activeView, setActiveView] = useState(() => loadWorkspaceView());
  const [contentChecks, setContentChecks] = useState(false);
  const [directoryRobots, setDirectoryRobots] = useState(false);
  const [performanceChecks, setPerformanceChecks] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [internalCrawl, setInternalCrawl] = useState(false);
  const [urlQueryPolicy, setUrlQueryPolicy] = useState("preserve");
  const [trailingSlashPolicy, setTrailingSlashPolicy] = useState("preserve");
  const [gscRows, setGscRows] = useState([]);
  const [gscStatus, setGscStatus] = useState(null);
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [dataResetKey, setDataResetKey] = useState(0);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyLimit, setHistoryLimit] = useState(() => loadHistoryLimit());
  const [retainedJobs, setRetainedJobs] = useState([]);
  const [retainedJobsMeta, setRetainedJobsMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    pageCount: 1,
    retentionSeconds: 0,
    storage: "memory",
  });
  const [retainedJobsQuery, setRetainedJobsQuery] = useState("");
  const [retainedJobsStatus, setRetainedJobsStatus] = useState("");
  const [retainedJobsLoading, setRetainedJobsLoading] = useState(false);
  const [comparisonEntry, setComparisonEntry] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [currentJobStartedAt, setCurrentJobStartedAt] = useState(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [elapsedNow, setElapsedNow] = useState(0);
  const mainContentRef = useRef(null);
  const t = dictionaries[language];
  const workspaceCopy = workspaceText[language] || workspaceText.en;
  const workspaceViews = [
    ["scan", ScanSearch],
    ["google", ChartNoAxesCombined],
    ["issues", ListChecks],
    ["urls", Link],
    ["history", History],
    ["settings", Settings],
  ];

  function changeView(view, options = {}) {
    setActiveView(saveWorkspaceView(view));
    if (options.focus !== false) {
      window.requestAnimationFrame(() => mainContentRef.current?.focus({ preventScroll: true }));
    }
  }

    useEffect(() => {
    getGscStatus()
      .then((status) => {
        setGscStatus(status);
        if (status?.siteUrl) setGscSiteUrl(status.siteUrl);
      })
      .catch(() => setGscStatus({ configured: false, note: "Search Console API status is unavailable." }));
  }, []);
useEffect(() => {
    if (!loading || !currentJobStartedAt) return undefined;
    const timer = window.setInterval(() => setElapsedNow(Date.now() - currentJobStartedAt), 1000);
    return () => window.clearInterval(timer);
  }, [loading, currentJobStartedAt]);

  useEffect(() => {
    const saved = readActiveAuditJob();
    if (!saved) return;
    setLoading(true);
    setError("");
    setCurrentJobId(saved.id);
    setCurrentJobStartedAt(saved.startedAt);
    setElapsedNow(Date.now() - saved.startedAt);
    setProgress({ label: t.progressPreparing, value: 5, meta: "" });
    pollAuditJob(saved.id)
      .catch((err) => setError(formatApiError(err)))
      .finally(resetJobUi);
  }, []);
  useEffect(() => {
    loadRetainedJobs().catch(() => {});
  }, []);

  function resetJobUi() {
    window.setTimeout(() => {
      setLoading(false);
      setProgress(null);
      setCurrentJobId(null);
      setJobStatus(null);
      setCurrentJobStartedAt(null);
      setElapsedNow(0);
    }, 250);
  }

  function saveCompletedReport(result) {
    setReport(result);
    setHistory((currentHistory) => {
      const nextHistory = [
        toHistoryEntry(result),
        ...currentHistory.filter((item) => item.scannedAt !== result.scannedAt),
      ].slice(0, historyLimit);
      saveHistory(nextHistory);
      return nextHistory;
    });
    setComparisonEntry(null);
    loadRetainedJobs().catch(() => {});
  }

  async function loadRetainedJobs(overrides = {}) {
    setRetainedJobsLoading(true);
    try {
      const body = await listAuditJobs({
        page: overrides.page || retainedJobsMeta.page || 1,
        pageSize: retainedJobsMeta.pageSize || 10,
        query: overrides.query ?? retainedJobsQuery,
        status: overrides.status ?? retainedJobsStatus,
      });
      setRetainedJobs(body.items || []);
      setRetainedJobsMeta({
        total: body.total || 0,
        page: body.page || 1,
        pageSize: body.pageSize || 10,
        pageCount: body.pageCount || 1,
        retentionSeconds: body.retentionSeconds || 0,
        storage: body.storage || "memory",
      });
    } finally {
      setRetainedJobsLoading(false);
    }
  }

  async function openRetainedReport(jobId) {
    const body = await getAuditJob(jobId);
    if (!body.result) throw new Error("This task does not have a completed report.");
    saveCompletedReport(body.result);
  }

  async function continueRetainedJob(job) {
    setLoading(true);
    setError("");
    setCurrentJobId(job.id);
    setJobStatus(job.status);
    const startedAt = Number(job.createdAt) || Date.now();
    setCurrentJobStartedAt(startedAt);
    setElapsedNow(Date.now() - startedAt);
    saveActiveAuditJob({ id: job.id, startedAt });
    try {
      if (["stopped", "error", "interrupted"].includes(job.status)) {
        await controlAuditJob(job.id, "restart", "Could not restart retained task");
      } else if (job.status === "paused") {
        await controlRetainedJob(job.id, "resume");
      }
      await pollAuditJob(job.id);
    } finally {
      resetJobUi();
      loadRetainedJobs().catch(() => {});
    }
  }

  async function controlRetainedJob(jobId, action) {
    return controlAuditJob(jobId, action, "Could not control retained task");
  }

  async function deleteRetainedJob(jobId) {
    await removeAuditJob(jobId);
    if (currentJobId === jobId) clearActiveAuditJob();
    await loadRetainedJobs();
  }

  async function controlJob(action) {
    if (!currentJobId) return;
    const body = await controlAuditJob(currentJobId, action);
    if (action === "pause" && body.status === "paused") setPauseCount((count) => count + 1);
    setJobStatus(body.status);
  }

  async function pollAuditJob(jobId) {
    while (true) {
      let pollBody;
      try {
        pollBody = await runAuditJobBatch(jobId);
      } catch (error) {
        clearActiveAuditJob();
        throw error;
      }
      setJobStatus(pollBody.status);

      const progressView = auditProgressView(pollBody, t);
      setProgress(progressView);

      if (pollBody.status === "done") {
        clearActiveAuditJob();
        setProgress({ label: t.progressFinalizing, value: 100, meta: progressView.meta });
        saveCompletedReport(pollBody.result);
        return;
      }
      if (pollBody.status === "stopped") {
        clearActiveAuditJob();
        setProgress({ label: t.progressStopped, value: pollBody.progress?.percent || 0, meta: progressView.meta });
        return;
      } else if (pollBody.status === "error") {
        clearActiveAuditJob();
        throw new Error(pollBody.error || "Audit failed");
      }

      await new Promise((resolve) => window.setTimeout(resolve, pollBody.leaseBusy ? 1000 : 250));
    }
  }

  async function runAudit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    setCurrentJobStartedAt(Date.now());
    setPauseCount(0);
    setElapsedNow(0);
    setProgress({ label: t.progressPreparing, value: 5, meta: "" });
    try {
      const startBody = await startAuditJob({
        sitemapUrl,
        options: {
          contentChecks,
          performanceChecks,
          backgroundMode,
          internalCrawl,
          urlQueryPolicy,
          trailingSlashPolicy,
          robotsSource: directoryRobots ? "sitemap-directory" : "root",
          proxyEnabled: false,
        },
      });
      setCurrentJobId(startBody.id);
      setJobStatus(startBody.status);
      const startedAt = Date.now();
      setCurrentJobStartedAt(startedAt);
      saveActiveAuditJob({ id: startBody.id, startedAt });
      await pollAuditJob(startBody.id);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      resetJobUi();
    }
  }

  return (
    <>
      <a className="skip-link" href="#workspace-content">{t.skipToContent}</a>
      <main id="workspace-content" tabIndex="-1" ref={mainContentRef}>
      <header className="top">
        <div>
          <span className="mark">soos</span>
          <h1>{t.heading}</h1>
        </div>
        <div className="top-actions">
          <p>{t.subheading}</p>
          <label className="visually-hidden" htmlFor="language-select">{t.languageLabel}</label>
          <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="zh-CN">{"\u7b80\u4f53\u4e2d\u6587"}</option>
            <option value="zh-TW">{"\u7e41\u9ad4\u4e2d\u6587"}</option>
          </select>
        </div>
      </header>

      <nav className="workspace-nav" aria-label={workspaceCopy.navigation}>
        {workspaceViews.map(([view, Icon]) => (
          <button
            className={activeView === view ? "active" : ""}
            type="button"
            key={view}
            aria-current={activeView === view ? "page" : undefined}
            onClick={() => changeView(view, { focus: false })}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{workspaceCopy[view]}</span>
          </button>
        ))}
      </nav>

      <div className="workspace-view" hidden={activeView !== "scan"}>
        <form className="searchbar" onSubmit={runAudit}>
        <Search size={20} aria-hidden="true" />
        <label className="visually-hidden" htmlFor="audit-url">{t.auditUrlLabel}</label>
        <input
          id="audit-url"
          type="url"
          required
          placeholder={t.placeholder}
          value={sitemapUrl}
          onChange={(event) => setSitemapUrl(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <FileSearch size={18} aria-hidden="true" />}
          {t.audit}
        </button>
        </form>

        <ProgressBar progress={progress} />
        <RuntimePanel
        loading={loading}
        jobStatus={jobStatus}
        progress={progress}
        runtimeMeta={{ startedAt: currentJobStartedAt, elapsedMs: elapsedNow, stageElapsedMs: progress?.stageStartedAt ? Date.now() - progress.stageStartedAt : elapsedNow, pauseCount }}
        t={t}
        />
        <ProgressControls
        loading={loading}
        jobStatus={jobStatus}
        onPause={() => controlJob("pause").catch((err) => setError(formatApiError(err)))}
        onResume={() => controlJob("resume").catch((err) => setError(formatApiError(err)))}
        onStop={() => controlJob("stop").catch((err) => setError(formatApiError(err)))}
        t={t}
        />
      </div>

      <div className="workspace-view" hidden={activeView !== "settings"}>
        <label className="option-toggle">
        <input type="checkbox" checked={contentChecks} onChange={(event) => setContentChecks(event.target.checked)} />
        <span>
          <strong>{t.pageChecksTitle}</strong>
          <small>{t.pageChecksHelp}</small>
        </span>
        </label>

        <label className="option-toggle">
        <input type="checkbox" checked={performanceChecks} onChange={(event) => setPerformanceChecks(event.target.checked)} />
        <span>
          <strong>{t.performanceChecksTitle || "Performance checks"}</strong>
          <small>{t.performanceChecksHelp || "TTFB, HTML size, scripts, stylesheets, images, and lightweight CWV readiness signals"}</small>
        </span>
        </label>

        <label className="option-toggle">
        <input type="checkbox" checked={backgroundMode} onChange={(event) => setBackgroundMode(event.target.checked)} />
        <span>
          <strong>{t.backgroundModeTitle || "Background worker mode"}</strong>
          <small>{t.backgroundModeHelp || "Raise the scan limit to 2000 URLs and keep the job available longer"}</small>
        </span>
        </label>

        <label className="option-toggle">
        <input type="checkbox" checked={internalCrawl} onChange={(event) => setInternalCrawl(event.target.checked)} />
        <span>
          <strong>{t.internalCrawlTitle}</strong>
          <small>{t.internalCrawlHelp}</small>
        </span>
        </label>

        <section className="url-policy-settings">
        <div className="url-policy-copy">
          <strong>{t.urlPolicyTitle}</strong>
          <small>{t.urlPolicyHelp}</small>
        </div>
        <label>
          <strong>{t.queryPolicy}</strong>
          <select value={urlQueryPolicy} onChange={(event) => setUrlQueryPolicy(event.target.value)}>
            <option value="preserve">{t.queryPreserve}</option>
            <option value="strip_tracking">{t.queryStripTracking}</option>
            <option value="drop_all">{t.queryDropAll}</option>
          </select>
        </label>
        <label>
          <strong>{t.trailingSlashPolicy}</strong>
          <select value={trailingSlashPolicy} onChange={(event) => setTrailingSlashPolicy(event.target.value)}>
            <option value="preserve">{t.slashPreserve}</option>
            <option value="remove">{t.slashRemove}</option>
            <option value="add">{t.slashAdd}</option>
          </select>
        </label>
        </section>

        <label className="option-toggle">
        <input type="checkbox" checked={directoryRobots} onChange={(event) => setDirectoryRobots(event.target.checked)} />
        <span>
          <strong>{t.directoryRobotsTitle}</strong>
          <small>{t.directoryRobotsHelp}</small>
        </span>
        </label>

        <PrivacyDataPanel
          language={language}
          onDeleted={() => {
            setSitemapUrl("");
            setReport(null);
            setHistory([]);
            setHistoryLimit(12);
            setComparisonEntry(null);
            setGscRows([]);
            setGscStatus({ configured: false });
            setGscSiteUrl("");
            setRetainedJobs([]);
            setRetainedJobsMeta({
              total: 0,
              page: 1,
              pageSize: 10,
              pageCount: 1,
              retentionSeconds: 0,
              storage: "memory",
            });
            setRetainedJobsQuery("");
            setRetainedJobsStatus("");
            setRetainedJobsLoading(false);
            setError("");
            setLoading(false);
            setProgress(null);
            setCurrentJobId(null);
            setJobStatus(null);
            setCurrentJobStartedAt(null);
            setElapsedNow(0);
            setPauseCount(0);
            setDataResetKey((value) => value + 1);
          }}
        />
      </div>

      <div className="workspace-view" hidden={activeView !== "google"}>
        <SearchConsoleApiConfig key={`gsc-config-${dataResetKey}`} status={gscStatus} onStatus={setGscStatus} siteUrl={gscSiteUrl} onSiteUrlChange={setGscSiteUrl} language={language} />
        <SearchAnalyticsPanel key={`gsc-analytics-${dataResetKey}`} status={gscStatus} siteUrl={gscSiteUrl} onRows={setGscRows} language={language} />
        <GscSitemapsPanel key={`gsc-sitemaps-${dataResetKey}`} status={gscStatus} siteUrl={gscSiteUrl} currentSitemapUrl={report?.input?.sitemapUrl} language={language} />
        <SearchConsoleImport key={`gsc-import-${dataResetKey}`} rows={gscRows} onImport={setGscRows} onClear={() => setGscRows([])} language={language} />
      </div>

      <div className="workspace-view" hidden={activeView !== "history"}>
        <RetainedJobsPanel
        jobs={retainedJobs}
        loading={retainedJobsLoading}
        meta={retainedJobsMeta}
        query={retainedJobsQuery}
        status={retainedJobsStatus}
        t={t}
        onQueryChange={setRetainedJobsQuery}
        onStatusChange={(value) => {
          setRetainedJobsStatus(value);
          loadRetainedJobs({ page: 1, status: value }).catch((err) => setError(formatApiError(err)));
        }}
        onSearch={(event) => {
          event.preventDefault();
          loadRetainedJobs({ page: 1 }).catch((err) => setError(formatApiError(err)));
        }}
        onPageChange={(page) => loadRetainedJobs({ page }).catch((err) => setError(formatApiError(err)))}
        onRefresh={() => loadRetainedJobs().catch((err) => setError(formatApiError(err)))}
        onOpen={(id) => openRetainedReport(id).catch((err) => setError(formatApiError(err)))}
        onContinue={(job) => continueRetainedJob(job).catch((err) => setError(formatApiError(err)))}
        onDelete={(id) => deleteRetainedJob(id).catch((err) => setError(formatApiError(err)))}
        />
        <HistoryPanel
        history={history}
        currentReport={report}
        historyLimit={historyLimit}
        t={t}
        onRerun={(entry) => {
          setSitemapUrl(entry.input?.originalUrl || entry.input?.sitemapUrl || "");
          setComparisonEntry(null);
        }}
        onCompare={(entry) => setComparisonEntry(entry)}
        onDelete={(id) => {
          const nextHistory = history.filter((entry) => entry.id !== id);
          setHistory(nextHistory);
          saveHistory(nextHistory);
          if (comparisonEntry?.id === id) {
            setComparisonEntry(null);
          }
        }}
        onClear={() => {
          setHistory([]);
          saveHistory([]);
          setComparisonEntry(null);
        }}
        onLimitChange={(limit) => {
          setHistoryLimit(limit);
          saveHistoryLimit(limit);
          const nextHistory = history.slice(0, limit);
          setHistory(nextHistory);
          saveHistory(nextHistory);
          if (comparisonEntry && !nextHistory.some((entry) => entry.id === comparisonEntry.id)) {
            setComparisonEntry(null);
          }
        }}
        />
        <ComparisonPanel comparisonEntry={comparisonEntry} report={report} t={t} />
      </div>

      {error ? <div className="error" role="alert">{error}</div> : null}
      <Report
        report={report}
        t={t}
        gscRows={gscRows}
        gscStatus={gscStatus}
        gscSiteUrl={gscSiteUrl}
        language={language}
        activeView={activeView}
        onViewChange={changeView}
        comparisonEntry={comparisonEntry}
      />
      </main>
    </>
  );
}

const reactRootKey = Symbol.for("soos.reactRoot");
const reactRootElement = document.getElementById("root");
const reactRoot = reactRootElement[reactRootKey] || createRoot(reactRootElement);
reactRootElement[reactRootKey] = reactRoot;

reactRoot.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

