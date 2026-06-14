import React from "react";
import { GscSitemapsPanel } from "./GscSitemapsPanel.jsx";
import { SearchAnalyticsPanel } from "./SearchAnalyticsPanel.jsx";
import { SearchConsoleApiConfig } from "./SearchConsoleApiConfig.jsx";
import { SearchConsoleImport } from "./SearchConsoleImport.jsx";

export function GoogleWorkspace({ gsc, report, language }) {
  const connected = Boolean(gsc.status?.configured);
  return (
    <>
      <SearchConsoleApiConfig
        key={`gsc-config-${gsc.resetKey}`}
        status={gsc.status}
        onStatus={gsc.setStatus}
        siteUrl={gsc.siteUrl}
        onSiteUrlChange={gsc.setSiteUrl}
        language={language}
      />
      {connected ? (
        <>
          <GscSitemapsPanel
            key={`gsc-sitemaps-${gsc.resetKey}-${gsc.siteUrl}`}
            status={gsc.status}
            siteUrl={gsc.siteUrl}
            currentSitemapUrls={report?.input?.sitemapUrls || [report?.input?.sitemapUrl].filter(Boolean)}
            language={language}
          />
          <SearchAnalyticsPanel
            key={`gsc-analytics-${gsc.resetKey}-${gsc.siteUrl}`}
            status={gsc.status}
            siteUrl={gsc.siteUrl}
            onRows={(rows) => gsc.setRows(rows, { source: "api", siteUrl: gsc.siteUrl })}
            language={language}
          />
        </>
      ) : (
        <SearchConsoleImport
          key={`gsc-import-${gsc.resetKey}`}
          rows={gsc.rowsSource === "csv" ? gsc.rows : []}
          onImport={(rows) => gsc.setRows(rows, { source: "csv", siteUrl: "" })}
          onClear={gsc.clearRows}
          language={language}
        />
      )}
    </>
  );
}
