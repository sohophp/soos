import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatApiError } from "../api-client.js";
import { loadGscSitemaps } from "../gsc-client.js";
import { normalizeGscSitemapUrl } from "../gsc-sitemaps.js";
import { gscDataText } from "../i18n.js";

export function GscSitemapsPanel({ status, siteUrl, currentSitemapUrls = [], language }) {
  const copy = gscDataText[language] || gscDataText.en;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadSitemaps = useCallback(async () => {
    const requestedSiteUrl = siteUrl.trim();
    if (!status?.configured || !requestedSiteUrl) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = await loadGscSitemaps(requestedSiteUrl);
      if (requestId !== requestIdRef.current || siteUrl.trim() !== requestedSiteUrl) return;
      if (String(body.siteUrl || "") !== requestedSiteUrl) {
        setError(copy.sitemapsPropertyMismatch);
        return;
      }
      setResult(body);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(formatApiError(err));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [copy.sitemapsPropertyMismatch, siteUrl, status?.configured]);

  useEffect(() => {
    requestIdRef.current += 1;
    setResult(null);
    setError("");
    setLoading(false);
    if (status?.configured && siteUrl.trim()) loadSitemaps();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadSitemaps, siteUrl, status?.configured]);

  const currentKeys = [...new Set(currentSitemapUrls.map(normalizeGscSitemapUrl).filter(Boolean))];
  const googleKeys = new Set((result?.sitemaps || []).map((item) => normalizeGscSitemapUrl(item.path)).filter(Boolean));
  const currentMatchCount = currentKeys.filter((key) => googleKeys.has(key)).length;
  const currentFound = currentKeys.length ? currentMatchCount === currentKeys.length : null;

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
          <small>{copy.sitemapsProperty}: {result?.siteUrl || siteUrl}</small>
        </div>
        <button className="export-button" type="button" onClick={loadSitemaps} disabled={loading || !status?.configured}>
          {loading ? copy.sitemapsLoading : copy.sitemapsReload}
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
              <span>
                {currentFound
                  ? copy.sitemapsCurrentFound
                  : `${copy.sitemapsCurrentMissing} (${currentMatchCount}/${currentKeys.length})`}
              </span>
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
