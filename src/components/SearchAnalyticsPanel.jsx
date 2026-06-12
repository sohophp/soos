import React, { useMemo, useState } from "react";
import { formatApiError } from "../api-client.js";
import { downloadCsvFile } from "../downloads.js";
import { loadGscSearchAnalytics } from "../gsc-client.js";
import { gscDataText } from "../i18n.js";
import {
  buildSearchAnalyticsChangeInsights,
  buildSearchAnalyticsComparison,
  buildSearchAnalyticsInsights,
  defaultGscDateRange,
  summarizeSearchAnalyticsRows,
} from "../search-analytics.js";

function classifySearchQueryOpportunity(row) {
  if ((row.impressions || 0) >= 100 && typeof row.ctr === "number" && row.ctr < 0.01) return "low_ctr";
  if (typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= 50) return "striking_distance";
  if (typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= 100) return "page_two";
  return "monitor";
}

function keywordOpportunityAction(type) {
  if (type === "low_ctr") return "Rewrite title/meta description and align snippet copy with query intent.";
  if (type === "snippet_gap") return "Improve title/meta description and verify the page answers the query intent clearly.";
  if (type === "striking_distance") return "Improve the answer section, add internal links, and strengthen topical relevance.";
  if (type === "page_two") return "Expand content depth and add internal links from stronger related pages.";
  return "Monitor performance and prioritize if impressions or position improve.";
}

function downloadKeywordOpportunitiesCsv(rows, insights) {
  const insightByDetail = new Map((insights || []).map((insight) => [insight.detail, insight]));
  const csvRows = [
    ["page", "query", "clicks", "impressions", "ctr", "position", "opportunity_type", "recommended_action"],
  ];
  for (const row of (rows || []).filter((item) => item.page && item.query)) {
    const insight = insightByDetail.get(`${row.query} on ${row.page}`) || insightByDetail.get(row.page);
    const type = insight?.type || classifySearchQueryOpportunity(row);
    csvRows.push([
      row.page,
      row.query,
      row.clicks ?? 0,
      row.impressions ?? 0,
      typeof row.ctr === "number" ? (row.ctr * 100).toFixed(2) : "",
      typeof row.position === "number" ? row.position.toFixed(1) : "",
      type,
      insight?.action || keywordOpportunityAction(type),
    ]);
  }
  downloadCsvFile(`soos-keyword-opportunities-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, csvRows);
}

function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function formatNumberDelta(value, digits = 0, reverse = false) {
  if (value == null || !Number.isFinite(value)) return "-";
  const displayValue = reverse ? -value : value;
  return `${displayValue >= 0 ? "+" : ""}${displayValue.toFixed(digits)}`;
}

function comparisonInsightCopy(insight, copy) {
  const samples = insight.sample?.length ? ` ${insight.sample.join(", ")}` : "";
  const text = {
    clicks_down: [copy.clicksDown, `${formatPercent(insight.percent)}. ${copy.clicksDownAction}`],
    impressions_up_clicks_flat: [copy.impressionsUpClicksFlat, `${formatPercent(insight.percent)}. ${copy.impressionsUpClicksFlatAction}`],
    ctr_down: [copy.ctrDown, `${formatPercent(insight.value)}. ${copy.ctrDownAction}`],
    position_down: [copy.positionDown, `${formatNumberDelta(insight.value, 1)}. ${copy.positionDownAction}`],
    new_visibility: [copy.newVisibility, `${insight.count} ${copy.rowsLoaded}.${samples}`],
    lost_visibility: [copy.lostVisibility, `${insight.count} ${copy.rowsLoaded}.${samples}`],
  };
  return text[insight.type] || [insight.type, ""];
}

function downloadComparisonCsv(comparison, ranges) {
  const csvRows = [[
    "current_start",
    "current_end",
    "previous_start",
    "previous_end",
    "dimension_value",
    "state",
    "current_clicks",
    "previous_clicks",
    "clicks_change",
    "current_impressions",
    "previous_impressions",
    "impressions_change",
    "current_ctr",
    "previous_ctr",
    "ctr_change",
    "current_position",
    "previous_position",
    "position_change",
  ]];
  for (const row of comparison.rows) {
    csvRows.push([
      ranges.current.startDate,
      ranges.current.endDate,
      ranges.previous.startDate,
      ranges.previous.endDate,
      row.label || row.page || row.query || row.country || row.device || "",
      row.state,
      row.current?.clicks ?? 0,
      row.previous?.clicks ?? 0,
      row.clicksDelta,
      row.current?.impressions ?? 0,
      row.previous?.impressions ?? 0,
      row.impressionsDelta,
      row.current?.ctr ?? "",
      row.previous?.ctr ?? "",
      row.ctrDelta ?? "",
      row.current?.position ?? "",
      row.previous?.position ?? "",
      row.positionDelta ?? "",
    ]);
  }
  downloadCsvFile(`soos-search-analytics-comparison-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, csvRows);
}

export function SearchAnalyticsPanel({ status, siteUrl, onRows, language }) {
  const copy = gscDataText[language] || gscDataText.en;
  const defaults = useMemo(() => defaultGscDateRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [dimension, setDimension] = useState("page");
  const [comparePrevious, setComparePrevious] = useState(true);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparisonRanges, setComparisonRanges] = useState(null);
  const insights = useMemo(() => buildSearchAnalyticsInsights(rows, summary?.dimension || dimension, language), [dimension, language, rows, summary?.dimension]);
  const changeInsights = useMemo(() => buildSearchAnalyticsChangeInsights(comparison), [comparison]);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event.preventDefault();
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
      const body = await loadGscSearchAnalytics({
        startDate,
        endDate,
        siteUrl,
        dimension,
        comparePrevious,
      });
      if (body.dimension === "page") onRows(body.rows || []);
      setRows(body.rows || []);
      setSummary({ ...summarizeSearchAnalyticsRows(body.rows || []), dimension: body.dimension || dimension });
      if (body.comparison?.current && body.comparison?.previous) {
        setComparison(buildSearchAnalyticsComparison(body.comparison.current.rows, body.comparison.previous.rows));
        setComparisonRanges({
          current: {
            startDate: body.comparison.current.startDate,
            endDate: body.comparison.current.endDate,
          },
          previous: {
            startDate: body.comparison.previous.startDate,
            endDate: body.comparison.previous.endDate,
          },
        });
      } else {
        setComparison(null);
        setComparisonRanges(null);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel search-analytics-panel">
      <div className="panel-head">
        <h2>{copy.analyticsTitle}</h2>
        <span>{status?.configured ? copy.ready : copy.configureFirst}</span>
      </div>
      <form className="search-analytics-body" onSubmit={loadAnalytics}>
        <div className="search-analytics-fields">
          <label>
            <strong>{copy.startDate}</strong>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.endDate}</strong>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.dimension}</strong>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)}>
              <option value="page">{copy.page}</option>
              <option value="query">{copy.query}</option>
              <option value="page_query">{copy.pageQuery}</option>
              <option value="country">{copy.country}</option>
              <option value="device">{copy.device}</option>
            </select>
          </label>
        </div>
        <label className="search-analytics-compare">
          <input
            type="checkbox"
            checked={comparePrevious}
            onChange={(event) => setComparePrevious(event.target.checked)}
          />
          <span>
            <strong>{copy.comparePrevious}</strong>
            <small>{copy.comparisonHelp}</small>
          </span>
        </label>
        <div className="gsc-api-actions">
          <button className="export-button" type="submit" disabled={loading}>
            {loading ? copy.loading : copy.load}
          </button>
          {dimension === "page_query" && rows.length ? (
            <button className="export-button" type="button" onClick={() => downloadKeywordOpportunitiesCsv(rows, insights)}>
              {copy.export}
            </button>
          ) : null}
          {comparison && comparisonRanges ? (
            <button className="export-button" type="button" onClick={() => downloadComparisonCsv(comparison, comparisonRanges)}>
              {copy.exportComparison}
            </button>
          ) : null}
        </div>
        {summary ? (
          <small role="status">{summary.rows} {copy.rowsLoaded}, {summary.clicks} {copy.clicks}, {summary.impressions} {copy.impressions}</small>
        ) : (
          <small>{copy.analyticsHelp}</small>
        )}
        {dimension !== "page" ? <small>{copy.pageOnly}</small> : null}
        {comparison && comparisonRanges ? (
          <>
            <div className="search-analytics-periods">
              <span><strong>{copy.currentPeriod}</strong> {comparisonRanges.current.startDate} - {comparisonRanges.current.endDate}</span>
              <span><strong>{copy.previousPeriod}</strong> {comparisonRanges.previous.startDate} - {comparisonRanges.previous.endDate}</span>
            </div>
            <div className="search-analytics-comparison">
              <article>
                <small>{copy.clicks}</small>
                <strong>{comparison.current.clicks}</strong>
                <span>{formatPercent(comparison.delta.clicksPercent)}</span>
              </article>
              <article>
                <small>{copy.impressions}</small>
                <strong>{comparison.current.impressions}</strong>
                <span>{formatPercent(comparison.delta.impressionsPercent)}</span>
              </article>
              <article>
                <small>CTR</small>
                <strong>{comparison.current.ctr == null ? "-" : `${(comparison.current.ctr * 100).toFixed(2)}%`}</strong>
                <span>{formatPercent(comparison.delta.ctr)}</span>
              </article>
              <article>
                <small>{copy.position}</small>
                <strong>{comparison.current.position == null ? "-" : comparison.current.position.toFixed(1)}</strong>
                <span>{formatNumberDelta(comparison.delta.position, 1, true)}</span>
              </article>
            </div>
            {changeInsights.length ? (
              <div className="search-analytics-change-insights">
                <strong>{copy.changeInsights}</strong>
                {changeInsights.map((insight) => {
                  const [title, detail] = comparisonInsightCopy(insight, copy);
                  return (
                    <article className={`search-analytics-insight ${insight.severity}`} key={insight.type}>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <small>{copy.noComparisonIssues}</small>
            )}
          </>
        ) : null}
        {insights.length ? (
          <div className="search-analytics-insights">
            {insights.map((insight, index) => (
              <article className={`search-analytics-insight ${insight.severity}`} key={`${insight.type}-${index}`}>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
                <span>{insight.metrics}</span>
                <em>{insight.action}</em>
              </article>
            ))}
          </div>
        ) : dimension === "page_query" && rows.length ? (
          <small>{copy.noOpportunities}</small>
        ) : null}
        {rows.length ? (
          <div className="search-analytics-results">
            <div className="search-analytics-result head">
              <span>{copy.dimension}</span>
              <span>{copy.clicks}</span>
              <span>{copy.impressions}</span>
              <span>CTR</span>
              <span>{copy.position}</span>
            </div>
            {rows.slice(0, 12).map((row, index) => (
              <div className="search-analytics-result" key={`${row.label || row.page || index}-${index}`}>
                <strong title={row.label || row.page}>{row.label || row.page || row.query || row.country || row.device}</strong>
                <span>{row.clicks ?? 0}</span>
                <span>{row.impressions ?? 0}</span>
                <span>{typeof row.ctr === "number" ? `${(row.ctr * 100).toFixed(2)}%` : "-"}</span>
                <span>{typeof row.position === "number" ? row.position.toFixed(1) : "-"}</span>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <small className="gsc-api-error" role="alert">{error}</small> : null}
      </form>
    </section>
  );
}
