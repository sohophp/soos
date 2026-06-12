import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import {
  buildCategoryDelta,
  buildIssueDelta,
  HISTORY_LIMIT_OPTIONS,
  trendLabel,
} from "../history.js";
import { compareScanConfig, reportComparisonConfig } from "../version-comparison.js";

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

export function HistoryPanel({
  history,
  currentReport,
  historyLimit,
  t,
  onRerun,
  onCompare,
  onDelete,
  onClear,
  onLimitChange,
}) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{t.history}</h2>
        <div className="history-head-actions">
          <label className="history-limit">
            <span>{t.keepRecent}</span>
            <select value={historyLimit} onChange={(event) => onLimitChange(Number(event.target.value))}>
              {HISTORY_LIMIT_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button className="export-button" type="button" onClick={onClear} disabled={!history.length}>
            {t.clearHistory}
          </button>
          <span>{history.length}</span>
        </div>
      </div>
      {!history.length ? <p className="none">{t.noHistory}</p> : (
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
                    }) || "-"}
                  </small>
                </div>
              ) : null}
              {expandedId === entry.id ? (
                <div className="history-detail">
                  {entry.statusFlags?.length ? (
                    <div className="status-flag-list history-flags">
                      {entry.statusFlags.map((flag) => (
                        <Badge key={`${entry.id}-${flag.key}`} severity={flag.severity}>{flag.label}</Badge>
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
                <button className="export-button" type="button" onClick={() => setExpandedId((current) => current === entry.id ? null : entry.id)}>
                  {expandedId === entry.id ? t.hideDetails : t.details}
                </button>
                <button className="export-button" type="button" onClick={() => onRerun(entry)}>{t.rerun}</button>
                <button className="export-button" type="button" onClick={() => onCompare(entry)}>{t.compareToCurrent}</button>
                <button className="export-button" type="button" onClick={() => onDelete(entry.id)}>{t.deleteHistory}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function RetainedJobsPanel({
  jobs,
  loading,
  meta,
  query,
  status,
  t,
  onQueryChange,
  onStatusChange,
  onSearch,
  onPageChange,
  onRefresh,
  onOpen,
  onContinue,
  onDelete,
}) {
  const retentionText = meta.retentionSeconds >= 86400
    ? `${Math.round(meta.retentionSeconds / 86400)} ${t.retainedDays}`
    : `${Math.round(meta.retentionSeconds / 3600)} ${t.retainedHours}`;
  return (
    <section className="panel retained-jobs">
      <div className="panel-head">
        <div><h2>{t.retainedJobs}</h2><small>{t.retainedJobsHelp}</small></div>
        <div className="history-head-actions">
          <button className="export-button" type="button" onClick={onRefresh} disabled={loading}>{t.refreshJobs}</button>
          <span>{meta.total || 0}</span>
        </div>
      </div>
      <form className="retained-job-toolbar" onSubmit={onSearch}>
        <input
          type="search"
          aria-label={t.retainedSearch}
          placeholder={t.retainedSearch}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <label>
          <span>{t.retainedStatus}</span>
          <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
            <option value="">{t.retainedAllStatuses}</option>
            {["done", "queued", "running", "paused", "stopped", "error", "interrupted"].map((value) => (
              <option value={value} key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="export-button" type="submit" disabled={loading}>{t.retainedSearchButton}</button>
      </form>
      {meta.retentionSeconds ? (
        <small className="retained-job-retention">
          {t.retainedRetention}: {retentionText} · {meta.storage === "neon" ? t.retainedNeon : t.retainedMemory}
        </small>
      ) : null}
      {!jobs.length ? <p className="none">{t.noRetainedJobs}</p> : (
        <div className="retained-job-list">
          {jobs.map((job) => {
            const canContinue = ["queued", "paused", "stopped", "error", "interrupted"].includes(job.status);
            return (
              <article className="retained-job-row" key={job.id}>
                <div><strong>{job.request?.sitemapUrl || job.id}</strong><small>{job.id}</small></div>
                <Badge severity={job.status === "done" ? "ok" : job.status === "error" || job.status === "interrupted" ? "warning" : "notice"}>
                  {job.status}
                </Badge>
                <div className="retained-job-meta">
                  <small>{t.jobProgress}: {job.progress?.percent || 0}%</small>
                  <small>{t.jobUpdated}: {new Date(job.updatedAt).toLocaleString()}</small>
                  {job.expiresAt ? <small>{t.retainedExpires}: {new Date(job.expiresAt).toLocaleString()}</small> : null}
                  {job.summary ? <small>{t.historyScore}: {job.summary.healthScore ?? "-"} / {t.historyUrls}: {job.summary.urlCount ?? 0}</small> : null}
                </div>
                <div className="history-actions">
                  {job.status === "done" ? <button className="export-button" type="button" onClick={() => onOpen(job.id)}>{t.openReport}</button> : null}
                  {canContinue ? <button className="export-button" type="button" onClick={() => onContinue(job)}>{t.continueJob}</button> : null}
                  {!["running", "queued"].includes(job.status) ? (
                    <button
                      className="export-button"
                      type="button"
                      onClick={() => {
                        const label = job.request?.sitemapUrl || job.id;
                        if (window.confirm(`${t.confirmDeleteJob}\n${label}`)) onDelete(job.id);
                      }}
                    >
                      {t.deleteHistory}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {meta.pageCount > 1 ? (
        <nav className="result-pagination" aria-label={t.retainedJobs}>
          <button type="button" disabled={loading || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>{t.retainedPrevious}</button>
          <span>{t.retainedPage} {meta.page} {t.retainedOf} {meta.pageCount}</span>
          <button type="button" disabled={loading || meta.page >= meta.pageCount} onClick={() => onPageChange(meta.page + 1)}>{t.retainedNext}</button>
        </nav>
      ) : null}
    </section>
  );
}

export function ComparisonPanel({ comparisonEntry, report, t }) {
  if (!comparisonEntry || !report) return null;
  const delta = buildIssueDelta(comparisonEntry, report);
  const categoryDelta = buildCategoryDelta(comparisonEntry, report);
  const configDelta = compareScanConfig(comparisonEntry.scanConfig, reportComparisonConfig(report));
  const formatConfigValue = (value) => {
    if (value === true) return "on";
    if (value === false) return "off";
    if (value == null || value === "") return "-";
    return String(value);
  };
  return (
    <section className="panel executive-summary">
      <div className="panel-head"><h2>{t.compareToCurrent}</h2></div>
      <div className="executive-body">
        <p>
          {t.historyScore}: {comparisonEntry.summary?.healthScore ?? "-"} {"->"} {report.summary?.healthScore ?? "-"};{" "}
          {t.historyAffected}: {comparisonEntry.summary?.affectedUrlCount ?? 0} {"->"} {report.summary?.affectedUrlCount ?? 0}
        </p>
        {delta.improved.length || delta.worsened.length ? (
          <div className="delta-grid">
            {delta.improved.length ? <div className="delta-card delta-good"><strong>{t.improvedIssues}</strong>{delta.improved.map((item) => <small key={`improved-${item.severity}`}>{item.severity}: -{item.delta}</small>)}</div> : null}
            {delta.worsened.length ? <div className="delta-card delta-bad"><strong>{t.worsenedIssues}</strong>{delta.worsened.map((item) => <small key={`worsened-${item.severity}`}>{item.severity}: +{item.delta}</small>)}</div> : null}
          </div>
        ) : <div className="executive-actions"><small>{t.noDelta}</small></div>}
        {categoryDelta.length ? (
          <div className="delta-grid"><div className="delta-card"><strong>{t.categoryDelta}</strong>{categoryDelta.map((item) => <small key={item.key}>{item.key}: {item.before} {"->"} {item.after}</small>)}</div></div>
        ) : null}
        {comparisonEntry.issueFingerprints ? (
          <div className="delta-grid">
            <div className="delta-card delta-bad"><strong>{t.regressions}: {delta.introduced.length}</strong>{delta.introduced.length ? delta.introduced.slice(0, 20).map((item) => <small key={`regression-${item.key}`}>{item.severity} · {item.type} · {item.url}</small>) : <small>{t.noRegressions}</small>}</div>
            <div className="delta-card delta-good"><strong>{t.resolvedIssues}: {delta.resolved.length}</strong>{delta.resolved.slice(0, 20).map((item) => <small key={`resolved-${item.key}`}>{item.severity} · {item.type} · {item.url}</small>)}</div>
            <div className="delta-card delta-bad"><strong>{t.severityWorsened}: {delta.severityWorsened.length}</strong>{delta.severityWorsened.slice(0, 20).map((item) => <small key={`worsened-${item.key}`}>{item.type} · {item.url} · {item.beforeSeverity} {"->"} {item.afterSeverity}</small>)}</div>
            <div className="delta-card delta-good"><strong>{t.severityImproved}: {delta.severityImproved.length}</strong>{delta.severityImproved.slice(0, 20).map((item) => <small key={`improved-${item.key}`}>{item.type} · {item.url} · {item.beforeSeverity} {"->"} {item.afterSeverity}</small>)}</div>
            <div className="delta-card"><strong>{t.persistentIssues}: {delta.persistent.length}</strong>{delta.persistent.slice(0, 20).map((item) => <small key={`persistent-${item.key}`}>{item.severity} · {item.type} · {item.url}</small>)}</div>
          </div>
        ) : null}
        <div className="delta-grid">
          <div className={`delta-card ${configDelta.changes.length ? "delta-warning" : ""}`}>
            <strong>{t.scanConfigChanges}: {configDelta.changes.length}</strong>
            {!configDelta.available ? <small>{t.scanConfigUnavailable}</small> : null}
            {configDelta.available && !configDelta.changes.length ? <small>{t.noScanConfigChanges}</small> : null}
            {configDelta.changes.map((item) => <small key={`config-${item.field}`}>{item.field}: {t.fromValue} {formatConfigValue(item.before)} {t.toValue} {formatConfigValue(item.after)}</small>)}
            {configDelta.changes.length ? <em>{t.scanConfigWarning}</em> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
