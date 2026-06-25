import React, { useEffect, useState } from "react";
import {
  downloadAuditCsv,
  downloadHtmlReport,
  downloadSummaryReport,
} from "../report-exports.js";
import { buildUrlInspectionCandidates } from "../url-inspection-candidates.js";
import { GooglebotLogAnalysis } from "./GooglebotLogAnalysis.jsx";
import { GoogleOverview } from "./GoogleOverview.jsx";
import { IssuesView } from "./IssuesView.jsx";
import { ReportEmptyState } from "./ReportUi.jsx";
import { ScanSummaryView } from "./ScanSummaryView.jsx";
import { UrlFindingsPanel } from "./UrlFindingsPanel.jsx";
import { UrlInspectionPanel } from "./UrlInspectionPanel.jsx";
import { UrlStructureView } from "./UrlStructureView.jsx";

export function WorkspaceReport({
  report,
  t,
  gsc,
  language,
  activeView,
  onViewChange,
  comparisonEntry,
}) {
  const [inspectionResults, setInspectionResults] = useState([]);
  const [issueFilter, setIssueFilter] = useState(null);
  const inspectionCandidates = report
    ? buildUrlInspectionCandidates(report, gsc.rows, comparisonEntry)
    : [];

  useEffect(() => {
    setInspectionResults([]);
  }, [gsc.siteUrl, gsc.status?.configured]);

  function selectIssue(issue) {
    setIssueFilter(issue);
    onViewChange?.("urls");
  }

  if (!report) {
    return ["scan", "issues", "urls"].includes(activeView)
      ? <ReportEmptyState t={t} />
      : null;
  }

  return (
    <>
      <div className="workspace-view" hidden={activeView !== "scan"}>
        <ScanSummaryView
          report={report}
          t={t}
          language={language}
          gscStatus={gsc.status}
          inspectionResults={inspectionResults}
          inspectionCandidateCount={inspectionCandidates.length}
        />
      </div>
      <div className="workspace-view" hidden={activeView !== "google"}>
        <GoogleOverview report={report} t={t} gscRows={gsc.rows} language={language} />
        <GooglebotLogAnalysis report={report} language={language} gscRows={gsc.rows} />
        <UrlInspectionPanel
          report={report}
          gscStatus={gsc.status}
          siteUrl={gsc.siteUrl}
          language={language}
          gscRows={gsc.rows}
          comparisonEntry={comparisonEntry}
          onResultsChange={setInspectionResults}
        />
      </div>
      <div className="workspace-view" hidden={activeView !== "issues"}>
        <IssuesView
          report={report}
          t={t}
          gscRows={gsc.rows}
          inspectionResults={inspectionResults}
          onSelectIssue={selectIssue}
        />
      </div>
      <div className="workspace-view" hidden={activeView !== "urls"}>
        <UrlStructureView report={report} t={t} language={language} />
        <UrlFindingsPanel
          report={report}
          gscRows={gsc.rows}
          inspectionResults={inspectionResults}
          comparisonEntry={comparisonEntry}
          issueFilter={issueFilter}
          t={t}
          language={language}
          onIssueFilterChange={setIssueFilter}
          onExportSummary={() => downloadSummaryReport(report)}
          onExportHtml={() => downloadHtmlReport(report, gsc.rows, language)}
          onExportCsv={(pages) => downloadAuditCsv(report, gsc.rows, pages)}
        />
      </div>
    </>
  );
}
