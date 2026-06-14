import React, { useEffect, useMemo, useState } from "react";
import { downloadCsvFile } from "../downloads.js";
import { buildUrlSetCsvRows, buildUrlSetFindings } from "../google-url-sets.js";
import { paginateResultRows } from "../result-pagination.js";
import { Badge } from "./ReportUi.jsx";
import { ResultPagination } from "./ResultPagination.jsx";

export function GoogleUrlSetComparison({ report, gscRows, inspectionResults, copy, language }) {
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
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
  const pagination = paginateResultRows(visibleFindings, pageNumber);
  useEffect(() => setPageNumber(1), [filter, report]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);

  return (
    <section className="url-set-comparison">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.urlSetsTitle}</strong>
          <small>{copy.urlSetsHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select aria-label={copy.urlSetsTitle} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.urlSetsAll} ({findings.length})</option>
            {Object.entries(typeLabels).map(([type, label]) => (
              <option value={type} key={type}>{label} ({counts[type] || 0})</option>
            ))}
          </select>
          <button
            className="export-button"
            type="button"
            disabled={!findings.length}
            onClick={() => downloadCsvFile("soos-url-set-diagnosis.csv", buildUrlSetCsvRows(findings, typeLabels))}
          >
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
          {pagination.items.map((item, index) => (
            <div className="url-set-row" key={`${item.type}-${item.url}-${index}`}>
              <Badge severity={item.severity}>{typeLabels[item.type] || item.type}</Badge>
              <strong title={item.url}>{item.url}</strong>
              <span>{item.source}</span>
              <small title={item.detail}>{item.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={copy.urlSetsTitle}
        language={language}
      />
    </section>
  );
}
