import React, { useEffect, useMemo, useState } from "react";
import { downloadCsvFile } from "../downloads.js";
import { structuredDiagnosticText } from "../i18n.js";
import { paginateResultRows } from "../result-pagination.js";
import {
  buildStructuredDataCoverage,
  buildStructuredDataCsvRows,
  buildStructuredDataRows,
  summarizeStructuredDataRows,
} from "../structured-data-diagnostics.js";
import { ResultPagination } from "./ResultPagination.jsx";

export function StructuredDataDiagnostics({ report, inspectionResults, copy, language }) {
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const rows = useMemo(
    () => buildStructuredDataRows(report, inspectionResults),
    [inspectionResults, report],
  );
  const totals = useMemo(() => summarizeStructuredDataRows(rows), [rows]);
  const coverage = useMemo(() => buildStructuredDataCoverage(rows), [rows]);

  const filteredRows = rows.filter((row) => {
    if (filter === "errors") return row.localErrors.length > 0;
    if (filter === "recommendations") return row.recommendations.length > 0;
    if (filter === "google") return row.googleIssues.length > 0 || (row.googleVerdict && row.googleVerdict !== "PASS");
    return true;
  });
  const pagination = paginateResultRows(filteredRows, pageNumber);
  useEffect(() => setPageNumber(1), [filter, report]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);
  if (!rows.length) return null;
  const diagnosticLabels = structuredDiagnosticText[language] || structuredDiagnosticText.en;

  return (
    <section className="structured-data-diagnostics">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.structuredTitle}</strong>
          <small>{copy.structuredHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select aria-label={copy.structuredTitle} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.structuredAll} ({rows.length})</option>
            <option value="errors">{copy.structuredErrors} ({totals.errors})</option>
            <option value="recommendations">{copy.structuredRecommendations} ({totals.recommendations})</option>
            <option value="google">{copy.structuredGoogle} ({totals.google})</option>
          </select>
          <button
            className="export-button"
            type="button"
            onClick={() => downloadCsvFile(
              "soos-structured-data-diagnosis.csv",
              buildStructuredDataCsvRows(rows, copy.structuredNoIssues),
            )}
          >
            {copy.structuredExport}
          </button>
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
        {pagination.items.map((row, index) => (
          <div className="structured-data-row" key={`${row.url}-${row.googleVerdict || ""}-${index}`}>
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
              {!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length
                ? <small>{copy.structuredNoIssues}</small>
                : null}
            </div>
          </div>
        ))}
      </div>
      <ResultPagination
        pagination={pagination}
        onPage={setPageNumber}
        label={copy.structuredTitle}
        language={language}
      />
    </section>
  );
}
