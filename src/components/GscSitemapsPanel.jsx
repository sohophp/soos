import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { loadGscSitemaps } from "../gsc-client.js";
import { gscDataText } from "../i18n.js";
import { normalizeReportUrl } from "../url-policy.js";

export function GscSitemapsPanel({ status, siteUrl, currentSitemapUrl, language }) {
  const copy = gscDataText[language] || gscDataText.en;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setResult(null);
    setError("");
  }, [siteUrl]);

  async function loadSitemaps() {
    if (!status?.configured) {
      setError(copy.connectFirst);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.propertyFirst);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResult(await loadGscSitemaps(siteUrl));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const currentKey = normalizeReportUrl(currentSitemapUrl || "");
  const currentFound = currentKey
    ? (result?.sitemaps || []).some((item) => normalizeReportUrl(item.path) === currentKey)
    : null;

  return (
    <section className="panel gsc-sitemaps-panel">
      <div className="panel-head">
        <h2>{copy.sitemapsTitle}</h2>
        <span>{status?.configured ? copy.ready : copy.configureFirst}</span>
      </div>
      <div className="gsc-sitemaps-actions">
        <div>
          <strong>{copy.sitemapsTitle}</strong>
          <small>{copy.sitemapsHelp}</small>
        </div>
        <button className="export-button" type="button" onClick={loadSitemaps} disabled={loading || !status?.configured}>
          {loading ? copy.sitemapsLoading : copy.sitemapsLoad}
        </button>
      </div>
      {error ? <div className="url-inspection-error">{error}</div> : null}
      {result ? (
        <div className="gsc-sitemaps-body">
          <div className="coverage-disposition-summary">
            <span>{result.summary?.total || 0} {copy.sitemapsTotal}</span>
            <span>{result.summary?.pending || 0} {copy.sitemapsPending}</span>
            <span>{result.summary?.withErrors || 0} {copy.sitemapsErrors}</span>
            <span>{result.summary?.withWarnings || 0} {copy.sitemapsWarnings}</span>
            <span>{result.summary?.submittedUrls || 0} {copy.sitemapsSubmittedUrls}</span>
          </div>
          {currentFound !== null ? (
            <div className={`gsc-sitemap-current ${currentFound ? "found" : "missing"}`}>
              {currentFound ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{currentFound ? copy.sitemapsCurrentFound : copy.sitemapsCurrentMissing}</span>
            </div>
          ) : null}
          {(result.sitemaps || []).length ? (
            <div className="gsc-sitemap-list">
              {result.sitemaps.map((item) => (
                <article className="gsc-sitemap-row" key={item.path}>
                  <div>
                    <strong title={item.path}>{item.path}</strong>
                    <small>{item.sitemapIndex ? copy.sitemapsIndex : copy.sitemapsFile}{item.type ? ` / ${item.type}` : ""}</small>
                  </div>
                  <span>{copy.sitemapsLastRead}: {item.lastDownloaded || "-"}</span>
                  <span>{copy.sitemapsLastSubmitted}: {item.lastSubmitted || "-"}</span>
                  <span>{item.submittedUrls} {copy.sitemapsSubmittedUrls}</span>
                  <span>{item.errors} {copy.sitemapsErrors} / {item.warnings} {copy.sitemapsWarnings}</span>
                </article>
              ))}
            </div>
          ) : <small>{copy.sitemapsNoData}</small>}
          <small className="gsc-sitemaps-note">{copy.sitemapsDeprecatedNote}</small>
        </div>
      ) : null}
    </section>
  );
}
