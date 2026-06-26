import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatText } from "../i18n.js";
import { buildReportCoverage } from "../report-coverage.js";
import { healthScoreTone } from "../report-views.js";
import { Badge, Stat } from "./ReportUi.jsx";
import { PageSpeedInsightsPanel } from "./PageSpeedInsightsPanel.jsx";

function ScoreCard({ score, t }) {
  const tone = healthScoreTone(score);
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
      <div className="panel-head"><h2>{t.executiveSummary}</h2></div>
      <div className="executive-body">
        <p>{summary.headline}</p>
        {summary.topActions?.length ? (
          <div className="executive-actions">
            <strong>{t.priorityActions}</strong>
            {summary.topActions.map((action, index) => <small key={`${action}-${index}`}>{action}</small>)}
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
      <div className="panel-head"><h2>{t.statusFlags}</h2></div>
      <div className="status-flag-list">
        {flags.map((flag) => (
          <Badge key={flag.key} severity={flag.severity}>{flag.label}</Badge>
        ))}
      </div>
    </section>
  );
}

function ReportCoveragePanel({ coverage, t }) {
  const localizedCoverageText = {
    "The scan hit a configured sitemap, URL, or internal discovery limit.": t.coverageLimitTruncated,
    "Recursive internal discovery was not enabled.": t.coverageLimitInternalOff,
    "Google Search Console data was not connected for this report.": t.coverageLimitGscOff,
    "URL Inspection has not checked representative URLs for this report.": t.coverageLimitInspectionOff,
    "URL Inspection covers only a subset of candidate URLs.": t.coverageLimitInspectionSubset,
    "PageSpeed Insights was not run.": t.coverageLimitPageSpeedOff,
    "CrUX field data was not loaded.": t.coverageLimitCruxOff,
    "Do not treat missing findings as proof that the unscanned URL set is healthy.": t.coverageCannotUnscannedHealthy,
    "Do not conclude that sitemap pages are reachable from the homepage unless link graph data exists.": t.coverageCannotReachability,
    "Do not label issues as Google-confirmed without URL Inspection or Search Analytics evidence.": t.coverageCannotGoogleConfirmed,
    "Do not claim full-site Google indexing status from local scan data alone.": t.coverageCannotFullIndexing,
    "Do not generalize inspected URL results to every URL in the sitemap.": t.coverageCannotGeneralizeInspection,
    "Do not infer Lighthouse lab performance or SEO audit status from lightweight HTML signals.": t.coverageCannotLighthouse,
    "Do not infer real-user Core Web Vitals from this report.": t.coverageCannotCrux,
  };
  const localizeLine = (line) => localizedCoverageText[line] || line;
  const signalLabels = {
    local_scan: t.coverageLocalScan,
    robots_txt: t.coverageRobots,
    sitemap_xml: t.coverageSitemap,
    internal_links: t.coverageInternalLinks,
    search_console: t.coverageSearchConsole,
    url_inspection_sample: t.coverageUrlInspection,
    pagespeed: t.coveragePageSpeed,
    crux: t.coverageCrux,
  };
  const trustSeverity = coverage.trustLevel === "strong" ? "notice" : coverage.trustLevel === "moderate" ? "warning" : "critical";
  return (
    <section className="panel report-coverage-panel">
      <div className="panel-head">
        <h2>{t.reportCoverage}</h2>
        <Badge severity={trustSeverity}>{t[`coverageTrust${coverage.trustLevel[0].toUpperCase()}${coverage.trustLevel.slice(1)}`] || coverage.trustLevel}</Badge>
      </div>
      <div className="coverage-stats">
        <Stat label={t.coverageScanned} value={coverage.scannedUrlCount} />
        <Stat label={t.coverageSitemapUrls} value={coverage.sitemapUrlCount} />
        <Stat label={t.coverageInspected} value={coverage.inspectionCheckedCount} />
      </div>
      {coverage.trustSignals.length ? (
        <div className="coverage-chip-list" aria-label={t.coverageSignals}>
          {coverage.trustSignals.map((signal) => (
            <span key={signal}>{signalLabels[signal] || signal}</span>
          ))}
        </div>
      ) : null}
      {!coverage.gscConnected ? (
        <p className="coverage-local-note">
          <strong>{t.coverageLocalOnlyTitle}</strong>
          <span>{t.coverageLocalOnlyHelp}</span>
        </p>
      ) : null}
      <div className="coverage-limits">
        <div>
          <strong>{t.coverageLimitations}</strong>
          {(coverage.limitations.length ? coverage.limitations : [t.coverageNoLimitations]).slice(0, 4).map((item, index) => (
            <small key={`${item}-${index}`}>{localizeLine(item)}</small>
          ))}
        </div>
        <div>
          <strong>{t.coverageCannotConclude}</strong>
          {(coverage.cannotConclude.length ? coverage.cannotConclude : [t.coverageNoUnsafeConclusions]).slice(0, 4).map((item, index) => (
            <small key={`${item}-${index}`}>{localizeLine(item)}</small>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScanSummaryView({
  report,
  t,
  language,
  gscStatus,
  inspectionResults = [],
  inspectionCandidateCount = 0,
}) {
  const coverage = buildReportCoverage(report, {
    gscStatus,
    inspectionResults,
    inspectionCandidateCount,
  });
  return (
    <>
      <StatusFlags flags={report.statusFlags} t={t} />
      <ExecutiveSummary summary={report.executiveSummary} t={t} />
      <PageSpeedInsightsPanel report={report} language={language} />
      <ScoreCard score={report.summary.healthScore} t={t} />
      <ReportCoveragePanel coverage={coverage} t={t} />
      <section className="summary">
        <Stat label={t.urls} value={report.summary.urlCount} />
        {report.options?.internalCrawl
          ? <Stat label={t.discoveredUrls} value={report.summary.discoveredUrlCount || 0} />
          : null}
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
            <span>{formatText(t.limitReachedText, {
              urls: report.limits.maxUrls,
              sitemaps: report.limits.maxSitemaps,
            })}</span>
          </div>
        </section>
      ) : (
        <section className="limit-note">
          <CheckCircle2 size={18} />
          <span>{formatText(t.limitOk, {
            urls: report.limits.maxUrls,
            sitemaps: report.limits.maxSitemaps,
          })}</span>
        </section>
      )}
    </>
  );
}
