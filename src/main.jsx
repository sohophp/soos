import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileSearch,
  Globe2,
  Loader2,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { absoluteLogUrl, parseAccessLog, STATIC_ASSET_PATH } from "./googlebot-log.js";
import { buildUrlInspectionCandidates, inspectionCandidateKey } from "./url-inspection-candidates.js";
import { buildInternalLinkGraph } from "./link-graph.js";
import { analyzeUrlVariantGroup, comparisonUrl, normalizeReportUrl, urlVariantFamily } from "./url-policy.js";
import { apiPost } from "./api-client.js";
import {
  getGscStatus,
  inspectGscUrls,
  loadGscSearchAnalytics,
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
import { SearchConsoleApiConfig } from "./components/SearchConsoleApiConfig.jsx";
import {
  detectLanguage,
  dictionaries,
  formatText,
  googlebotLogText,
  gscDataText,
  gscSupportingText,
  gscUiText,
  inspectionDiagnosisText,
  structuredDiagnosticText,
} from "./i18n.js";
import "./styles.css";

const severityLabels = { critical: "Critical", warning: "Warning", notice: "Notice" };
const severityIcons = { critical: XCircle, warning: AlertTriangle, notice: ShieldAlert };


function Badge({ severity, children }) {
  const Icon = severityIcons[severity] || CheckCircle2;
  return (
    <span className={`badge badge-${severity || "ok"}`}>
      <Icon size={14} />
      {children}
    </span>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ progress }) {
  if (!progress) return null;
  return (
    <section className="progress-panel">
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
      <div className="runtime-grid">
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
function ScoreCard({ score, t }) {
  const tone = score >= 85 ? "good" : score >= 65 ? "warn" : "bad";
  return (
    <section className={`score score-${tone}`}>
      <div>
        <span>{t.healthScore}</span>
        <strong>{score}</strong>
      </div>
      <p>{score >= 85 ? t.cleanSignals : score >= 65 ? t.needsCleanup : t.likelyBlockers}</p>
    </section>
  );
}

function ExecutiveSummary({ summary, t }) {
  if (!summary?.headline) return null;
  return (
    <section className="panel executive-summary">
      <div className="panel-head">
        <h2>{t.executiveSummary}</h2>
      </div>
      <div className="executive-body">
        <p>{summary.headline}</p>
        {summary.topActions?.length ? (
          <div className="executive-actions">
            <strong>{t.priorityActions}</strong>
            {summary.topActions.map((action) => (
              <small key={action}>{action}</small>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusFlags({ flags, t }) {
  if (!flags?.length) return null;
  return (
    <section className="panel status-flags">
      <div className="panel-head">
        <h2>{t.statusFlags}</h2>
      </div>
      <div className="status-flag-list">
        {flags.map((flag) => (
          <Badge key={flag.key} severity={flag.severity}>
            {flag.label}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ t }) {
  return (
    <section className="empty">
      <FileSearch size={42} />
      <p>{t.placeholder}</p>
    </section>
  );
}

function PerformanceSignals({ page, t }) {
  if (!page.performance) return null;
  const perf = page.performance;
  const kb = Math.round((perf.htmlBytes || 0) / 1024);
  return (
    <div className="signals performance-signals">
      <div><strong>{t.performance || "Performance"}</strong><span>{perf.ttfbMs ? `${perf.ttfbMs}ms TTFB` : "TTFB unknown"}</span></div>
      <div><strong>HTML</strong><span>{kb}KB</span></div>
      <div><strong>Resources</strong><span>{perf.scriptCount || 0} JS / {perf.stylesheetCount || 0} CSS / {perf.imageCount || 0} IMG</span></div>
    </div>
  );
}
function PageRow({ page, t }) {
  const [open, setOpen] = useState(false);
  const firstIssue = page.issues[0];
  const hasSignals =
    page.title != null ||
    page.description != null ||
    page.h1Count != null ||
    page.lang != null ||
    page.viewport != null ||
    page.structuredData != null;
  return (
    <article className="row">
      <button className="row-main" type="button" onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={open ? "rotated" : ""} size={18} />
        <div className="url-cell">
          <span>{page.url}</span>
          {page.finalUrl && page.finalUrl !== page.url ? <small>{t.final}: {page.finalUrl}</small> : null}
          {page.redirectChain?.length ? <small>{t.redirectChain}: {page.redirectChain.length} {t.redirectHops}</small> : null}
        </div>
        <div className="row-status">
          <span className="http">{page.status || "ERR"}</span>
          {firstIssue ? <Badge severity={firstIssue.severity}>{severityLabels[firstIssue.severity]}</Badge> : <Badge>OK</Badge>}
        </div>
      </button>
      {open ? (
        <div className="row-detail">
          {page.redirectChain?.length ? (
            <div className="redirect-chain">
              <strong>{t.redirectChain}</strong>
              {page.redirectChain.map((hop, index) => (
                <small key={`${hop.url}-${hop.status}-${index}`}>
                  {index + 1}. HTTP {hop.status} / {hop.url} {"->"} {hop.targetUrl || hop.location || t.unknown}
                </small>
              ))}
            </div>
          ) : null}
          {hasSignals ? (
            <div className="signals">
              <div>
                <strong>{t.title}</strong>
                <span>{page.title || t.missing}</span>
              </div>
              <div>
                <strong>{t.description}</strong>
                <span>{page.description || t.missing}</span>
              </div>
              <div>
                <strong>{t.h1}</strong>
                <span>{page.h1Count ?? t.unknown}</span>
              </div>
              <div>
                <strong>{t.lang}</strong>
                <span>{page.lang || t.missing}</span>
              </div>
              <div>
                <strong>{t.viewport}</strong>
                <span>{page.viewport ? t.present : t.missing}</span>
              </div>
              <div>
                <strong>{t.jsonLd}</strong>
                <span>
                  {page.structuredData?.count
                    ? formatText(t.validInvalid, { valid: page.structuredData.validCount, invalid: page.structuredData.invalidCount })
                    : t.noneFound}
                </span>
              </div>
            </div>
          ) : null}
          {page.canonical ? (
            <p>
              <strong>{t.canonical}</strong>
              <a href={page.canonical} target="_blank" rel="noreferrer">
                {page.canonical}
                <ExternalLink size={14} />
              </a>
            </p>
          ) : null}
          {page.alternates?.length ? (
            <p>
              <strong>{t.alternates}</strong>
              <span>{page.alternates.length} {t.hreflangLinks}</span>
            </p>
          ) : null}
          <div className="issues">
            {page.googleReasons?.length ? (
              <div className="reason-box">
                <strong>{t.likelyOutcome}</strong>
                {page.googleReasons.map((reason) => (
                  <div className="reason" key={reason.code}>
                    <Badge severity={reason.severity}>{reason.label}</Badge>
                    <span>{reason.detail}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {page.issues.length ? (
              page.issues.map((issue, index) => (
                <div className={`issue issue-${issue.severity}`} key={`${issue.type}-${index}`}>
                  <Badge severity={issue.severity}>{issue.type}</Badge>
                  <span>{issue.message}</span>
                  {issue.detail ? <small>{issue.detail}</small> : null}
                </div>
              ))
            ) : (
              <div className="issue issue-ok">
                <Badge>OK</Badge>
                <span>{t.noBlockers}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Backlog({ backlog, t }) {
  if (!backlog?.length) {
    return (
      <section className="panel backlog">
        <div className="panel-head">
          <h2>{t.fixFirst}</h2>
        </div>
        <div className="clean">
          <CheckCircle2 size={20} />
          <span>{t.noPriority}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel backlog">
      <div className="panel-head">
        <h2>{t.fixFirst}</h2>
        <span>{backlog.length} {t.tasks}</span>
      </div>
      <div className="tasks">
        {backlog.map((task) => (
          <article className={`task task-${task.severity}`} key={task.key}>
            <div className="task-top">
              <Badge severity={task.severity}>{task.count} affected</Badge>
              <h3>{task.title}</h3>
            </div>
            <p>{task.action}</p>
            {task.sampleUrls?.length ? (
              <div className="samples">
                {task.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Sitemaps({ sitemaps, t }) {
  if (!sitemaps?.length) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.sitemaps}</h2>
        <span>{sitemaps.length}</span>
      </div>
      <div className="sitemap-list">
        {sitemaps.map((sitemap) => (
          <div className="sitemap" key={sitemap.url}>
            <Globe2 size={16} />
            <span>{sitemap.url}</span>
            <em>{sitemap.kind}</em>
            <strong>{sitemap.locCount}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function RobotsDetails({ robots, t, onSelectIssue }) {
  const [copiedRule, setCopiedRule] = useState("");
  if (!robots?.found) return null;
  const analysis = robots.analysis;
  const impactLabels = {
    submitted_url: t.blockedSubmittedUrls,
    canonical_target: t.blockedCanonicalTargets,
    alternate_target: t.blockedAlternateTargets,
  };
  return (
    <section className="panel robots-detail">
      <div className="panel-head">
        <h2>{t.robotsAnalysis}</h2>
        <span>{analysis?.ruleCount || 0} {t.rules}</span>
      </div>
      <div className="robots-metrics">
        <Stat label={t.googleGroups} value={analysis?.googleGroupCount || 0} />
        <Stat label={t.sitemapDirectives} value={robots.sitemapDirectives?.length || 0} />
        <Stat label={t.critical} value={analysis?.issues?.filter((issue) => issue.severity === "critical").length || 0} tone="bad" />
      </div>
      {analysis?.issues?.length ? (
        <div className="issues robots-issues">
          {analysis.issues.map((issue) => (
            <div className={`issue issue-${issue.severity}`} key={issue.type}>
              <Badge severity={issue.severity}>{issue.type}</Badge>
              <span>{issue.message}</span>
              {issue.detail ? <small>{issue.detail}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {robots.sitemapDirectives?.length ? (
        <div className="robot-sitemaps">
          {robots.sitemapDirectives.map((url) => (
            <small key={url}>{url}</small>
          ))}
        </div>
      ) : null}
      {analysis?.blockedSummaries?.length ? (
        <div className="robots-impact">
          <div className="panel-head">
            <h2>{t.robotsImpact}</h2>
            <span>{analysis.blockedSummaries.length}</span>
          </div>
          <div className="impact-list">
            {analysis.blockedSummaries.map((item) => (
              <article className="impact-card" key={`${item.scope}-${item.rule}`}>
                <div className="impact-top">
                  <Badge severity="warning">{impactLabels[item.scope] || item.scope}</Badge>
                  <strong>{item.rule}</strong>
                  <span>{item.count}</span>
                </div>
                {item.details?.length ? (
                  <div className="impact-details">
                    {item.details.map((detail) => (
                      <small key={detail}>{detail}</small>
                    ))}
                  </div>
                ) : null}
                {item.sampleUrls?.length ? (
                  <div className="impact-samples">
                    <strong>{t.sampleUrls}</strong>
                    {item.sampleUrls.map((url) => (
                      <small key={url}>{url}</small>
                    ))}
                  </div>
                ) : null}
                <button
                  className="impact-filter"
                  type="button"
                  onClick={() =>
                    onSelectIssue?.({
                      type:
                        item.scope === "submitted_url"
                          ? "robots_disallow"
                          : item.scope === "canonical_target"
                            ? "canonical_blocked"
                            : "alternate_blocked",
                    })
                  }
                >
                  {t.showMatchingUrls}
                </button>
                {item.affectedUrls?.length ? (
                  <button
                    className="impact-filter"
                    type="button"
                    onClick={async () => {
                      const key = `${item.scope}-${item.rule}`;
                      await navigator.clipboard.writeText(item.affectedUrls.join("\n"));
                      setCopiedRule(key);
                      window.setTimeout(() => setCopiedRule((current) => (current === key ? "" : current)), 1600);
                    }}
                  >
                    {copiedRule === `${item.scope}-${item.rule}` ? t.copiedBlockedUrls : t.copyBlockedUrls}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {robots.contentPreview ? (
        <details className="robots-content">
          <summary>{t.robotsContent}</summary>
          <pre>{robots.contentPreview}</pre>
        </details>
      ) : null}
    </section>
  );
}

function SitemapSignals({ signals, t, onSelectIssue }) {
  if (!signals?.length) return null;

  const signalLabels = {
    redirect: t.redirectUrlsInSitemap,
    noindex: t.noindexUrlsInSitemap,
    canonical_mismatch: t.canonicalizedElsewhere,
    canonical_not_in_sitemap: t.canonicalMissingFromSitemap,
    http_error: t.brokenUrlsInSitemap,
  };

  return (
    <section className="panel sitemap-signals">
      <div className="panel-head">
        <h2>{t.sitemapSignals}</h2>
        <span>{signals.length}</span>
      </div>
      <div className="impact-list">
        {signals.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={item.key === "http_error" || item.key === "noindex" ? "critical" : "warning"}>
                {item.scope === "canonical_target" ? t.blockedCanonicalTargets : t.blockedSubmittedUrls}
              </Badge>
              <strong>{signalLabels[item.key] || item.title}</strong>
              <span>{item.count}</span>
            </div>
            {item.details?.length ? (
              <div className="impact-samples">
                <strong>{t.relatedTargets}</strong>
                {item.details.map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
            ) : null}
            {item.sampleUrls?.length ? (
              <div className="impact-samples">
                <strong>{t.sampleUrls}</strong>
                {item.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
            <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: item.key })}>
              {t.showMatchingUrls}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function InternationalSignals({ signals, t, onSelectIssue }) {
  if (!signals?.length) return null;

  const signalLabels = {
    alternate_not_reciprocal: t.alternateNotReciprocal,
    alternate_target_canonical_mismatch: t.alternateCanonicalMismatch,
    alternate_hreflang_invalid: t.invalidHreflangValues,
  };

  return (
    <section className="panel sitemap-signals">
      <div className="panel-head">
        <h2>{t.internationalSignals}</h2>
        <span>{signals.length}</span>
      </div>
      <div className="impact-list">
        {signals.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity="warning">{t.blockedAlternateTargets}</Badge>
              <strong>{signalLabels[item.key] || item.title}</strong>
              <span>{item.count}</span>
            </div>
            {item.details?.length ? (
              <div className="impact-samples">
                <strong>{t.relatedTargets}</strong>
                {item.details.map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
            ) : null}
            {item.sampleUrls?.length ? (
              <div className="impact-samples">
                <strong>{t.sampleUrls}</strong>
                {item.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
            <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: item.key })}>
              {t.showMatchingUrls}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
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

function downloadCsvFile(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

function downloadCsv(report, gscRows = []) {
  const gscByUrl = buildGscRowMap(gscRows);
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

  for (const page of report.pages || []) {
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
  for (const row of (gscRows || []).filter((item) => !sitemapKeys.has(item.key))) {
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
function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
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

const HISTORY_KEY = "soos.auditHistory.v1";
const HISTORY_LIMIT_KEY = "soos.auditHistory.limit.v1";
const HISTORY_LIMIT_OPTIONS = [5, 10, 12, 20, 30];

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage failures
  }
}

function loadHistoryLimit() {
  try {
    const raw = Number(window.localStorage.getItem(HISTORY_LIMIT_KEY) || 12);
    return HISTORY_LIMIT_OPTIONS.includes(raw) ? raw : 12;
  } catch {
    return 12;
  }
}

function saveHistoryLimit(limit) {
  try {
    window.localStorage.setItem(HISTORY_LIMIT_KEY, String(limit));
  } catch {
    // ignore storage failures
  }
}

function toHistoryEntry(report) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    scannedAt: report.scannedAt,
    input: report.input,
    summary: report.summary,
    executiveSummary: report.executiveSummary,
    statusFlags: report.statusFlags,
    issueFingerprints: (report.pages || []).flatMap((page) =>
      (page.issues || []).map((issue) => ({
        key: `${normalizeReportUrl(page.url)}|${issue.type}`,
        url: page.url,
        type: issue.type,
        severity: issue.severity,
      })),
    ).slice(0, 10000),
  };
}

function trendLabel(current, previous, t) {
  if (previous == null || current == null) return null;
  if (current > previous) return t.trendUp;
  if (current < previous) return t.trendDown;
  return t.trendFlat;
}

function buildIssueDelta(previousEntry, currentReport) {
  if (!previousEntry || !currentReport) {
    return { improved: [], worsened: [], regressions: [], resolved: [] };
  }

  const previousCounts = previousEntry.summary?.issueCounts || {};
  const currentCounts = currentReport.summary?.issueCounts || {};
  const severities = ["critical", "warning", "notice"];

  const improved = [];
  const worsened = [];

  for (const severity of severities) {
    const before = previousCounts[severity] || 0;
    const after = currentCounts[severity] || 0;
    if (after < before) {
      improved.push({ severity, delta: before - after });
    } else if (after > before) {
      worsened.push({ severity, delta: after - before });
    }
  }

  const previousIssues = new Map((previousEntry.issueFingerprints || []).map((item) => [item.key, item]));
  const currentIssues = new Map(
    (currentReport.pages || []).flatMap((page) =>
      (page.issues || []).map((issue) => ({
        key: `${normalizeReportUrl(page.url)}|${issue.type}`,
        url: page.url,
        type: issue.type,
        severity: issue.severity,
      })),
    ).map((item) => [item.key, item]),
  );
  const regressions = [...currentIssues].filter(([key]) => !previousIssues.has(key)).map(([, item]) => item);
  const resolved = [...previousIssues].filter(([key]) => !currentIssues.has(key)).map(([, item]) => item);
  return { improved, worsened, regressions, resolved };
}

function summarizeCategoryCountsFromReportLike(reportLike) {
  const flags = reportLike?.statusFlags || [];
  const counts = {
    robots: 0,
    sitemap: 0,
    canonical: 0,
    international: 0,
    content: 0,
    fetch: 0,
  };

  for (const flag of flags) {
    if (flag.key === "robots_blocked") counts.robots += 1;
    if (flag.key === "sitemap_misaligned") counts.sitemap += 1;
    if (flag.key === "canonical_conflict") counts.canonical += 1;
    if (flag.key === "international_mismatch") counts.international += 1;
  }

  return counts;
}

function buildCategoryDelta(previousEntry, currentReport) {
  const previous = summarizeCategoryCountsFromReportLike(previousEntry);
  const current = summarizeCategoryCountsFromReportLike(currentReport);
  const keys = ["robots", "sitemap", "canonical", "international", "content", "fetch"];

  return keys
    .map((key) => ({
      key,
      before: previous[key] || 0,
      after: current[key] || 0,
      delta: (current[key] || 0) - (previous[key] || 0),
    }))
    .filter((item) => item.before !== item.after);
}

function HistoryPanel({ history, currentReport, historyLimit, t, onRerun, onCompare, onDelete, onClear, onLimitChange }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{t.history}</h2>
        <div className="history-head-actions">
          <label className="history-limit">
            <span>{t.keepRecent}</span>
            <select value={historyLimit} onChange={(event) => onLimitChange(Number(event.target.value))}>
              {HISTORY_LIMIT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button className="export-button" type="button" onClick={onClear} disabled={!history.length}>
            {t.clearHistory}
          </button>
          <span>{history.length}</span>
        </div>
      </div>
      {!history.length ? (
        <p className="none">{t.noHistory}</p>
      ) : (
        <div className="history-list">
          {history.map((entry) => (
            <article className="history-card" key={entry.id}>
              <div className="history-top">
                <strong>{entry.input?.originalUrl || entry.input?.sitemapUrl}</strong>
                <small>{new Date(entry.scannedAt).toLocaleString()}</small>
              </div>
              <div className="history-stats">
                <span>{t.historyScore}: {entry.summary?.healthScore ?? "-"}</span>
                <span>{t.historyUrls}: {entry.summary?.urlCount ?? 0}</span>
                <span>{t.historyAffected}: {entry.summary?.affectedUrlCount ?? 0}</span>
              </div>
              {currentReport && currentReport.scannedAt !== entry.scannedAt ? (
                <div className="history-compare">
                  <small>{t.historyScore}: {trendLabel(currentReport.summary?.healthScore, entry.summary?.healthScore, t) || "-"}</small>
                  <small>
                    {t.historyAffected}: {trendLabel(entry.summary?.affectedUrlCount, currentReport.summary?.affectedUrlCount, {
                      ...t,
                      trendUp: t.trendDown,
                      trendDown: t.trendUp,
                      trendFlat: t.trendFlat,
                    }) || "-"}
                  </small>
                </div>
              ) : null}
              {expandedId === entry.id ? (
                <div className="history-detail">
                  {entry.statusFlags?.length ? (
                    <div className="status-flag-list history-flags">
                      {entry.statusFlags.map((flag) => (
                        <Badge key={`${entry.id}-${flag.key}`} severity={flag.severity}>
                          {flag.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {entry.executiveSummary?.headline ? (
                    <div className="executive-actions">
                      <small>{entry.executiveSummary.headline}</small>
                      {(entry.executiveSummary.topActions || []).map((action) => (
                        <small key={`${entry.id}-${action}`}>{action}</small>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="history-actions">
                <button
                  className="export-button"
                  type="button"
                  onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                >
                  {expandedId === entry.id ? t.hideDetails : t.details}
                </button>
                <button className="export-button" type="button" onClick={() => onRerun(entry)}>
                  {t.rerun}
                </button>
                <button className="export-button" type="button" onClick={() => onCompare(entry)}>
                  {t.compareToCurrent}
                </button>
                <button className="export-button" type="button" onClick={() => onDelete(entry.id)}>
                  {t.deleteHistory}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RetainedJobsPanel({ jobs, loading, t, onRefresh, onOpen, onContinue, onDelete }) {
  return (
    <section className="panel retained-jobs">
      <div className="panel-head">
        <div>
          <h2>{t.retainedJobs}</h2>
          <small>{t.retainedJobsHelp}</small>
        </div>
        <div className="history-head-actions">
          <button className="export-button" type="button" onClick={onRefresh} disabled={loading}>
            {t.refreshJobs}
          </button>
          <span>{jobs.length}</span>
        </div>
      </div>
      {!jobs.length ? (
        <p className="none">{t.noRetainedJobs}</p>
      ) : (
        <div className="retained-job-list">
          {jobs.map((job) => {
            const canContinue = ["queued", "paused", "stopped", "error", "interrupted"].includes(job.status);
            return (
              <article className="retained-job-row" key={job.id}>
                <div>
                  <strong>{job.request?.sitemapUrl || job.id}</strong>
                  <small>{job.id}</small>
                </div>
                <Badge severity={job.status === "done" ? "ok" : job.status === "error" || job.status === "interrupted" ? "warning" : "notice"}>
                  {job.status}
                </Badge>
                <div className="retained-job-meta">
                  <small>{t.jobProgress}: {job.progress?.percent || 0}%</small>
                  <small>{t.jobUpdated}: {new Date(job.updatedAt).toLocaleString()}</small>
                  {job.summary ? <small>{t.historyScore}: {job.summary.healthScore ?? "-"} / {t.historyUrls}: {job.summary.urlCount ?? 0}</small> : null}
                </div>
                <div className="history-actions">
                  {job.status === "done" ? (
                    <button className="export-button" type="button" onClick={() => onOpen(job.id)}>{t.openReport}</button>
                  ) : null}
                  {canContinue ? (
                    <button className="export-button" type="button" onClick={() => onContinue(job)}>{t.continueJob}</button>
                  ) : null}
                  {!["running", "queued"].includes(job.status) ? (
                    <button className="export-button" type="button" onClick={() => onDelete(job.id)}>{t.deleteHistory}</button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ComparisonPanel({ comparisonEntry, report, t }) {
  if (!comparisonEntry || !report) return null;
  const delta = buildIssueDelta(comparisonEntry, report);
  const categoryDelta = buildCategoryDelta(comparisonEntry, report);

  return (
    <section className="panel executive-summary">
      <div className="panel-head">
        <h2>{t.compareToCurrent}</h2>
      </div>
      <div className="executive-body">
        <p>
          {t.historyScore}: {comparisonEntry.summary?.healthScore ?? "-"} {"->"} {report.summary?.healthScore ?? "-"};{" "}
          {t.historyAffected}: {comparisonEntry.summary?.affectedUrlCount ?? 0} {"->"} {report.summary?.affectedUrlCount ?? 0}
        </p>
        {delta.improved.length || delta.worsened.length ? (
          <div className="delta-grid">
            {delta.improved.length ? (
              <div className="delta-card delta-good">
                <strong>{t.improvedIssues}</strong>
                {delta.improved.map((item) => (
                  <small key={`improved-${item.severity}`}>{item.severity}: -{item.delta}</small>
                ))}
              </div>
            ) : null}
            {delta.worsened.length ? (
              <div className="delta-card delta-bad">
                <strong>{t.worsenedIssues}</strong>
                {delta.worsened.map((item) => (
                  <small key={`worsened-${item.severity}`}>{item.severity}: +{item.delta}</small>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="executive-actions">
            <small>{t.noDelta}</small>
          </div>
        )}
        {categoryDelta.length ? (
          <div className="delta-grid">
            <div className="delta-card">
              <strong>{t.categoryDelta}</strong>
              {categoryDelta.map((item) => (
                <small key={item.key}>
                  {item.key}: {item.before} {"->"} {item.after}
                </small>
              ))}
            </div>
          </div>
        ) : null}
        {comparisonEntry.issueFingerprints ? (
          <div className="delta-grid">
            <div className="delta-card delta-bad">
              <strong>{t.regressions}: {delta.regressions.length}</strong>
              {delta.regressions.length
                ? delta.regressions.slice(0, 20).map((item) => <small key={`regression-${item.key}`}>{item.severity} · {item.type} · {item.url}</small>)
                : <small>{t.noRegressions}</small>}
            </div>
            <div className="delta-card delta-good">
              <strong>{t.resolvedIssues}: {delta.resolved.length}</strong>
              {delta.resolved.slice(0, 20).map((item) => <small key={`resolved-${item.key}`}>{item.severity} · {item.type} · {item.url}</small>)}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}



function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseCsvRows(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (delimiter !== "whitespace" && char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
function parseSearchConsoleCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const normalizeHeader = (header) => header.trim().toLowerCase().replace(/^\ufeff/, "");
  const pageHeaders = [
    "page",
    "pages",
    "url",
    "landing page",
    "\u9875\u9762",
    "\u7f51\u9875",
    "\u7db2\u5740",
    "\u7db2\u9801",
    "\u6392\u540d\u9760\u524d\u7684\u7f51\u9875",
    "\u6392\u540d\u9760\u524d\u7684\u7db2\u9801",
  ];
  const clickHeaders = ["clicks", "\u70b9\u51fb\u6b21\u6570", "\u9ede\u64ca\u6b21\u6578"];
  const impressionHeaders = ["impressions", "\u5c55\u793a\u6b21\u6570", "\u5c55\u793a", "\u66dd\u5149\u6b21\u6578", "\u66dd\u5149"];
  const ctrHeaders = ["ctr", "\u70b9\u51fb\u7387", "\u9ede\u95b1\u7387"];
  const positionHeaders = ["position", "average position", "avg position", "\u6392\u540d", "\u5e73\u5747\u6392\u540d", "\u5e73\u5747\u6392\u540d\u4f4d\u7f6e"];

  const headerCandidates = rows.slice(0, 10).map((row, index) => ({
    index,
    headers: row.map(normalizeHeader),
  }));
  const findHeaderIn = (headers, candidates) => candidates.map((candidate) => headers.indexOf(candidate)).find((index) => index >= 0);
  const headerMatch = headerCandidates.find(({ headers }) => {
    const pageIndex = findHeaderIn(headers, pageHeaders);
    const clicksIndex = findHeaderIn(headers, clickHeaders);
    return pageIndex !== undefined && clicksIndex !== undefined;
  });
  if (!headerMatch) return [];

  const headers = headerMatch.headers;
  const findHeader = (candidates) => findHeaderIn(headers, candidates);
  const pageIndex = findHeader(pageHeaders);
  const clicksIndex = findHeader(clickHeaders);
  const impressionsIndex = findHeader(impressionHeaders);
  const ctrIndex = findHeader(ctrHeaders);
  const positionIndex = findHeader(positionHeaders);
  if (pageIndex === undefined) return [];
  return rows.slice(headerMatch.index + 1).map((row) => {
    const page = row[pageIndex]?.trim();
    if (!page || !/^https?:\/\//i.test(page)) return null;
    const numberValue = (index) => {
      if (index === undefined) return null;
      const raw = String(row[index] || "").replace(/[% ,]/g, "");
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    return {
      page,
      key: normalizeReportUrl(page),
      clicks: numberValue(clicksIndex),
      impressions: numberValue(impressionsIndex),
      ctr: numberValue(ctrIndex),
      position: numberValue(positionIndex),
    };
  }).filter(Boolean);
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




function defaultGscDateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}











function buildSearchAnalyticsInsights(rows, dimension, language = "en") {
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : "en";
  const insightText = {
    "zh-CN": {
      low_ctr: ["高展示、低点击率", "重写标题和 meta description，使摘要更符合查询意图并提高点击吸引力。"],
      snippet_gap: ["排名靠前但几乎没有点击", "检查页面是否匹配查询意图，并改进标题、描述和首屏答案。"],
      striking_distance: ["接近首页顶部的排名机会", "加强回答该查询的内容段落，增加内部链接并提高摘要相关性。"],
      page_two: ["第二页排名机会", "扩展内容深度，从更强的相关页面增加内部链接，并对比首页结果的内容差距。"],
      intent_spread: ["页面覆盖多个查询意图", "围绕最强的搜索意图重新组织页面，并检查是否需要拆分内容。"],
    },
    "zh-TW": {
      low_ctr: ["高曝光、低點閱率", "重寫標題和 meta description，使摘要更符合查詢意圖並提高點擊吸引力。"],
      snippet_gap: ["排名靠前但幾乎沒有點擊", "檢查頁面是否符合查詢意圖，並改善標題、描述和首屏答案。"],
      striking_distance: ["接近首頁頂部的排名機會", "加強回答該查詢的內容段落，增加內部連結並提高摘要相關性。"],
      page_two: ["第二頁排名機會", "擴充內容深度，從更強的相關頁面增加內部連結，並比較首頁結果的內容差距。"],
      intent_spread: ["頁面涵蓋多個查詢意圖", "圍繞最強的搜尋意圖重新組織頁面，並檢查是否需要拆分內容。"],
    },
  };
  if (dimension !== "page_query") return [];
  const pageQueryRows = (rows || []).filter((row) => row.page && row.query);
  const insights = [];
  const seenInsightDetails = new Set();
  function addInsight(insight) {
    const key = insight.detail;
    if (seenInsightDetails.has(key)) return;
    seenInsightDetails.add(key);
    insights.push(insight);
  }
  const lowCtr = pageQueryRows
    .filter((row) => (row.impressions || 0) >= 100 && typeof row.ctr === "number" && row.ctr < 0.01)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of lowCtr) {
    addInsight({
      type: "low_ctr",
      severity: "warning",
      title: "High impressions, low CTR",
      detail: `${row.query} on ${row.page}`,
      action: "Rewrite title/meta description to match the query intent and make the result more clickable.",
      metrics: `${row.impressions} impressions, ${((row.ctr || 0) * 100).toFixed(2)}% CTR, position ${typeof row.position === "number" ? row.position.toFixed(1) : "-"}`,
    });
  }
  const highRankLowClicks = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position <= 3 && (row.impressions || 0) >= 100 && (row.clicks || 0) <= 1)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of highRankLowClicks) {
    addInsight({
      type: "snippet_gap",
      severity: "warning",
      title: "Top ranking, almost no clicks",
      detail: `${row.query} on ${row.page}`,
      action: "Check whether the query intent matches the page and improve the title, meta description, and visible answer near the top.",
      metrics: `${row.impressions} impressions, ${row.clicks || 0} clicks, position ${row.position.toFixed(1)}`,
    });
  }
  const strikingDistance = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= 50)
    .sort((a, b) => (a.position || 99) - (b.position || 99))
    .slice(0, 5);
  for (const row of strikingDistance) {
    addInsight({
      type: "striking_distance",
      severity: "notice",
      title: "Ranking within striking distance",
      detail: `${row.query} on ${row.page}`,
      action: "Strengthen the section that answers this query, add internal links, and improve snippet relevance.",
      metrics: `${row.impressions} impressions, position ${row.position.toFixed(1)}`,
    });
  }
  const pageTwo = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= 100)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of pageTwo) {
    addInsight({
      type: "page_two",
      severity: "notice",
      title: "Page two opportunity",
      detail: `${row.query} on ${row.page}`,
      action: "Expand the answer depth, add internal links from stronger related pages, and compare content gaps against page-one results.",
      metrics: `${row.impressions} impressions, position ${row.position.toFixed(1)}`,
    });
  }
  const byPage = new Map();
  for (const row of pageQueryRows) {
    if ((row.impressions || 0) < 30) continue;
    const list = byPage.get(row.page) || [];
    list.push(row);
    byPage.set(row.page, list);
  }
  for (const [page, list] of byPage.entries()) {
    const queryCount = list.length;
    const impressions = list.reduce((sum, row) => sum + (row.impressions || 0), 0);
    if (queryCount < 5 || impressions < 300) continue;
    const topQueries = list
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 3)
      .map((row) => row.query)
      .join(", ");
    addInsight({
      type: "intent_spread",
      severity: "notice",
      title: "Page ranks for many queries",
      detail: page,
      action: `Cluster the page around the strongest intent. Top queries: ${topQueries}.`,
      metrics: `${queryCount} queries, ${impressions} impressions`,
    });
  }
  return insights.slice(0, 12).map((insight) => {
    const localized = insightText[locale]?.[insight.type];
    return localized ? { ...insight, title: localized[0], action: localized[1] } : insight;
  });
}

function classifySearchQueryOpportunity(row) {
  if ((row.impressions || 0) >= 100 && typeof row.ctr === "number" && row.ctr < 0.01) return "low_ctr";
  if (typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= 50) return "striking_distance";
  if (typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= 100) return "page_two";
  return "monitor";
}

function keywordOpportunityAction(type) {
  if (type === "low_ctr") return "Rewrite title/meta description and align snippet copy with query intent.";
  if (type === "snippet_gap") return "Improve title/meta description and verify the page answers the query intent clearly.";
  if (type === "striking_distance") return "Improve the answer section, add internal links, and strengthen topical relevance.";
  if (type === "page_two") return "Expand content depth and add internal links from stronger related pages.";
  return "Monitor performance and prioritize if impressions or position improve.";
}

function downloadKeywordOpportunitiesCsv(rows, insights) {
  const insightByDetail = new Map((insights || []).map((insight) => [insight.detail, insight]));
  const csvRows = [
    ["page", "query", "clicks", "impressions", "ctr", "position", "opportunity_type", "recommended_action"],
  ];
  for (const row of (rows || []).filter((item) => item.page && item.query)) {
    const insight = insightByDetail.get(`${row.query} on ${row.page}`) || insightByDetail.get(row.page);
    const type = insight?.type || classifySearchQueryOpportunity(row);
    csvRows.push([
      row.page,
      row.query,
      row.clicks ?? 0,
      row.impressions ?? 0,
      typeof row.ctr === "number" ? (row.ctr * 100).toFixed(2) : "",
      typeof row.position === "number" ? row.position.toFixed(1) : "",
      type,
      insight?.action || keywordOpportunityAction(type),
    ]);
  }
  downloadCsvFile(`soos-keyword-opportunities-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, csvRows);
}

function SearchAnalyticsPanel({ status, siteUrl, onRows, language }) {
  const copy = gscDataText[language] || gscDataText.en;
  const defaults = useMemo(() => defaultGscDateRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [dimension, setDimension] = useState("page");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const insights = useMemo(() => buildSearchAnalyticsInsights(rows, summary?.dimension || dimension, language), [dimension, language, rows, summary?.dimension]);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event.preventDefault();
    if (!status?.configured) {
      setError(copy.connectFirst);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.propertyFirst);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = await loadGscSearchAnalytics({
        startDate,
        endDate,
        siteUrl,
        dimension,
      });
      if (body.dimension === "page") onRows(body.rows || []);
      setRows(body.rows || []);
      setSummary({
        rows: body.rows?.length || 0,
        clicks: (body.rows || []).reduce((sum, row) => sum + (row.clicks || 0), 0),
        impressions: (body.rows || []).reduce((sum, row) => sum + (row.impressions || 0), 0),
        dimension: body.dimension || dimension,
      });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel search-analytics-panel">
      <div className="panel-head">
        <h2>{copy.analyticsTitle}</h2>
        <span>{status?.configured ? copy.ready : copy.configureFirst}</span>
      </div>
      <form className="search-analytics-body" onSubmit={loadAnalytics}>
        <div className="search-analytics-fields">
          <label>
            <strong>{copy.startDate}</strong>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.endDate}</strong>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.dimension}</strong>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)}>
              <option value="page">{copy.page}</option>
              <option value="query">{copy.query}</option>
              <option value="page_query">{copy.pageQuery}</option>
              <option value="country">{copy.country}</option>
              <option value="device">{copy.device}</option>
            </select>
          </label>
        </div>
        <div className="gsc-api-actions">
          <button className="export-button" type="submit" disabled={loading}>
            {loading ? copy.loading : copy.load}
          </button>
          {dimension === "page_query" && rows.length ? (
            <button className="export-button" type="button" onClick={() => downloadKeywordOpportunitiesCsv(rows, insights)}>
              {copy.export}
            </button>
          ) : null}
        </div>
        {summary ? (
          <small>{summary.rows} {copy.rowsLoaded}, {summary.clicks} {copy.clicks}, {summary.impressions} {copy.impressions}</small>
        ) : (
          <small>{copy.analyticsHelp}</small>
        )}
        {dimension !== "page" ? <small>{copy.pageOnly}</small> : null}
        {insights.length ? (
          <div className="search-analytics-insights">
            {insights.map((insight, index) => (
              <article className={`search-analytics-insight ${insight.severity}`} key={`${insight.type}-${index}`}>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
                <span>{insight.metrics}</span>
                <em>{insight.action}</em>
              </article>
            ))}
          </div>
        ) : dimension === "page_query" && rows.length ? (
          <small>{copy.noOpportunities}</small>
        ) : null}
        {rows.length ? (
          <div className="search-analytics-results">
            <div className="search-analytics-result head">
              <span>{copy.dimension}</span>
              <span>{copy.clicks}</span>
              <span>{copy.impressions}</span>
              <span>CTR</span>
              <span>{copy.position}</span>
            </div>
            {rows.slice(0, 12).map((row, index) => (
              <div className="search-analytics-result" key={`${row.label || row.page || index}-${index}`}>
                <strong title={row.label || row.page}>{row.label || row.page || row.query || row.country || row.device}</strong>
                <span>{row.clicks ?? 0}</span>
                <span>{row.impressions ?? 0}</span>
                <span>{typeof row.ctr === "number" ? `${(row.ctr * 100).toFixed(2)}%` : "-"}</span>
                <span>{typeof row.position === "number" ? row.position.toFixed(1) : "-"}</span>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <small className="gsc-api-error">{error}</small> : null}
      </form>
    </section>
  );
}
function SearchConsoleImport({ rows, onImport, onClear, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage(`${copy.reading} ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseSearchConsoleCsv(text);
      if (!parsed.length) {
        setError(copy.noRows);
        setMessage(`${file.name}: 0 ${copy.parsed}`);
        onImport([]);
      } else {
        onImport(parsed);
        setMessage(`${file.name}: ${parsed.length} ${copy.imported}`);
      }
    } catch (err) {
      setError(err.message || String(err));
      setMessage(`${file.name}: ${copy.importFailed}`);
    } finally {
      event.target.value = "";
    }
  }

  function clearImportedRows() {
    onClear();
    setMessage(copy.cleared);
    setError("");
  }

  return (
    <section className="panel gsc-import">
      <div className="panel-head">
        <h2>{copy.csvTitle}</h2>
        <span>{rows.length ? `${rows.length} ${copy.rowsLoaded}` : copy.optional}</span>
      </div>
      <div className="gsc-import-body">
        <div>
          <strong>{copy.importTitle}</strong>
          <small>{copy.importHelp}</small>
          {message ? <small className="gsc-import-message">{message}</small> : null}
          {error ? <small className="gsc-import-error">{error}</small> : null}
        </div>
        <div className="gsc-import-actions">
          <label className="export-button file-button">
            {copy.importButton}
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={handleFile} />
          </label>
          {rows.length ? (
            <button className="export-button" type="button" onClick={clearImportedRows}>
              {copy.clearButton}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
function buildGscRowMap(rows) {
  return new Map((rows || []).map((row) => [row.key, row]));
}

function uniqueGscRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.key || normalizeReportUrl(row.page || "");
    if (!key) continue;
    const current = byKey.get(key);
    if (!current || (row.impressions || 0) > (current.impressions || 0)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function isTechnicallyIndexablePage(page) {
  const blockers = new Set([
    "fetch_failed",
    "http_error",
    "robots_disallow",
    "noindex",
    "canonical_blocked",
    "canonical_cross_host",
    "canonical_mismatch",
  ]);
  return !(page.issues || []).some((issue) => blockers.has(issue.type));
}

function buildGscOpportunities(report, rows, language = "en") {
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
    makeItem(
      "low_ranking",
      copy.lowRanking[0],
      "notice",
      lowRanking,
      copy.lowRanking[1],
    ),
    makeItem(
      "low_ctr",
      copy.lowCtr[0],
      "notice",
      lowCtr,
      copy.lowCtr[1],
    ),
    makeItem(
      "blocked_with_visibility",
      copy.blockedVisibility[0],
      "critical",
      blockedWithVisibility,
      copy.blockedVisibility[1],
    ),
    makeItem(
      "gsc_not_in_sitemap",
      copy.missingSitemap[0],
      "notice",
      gscNotInSitemap,
      copy.missingSitemap[1],
    ),
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const severityRank = { critical: 3, warning: 2, notice: 1 };
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.count - a.count;
    });
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
function buildSearchVisibility(report) {
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
function buildUrlAlignmentRows(report, inspectionResults, copy) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  return (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url)) || {};
    const submittedUrl = inspection.url || page.url || "";
    const fetchedUrl = page.finalUrl || submittedUrl;
    const htmlCanonical = page.canonical || "";
    const googleCanonical = inspection.googleCanonical || "";
    const userCanonical = inspection.userCanonical || "";
    const submittedKey = normalizeReportUrl(submittedUrl);
    const fetchedKey = normalizeReportUrl(fetchedUrl);
    const htmlKey = normalizeReportUrl(htmlCanonical);
    const googleKey = normalizeReportUrl(googleCanonical);
    const userKey = normalizeReportUrl(userCanonical);
    const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
    const blocked = ["robots_disallow", "noindex", "http_error", "fetch_failed", "canonical_blocked"].some((type) => issueTypes.has(type));
    const verdict = String(inspection.verdict || "").toUpperCase();
    let state = "unknown";
    let severity = "notice";
    let label = copy.unknownAlignment;

    if (!inspection.ok) {
      state = "inspection_failed";
      severity = "critical";
      label = copy.inspectionFailed;
    } else if (blocked) {
      state = "blocked";
      severity = "critical";
      label = copy.crawlBlocked;
    } else if (googleKey && googleKey !== submittedKey && googleKey !== fetchedKey && googleKey !== htmlKey) {
      state = "google_canonical_differs";
      severity = "warning";
      label = copy.googleCanonicalDiffers;
    } else if (submittedKey && fetchedKey && submittedKey !== fetchedKey) {
      state = "redirect";
      severity = "warning";
      label = copy.submittedRedirects;
    } else if (htmlKey && fetchedKey && htmlKey !== fetchedKey) {
      state = "html_canonical_differs";
      severity = "warning";
      label = copy.htmlCanonicalDiffers;
    } else if (verdict === "PASS") {
      state = "aligned_indexed";
      severity = "good";
      label = copy.alignedIndexed;
    } else if (
      fetchedKey
      && (!htmlKey || htmlKey === fetchedKey)
      && (!userKey || userKey === fetchedKey)
      && (!googleKey || googleKey === fetchedKey)
    ) {
      state = "aligned_not_indexed";
      severity = "critical";
      label = copy.alignedNotIndexed;
    }

    return {
      submittedUrl,
      fetchedUrl,
      htmlCanonical,
      userCanonical,
      googleCanonical,
      coverageState: inspection.coverageState || inspection.error || "",
      state,
      severity,
      label,
    };
  });
}

function UrlAlignmentMatrix({ report, inspectionResults, copy }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => buildUrlAlignmentRows(report, inspectionResults, copy), [copy, inspectionResults, report]);
  const counts = rows.reduce((summary, row) => {
    summary[row.state] = (summary[row.state] || 0) + 1;
    return summary;
  }, {});
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.state === filter);
  const states = [...new Set(rows.map((row) => row.state))];
  if (!rows.length) return null;

  function exportRows() {
    downloadCsvFile("soos-google-url-alignment.csv", [
      ["diagnosis", "state", "submitted_url", "fetched_url", "html_canonical", "gsc_user_canonical", "google_canonical", "coverage_state"],
      ...rows.map((row) => [
        row.label,
        row.state,
        row.submittedUrl,
        row.fetchedUrl,
        row.htmlCanonical,
        row.userCanonical,
        row.googleCanonical,
        row.coverageState,
      ]),
    ]);
  }

  return (
    <section className="url-alignment">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.alignmentTitle}</strong>
          <small>{copy.alignmentHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.alignmentAll} ({rows.length})</option>
            {states.map((state) => {
              const row = rows.find((item) => item.state === state);
              return <option value={state} key={state}>{row.label} ({counts[state]})</option>;
            })}
          </select>
          <button className="export-button" type="button" onClick={exportRows}>{copy.exportAlignment}</button>
        </div>
      </div>
      <div className="url-alignment-table">
        <div className="url-alignment-row head">
          <span>{copy.alignmentState}</span>
          <span>{copy.submittedUrl}</span>
          <span>{copy.fetchedUrl}</span>
          <span>{copy.htmlCanonical}</span>
          <span>{copy.googleCanonical}</span>
        </div>
        {visibleRows.map((row) => (
          <div className="url-alignment-row" key={row.submittedUrl}>
            <span><Badge severity={row.severity === "good" ? "ok" : row.severity}>{row.label}</Badge></span>
            <span title={row.submittedUrl}>{row.submittedUrl || "-"}</span>
            <span title={row.fetchedUrl}>{row.fetchedUrl || "-"}</span>
            <span title={row.htmlCanonical}>{row.htmlCanonical || "-"}</span>
            <span title={row.googleCanonical}>{row.googleCanonical || "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function classifyIndexCoverage(inspection, page, gsc, copy) {
  const coverage = String(inspection.coverageState || "").toLowerCase();
  const robots = String(inspection.robotsTxtState || "").toLowerCase();
  const indexing = String(inspection.indexingState || "").toLowerCase();
  const fetchState = String(inspection.pageFetchState || "").toLowerCase();
  const verdict = String(inspection.verdict || "").toUpperCase();
  const issueTypes = new Set((page?.issues || []).map((issue) => issue.type));
  const submittedKey = normalizeReportUrl(inspection.url);
  const localCanonicalKey = normalizeReportUrl(page?.canonical || inspection.userCanonical || "");
  const googleCanonicalKey = normalizeReportUrl(inspection.googleCanonical || "");
  const canonicalAgreement = Boolean(
    googleCanonicalKey
    && localCanonicalKey
    && googleCanonicalKey === localCanonicalKey
    && googleCanonicalKey !== submittedKey
  );
  let reason = "other";
  let reasonLabel = copy.reasonOther;
  let disposition = "needs_fix";
  let dispositionLabel = copy.needsFix;

  if (!inspection.ok) {
    reason = "inspection_error";
    reasonLabel = copy.inspectionFailed;
  } else if (verdict === "PASS") {
    reason = "indexed";
    reasonLabel = copy.indexedState;
    disposition = "indexed";
    dispositionLabel = copy.indexedState;
  } else if (
    robots.includes("blocked")
    || robots.includes("disallow")
    || indexing.includes("blocked")
    || indexing.includes("noindex")
    || ["robots_disallow", "noindex", "canonical_blocked"].some((type) => issueTypes.has(type))
  ) {
    reason = "blocked";
    reasonLabel = copy.reasonBlocked;
  } else if (coverage.includes("soft 404")) {
    reason = "soft_404";
    reasonLabel = copy.reasonSoft404;
  } else if (
    coverage.includes("server error")
    || coverage.includes("redirect error")
    || (
      fetchState
      && !fetchState.includes("unspecified")
      && !["successful", "page_fetch_state_successful"].includes(fetchState)
    )
    || ["fetch_failed", "http_error"].some((type) => issueTypes.has(type))
  ) {
    reason = "fetch_problem";
    reasonLabel = copy.reasonFetch;
  } else if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    reason = "discovered_not_crawled";
    reasonLabel = copy.reasonDiscovered;
  } else if (coverage.includes("crawled") && coverage.includes("not indexed")) {
    reason = "crawled_not_indexed";
    reasonLabel = copy.reasonCrawled;
  } else if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    reason = "duplicate";
    reasonLabel = copy.reasonDuplicate;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  } else if (googleCanonicalKey && googleCanonicalKey !== submittedKey) {
    reason = "canonical_conflict";
    reasonLabel = copy.reasonCanonical;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  }

  const impressions = gsc?.impressions || 0;
  const clicks = gsc?.clicks || 0;
  const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
  const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.floor((Date.now() - lastCrawlMs) / 86400000) : null;
  const stale = crawlAgeDays != null && crawlAgeDays > 90;
  let priority = "low";
  if (disposition === "needs_fix" && (clicks > 0 || impressions >= 100 || reason === "blocked" || reason === "fetch_problem")) {
    priority = "high";
  } else if (disposition === "needs_fix" || impressions > 0 || stale) {
    priority = "medium";
  }

  return {
    url: inspection.url,
    reason,
    reasonLabel,
    disposition,
    dispositionLabel,
    priority,
    impressions,
    clicks,
    position: gsc?.position ?? null,
    lastCrawlTime: inspection.lastCrawlTime || "",
    crawlAgeDays,
    stale,
    coverageState: inspection.coverageState || inspection.error || "",
    googleCanonical: inspection.googleCanonical || "",
  };
}

function IndexCoveragePriorities({ report, inspectionResults, gscRows, copy }) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  const rows = (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url));
    const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
      || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
    return classifyIndexCoverage(inspection, page, gsc, copy);
  });
  const priorityRank = { high: 3, medium: 2, low: 1 };
  const actionableRows = rows
    .filter((row) => row.disposition !== "indexed")
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || b.impressions - a.impressions);
  const groups = [...new Map(actionableRows.map((row) => [row.reason, {
    reason: row.reason,
    label: row.reasonLabel,
    rows: actionableRows.filter((item) => item.reason === row.reason),
  }])).values()];
  if (!rows.length) return null;

  function priorityLabel(priority) {
    if (priority === "high") return copy.priorityHigh;
    if (priority === "medium") return copy.priorityMedium;
    return copy.priorityLow;
  }

  function exportCoverage() {
    downloadCsvFile("soos-google-index-coverage.csv", [
      ["url", "reason", "disposition", "priority", "coverage_state", "clicks", "impressions", "position", "last_crawl", "crawl_age_days", "google_canonical"],
      ...rows.map((row) => [
        row.url,
        row.reason,
        row.disposition,
        row.priority,
        row.coverageState,
        row.clicks,
        row.impressions,
        row.position ?? "",
        row.lastCrawlTime,
        row.crawlAgeDays ?? "",
        row.googleCanonical,
      ]),
    ]);
  }

  return (
    <section className="index-coverage-priorities">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.coverageTitle}</strong>
          <small>{copy.coverageHelp}</small>
        </div>
        <button className="export-button" type="button" onClick={exportCoverage}>{copy.coverageExport}</button>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.needsFix}: {rows.filter((row) => row.disposition === "needs_fix").length}</span>
        <span>{copy.expectedExclusion}: {rows.filter((row) => row.disposition === "expected_exclusion").length}</span>
        <span>{copy.indexedState}: {rows.filter((row) => row.disposition === "indexed").length}</span>
      </div>
      {groups.length ? (
        <div className="coverage-groups">
          {groups.map((group) => (
            <article className="coverage-group" key={group.reason}>
              <div className="impact-top">
                <Badge severity={group.rows.some((row) => row.priority === "high") ? "critical" : "warning"}>{group.label}</Badge>
                <strong>{group.rows.length} {copy.affectedUrls}</strong>
                <span>{group.rows.reduce((sum, row) => sum + row.impressions, 0)} {copy.impressions}</span>
              </div>
              <div className="coverage-priority-rows">
                {group.rows.slice(0, 8).map((row) => (
                  <div className="coverage-priority-row" key={row.url}>
                    <Badge severity={row.priority === "high" ? "critical" : row.priority === "medium" ? "warning" : "notice"}>{priorityLabel(row.priority)}</Badge>
                    <strong title={row.url}>{row.url}</strong>
                    <span>{row.dispositionLabel}</span>
                    <small>
                      {row.impressions || row.clicks
                        ? `${row.clicks} ${copy.clicks} / ${row.impressions} ${copy.impressions}`
                        : copy.noPerformanceData}
                      {row.stale ? ` | ${copy.staleCrawl}: ${row.crawlAgeDays}d` : ""}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ImportantPageFreshness({ inspectionResults, gscRows, copy }) {
  const [sortBy, setSortBy] = useState("risk");
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  const riskRank = { critical: 4, stale: 3, unknown: 2, watch: 1, fresh: 0 };
  const rows = (inspectionResults || [])
    .filter((item) => item.ok && String(item.verdict || "").toUpperCase() === "PASS")
    .map((inspection) => {
      const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
        || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
      const impressions = gsc?.impressions || 0;
      const clicks = gsc?.clicks || 0;
      if (!impressions && !clicks) return null;
      const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
      const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.max(0, Math.floor((Date.now() - lastCrawlMs) / 86400000)) : null;
      const demand = clicks > 0 || impressions >= 1000 ? "high" : impressions >= 100 ? "medium" : "low";
      const demandScore = clicks * 1000 + impressions;
      let freshness = "fresh";
      if (crawlAgeDays == null) freshness = "unknown";
      else if (crawlAgeDays > 180) freshness = "critical";
      else if (crawlAgeDays > 90) freshness = "stale";
      else if (crawlAgeDays > 30) freshness = "watch";
      return {
        url: inspection.url,
        googleCanonical: inspection.googleCanonical || "",
        lastCrawlTime: inspection.lastCrawlTime || "",
        crawlAgeDays,
        freshness,
        demand,
        demandScore,
        impressions,
        clicks,
        position: gsc?.position ?? null,
      };
    })
    .filter(Boolean);
  const sortedRows = [...rows].sort((a, b) => {
    if (sortBy === "demand") return b.demandScore - a.demandScore || (b.crawlAgeDays || 0) - (a.crawlAgeDays || 0);
    if (sortBy === "age") return (b.crawlAgeDays ?? -1) - (a.crawlAgeDays ?? -1) || b.demandScore - a.demandScore;
    return riskRank[b.freshness] - riskRank[a.freshness] || b.demandScore - a.demandScore;
  });
  if (!rows.length) return null;

  function freshnessLabel(value) {
    if (value === "critical") return copy.freshnessCritical;
    if (value === "stale") return copy.freshnessStale;
    if (value === "watch") return copy.freshnessWatch;
    if (value === "unknown") return copy.freshnessUnknown;
    return copy.freshnessFresh;
  }

  function demandLabel(value) {
    if (value === "high") return copy.demandHigh;
    if (value === "medium") return copy.demandMedium;
    return copy.demandLow;
  }

  function exportFreshness() {
    downloadCsvFile("soos-google-crawl-freshness.csv", [
      ["url", "freshness", "demand", "last_crawl", "crawl_age_days", "clicks", "impressions", "position", "google_canonical"],
      ...sortedRows.map((row) => [
        row.url,
        row.freshness,
        row.demand,
        row.lastCrawlTime,
        row.crawlAgeDays ?? "",
        row.clicks,
        row.impressions,
        row.position ?? "",
        row.googleCanonical,
      ]),
    ]);
  }

  return (
    <section className="crawl-freshness">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.freshnessTitle}</strong>
          <small>{copy.freshnessHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="risk">{copy.freshnessSortRisk}</option>
            <option value="demand">{copy.freshnessSortDemand}</option>
            <option value="age">{copy.freshnessSortAge}</option>
          </select>
          <button className="export-button" type="button" onClick={exportFreshness}>{copy.freshnessExport}</button>
        </div>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.indexedWithDemand}: {rows.length}</span>
        <span>{copy.freshnessCritical}: {rows.filter((row) => row.freshness === "critical").length}</span>
        <span>{copy.freshnessStale}: {rows.filter((row) => row.freshness === "stale").length}</span>
      </div>
      <div className="crawl-freshness-list">
        {sortedRows.map((row) => (
          <div className="crawl-freshness-row" key={row.url}>
            <Badge severity={row.freshness === "critical" ? "critical" : row.freshness === "stale" ? "warning" : row.freshness === "watch" || row.freshness === "unknown" ? "notice" : "ok"}>
              {freshnessLabel(row.freshness)}
            </Badge>
            <strong title={row.url}>{row.url}</strong>
            <span>{demandLabel(row.demand)}</span>
            <small>{row.crawlAgeDays == null ? copy.freshnessUnknown : `${copy.crawlAge}: ${row.crawlAgeDays} ${copy.days}`}</small>
            <small>{row.clicks} {copy.clicks} / {row.impressions} {copy.impressions}</small>
          </div>
        ))}
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



function UrlInspectionPanel({ report, gscStatus, siteUrl, language, gscRows }) {
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
      setError(err.message || String(err));
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
      {error ? <div className="url-inspection-error">{error}</div> : null}
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
          <IndexCoveragePriorities report={report} inspectionResults={result.results} gscRows={gscRows} copy={copy} />
          <ImportantPageFreshness inspectionResults={result.results} gscRows={gscRows} copy={copy} />
          <UrlAlignmentMatrix report={report} inspectionResults={result.results} copy={copy} />
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

function diagnoseInspectionResult(item) {
  const diagnoses = [];
  const coverage = String(item.coverageState || "").toLowerCase();
  const indexing = String(item.indexingState || "").toLowerCase();
  const robots = String(item.robotsTxtState || "").toLowerCase();
  const fetchState = String(item.pageFetchState || "").toLowerCase();
  const verdict = String(item.verdict || "").toUpperCase();
  const mobileVerdict = String(item.mobileVerdict || "").toUpperCase();
  const richVerdict = String(item.richResultsVerdict || "").toUpperCase();
  if (!item.ok) {
    diagnoses.push({
      type: "inspection_error",
      severity: "critical",
      title: "Inspection request failed",
      detail: item.error || "Google did not return URL Inspection data for this URL.",
      action: "Check the API connection, property access, and whether this URL belongs to the configured property.",
    });
    return diagnoses;
  }
  if (verdict === "FAIL" || coverage.includes("not indexed") || coverage.includes("excluded") || coverage.includes("crawled - currently not indexed")) {
    diagnoses.push({
      type: "not_indexed",
      severity: "critical",
      title: "Not indexed by Google",
      detail: item.coverageState || "Google did not report this URL as indexed.",
      action: "Review crawlability, canonical tags, content quality, internal links, and sitemap inclusion.",
    });
  }
  if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    diagnoses.push({
      type: "discovered_not_crawled",
      severity: "warning",
      title: "Discovered, not crawled yet",
      detail: item.coverageState,
      action: "Strengthen internal links, verify crawl budget signals, keep the URL in sitemap, and make sure the server responds quickly.",
    });
  }
  if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    diagnoses.push({
      type: "duplicate_or_alternate",
      severity: "warning",
      title: "Google treats this as duplicate or alternate",
      detail: item.coverageState,
      action: "Confirm the canonical target is intentional. If this URL should rank, make canonical, sitemap, internal links, and content unique.",
    });
  }
  if (coverage.includes("soft 404")) {
    diagnoses.push({
      type: "soft_404",
      severity: "critical",
      title: "Soft 404 detected",
      detail: item.coverageState,
      action: "Add substantial useful content or return a real 404/410 if the page should not exist.",
    });
  }
  if (robots.includes("disallow") || robots.includes("blocked")) {
    diagnoses.push({
      type: "robots_blocked",
      severity: "critical",
      title: "Blocked by robots.txt",
      detail: item.robotsTxtState || "Google reports a robots.txt blocker.",
      action: "Remove the blocking robots.txt rule if this page should be indexed.",
    });
  }
  if (fetchState && !["successful", "page_fetch_state_successful"].includes(fetchState)) {
    diagnoses.push({
      type: "fetch_problem",
      severity: "warning",
      title: "Google fetch has problems",
      detail: item.pageFetchState || "Google reported a non-successful fetch state.",
      action: "Check server availability, redirects, status codes, firewall rules, and rendering stability.",
    });
  }
  if (item.googleCanonical && item.userCanonical && normalizeReportUrl(item.googleCanonical) !== normalizeReportUrl(item.userCanonical)) {
    diagnoses.push({
      type: "canonical_mismatch",
      severity: "warning",
      title: "Google selected a different canonical",
      detail: `Google: ${item.googleCanonical}`,
      action: "Align canonical tags, internal links, redirects, and sitemap URLs around the preferred canonical.",
    });
  }
  if (!item.sitemap?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "not_seen_in_sitemap",
      severity: "notice",
      title: "Google did not report sitemap discovery",
      detail: "URL Inspection did not include a sitemap source for this URL.",
      action: "Keep the canonical URL in the submitted sitemap and ensure the sitemap is discoverable from robots.txt.",
    });
  }
  if (!item.referringUrls?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "no_referrers",
      severity: "notice",
      title: "No referring URLs reported",
      detail: "Google did not report internal or external referrers for this URL.",
      action: "Add internal links from relevant indexed pages so Google can discover and prioritize the URL.",
    });
  }
  if (mobileVerdict && mobileVerdict !== "PASS") {
    diagnoses.push({
      type: "mobile_usability",
      severity: "warning",
      title: "Mobile usability issue",
      detail: item.mobileVerdict,
      action: "Review mobile usability issues in Search Console and fix layout, tap target, and viewport problems.",
    });
  }
  if (richVerdict && richVerdict !== "PASS" && richVerdict !== "VERDICT_UNSPECIFIED") {
    diagnoses.push({
      type: "rich_results",
      severity: "notice",
      title: "Rich results need review",
      detail: item.richResultsVerdict,
      action: "Validate structured data with Google's rich results tooling and fix invalid detected items.",
    });
  }
  if (indexing && indexing !== "indexing_allowed" && indexing !== "allowed") {
    diagnoses.push({
      type: "indexing_state",
      severity: "notice",
      title: "Indexing state needs review",
      detail: item.indexingState || "Google returned a non-standard indexing state.",
      action: "Compare this state with meta robots, canonical signals, and crawl diagnostics.",
    });
  }
  return diagnoses;
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
      setError(err.message || String(err));
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
          {message ? <small>{message}</small> : null}
          {error ? <small className="gsc-import-error">{copy.failed}: {error}</small> : null}
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

function InternalDiscovery({ report, t }) {
  const pages = report?.discoveredPages || [];
  if (!report?.options?.internalCrawl) return null;
  return (
    <section className="panel internal-discovery">
      <div className="panel-head">
        <h2>{t.internalDiscoveryTitle}</h2>
        <span>{pages.length} {t.discoveredUrls}</span>
      </div>
      <div className="internal-discovery-copy">
        <small>{t.internalDiscoveryHelp}</small>
        {report.truncation?.internalCrawlLimitReached ? <small className="gsc-api-error">{t.internalCrawlLimit}</small> : null}
      </div>
      {pages.length ? (
        <div className="internal-discovery-list">
          {pages.map((page) => (
            <article className="internal-discovery-row" key={page.url}>
              <Badge severity={page.status >= 400 || !page.status ? "critical" : page.issues?.length ? "warning" : "ok"}>
                {page.status || "ERR"}
              </Badge>
              <strong title={page.url}>{page.url}</strong>
              <span>{t.crawlDepth}: {page.crawlDepth || 1}</span>
              <small title={page.discoveredFrom}>{t.discoveredFrom}: {page.discoveredFrom || "-"}</small>
              <small>{page.issues?.length || 0} {t.tasks}</small>
            </article>
          ))}
        </div>
      ) : <p className="none">{t.noDiscoveredUrls}</p>}
    </section>
  );
}

function InternalLinkGraph({ report, t }) {
  const [filter, setFilter] = useState("all");
  const graph = useMemo(() => buildInternalLinkGraph(report), [report]);
  if (!report?.options?.internalCrawl || !graph.rows.length) return null;
  const labels = {
    unreachable: t.graphUnreachable,
    orphan: t.graphOrphan,
    deep: t.graphDeep,
    weak: t.graphWeak,
    dead_end: t.graphDeadEnd,
    healthy: t.graphHealthy,
  };
  const visibleRows = filter === "all" ? graph.rows : graph.rows.filter((row) => row.state === filter);

  function exportGraph() {
    downloadCsvFile("soos-internal-link-graph.csv", [
      ["state", "url", "source", "homepage_click_depth", "discovery_depth", "inbound_count", "outbound_count", "inbound_urls", "outbound_urls"],
      ...graph.rows.map((row) => [
        labels[row.state] || row.state,
        row.url,
        row.source,
        row.clickDepth ?? "",
        row.crawlDepth,
        row.inboundCount,
        row.outboundCount,
        row.inboundUrls.join(" | "),
        row.outboundUrls.join(" | "),
      ]),
    ]);
  }

  return (
    <section className="panel internal-link-graph">
      <div className="panel-head">
        <h2>{t.linkGraphTitle}</h2>
        <span>{graph.rows.length} {t.graphNodes} / {graph.edgeCount} {t.graphEdges} / {graph.reachableCount} {t.reachablePages}</span>
      </div>
      <div className="link-graph-toolbar">
        <div>
          <small>{t.linkGraphHelp}</small>
          {!graph.rootAvailable ? <small className="gsc-api-error">{t.rootNotScanned}</small> : null}
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{t.graphAll} ({graph.rows.length})</option>
            {Object.entries(labels).map(([state, label]) => (
              <option value={state} key={state}>{label} ({graph.counts[state] || 0})</option>
            ))}
          </select>
          <button className="export-button" type="button" onClick={exportGraph}>{t.linkGraphExport}</button>
        </div>
      </div>
      <div className="coverage-disposition-summary link-graph-summary">
        {graph.rootAvailable ? <span>{t.maxClickDepth}: {graph.maxClickDepth}</span> : null}
        {Object.entries(labels).map(([state, label]) => (
          <span key={state}>{label}: {graph.counts[state] || 0}</span>
        ))}
      </div>
      <div className="link-graph-list">
        {visibleRows.map((row) => (
          <article className="link-graph-row" key={row.url}>
            <Badge severity={row.state === "unreachable" || row.state === "orphan" ? "critical" : row.state === "deep" || row.state === "weak" ? "warning" : row.state === "dead_end" ? "notice" : "ok"}>
              {labels[row.state]}
            </Badge>
            <strong title={row.url}>{row.url}</strong>
            <span>{t.graphSource}: {row.source === "sitemap" ? t.graphSourceSitemap : t.graphSourceInternal}</span>
            <span>{t.clickDepth}: {row.clickDepth ?? "-"}</span>
            <span>{t.crawlDepth}: {row.crawlDepth}</span>
            <span>{t.inboundCount}: {row.inboundCount}</span>
            <span>{t.outboundCount}: {row.outboundCount}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Report({ report, t, gscRows, gscStatus, gscSiteUrl, language }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState(null);
  const pages = useMemo(() => {
    if (!report?.pages) return [];
    let filtered;
    if (filter === "all") filtered = report.pages;
    else if (filter === "ok") filtered = report.pages.filter((page) => !page.issues.length);
    else filtered = report.pages.filter((page) => page.issues.some((issue) => issue.severity === filter));

    if (issueFilter?.type) {
      filtered = filtered.filter((page) => page.issues.some((issue) => issue.type === issueFilter.type));
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return filtered;

    return filtered.filter((page) => {
      const issueText = page.issues.map((issue) => `${issue.type} ${issue.message} ${issue.detail || ""}`).join(" ");
      const reasonText = (page.googleReasons || []).map((reason) => `${reason.label} ${reason.detail}`).join(" ");
      const haystack = [
        page.url,
        page.finalUrl,
        page.canonical,
        page.title,
        page.description,
        issueText,
        reasonText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, issueFilter, query, report]);

  if (!report) return <EmptyState t={t} />;

  return (
    <>
      <StatusFlags flags={report.statusFlags} t={t} />
      <ExecutiveSummary summary={report.executiveSummary} t={t} />
      <ScoreCard score={report.summary.healthScore} t={t} />
      <SearchVisibility report={report} t={t} gscRows={gscRows} language={language} />
      <GscOpportunities report={report} rows={gscRows} language={language} />
      <GooglebotLogAnalysis report={report} language={language} gscRows={gscRows} />
      <UrlInspectionPanel report={report} gscStatus={gscStatus} siteUrl={gscSiteUrl} language={language} gscRows={gscRows} />
      <InternalDiscovery report={report} t={t} />
      <InternalLinkGraph report={report} t={t} />
      <section className="summary">
        <Stat label={t.urls} value={report.summary.urlCount} />
        {report.options?.internalCrawl ? <Stat label={t.discoveredUrls} value={report.summary.discoveredUrlCount || 0} /> : null}
        <Stat label={t.affected} value={report.summary.affectedUrlCount} tone="warn" />
        <Stat label={t.googleRisk} value={report.summary.googleBlockedCount} tone="bad" />
        <Stat label={t.critical} value={report.summary.issueCounts.critical} tone="bad" />
        <Stat label={t.warnings} value={report.summary.issueCounts.warning} tone="warn" />
      </section>

      <section className="panel detected">
        <div className="panel-head">
          <h2>{t.detectedInputs}</h2>
          <span>{report.input.inputType}</span>
        </div>
        <div className="detected-grid">
          <p><strong>{t.original}</strong><span>{report.input.originalUrl}</span></p>
          <p><strong>{t.siteRoot}</strong><span>{report.input.siteRootUrl}</span></p>
          <p><strong>Sitemap</strong><span>{report.input.sitemapUrl}</span></p>
          <p><strong>Robots</strong><span>{report.input.robotsUrl}</span></p>
        </div>
      </section>

      {report.truncation?.truncated ? (
        <section className="limit-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>{t.limitReachedTitle}</strong>
            <span>{formatText(t.limitReachedText, { urls: report.limits.maxUrls, sitemaps: report.limits.maxSitemaps })}</span>
          </div>
        </section>
      ) : (
        <section className="limit-note">
          <CheckCircle2 size={18} />
          <span>
            {formatText(t.limitOk, { urls: report.limits.maxUrls, sitemaps: report.limits.maxSitemaps })}
          </span>
        </section>
      )}

      <Backlog backlog={report.backlog} t={t} />

      <section className="panel robots">
        <div>
          <Bot size={20} />
          <div>
            <h2>{t.robots}</h2>
            <p>{report.robots?.url}</p>
          </div>
        </div>
        {report.robots?.found ? (
          <Badge>{t.found} - {report.robots.groupCount} {t.groups}</Badge>
        ) : (
          <Badge severity="warning">{report.robots?.error || "Not found"}</Badge>
        )}
      </section>

      <RobotsDetails robots={report.robots} t={t} onSelectIssue={setIssueFilter} />

      <SitemapSignals signals={report.sitemapSignals} t={t} onSelectIssue={setIssueFilter} />

      <InternationalSignals signals={report.internationalSignals} t={t} onSelectIssue={setIssueFilter} />

      <Sitemaps sitemaps={report.sitemaps} t={t} />

      <section className="panel">
        <div className="panel-head">
          <h2>{t.urlFindings}</h2>
          <div className="findings-toolbar">
            <div className="filters">
              {["all", "critical", "warning", "notice", "ok"].map((item) => (
                <button
                  className={filter === item ? "active" : ""}
                  key={item}
                  type="button"
                  onClick={() => {
                    setFilter(item);
                    if (item === "ok") setIssueFilter(null);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="findings-actions">
              {issueFilter?.type ? (
                <button className="export-button" type="button" onClick={() => setIssueFilter(null)}>
                  {issueFilter.type}
                </button>
              ) : null}
              <input
                className="findings-search"
                type="search"
                placeholder={t.searchUrls}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="export-button" type="button" onClick={() => downloadSummary(report)}>
                {t.exportSummary}
              </button>
              <button className="export-button" type="button" onClick={() => downloadCsv(report, gscRows)}>
                {t.exportCsv}
              </button>
            </div>
          </div>
        </div>
        <div className="rows">
          {pages.length ? pages.map((page) => <PageRow page={page} key={page.url} t={t} />) : <p className="none">{t.noFilter}</p>}
        </div>
      </section>
    </>
  );
}

function App() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [language, setLanguage] = useState(() => detectLanguage());
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
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyLimit, setHistoryLimit] = useState(() => loadHistoryLimit());
  const [retainedJobs, setRetainedJobs] = useState([]);
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
  const t = dictionaries[language];

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
      .catch((err) => setError(err.message || String(err)))
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

  async function loadRetainedJobs() {
    setRetainedJobsLoading(true);
    try {
      const body = await listAuditJobs(20);
      setRetainedJobs(body.items || []);
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
    setRetainedJobs((items) => items.filter((item) => item.id !== jobId));
    if (currentJobId === jobId) clearActiveAuditJob();
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
      setError(err.message || String(err));
    } finally {
      resetJobUi();
    }
  }

  return (
    <main>
      <header className="top">
        <div>
          <span className="mark">soos</span>
          <h1>{t.heading}</h1>
        </div>
        <div className="top-actions">
          <p>{t.subheading}</p>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="zh-CN">{"\u7b80\u4f53\u4e2d\u6587"}</option>
            <option value="zh-TW">{"\u7e41\u9ad4\u4e2d\u6587"}</option>
          </select>
        </div>
      </header>

      <form className="searchbar" onSubmit={runAudit}>
        <Search size={20} />
        <input
          type="url"
          required
          placeholder={t.placeholder}
          value={sitemapUrl}
          onChange={(event) => setSitemapUrl(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
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
        onPause={() => controlJob("pause").catch((err) => setError(err.message || String(err)))}
        onResume={() => controlJob("resume").catch((err) => setError(err.message || String(err)))}
        onStop={() => controlJob("stop").catch((err) => setError(err.message || String(err)))}
        t={t}
      />

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
      <SearchConsoleApiConfig status={gscStatus} onStatus={setGscStatus} siteUrl={gscSiteUrl} onSiteUrlChange={setGscSiteUrl} language={language} />
      <SearchAnalyticsPanel status={gscStatus} siteUrl={gscSiteUrl} onRows={setGscRows} language={language} />
      <GscSitemapsPanel status={gscStatus} siteUrl={gscSiteUrl} currentSitemapUrl={report?.input?.sitemapUrl} language={language} />
      <SearchConsoleImport rows={gscRows} onImport={setGscRows} onClear={() => setGscRows([])} language={language} />

      <RetainedJobsPanel
        jobs={retainedJobs}
        loading={retainedJobsLoading}
        t={t}
        onRefresh={() => loadRetainedJobs().catch((err) => setError(err.message || String(err)))}
        onOpen={(id) => openRetainedReport(id).catch((err) => setError(err.message || String(err)))}
        onContinue={(job) => continueRetainedJob(job).catch((err) => setError(err.message || String(err)))}
        onDelete={(id) => deleteRetainedJob(id).catch((err) => setError(err.message || String(err)))}
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

      {error ? <div className="error">{error}</div> : null}
      <Report report={report} t={t} gscRows={gscRows} gscStatus={gscStatus} gscSiteUrl={gscSiteUrl} language={language} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

