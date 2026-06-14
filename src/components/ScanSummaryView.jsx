import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatText } from "../i18n.js";
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
            {summary.topActions.map((action) => <small key={action}>{action}</small>)}
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

export function ScanSummaryView({ report, t, language }) {
  return (
    <>
      <StatusFlags flags={report.statusFlags} t={t} />
      <ExecutiveSummary summary={report.executiveSummary} t={t} />
      <PageSpeedInsightsPanel report={report} language={language} />
      <ScoreCard score={report.summary.healthScore} t={t} />
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
