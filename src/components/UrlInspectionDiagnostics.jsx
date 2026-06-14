import React, { useEffect, useMemo, useState } from "react";
import { downloadCsvFile } from "../downloads.js";
import { LARGE_RESULT_PAGE_SIZE, paginateResultRows } from "../result-pagination.js";
import {
  buildFreshnessRows,
  buildIndexCoverageRows,
  buildUrlAlignmentRows,
  sortFreshnessRows,
} from "../url-inspection-diagnostics.js";
import { ResultPagination } from "./ResultPagination.jsx";

export function UrlAlignmentMatrix({ report, inspectionResults, copy, language, Badge }) {
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const rows = useMemo(
    () => buildUrlAlignmentRows(report, inspectionResults, copy),
    [copy, inspectionResults, report],
  );
  const counts = rows.reduce((summary, row) => {
    summary[row.state] = (summary[row.state] || 0) + 1;
    return summary;
  }, {});
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.state === filter);
  const pagination = paginateResultRows(visibleRows, pageNumber);
  const states = [...new Set(rows.map((row) => row.state))];
  useEffect(() => setPageNumber(1), [filter, inspectionResults, report]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);
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
          <select aria-label={copy.alignmentTitle} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.alignmentAll} ({rows.length})</option>
            {states.map((state) => {
              const row = rows.find((item) => item.state === state);
              return <option value={state} key={state}>{row.label} ({counts[state]})</option>;
            })}
          </select>
          <button className="export-button" type="button" onClick={exportRows}>{copy.exportAlignment}</button>
        </div>
      </div>
      <div
        className="url-alignment-table"
        role="table"
        aria-label={copy.alignmentTitle}
        aria-rowcount={visibleRows.length + 1}
        tabIndex="0"
      >
        <div className="url-alignment-row head" role="row">
          <span role="columnheader">{copy.alignmentState}</span>
          <span role="columnheader">{copy.submittedUrl}</span>
          <span role="columnheader">{copy.fetchedUrl}</span>
          <span role="columnheader">{copy.htmlCanonical}</span>
          <span role="columnheader">{copy.googleCanonical}</span>
        </div>
        {pagination.items.map((row, index) => (
          <div
            className="url-alignment-row"
            role="row"
            aria-rowindex={(pagination.page - 1) * LARGE_RESULT_PAGE_SIZE + index + 2}
            key={row.submittedUrl}
          >
            <span role="cell"><Badge severity={row.severity === "good" ? "ok" : row.severity}>{row.label}</Badge></span>
            <span role="cell" title={row.submittedUrl}>{row.submittedUrl || "-"}</span>
            <span role="cell" title={row.fetchedUrl}>{row.fetchedUrl || "-"}</span>
            <span role="cell" title={row.htmlCanonical}>{row.htmlCanonical || "-"}</span>
            <span role="cell" title={row.googleCanonical}>{row.googleCanonical || "-"}</span>
          </div>
        ))}
      </div>
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={copy.alignmentTitle}
        language={language}
      />
    </section>
  );
}

export function IndexCoveragePriorities({ report, inspectionResults, gscRows, copy, language, Badge }) {
  const [groupPages, setGroupPages] = useState({});
  const rows = buildIndexCoverageRows(report, inspectionResults, gscRows, copy);
  const priorityRank = { high: 3, medium: 2, low: 1 };
  const actionableRows = rows
    .filter((row) => row.disposition !== "indexed")
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || b.impressions - a.impressions);
  const groups = [...new Map(actionableRows.map((row) => [row.reason, {
    reason: row.reason,
    label: row.reasonLabel,
    rows: actionableRows.filter((item) => item.reason === row.reason),
  }])).values()];
  useEffect(() => setGroupPages({}), [inspectionResults, report]);
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
          {groups.map((group) => {
            const pagination = paginateResultRows(group.rows, groupPages[group.reason] || 1, 8);
            return (
              <article className="coverage-group" key={group.reason}>
                <div className="impact-top">
                  <Badge severity={group.rows.some((row) => row.priority === "high") ? "critical" : "warning"}>{group.label}</Badge>
                  <strong>{group.rows.length} {copy.affectedUrls}</strong>
                  <span>{group.rows.reduce((sum, row) => sum + row.impressions, 0)} {copy.impressions}</span>
                </div>
                <div className="coverage-priority-rows">
                  {pagination.items.map((row) => (
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
                <ResultPagination
                  pagination={pagination}
                  onPage={(page) => setGroupPages((current) => ({ ...current, [group.reason]: page }))}
                  label={`${copy.coverageTitle}: ${group.label}`}
                  language={language}
                />
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function ImportantPageFreshness({ inspectionResults, gscRows, copy, language, Badge }) {
  const [sortBy, setSortBy] = useState("risk");
  const [pageNumber, setPageNumber] = useState(1);
  const rows = buildFreshnessRows(inspectionResults, gscRows);
  const sortedRows = sortFreshnessRows(rows, sortBy);
  const pagination = paginateResultRows(sortedRows, pageNumber);
  useEffect(() => setPageNumber(1), [inspectionResults, sortBy]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);
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
          <select aria-label={copy.freshnessTitle} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
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
        {pagination.items.map((row) => (
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
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={copy.freshnessTitle}
        language={language}
      />
    </section>
  );
}
