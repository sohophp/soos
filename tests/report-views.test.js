import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  healthScoreTone,
  robotsImpactIssueType,
} from "../src/report-views.js";

assert.equal(healthScoreTone(100), "good");
assert.equal(healthScoreTone(85), "good");
assert.equal(healthScoreTone(84), "warn");
assert.equal(healthScoreTone(65), "warn");
assert.equal(healthScoreTone(64), "bad");

assert.equal(robotsImpactIssueType("submitted_url"), "robots_disallow");
assert.equal(robotsImpactIssueType("canonical_target"), "canonical_blocked");
assert.equal(robotsImpactIssueType("alternate_target"), "alternate_blocked");

const [mainSource, reportSource, summarySource, issuesSource, uiSource, styles] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSummaryView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/IssuesView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ReportUi.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);
assert.match(mainSource, /<WorkspaceReport/);
assert.match(reportSource, /\["issues", "urls"\]\.includes\(activeView\)/);
assert.doesNotMatch(reportSource, /\["scan", "issues", "urls"\]\.includes\(activeView\)/);
assert.match(reportSource, /<ReportEmptyState t=\{t\} onStartScan=\{\(\) => onViewChange\?\.\("scan"\)\} \/>/);
assert.match(reportSource, /import \{ ErrorBoundary \} from "\.\/ErrorBoundary\.jsx"/);
assert.match(reportSource, /<ErrorBoundary panel>/);
assert.match(reportSource, /gscRows=\{gsc\.rows\}/);
assert.match(reportSource, /searchInsights=\{gsc\.searchInsights\}/);
assert.match(reportSource, /inspectionResults=\{inspectionResults\}/);
assert.match(reportSource, /buildUrlInspectionCandidates\(report, gsc\.rows, comparisonEntry\)/);
assert.match(reportSource, /inspectionCandidateCount=\{inspectionCandidates\.length\}/);
assert.match(uiSource, /export function ReportEmptyState/);
assert.match(uiSource, /t\.emptyReportTitle/);
assert.match(uiSource, /t\.emptyReportHelp/);
assert.match(uiSource, /t\.emptyReportAction/);
assert.match(summarySource, /<StatusFlags flags=\{report\.statusFlags\}/);
assert.match(summarySource, /buildReportCoverage\(report/);
assert.match(summarySource, /function ReportCoveragePanel/);
assert.match(summarySource, /coverageCannotConclude/);
assert.doesNotMatch(summarySource, /coverage\.limitations[\s\S]*?\.slice\(0, 4\)/);
assert.doesNotMatch(summarySource, /coverage\.cannotConclude[\s\S]*?\.slice\(0, 4\)/);
assert.match(summarySource, /coverageLocalOnlyTitle/);
assert.match(summarySource, /coverageLocalOnlyHelp/);
assert.match(summarySource, /!coverage\.gscConnected/);
assert.match(summarySource, /report\.summary\.healthScore/);
assert.match(summarySource, /report\.truncation\?\.truncated/);
assert.match(issuesSource, /robotsImpactIssueType\(item\.scope\)/);
assert.match(issuesSource, /normalizeReportIssues\(report, \{ gscRows, searchInsights, inspectionResults \}\)/);
assert.match(issuesSource, /applyIssueStatuses/);
assert.match(issuesSource, /saveIssueStatuses\(report, next\)/);
assert.match(issuesSource, /function FixPlan/);
assert.match(issuesSource, /buildFixPlanCsvRows\(issues\)/);
assert.match(issuesSource, /const visibleIssues = showAll \? issues : issues\.slice\(0, 8\)/);
assert.match(issuesSource, /visibleIssues\.map/);
assert.match(issuesSource, /t\.showAllIssues/);
assert.match(issuesSource, /t\.showFewerIssues/);
assert.match(issuesSource, /aria-expanded=\{showAll\}/);
assert.match(styles, /\.show-more-issues/);
assert.match(issuesSource, /downloadCsvFile\(/);
assert.match(issuesSource, /closedIssueDecisions/);
assert.match(issuesSource, /markResolved/);
assert.match(issuesSource, /ignoreIssue/);
assert.match(issuesSource, /priorityScore/);
assert.match(issuesSource, /issue\.recommendedFix\.steps/);
assert.match(issuesSource, /issue\.verification\[0\]\?\.steps/);
assert.match(issuesSource, /issue\.affectedUrls\?\.length/);
assert.match(issuesSource, /issue\.affectedUrls\.slice\(0, 5\)\.map/);
assert.match(issuesSource, /t\.sampleUrls/);
assert.match(issuesSource, /navigator\.clipboard\.writeText/);
assert.match(issuesSource, /onSelectIssue\?\.\(issue\)/);
assert.match(issuesSource, /onSelectIssue\?\.\(\{ type: issueType \}\)/);
assert.match(issuesSource, /report\.internationalSignals/);

console.log("report views tests passed");
