import React, { useEffect, useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import { downloadCsvFile } from "../downloads.js";
import {
  buildInternalLinkGraph,
  buildInternalLinkGraphCsvRows,
} from "../link-graph.js";
import { paginateResultRows } from "../result-pagination.js";
import { Badge } from "./ReportUi.jsx";
import { ResultPagination } from "./ResultPagination.jsx";

function Sitemaps({ sitemaps, t }) {
  if (!sitemaps?.length) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.sitemaps}</h2>
        <span>{sitemaps.length}</span>
      </div>
      <div className="sitemap-list">
        {sitemaps.map((sitemap, index) => (
          <div className="sitemap" key={`${sitemap.url}-${sitemap.kind || ""}-${index}`}>
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

function InternalDiscovery({ report, t, language }) {
  const [pageNumber, setPageNumber] = useState(1);
  const pages = report?.discoveredPages || [];
  const pagination = paginateResultRows(pages, pageNumber);
  useEffect(() => setPageNumber(1), [report]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);
  if (!report?.options?.internalCrawl) return null;
  return (
    <section className="panel internal-discovery">
      <div className="panel-head">
        <h2>{t.internalDiscoveryTitle}</h2>
        <span>{pages.length} {t.discoveredUrls}</span>
      </div>
      <div className="internal-discovery-copy">
        <small>{t.internalDiscoveryHelp}</small>
        {report.truncation?.internalCrawlLimitReached
          ? <small className="gsc-api-error">{t.internalCrawlLimit}</small>
          : null}
      </div>
      {pages.length ? (
        <div className="internal-discovery-list">
          {pagination.items.map((page, index) => (
            <article className="internal-discovery-row" key={`${page.url}-${page.discoveredFrom || ""}-${index}`}>
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
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={t.internalDiscoveryTitle}
        language={language}
      />
    </section>
  );
}

function InternalLinkGraph({ report, t, language }) {
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const graph = useMemo(() => buildInternalLinkGraph(report), [report]);
  const labels = {
    unreachable: t.graphUnreachable,
    orphan: t.graphOrphan,
    deep: t.graphDeep,
    weak: t.graphWeak,
    dead_end: t.graphDeadEnd,
    healthy: t.graphHealthy,
  };
  const visibleRows = filter === "all" ? graph.rows : graph.rows.filter((row) => row.state === filter);
  const pagination = paginateResultRows(visibleRows, pageNumber);
  useEffect(() => setPageNumber(1), [filter, report]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);
  if (!report?.options?.internalCrawl || !graph.rows.length) return null;

  function exportGraph() {
    downloadCsvFile("soos-internal-link-graph.csv", buildInternalLinkGraphCsvRows(graph, labels));
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
          <select aria-label={t.linkGraphTitle} value={filter} onChange={(event) => setFilter(event.target.value)}>
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
        {pagination.items.map((row, index) => (
          <article className="link-graph-row" key={`${row.url}-${row.state}-${index}`}>
            <Badge severity={
              row.state === "unreachable" || row.state === "orphan"
                ? "critical"
                : row.state === "deep" || row.state === "weak"
                  ? "warning"
                  : row.state === "dead_end"
                    ? "notice"
                    : "ok"
            }>
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
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={t.linkGraphTitle}
        language={language}
      />
    </section>
  );
}

export function UrlStructureView({ report, t, language }) {
  return (
    <>
      <InternalDiscovery report={report} t={t} language={language} />
      <InternalLinkGraph report={report} t={t} language={language} />
      <Sitemaps sitemaps={report.sitemaps} t={t} />
    </>
  );
}
