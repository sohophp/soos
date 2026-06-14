import React from "react";
import { formatApiError } from "../api-client.js";
import {
  ComparisonPanel,
  HistoryPanel,
  RetainedJobsPanel,
} from "./HistoryPanels.jsx";

export function HistoryWorkspace({
  retainedJobs,
  reportHistory,
  scanSettings,
  auditRunner,
  t,
  onError,
}) {
  function reportError(err) {
    onError(formatApiError(err));
  }

  return (
    <>
      <RetainedJobsPanel
        jobs={retainedJobs.jobs}
        loading={retainedJobs.loading}
        meta={retainedJobs.meta}
        query={retainedJobs.query}
        status={retainedJobs.status}
        t={t}
        onQueryChange={retainedJobs.setQuery}
        onStatusChange={(value) => {
          retainedJobs.setStatus(value);
          retainedJobs.load({ page: 1, status: value }).catch(reportError);
        }}
        onSearch={(event) => {
          event.preventDefault();
          retainedJobs.load({ page: 1 }).catch(reportError);
        }}
        onPageChange={(page) => retainedJobs.load({ page }).catch(reportError)}
        onRefresh={() => retainedJobs.load().catch(reportError)}
        onOpen={(id) => retainedJobs.open(id).catch(reportError)}
        onContinue={(job) => {
          onError("");
          auditRunner.continueJob(job).catch(reportError);
        }}
        onDelete={(id) => retainedJobs.remove(id).catch(reportError)}
      />
      <HistoryPanel
        history={reportHistory.history}
        currentReport={reportHistory.report}
        historyLimit={reportHistory.historyLimit}
        t={t}
        onRerun={(entry) => {
          scanSettings.setValue("sitemapUrl", entry.input?.originalUrl || entry.input?.sitemapUrl || "");
          reportHistory.setComparisonEntry(null);
        }}
        onCompare={reportHistory.setComparisonEntry}
        onDelete={reportHistory.removeHistoryEntry}
        onClear={reportHistory.clearHistory}
        onLimitChange={reportHistory.changeHistoryLimit}
      />
      <ComparisonPanel
        comparisonEntry={reportHistory.comparisonEntry}
        report={reportHistory.report}
        t={t}
      />
    </>
  );
}
