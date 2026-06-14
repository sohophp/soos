import React, { useEffect, useMemo, useState } from "react";
import { apiPost, formatApiError } from "../api-client.js";
import { pageSpeedText } from "../i18n.js";
import { Badge, Stat } from "./ReportUi.jsx";

const SESSION_KEY = "soos.pagespeed.api-key";

function readSessionKey() {
  try {
    return globalThis.sessionStorage?.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function scoreSeverity(score) {
  if (score == null) return "notice";
  if (score >= 90) return "ok";
  if (score >= 50) return "warning";
  return "critical";
}

function fieldSeverity(category) {
  if (category === "FAST" || category === "good") return "ok";
  if (category === "AVERAGE" || category === "needs-improvement") return "warning";
  if (category === "SLOW" || category === "poor") return "critical";
  return "notice";
}

function fieldValue(metric, name) {
  if (metric?.percentile == null) return "-";
  if (name === "cls") return String(metric.percentile);
  return `${metric.percentile} ms`;
}

function metricValue(metric, name) {
  if (!metric) return "-";
  if (metric.displayValue) return metric.displayValue;
  if (metric.numericValue == null) return "-";
  if (name === "cls") return metric.numericValue.toFixed(3);
  return `${Math.round(metric.numericValue)} ms`;
}

function coreWebVitalsStatus(field) {
  const required = ["lcp", "cls", "inp"];
  const available = required.filter((name) => field?.metrics?.[name]);
  if (available.length < required.length) return "insufficient-data";
  return available.some((name) => fieldSeverity(field.metrics[name].category) !== "ok") ? "failed" : "passed";
}

function auditDescription(value) {
  return String(value || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function formatBytes(value) {
  if (!value) return "";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function cruxErrorState(error, copy) {
  if (error?.code !== "CRUX_API_NOT_ENABLED") {
    return {
      message: formatApiError(error),
      code: error?.code || "",
      requestId: error?.requestId || "",
      enableUrl: "",
    };
  }
  const urlMatch = String(error?.message || "").match(
    /https:\/\/(?:console\.developers\.google\.com|console\.cloud\.google\.com)\/[^\s)]+/,
  );
  return {
    message: copy.cruxApiNotEnabled,
    code: error.code,
    requestId: error.requestId || "",
    enableUrl: urlMatch?.[0]?.replace(/[.,;]+$/, "")
      || "https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com",
  };
}

export function PageSpeedInsightsPanel({ report, language }) {
  const copy = pageSpeedText[language] || pageSpeedText.en;
  const urls = useMemo(() => [...new Set(
    (report?.pages || [])
      .flatMap((page) => [page.finalUrl || page.url, page.url])
      .filter(Boolean),
  )].slice(0, 500), [report]);
  const [apiKey, setApiKey] = useState(readSessionKey);
  const [url, setUrl] = useState(urls[0] || report?.input?.siteRootUrl || "");
  const [strategy, setStrategy] = useState("mobile");
  const [includeCrux, setIncludeCrux] = useState(true);
  const [result, setResult] = useState(null);
  const [cruxResult, setCruxResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cruxError, setCruxError] = useState("");

  useEffect(() => {
    if (!urls.includes(url)) setUrl(urls[0] || report?.input?.siteRootUrl || "");
    setResult(null);
    setCruxResult(null);
    setError("");
    setCruxError("");
  }, [report?.scannedAt, report?.input?.siteRootUrl, url, urls]);

  function updateKey(value) {
    setApiKey(value);
    try {
      if (value) globalThis.sessionStorage?.setItem(SESSION_KEY, value);
      else globalThis.sessionStorage?.removeItem(SESSION_KEY);
    } catch {
      // Session-only storage may be unavailable in strict privacy modes.
    }
  }

  async function run(event) {
    event?.preventDefault();
    setLoading(true);
    setResult(null);
    setCruxResult(null);
    setError("");
    setCruxError("");
    try {
      const pageSpeedRequest = apiPost("/api/pagespeed/run", {
        apiKey,
        url,
        strategy,
        locale: language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : "en",
      }, {
        fallbackMessage: copy.failed,
      });
      const cruxRequest = includeCrux
        ? apiPost("/api/crux/run", {
          apiKey,
          url,
          formFactor: strategy === "desktop" ? "DESKTOP" : "PHONE",
        }, {
          fallbackMessage: copy.cruxFailed,
        })
        : Promise.resolve(null);
      const [pageSpeedOutcome, cruxOutcome] = await Promise.allSettled([
        pageSpeedRequest,
        cruxRequest,
      ]);
      if (pageSpeedOutcome.status === "rejected") throw pageSpeedOutcome.reason;
      setResult(pageSpeedOutcome.value);
      if (cruxOutcome.status === "fulfilled") {
        setCruxResult(cruxOutcome.value);
      } else {
        setCruxResult(null);
        setCruxError(cruxErrorState(cruxOutcome.reason, copy));
      }
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

  const field = result?.field?.page?.available
    ? result.field.page
    : result?.field?.origin?.available
      ? result.field.origin
      : null;
  const cruxField = cruxResult?.page?.available
    ? cruxResult.page
    : cruxResult?.origin?.available
      ? cruxResult.origin
      : null;
  const preferredField = cruxField || field;
  const preferredFieldSource = cruxField ? "crux" : field ? "pagespeed" : "";
  const webVitalsStatus = coreWebVitalsStatus(preferredField);

  return (
    <section className="panel pagespeed-panel">
      <div className="panel-head">
        <div>
          <h2>{copy.title}</h2>
          <small>{copy.help}</small>
        </div>
        <span>{copy.onDemand}</span>
      </div>
      <form className="pagespeed-form" onSubmit={run}>
        <label>
          <strong>{copy.apiKey}</strong>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => updateKey(event.target.value)}
            placeholder={copy.apiKeyPlaceholder}
            required
          />
          <small>{copy.apiKeyHelp}</small>
        </label>
        <label>
          <strong>{copy.testUrl}</strong>
          <select value={url} onChange={(event) => setUrl(event.target.value)}>
            {urls.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <fieldset className="pagespeed-strategy">
          <legend>{copy.strategy}</legend>
          {["mobile", "desktop"].map((item) => (
            <label key={item}>
              <input
                type="radio"
                name="pagespeed-strategy"
                value={item}
                checked={strategy === item}
                onChange={() => setStrategy(item)}
              />
              <span>{copy[item]}</span>
            </label>
          ))}
        </fieldset>
        <label className="pagespeed-crux-option">
          <input
            type="checkbox"
            checked={includeCrux}
            onChange={(event) => setIncludeCrux(event.target.checked)}
          />
          <span>{copy.includeCrux}</span>
        </label>
        <div className="pagespeed-actions">
          <button className="export-button" type="submit" disabled={loading || !apiKey || !url}>
            {loading ? copy.running : copy.run}
          </button>
          {apiKey ? (
            <button className="export-button" type="button" onClick={() => updateKey("")}>
              {copy.clearKey}
            </button>
          ) : null}
        </div>
        <small className="pagespeed-privacy">{copy.privacy}</small>
      </form>
      {error ? <div className="gsc-api-error" role="alert">{error}</div> : null}
      {cruxError ? (
        <div className="pagespeed-crux-error" role="status">
          <div>
            <strong>{cruxError.message}</strong>
            <small>{copy.cruxEnableWait}</small>
            {cruxError.code || cruxError.requestId ? (
              <small>
                {[cruxError.code, cruxError.requestId ? `request ${cruxError.requestId}` : ""].filter(Boolean).join(" · ")}
              </small>
            ) : null}
          </div>
          <div className="pagespeed-actions">
            {cruxError.enableUrl ? (
              <a className="export-button" href={cruxError.enableUrl} target="_blank" rel="noreferrer">
                {copy.enableCruxApi}
              </a>
            ) : null}
            <button className="export-button" type="button" onClick={() => run()} disabled={loading}>
              {copy.retryCrux}
            </button>
          </div>
        </div>
      ) : null}
      {result ? (
        <div className="pagespeed-results">
          <div className="inspection-summary">
            <Stat label={copy.performanceScore} value={result.scores.performance ?? "-"} tone={result.scores.performance >= 90 ? "good" : result.scores.performance < 50 ? "bad" : "warn"} />
            <Stat label={copy.seoScore} value={result.scores.seo ?? "-"} tone={result.scores.seo >= 90 ? "good" : result.scores.seo < 50 ? "bad" : "warn"} />
            <Stat label={copy.strategy} value={copy[result.strategy]} />
          </div>
          <div className="pagespeed-meta">
            <small>{copy.finalUrl}: {result.finalUrl}</small>
            <small>{copy.analyzedAt}: {result.analyzedAt}</small>
            <small>Lighthouse {result.lighthouseVersion || "-"}</small>
            {result.runtime?.totalMs != null ? <small>{copy.runtime}: {(result.runtime.totalMs / 1000).toFixed(1)} s</small> : null}
          </div>
          {result.redirected ? (
            <div className="pagespeed-callout warning" role="status">
              <strong>{copy.redirected}</strong>
              <span>{result.requestedUrl} → {result.finalUrl}</span>
            </div>
          ) : null}
          {result.lab.warnings?.length ? (
            <div className="pagespeed-callout warning" role="status">
              <strong>{copy.runWarnings}</strong>
              <ul>{result.lab.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}
          <section className="pagespeed-section">
            <strong>{copy.labTitle}</strong>
            <small>{copy.labHelp}</small>
            <div className="pagespeed-metrics">
              {Object.entries(result.lab.metrics || {}).map(([name, metric]) => (
                <div key={name}>
                  <span>{copy[name] || name.toUpperCase()}</span>
                  <strong>{metricValue(metric, name)}</strong>
                  <Badge severity={scoreSeverity(metric.score == null ? null : Math.round(metric.score * 100))}>
                    {metric.score == null ? copy.unknown : Math.round(metric.score * 100)}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
          <section className="pagespeed-section">
            <div className="pagespeed-section-heading">
              <div>
                <strong>{copy.fieldDataTitle}</strong>
                <small>{preferredFieldSource === "crux" ? copy.cruxHelp : copy.fieldHelp}</small>
              </div>
              {preferredField ? (
                <Badge severity={webVitalsStatus === "passed" ? "ok" : webVitalsStatus === "failed" ? "critical" : "notice"}>
                  {copy[webVitalsStatus]}
                </Badge>
              ) : null}
            </div>
            {preferredField ? (
              <div className="pagespeed-field">
                <small>
                  {preferredFieldSource === "crux" ? copy.cruxSource : copy.pagespeedFieldSource}
                  {" · "}
                  {preferredField.scope === "origin" || preferredField.originFallback || preferredField === result.field.origin
                    ? copy.originFallback
                    : copy.pageFieldData}
                  {preferredField.collectionPeriod?.firstDate && preferredField.collectionPeriod?.lastDate
                    ? ` · ${copy.collectionPeriod}: ${preferredField.collectionPeriod.firstDate} - ${preferredField.collectionPeriod.lastDate}`
                    : ""}
                </small>
                {Object.entries(preferredField.metrics || {}).map(([name, metric]) => (
                  <div key={name}>
                    <Badge severity={fieldSeverity(metric.category)}>{copy[metric.category] || copy.unknown}</Badge>
                    <strong>{copy[name] || name.toUpperCase()}</strong>
                    <span>{fieldValue(metric, name)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="none">{includeCrux && cruxResult ? copy.noCruxData : copy.noFieldData}</p>}
            {preferredFieldSource === "pagespeed" ? <small className="pagespeed-deprecation">{copy.fieldDeprecation}</small> : null}
          </section>
          {result.lab.opportunities?.length ? (
            <section className="pagespeed-section">
              <strong>{copy.opportunities}</strong>
              <div className="pagespeed-opportunities">
                {result.lab.opportunities.map((item) => (
                  <div key={item.id}>
                    <Badge severity={scoreSeverity(Math.round(item.score * 100))}>{Math.round(item.score * 100)}</Badge>
                    <strong>{item.title}</strong>
                    <span>
                      {item.displayValue || [
                        item.savingsMs ? `${item.savingsMs} ms` : "",
                        formatBytes(item.savingsBytes),
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {result.lab.diagnostics?.length ? (
            <section className="pagespeed-section">
              <strong>{copy.performanceDiagnostics}</strong>
              <div className="pagespeed-audits">
                {result.lab.diagnostics.map((item) => (
                  <article key={item.id}>
                    <Badge severity={scoreSeverity(item.score == null ? null : Math.round(item.score * 100))}>
                      {item.score == null ? copy.review : Math.round(item.score * 100)}
                    </Badge>
                    <div>
                      <strong>{item.title}</strong>
                      {item.displayValue ? <span>{item.displayValue}</span> : null}
                      {item.description ? <small>{auditDescription(item.description)}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="pagespeed-section">
            <strong>{copy.seoAudits}</strong>
            <small>{copy.seoAuditsHelp}</small>
            {result.seo?.audits?.length ? (
              <div className="pagespeed-audits">
                {result.seo.audits.map((item) => (
                  <article key={item.id}>
                    <Badge severity={item.scoreDisplayMode === "manual" ? "notice" : "critical"}>
                      {item.scoreDisplayMode === "manual" ? copy.review : copy.failedAudit}
                    </Badge>
                    <div>
                      <strong>{item.title}</strong>
                      {item.displayValue ? <span>{item.displayValue}</span> : null}
                      {item.description ? <small>{auditDescription(item.description)}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="none">{copy.noSeoFailures}</p>}
          </section>
        </div>
      ) : null}
    </section>
  );
}
