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
    event.preventDefault();
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
        setCruxError(formatApiError(cruxOutcome.reason));
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
      {cruxError ? <div className="gsc-api-error" role="status">{cruxError}</div> : null}
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
          </div>
          <section className="pagespeed-section">
            <strong>{copy.labTitle}</strong>
            <small>{copy.labHelp}</small>
            <div className="pagespeed-metrics">
              {Object.entries(result.lab.metrics || {}).map(([name, metric]) => (
                <div key={name}>
                  <span>{name.toUpperCase()}</span>
                  <strong>{metricValue(metric, name)}</strong>
                </div>
              ))}
            </div>
          </section>
          {includeCrux ? <section className="pagespeed-section">
            <strong>{copy.cruxTitle}</strong>
            <small>{copy.cruxHelp}</small>
            {cruxField ? (
              <div className="pagespeed-field">
                <small>
                  {cruxField.scope === "origin" ? copy.originFallback : copy.pageFieldData}
                  {cruxField.collectionPeriod?.firstDate && cruxField.collectionPeriod?.lastDate
                    ? ` · ${copy.collectionPeriod}: ${cruxField.collectionPeriod.firstDate} - ${cruxField.collectionPeriod.lastDate}`
                    : ""}
                </small>
                {Object.entries(cruxField.metrics || {}).map(([name, metric]) => (
                  <div key={name}>
                    <Badge severity={fieldSeverity(metric.category)}>{copy[metric.category] || copy.unknown}</Badge>
                    <strong>{name.toUpperCase()}</strong>
                    <span>{fieldValue(metric, name)}</span>
                  </div>
                ))}
              </div>
            ) : cruxResult ? <p className="none">{copy.noCruxData}</p> : null}
          </section> : null}
          <section className="pagespeed-section">
            <strong>{copy.fieldTitle}</strong>
            <small>{copy.fieldHelp}</small>
            {field ? (
              <div className="pagespeed-field">
                <small>{field.originFallback || field === result.field.origin ? copy.originFallback : copy.pageFieldData}</small>
                {Object.entries(field.metrics || {}).map(([name, metric]) => (
                  <div key={name}>
                    <Badge severity={fieldSeverity(metric.category)}>{metric.category || copy.unknown}</Badge>
                    <strong>{name.toUpperCase()}</strong>
                    <span>{fieldValue(metric, name)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="none">{copy.noFieldData}</p>}
            <small className="pagespeed-deprecation">{copy.fieldDeprecation}</small>
          </section>
          {result.lab.opportunities?.length ? (
            <section className="pagespeed-section">
              <strong>{copy.opportunities}</strong>
              <div className="pagespeed-opportunities">
                {result.lab.opportunities.map((item) => (
                  <div key={item.id}>
                    <Badge severity={scoreSeverity(Math.round(item.score * 100))}>{Math.round(item.score * 100)}</Badge>
                    <strong>{item.title}</strong>
                    <span>{item.displayValue || (item.savingsMs ? `${item.savingsMs} ms` : "")}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
