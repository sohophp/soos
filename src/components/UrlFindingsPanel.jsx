import React, { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  buildUrlSourceSets,
  paginateUrlFindings,
  pageMatchesUrlFilters,
  urlFilterCounts,
} from "../report-filters.js";
import { formatText, workspaceText } from "../i18n.js";
import { ResultPagination } from "./ResultPagination.jsx";

const severityLabels = { critical: "Critical", warning: "Warning", notice: "Notice" };
const severityIcons = { critical: XCircle, warning: AlertTriangle, notice: ShieldAlert };

function Badge({ severity, children }) {
  const Icon = severityIcons[severity] || CheckCircle2;
  return (
    <span className={`badge badge-${severity || "ok"}`}>
      <Icon size={14} aria-hidden="true" focusable="false" />
      {children}
    </span>
  );
}

function PageRow({ page, t }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const firstIssue = page.issues[0];
  const hasSignals =
    page.title != null
    || page.description != null
    || page.h1Count != null
    || page.lang != null
    || page.viewport != null
    || page.structuredData != null;

  return (
    <article className="row">
      <button
        className="row-main"
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={open ? "rotated" : ""} size={18} aria-hidden="true" focusable="false" />
        <div className="url-cell">
          <span>{page.url}</span>
          {page.finalUrl && page.finalUrl !== page.url ? <small>{t.final}: {page.finalUrl}</small> : null}
          {page.redirectChain?.length ? <small>{t.redirectChain}: {page.redirectChain.length} {t.redirectHops}</small> : null}
        </div>
        <div className="row-status">
          <span className="http">{page.status || "ERR"}</span>
          {firstIssue
            ? <Badge severity={firstIssue.severity}>{severityLabels[firstIssue.severity]}</Badge>
            : <Badge>OK</Badge>}
        </div>
      </button>
      {open ? (
        <div className="row-detail" id={detailId} role="region" aria-label={page.url}>
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
              <div><strong>{t.title}</strong><span>{page.title || t.missing}</span></div>
              <div><strong>{t.description}</strong><span>{page.description || t.missing}</span></div>
              <div><strong>{t.h1}</strong><span>{page.h1Count ?? t.unknown}</span></div>
              <div><strong>{t.lang}</strong><span>{page.lang || t.missing}</span></div>
              <div><strong>{t.viewport}</strong><span>{page.viewport ? t.present : t.missing}</span></div>
              <div>
                <strong>{t.jsonLd}</strong>
                <span>
                  {page.structuredData?.count
                    ? formatText(t.validInvalid, {
                      valid: page.structuredData.validCount,
                      invalid: page.structuredData.invalidCount,
                    })
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
                <ExternalLink size={14} aria-hidden="true" focusable="false" />
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
            {page.issues.length ? page.issues.map((issue, index) => (
              <div className={`issue issue-${issue.severity}`} key={`${issue.type}-${index}`}>
                <Badge severity={issue.severity}>{issue.type}</Badge>
                <span>{issue.message}</span>
                {issue.detail ? <small>{issue.detail}</small> : null}
              </div>
            )) : (
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

export function UrlFindingsPanel({
  report,
  gscRows,
  inspectionResults,
  comparisonEntry,
  issueFilter,
  t,
  language,
  onIssueFilterChange,
  onExportSummary,
  onExportHtml,
  onExportCsv,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [changeFilter, setChangeFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const workspaceCopy = workspaceText[language] || workspaceText.en;
  const sourceSets = useMemo(
    () => buildUrlSourceSets(report, gscRows, inspectionResults),
    [gscRows, inspectionResults, report],
  );
  const filterCounts = useMemo(
    () => urlFilterCounts(report?.pages || [], sourceSets, comparisonEntry),
    [comparisonEntry, report, sourceSets],
  );
  const pages = useMemo(() => (report?.pages || []).filter((page) => pageMatchesUrlFilters(page, {
    severity: filter,
    issueType: issueFilter?.type || "",
    query,
    source: sourceFilter,
    change: changeFilter,
    sourceSets,
    comparisonEntry,
  })), [changeFilter, comparisonEntry, filter, issueFilter, query, report, sourceFilter, sourceSets]);
  const pagination = paginateUrlFindings(pages, pageNumber);
  const { pageCount } = pagination;
  const visiblePages = pagination.items;

  useEffect(() => {
    setPageNumber(1);
  }, [changeFilter, filter, issueFilter, query, report, sourceFilter]);

  useEffect(() => {
    if (pageNumber > pageCount) setPageNumber(pageCount);
  }, [pageCount, pageNumber]);

  function clearFilters() {
    setFilter("all");
    onIssueFilterChange(null);
    setSourceFilter("all");
    setChangeFilter("all");
    setQuery("");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.urlFindings}</h2>
        <div className="findings-toolbar">
          <div className="filters" role="group" aria-label={t.urlFindings}>
            {["all", "critical", "warning", "notice", "ok"].map((item) => (
              <button
                className={filter === item ? "active" : ""}
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => {
                  setFilter(item);
                  if (item === "ok") onIssueFilterChange(null);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="findings-actions">
            {issueFilter?.type ? (
              <button className="export-button" type="button" onClick={() => onIssueFilterChange(null)}>
                {issueFilter.type}
              </button>
            ) : null}
            <label className="findings-select">
              <span>{workspaceCopy.sourceFilter}</span>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">{workspaceCopy.sourceAll} ({filterCounts.sources.all})</option>
                <option value="sitemap">{workspaceCopy.sourceSitemap} ({filterCounts.sources.sitemap})</option>
                <option value="internal">{workspaceCopy.sourceInternal} ({filterCounts.sources.internal})</option>
                <option value="gsc">{workspaceCopy.sourceGsc} ({filterCounts.sources.gsc})</option>
                <option value="google">{workspaceCopy.sourceGoogle} ({filterCounts.sources.google})</option>
              </select>
            </label>
            <label className="findings-select">
              <span>{workspaceCopy.changeFilter}</span>
              <select value={changeFilter} onChange={(event) => setChangeFilter(event.target.value)}>
                <option value="all">{workspaceCopy.changeAll} ({filterCounts.changes.all})</option>
                <option value="regressed">{workspaceCopy.changeRegressed} ({filterCounts.changes.regressed})</option>
                <option value="persistent">{workspaceCopy.changePersistent} ({filterCounts.changes.persistent})</option>
                <option value="improved">{workspaceCopy.changeImproved} ({filterCounts.changes.improved})</option>
                <option value="unchanged">{workspaceCopy.changeUnchanged} ({filterCounts.changes.unchanged})</option>
                <option value="unavailable">{workspaceCopy.changeUnavailable} ({filterCounts.changes.unavailable})</option>
              </select>
            </label>
            <input
              className="findings-search"
              type="search"
              aria-label={t.searchUrls}
              placeholder={t.searchUrls}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="export-button" type="button" onClick={onExportSummary}>{t.exportSummary}</button>
            <button className="export-button" type="button" onClick={onExportHtml}>{workspaceCopy.exportHtml}</button>
            <button className="export-button" type="button" onClick={() => onExportCsv(pages)}>{t.exportCsv}</button>
            {filter !== "all" || issueFilter || sourceFilter !== "all" || changeFilter !== "all" || query ? (
              <button className="export-button" type="button" onClick={clearFilters}>{workspaceCopy.clearFilters}</button>
            ) : null}
          </div>
        </div>
      </div>
      <small className="findings-match-count" role="status" aria-live="polite">
        {pages.length} {workspaceCopy.matchingUrls}
      </small>
      <div className="rows">
        {visiblePages.length
          ? visiblePages.map((page) => <PageRow page={page} key={page.url} t={t} />)
          : <p className="none">{t.noFilter}</p>}
      </div>
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={t.urlFindings}
        language={language}
      />
    </section>
  );
}
