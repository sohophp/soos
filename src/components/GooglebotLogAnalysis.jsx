import React, { useEffect, useMemo, useState } from "react";
import { apiPost, formatApiError } from "../api-client.js";
import { downloadCsvFile } from "../downloads.js";
import { parseAccessLog } from "../googlebot-log.js";
import {
  buildGooglebotLogCsvRows,
  buildGooglebotLogDiagnosis,
} from "../googlebot-diagnostics.js";
import { googlebotLogText } from "../i18n.js";
import { paginateResultRows } from "../result-pagination.js";
import { Badge } from "./ReportUi.jsx";
import { ResultPagination } from "./ResultPagination.jsx";
export function GooglebotLogAnalysis({ report, language, gscRows }) {
  const copy = googlebotLogText[language] || googlebotLogText.en;
  const [analysis, setAnalysis] = useState(null);
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
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
      setError(formatApiError(err));
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  const diagnosis = useMemo(
    () => buildGooglebotLogDiagnosis(analysis, report, gscRows, copy),
    [analysis, copy, gscRows, report],
  );

  const visibleFindings = diagnosis?.findings?.filter((item) => filter === "all" || item.type === filter) || [];
  const pagination = paginateResultRows(visibleFindings, pageNumber);
  const counts = diagnosis?.findings?.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {}) || {};
  useEffect(() => setPageNumber(1), [analysis, filter]);
  useEffect(() => {
    if (pageNumber > pagination.pageCount) setPageNumber(pagination.pageCount);
  }, [pageNumber, pagination.pageCount]);

  function exportDiagnosis() {
    downloadCsvFile(
      "soos-googlebot-log-diagnosis.csv",
      buildGooglebotLogCsvRows(diagnosis?.findings),
    );
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
          {message ? <small role="status">{message}</small> : null}
          {error ? <small className="gsc-import-error" role="alert">{copy.failed}: {error}</small> : null}
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
            <select aria-label={copy.title} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">{copy.all} ({diagnosis.findings.length})</option>
              {["errors", "nonSitemap", "parameters", "assets", "blocked", "unverified", "missing"].map((type) => (
                <option value={type} key={type}>{copy[type]} ({counts[type] || 0})</option>
              ))}
            </select>
            <button className="export-button" type="button" disabled={!diagnosis.findings.length} onClick={exportDiagnosis}>{copy.export}</button>
          </div>
          {visibleFindings.length ? (
            <div className="googlebot-log-findings">
              {pagination.items.map((item, index) => (
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
          <ResultPagination
            pagination={pagination}
            onPage={setPageNumber}
            label={copy.title}
            language={language}
          />
        </>
      ) : null}
    </section>
  );
}
