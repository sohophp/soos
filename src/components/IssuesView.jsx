import React, { useEffect, useState } from "react";
import { Bot, CheckCircle2 } from "lucide-react";
import { downloadCsvFile } from "../downloads.js";
import { buildFixPlanCsvRows } from "../fix-plan-export.js";
import { normalizeReportIssues } from "../issue-model.js";
import {
  applyIssueStatuses,
  loadIssueStatuses,
  saveIssueStatuses,
  setIssueStatus,
} from "../issue-status.js";
import { robotsImpactIssueType } from "../report-views.js";
import { Badge, Stat } from "./ReportUi.jsx";

function issueBadgeSeverity(severity) {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  if (severity === "low" || severity === "info") return "notice";
  return severity || "notice";
}

function FixPlan({ issues, closedIssues, t, onSelectIssue, onStatusChange }) {
  if (!issues?.length && !closedIssues?.length) {
    return (
      <section className="panel backlog">
        <div className="panel-head"><h2>{t.fixPlan}</h2></div>
        <div className="clean"><CheckCircle2 size={20} /><span>{t.noUnifiedIssues}</span></div>
      </section>
    );
  }
  function exportFixPlan() {
    downloadCsvFile(
      `soos-fix-plan-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`,
      buildFixPlanCsvRows(issues),
    );
  }
  return (
    <section className="panel backlog fix-plan">
      <div className="panel-head">
        <h2>{t.fixPlan}</h2>
        <div className="panel-actions">
          <span>{issues.length} {t.tasks}</span>
          <button className="export-button" type="button" onClick={exportFixPlan}>{t.exportFixPlan}</button>
        </div>
      </div>
      {issues?.length ? (
        <div className="tasks">
          {issues.slice(0, 8).map((issue) => (
          <article className={`task task-${issueBadgeSeverity(issue.severity)}`} key={issue.fingerprint}>
            <div className="task-top">
              <Badge severity={issueBadgeSeverity(issue.severity)}>{issue.severity}</Badge>
              <h3>{issue.title}</h3>
              <span className="priority-score">{t.priorityScore}: {issue.priorityScore}</span>
            </div>
            <p>{issue.summary}</p>
            <div className="fix-plan-meta">
              <small>{t.confidence}: {t[issue.confidence] || issue.confidence}</small>
              <small>{t.category}: {issue.category}</small>
              <small>{t.affectedUrls}: {issue.affectedUrlCount}</small>
            </div>
            <div className="fix-plan-block">
              <strong>{t.impact}</strong>
              <small>{issue.impact}</small>
            </div>
            <div className="fix-plan-block">
              <strong>{t.fixSteps}</strong>
              {issue.recommendedFix.steps.slice(0, 3).map((step, index) => (
                <small key={`${issue.fingerprint}-fix-${index}`}>{index + 1}. {step}</small>
              ))}
            </div>
            <div className="fix-plan-block">
              <strong>{t.verifySteps}</strong>
              {issue.verification[0]?.steps.slice(0, 2).map((step, index) => (
                <small key={`${issue.fingerprint}-verify-${index}`}>{index + 1}. {step}</small>
              ))}
            </div>
            {issue.evidence?.length ? (
              <div className="samples">
                <strong>{t.evidence}</strong>
                {issue.evidence.slice(0, 3).map((item, index) => (
                  <small key={`${issue.fingerprint}-evidence-${index}`}>
                    {item.url || "-"} · {item.label}{item.detail ? ` · ${item.detail}` : ""}
                  </small>
                ))}
              </div>
            ) : null}
            <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: issue.type })}>
              {t.showMatchingUrls}
            </button>
            <button className="impact-filter" type="button" onClick={() => onStatusChange?.(issue, "resolved")}>
              {t.markResolved}
            </button>
            <button className="impact-filter" type="button" onClick={() => onStatusChange?.(issue, "ignored")}>
              {t.ignoreIssue}
            </button>
          </article>
          ))}
        </div>
      ) : <div className="clean"><CheckCircle2 size={20} /><span>{t.noOpenIssues}</span></div>}
      {closedIssues?.length ? (
        <details className="closed-issue-decisions">
          <summary>{t.closedIssueDecisions}: {closedIssues.length}</summary>
          <div>
            {closedIssues.slice(0, 12).map((issue) => (
              <article key={`closed-${issue.fingerprint}`}>
                <Badge severity="notice">{t[issue.status] || issue.status}</Badge>
                <strong>{issue.title}</strong>
                <button className="impact-filter" type="button" onClick={() => onStatusChange?.(issue, "open")}>
                  {t.reopenIssue}
                </button>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Backlog({ backlog, t }) {
  if (!backlog?.length) {
    return (
      <section className="panel backlog">
        <div className="panel-head"><h2>{t.fixFirst}</h2></div>
        <div className="clean"><CheckCircle2 size={20} /><span>{t.noPriority}</span></div>
      </section>
    );
  }
  return (
    <section className="panel backlog">
      <div className="panel-head"><h2>{t.fixFirst}</h2><span>{backlog.length} {t.tasks}</span></div>
      <div className="tasks">
        {backlog.map((task) => (
          <article className={`task task-${task.severity}`} key={task.key}>
            <div className="task-top">
              <Badge severity={task.severity}>{task.count} affected</Badge>
              <h3>{task.title}</h3>
            </div>
            <p>{task.action}</p>
            {task.sampleUrls?.length ? (
              <div className="samples">{task.sampleUrls.map((url, index) => <small key={`${url}-${index}`}>{url}</small>)}</div>
            ) : null}
          </article>
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
      <div className="panel-head"><h2>{t.robotsAnalysis}</h2><span>{analysis?.ruleCount || 0} {t.rules}</span></div>
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
        <div className="robot-sitemaps">{robots.sitemapDirectives.map((url, index) => <small key={`${url}-${index}`}>{url}</small>)}</div>
      ) : null}
      {analysis?.blockedSummaries?.length ? (
        <div className="robots-impact">
          <div className="panel-head"><h2>{t.robotsImpact}</h2><span>{analysis.blockedSummaries.length}</span></div>
          <div className="impact-list">
            {analysis.blockedSummaries.map((item) => {
              const copyKey = `${item.scope}-${item.rule}`;
              const issueType = robotsImpactIssueType(item.scope);
              return (
                <article className="impact-card" key={copyKey}>
                  <div className="impact-top">
                    <Badge severity="warning">{impactLabels[item.scope] || item.scope}</Badge>
                    <strong>{item.rule}</strong>
                    <span>{item.count}</span>
                  </div>
                  {item.details?.length ? <div className="impact-details">{item.details.map((detail, index) => <small key={`${detail}-${index}`}>{detail}</small>)}</div> : null}
                  {item.sampleUrls?.length ? (
                    <div className="impact-samples">
                      <strong>{t.sampleUrls}</strong>
                      {item.sampleUrls.map((url, index) => <small key={`${url}-${index}`}>{url}</small>)}
                    </div>
                  ) : null}
                  <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: issueType })}>
                    {t.showMatchingUrls}
                  </button>
                  {item.affectedUrls?.length ? (
                    <button
                      className="impact-filter"
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(item.affectedUrls.join("\n"));
                        setCopiedRule(copyKey);
                        window.setTimeout(() => setCopiedRule((current) => current === copyKey ? "" : current), 1600);
                      }}
                    >
                      {copiedRule === copyKey ? t.copiedBlockedUrls : t.copyBlockedUrls}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
      {robots.contentPreview ? (
        <details className="robots-content"><summary>{t.robotsContent}</summary><pre>{robots.contentPreview}</pre></details>
      ) : null}
    </section>
  );
}

function SignalList({ title, signals, labels, t, badgeLabel, severityFor, onSelectIssue }) {
  if (!signals?.length) return null;
  return (
    <section className="panel sitemap-signals">
      <div className="panel-head"><h2>{title}</h2><span>{signals.length}</span></div>
      <div className="impact-list">
        {signals.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={severityFor(item)}>{badgeLabel(item)}</Badge>
              <strong>{labels[item.key] || item.title}</strong>
              <span>{item.count}</span>
            </div>
            {item.details?.length ? (
              <div className="impact-samples"><strong>{t.relatedTargets}</strong>{item.details.map((detail, index) => <small key={`${detail}-${index}`}>{detail}</small>)}</div>
            ) : null}
            {item.sampleUrls?.length ? (
              <div className="impact-samples"><strong>{t.sampleUrls}</strong>{item.sampleUrls.map((url, index) => <small key={`${url}-${index}`}>{url}</small>)}</div>
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

export function IssuesView({ report, t, onSelectIssue, gscRows = [], searchInsights = [], inspectionResults = [] }) {
  const [issueStatuses, setIssueStatuses] = useState({});
  useEffect(() => {
    setIssueStatuses(loadIssueStatuses(report));
  }, [report?.input?.siteRootUrl, report?.input?.originalUrl]);
  const normalizedIssues = applyIssueStatuses(
    normalizeReportIssues(report, { gscRows, searchInsights, inspectionResults }),
    issueStatuses,
  );
  const openIssues = normalizedIssues.filter((issue) => issue.status === "open");
  const closedIssues = normalizedIssues.filter((issue) => issue.status !== "open");
  function changeIssueStatus(issue, status) {
    setIssueStatuses((current) => {
      const next = setIssueStatus(current, issue.fingerprint, status);
      saveIssueStatuses(report, next);
      return next;
    });
  }
  const sitemapLabels = {
    redirect: t.redirectUrlsInSitemap,
    noindex: t.noindexUrlsInSitemap,
    canonical_mismatch: t.canonicalizedElsewhere,
    canonical_not_in_sitemap: t.canonicalMissingFromSitemap,
    http_error: t.brokenUrlsInSitemap,
  };
  const internationalLabels = {
    alternate_not_reciprocal: t.alternateNotReciprocal,
    alternate_target_canonical_mismatch: t.alternateCanonicalMismatch,
    alternate_hreflang_invalid: t.invalidHreflangValues,
  };
  return (
    <>
      <FixPlan
        issues={openIssues}
        closedIssues={closedIssues}
        t={t}
        onSelectIssue={onSelectIssue}
        onStatusChange={changeIssueStatus}
      />
      <Backlog backlog={report.backlog} t={t} />
      <section className="panel robots">
        <div>
          <Bot size={20} />
          <div><h2>{t.robots}</h2><p>{report.robots?.url}</p></div>
        </div>
        {report.robots?.found
          ? <Badge>{t.found} - {report.robots.groupCount} {t.groups}</Badge>
          : <Badge severity="warning">{report.robots?.error || "Not found"}</Badge>}
      </section>
      <RobotsDetails robots={report.robots} t={t} onSelectIssue={onSelectIssue} />
      <SignalList
        title={t.sitemapSignals}
        signals={report.sitemapSignals}
        labels={sitemapLabels}
        t={t}
        badgeLabel={(item) => item.scope === "canonical_target" ? t.blockedCanonicalTargets : t.blockedSubmittedUrls}
        severityFor={(item) => item.key === "http_error" || item.key === "noindex" ? "critical" : "warning"}
        onSelectIssue={onSelectIssue}
      />
      <SignalList
        title={t.internationalSignals}
        signals={report.internationalSignals}
        labels={internationalLabels}
        t={t}
        badgeLabel={() => t.blockedAlternateTargets}
        severityFor={() => "warning"}
        onSelectIssue={onSelectIssue}
      />
    </>
  );
}
