import React, { useEffect, useMemo, useState } from "react";
import { formatApiError } from "../api-client.js";
import { inspectGscUrls } from "../gsc-client.js";
import { gscDataText, inspectionDiagnosisText } from "../i18n.js";
import { buildUrlInspectionCandidates } from "../url-inspection-candidates.js";
import {
  buildInspectionQuotaSummary,
  buildInspectionQueueState,
  localizeInspectionResults,
  mergeInspectionBatch,
  summarizeInspectionDiagnoses,
} from "../url-inspection-view.js";
import { paginateResultRows } from "../result-pagination.js";
import { GoogleUrlSetComparison } from "./GoogleUrlSetComparison.jsx";
import { Badge, Stat } from "./ReportUi.jsx";
import { ResultPagination } from "./ResultPagination.jsx";
import { StructuredDataDiagnostics } from "./StructuredDataDiagnostics.jsx";
import { ImportantPageFreshness, IndexCoveragePriorities, UrlAlignmentMatrix } from "./UrlInspectionDiagnostics.jsx";
export function UrlInspectionPanel({ report, gscStatus, siteUrl, language, gscRows, comparisonEntry, onResultsChange }) {
  const copy = gscDataText[language] || gscDataText.en;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultPageNumber, setResultPageNumber] = useState(1);
  const [error, setError] = useState("");
  const candidates = useMemo(
    () => buildUrlInspectionCandidates(report, gscRows, comparisonEntry),
    [comparisonEntry, gscRows, report],
  );
  useEffect(() => {
    setResult(null);
    setResultPageNumber(1);
    setError("");
  }, [report?.scannedAt, siteUrl]);
  useEffect(() => {
    onResultsChange?.(result?.results || []);
  }, [onResultsChange, result]);
  if (!report?.pages?.length) return null;

  const {
    pendingCandidates,
    nextCandidates,
    nextUrls,
    anomalyCount,
    sourceCounts,
    indexedCount,
    failedCount,
  } = buildInspectionQueueState(candidates, result?.results || []);
  const reasonLabel = (reason) => {
    if (reason.startsWith("technical_blocker:")) return copy.candidateTechnical;
    if (reason.startsWith("url_signal:")) return copy.candidateSignals;
    if (reason.startsWith("history_severity_worsened:")) return copy.candidateHistoryWorsened;
    if (reason.startsWith("history_issue_introduced:")) return copy.candidateHistoryIntroduced;
    if (reason === "history_new_page") return copy.candidateHistoryNewPage;
    if (reason === "gsc_missing_sitemap") return copy.candidateGscMissing;
    if (reason === "internal_missing_sitemap") return copy.candidateInternalMissing;
    if (reason === "homepage_unreachable") return copy.candidateUnreachable;
    if (reason === "homepage_deep") return copy.candidateDeepPath;
    if (reason === "sitemap_no_gsc_impressions") return copy.candidateNoGsc;
    return copy.candidateBaseline;
  };
  const sourceLabel = (source) => ({
    sitemap: copy.sourceSitemapShort,
    gsc: copy.sourceGscShort,
    internal: copy.sourceInternalShort,
    history: copy.sourceHistoryShort,
  })[source] || source;
  const diagnosedResults = localizeInspectionResults(
    result?.results || [],
    language,
    inspectionDiagnosisText,
  );
  const resultPagination = paginateResultRows(diagnosedResults, resultPageNumber);
  const diagnosisSummary = summarizeInspectionDiagnoses(diagnosedResults);
  const quotaSummary = buildInspectionQuotaSummary(candidates, result?.results || [], {
    configured: gscStatus?.configured,
    siteUrl,
    hasGscRows: Boolean(gscRows?.length),
    internalCrawl: Boolean(report?.options?.internalCrawl),
    comparisonAvailable: Boolean(comparisonEntry),
    historyPageSnapshotAvailable: Array.isArray(comparisonEntry?.pageUrls),
    truncated: Boolean(
      report?.truncation?.truncated
      || report?.truncation?.urlLimitReached
      || report?.truncation?.sitemapLimitReached
      || report?.truncation?.internalCrawlLimitReached
    ),
  });
  const scopeReasonLabel = (reason) => ({
    gsc_not_connected: copy.inspectionSkipConnection,
    property_missing: copy.inspectionSkipProperty,
    gsc_rows_unavailable: copy.inspectionSkipGscRows,
    internal_discovery_disabled: copy.inspectionSkipInternal,
    history_comparison_missing: copy.inspectionSkipHistoryComparison,
    history_page_snapshot_unavailable: copy.inspectionSkipHistorySnapshot,
    scan_truncated: copy.inspectionSkipTruncated,
    no_candidates: copy.inspectionSkipNoCandidates,
  })[reason] || reason;

  async function runInspection() {
    if (!siteUrl.trim()) {
      setError(copy.inspectPropertyFirst);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = await inspectGscUrls(nextUrls, siteUrl);
      setResult((current) => mergeInspectionBatch(current, body, nextCandidates));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!gscStatus?.configured) {
    return (
      <>
        <StructuredDataDiagnostics report={report} inspectionResults={[]} copy={copy} language={language} />
        <GoogleUrlSetComparison report={report} gscRows={gscRows} inspectionResults={[]} copy={copy} language={language} />
      </>
    );
  }

  return (
    <section className="panel url-inspection">
      <div className="panel-head">
        <h2>{copy.inspectionTitle}</h2>
        <span>{gscStatus?.configured ? "GSC API" : copy.configureFirst}</span>
      </div>
      <div className="url-inspection-body">
        <div className="url-inspection-copy">
          <strong>{copy.inspectStatus}</strong>
          <small>{copy.inspectionHelp}</small>
        </div>
        <button className="export-button" type="button" disabled={!gscStatus?.configured || loading || !nextUrls.length} onClick={runInspection}>
          {loading ? copy.inspecting : result ? nextUrls.length ? copy.inspectNext : copy.inspectionComplete : copy.inspect}
        </button>
      </div>
      <div className="inspection-queue">
        <div className="coverage-disposition-summary">
          <span>{candidates.length} {copy.inspectionCandidates}</span>
          <span>{anomalyCount} {copy.inspectionAnomalies}</span>
          <span>{copy.inspected}: {quotaSummary.inspected}/{quotaSummary.total}</span>
          <span>{copy.inspectionRemainingBatches}: {quotaSummary.remainingBatches}/{quotaSummary.totalBatches}</span>
          <span>{copy.sourceSitemapShort}: {sourceCounts.sitemap || 0}</span>
          <span>{copy.sourceGscShort}: {sourceCounts.gsc || 0}</span>
          <span>{copy.sourceInternalShort}: {sourceCounts.internal || 0}</span>
          <span>{copy.sourceHistoryShort}: {sourceCounts.history || 0}</span>
        </div>
        {nextCandidates.length ? (
          <div className="inspection-queue-list">
            <strong>{copy.inspectionNextBatch}: {nextCandidates.length}</strong>
            {nextCandidates.slice(0, 6).map((candidate, index) => (
              <div
                className="inspection-queue-row"
                key={`${candidate.key || candidate.url}-${candidate.sources.join(",")}-${candidate.reasons.join(",")}-${index}`}
              >
                <span title={candidate.url}>{candidate.url}</span>
                <small>{candidate.reasons.map(reasonLabel).join(" / ")}</small>
                <small>{copy.inspectionSources}: {candidate.sources.map(sourceLabel).join(", ")}</small>
              </div>
            ))}
          </div>
        ) : null}
        <small className="inspection-quota-note">
          {copy.inspectionQuotaNote
            .replace("{batchSize}", String(quotaSummary.batchSize))
            .replace("{nextBatch}", String(quotaSummary.nextBatchSize))}
        </small>
        {quotaSummary.scopeReasons.length ? (
          <div className="inspection-scope-reasons">
            <strong>{copy.inspectionSkippedReasons}</strong>
            <ul>
              {quotaSummary.scopeReasons.map((reason) => (
                <li key={reason}>{scopeReasonLabel(reason)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {result && pendingCandidates.length ? <small className="inspection-remaining">{pendingCandidates.length} {copy.remaining}</small> : null}
      {error ? <div className="url-inspection-error" role="alert">{error}</div> : null}
      <StructuredDataDiagnostics report={report} inspectionResults={result?.results || []} copy={copy} language={language} />
      <GoogleUrlSetComparison report={report} gscRows={gscRows} inspectionResults={result?.results || []} copy={copy} language={language} />
      {result ? (
        <>
          <div className="inspection-summary">
            <Stat label={copy.inspected} value={result.inspected} />
            <Stat label="PASS" value={indexedCount} tone="good" />
            <Stat label={copy.review} value={failedCount} tone="warn" />
          </div>
          <div className="inspection-diagnosis-summary">
            <span>{diagnosisSummary.critical} {copy.critical}</span>
            <span>{diagnosisSummary.warning} {copy.warnings}</span>
            <span>{diagnosisSummary.notice} {copy.notices}</span>
          </div>
          <IndexCoveragePriorities report={report} inspectionResults={result.results} gscRows={gscRows} copy={copy} language={language} Badge={Badge} />
          <ImportantPageFreshness inspectionResults={result.results} gscRows={gscRows} copy={copy} language={language} Badge={Badge} />
          <UrlAlignmentMatrix report={report} inspectionResults={result.results} copy={copy} language={language} Badge={Badge} />
          <div className="inspection-list">
            {resultPagination.items.map((item, index) => (
              <article className="inspection-card" key={`${item.url}-${item.verdict || ""}-${item.coverageState || item.error || ""}-${index}`}>
                <div className="impact-top">
                  <Badge severity={item.ok && item.verdict === "PASS" ? "ok" : item.ok ? "warning" : "critical"}>{item.verdict || (item.ok ? "UNKNOWN" : "ERROR")}</Badge>
                  <strong>{item.url}</strong>
                  <span>{item.coverageState || item.error || copy.noCoverage}</span>
                </div>
                <div className="impact-details">
                  {item.candidate?.reasons?.length ? <small>{copy.inspectionQueue}: {item.candidate.reasons.map(reasonLabel).join(" / ")}</small> : null}
                  {item.candidate?.sources?.length ? <small>{copy.inspectionSources}: {item.candidate.sources.map(sourceLabel).join(", ")}</small> : null}
                  {item.indexingState ? <small>{copy.indexing}: {item.indexingState}</small> : null}
                  {item.robotsTxtState ? <small>{copy.robots}: {item.robotsTxtState}</small> : null}
                  {item.pageFetchState ? <small>{copy.fetch}: {item.pageFetchState}</small> : null}
                  {item.crawledAs ? <small>{copy.crawledAs}: {item.crawledAs}</small> : null}
                  {item.lastCrawlTime ? <small>{copy.lastCrawl}: {item.lastCrawlTime}</small> : null}
                  {item.sitemap?.length ? <small>{copy.sitemap}: {item.sitemap.slice(0, 2).join(", ")}</small> : null}
                  {item.referringUrls?.length ? <small>{copy.referrers}: {item.referringUrls.length}</small> : null}
                  {item.googleCanonical ? <small>{copy.googleCanonical}: {item.googleCanonical}</small> : null}
                  {item.userCanonical ? <small>{copy.userCanonical}: {item.userCanonical}</small> : null}
                  {item.mobileVerdict ? <small>{copy.mobile}: {item.mobileVerdict}</small> : null}
                  {item.richResultsVerdict ? <small>{copy.richResults}: {item.richResultsVerdict}</small> : null}
                </div>
                {item.diagnoses.length ? (
                  <div className="inspection-diagnoses">
                    {item.diagnoses.map((diagnosis, diagnosisIndex) => (
                      <div className={`inspection-diagnosis ${diagnosis.severity}`} key={`${item.url}-${diagnosis.type}-${diagnosisIndex}`}>
                        <strong>{diagnosis.title}</strong>
                        <small>{diagnosis.detail}</small>
                        <span>{diagnosis.action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inspection-diagnoses">
                    <div className="inspection-diagnosis good">
                      <strong>{copy.noIssue}</strong>
                      <small>{copy.noIssueDetail}</small>
                      <span>{copy.noIssueAction}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
          <ResultPagination
            pagination={resultPagination}
            onPage={setResultPageNumber}
            label={copy.inspectionTitle}
            language={language}
          />
        </>
      ) : null}
    </section>
  );
}
