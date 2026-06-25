import React from "react";
import { buildGscOpportunities, buildSearchVisibility } from "../gsc-summary.js";
import { gscSupportingText } from "../i18n.js";
import { Badge } from "./ReportUi.jsx";

function GscOpportunities({ report, rows, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const opportunities = buildGscOpportunities(report, rows || [], language);
  if (!rows?.length || !opportunities.length) return null;
  return (
    <section className="panel gsc-opportunities">
      <div className="panel-head">
        <h2>{copy.opportunities}</h2>
        <span>{opportunities.length}</span>
      </div>
      <div className="impact-list">
        {opportunities.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={item.severity}>{item.key}</Badge>
              <strong>{item.title}</strong>
              <span>{item.count}</span>
            </div>
            <div className="impact-details">
              <small>{item.detail}</small>
            </div>
            {item.sampleUrls.length ? (
              <div className="impact-samples">
                <strong>{copy.sampleUrls}</strong>
                {item.sampleUrls.map((url, index) => (
                  <small key={`${item.key}-${url}-${index}`}>{url}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchVisibility({ report, t, language }) {
  if (!report?.pages?.length) return null;
  const label = (key, fallback) => t?.[key] || fallback;
  const flaggedLabel = language === "zh-CN" ? "个标记" : language === "zh-TW" ? "個標記" : "flagged";
  const visibility = buildSearchVisibility(report);
  return (
    <section className="panel search-visibility">
      <div className="panel-head">
        <h2>{label("searchVisibility", "Search visibility")}</h2>
        <span>{visibility.readiness}% {label("readiness", "readiness")}</span>
      </div>
      <div className="visibility-grid">
        <div className="visibility-card">
          <strong>{label("technicallyIndexable", "Technically indexable")}</strong>
          <span>{visibility.technicallyIndexable}/{visibility.total}</span>
          <small>{label("indexableHelp", "URLs without crawl, noindex, HTTP, or canonical blockers in this audit.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("gscConfirmation", "Needs GSC confirmation")}</strong>
          <span>{visibility.hardBlocked + visibility.canonicalized} {flaggedLabel}</span>
          <small>{label("gscHelp", "Confirmed indexing status requires Google Search Console URL Inspection data.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("rankingData", "Ranking data")}</strong>
          <span>GSC API</span>
          <small>{label("rankingHelp", "Clicks, impressions, and average position require Search Console Search Analytics or a rank-tracking provider.")}</small>
        </div>
      </div>
      <div className="visibility-next">
        <strong>{label("nextIntegration", "Next integration")}</strong>
        <span>{label("nextIntegrationHelp", "Connect Google Search Console to compare this technical audit with real index coverage and performance.")}</span>
      </div>
    </section>
  );
}

export function GoogleOverview({ report, t, gscRows, language }) {
  return (
    <>
      <SearchVisibility report={report} t={t} language={language} />
      <GscOpportunities report={report} rows={gscRows} language={language} />
    </>
  );
}
