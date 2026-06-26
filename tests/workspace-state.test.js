import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [
  mainSource,
  gscHookSource,
  historyHookSource,
  googleSource,
  historySource,
  reportSource,
] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useGscWorkspace.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useReportHistory.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GoogleWorkspace.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/HistoryWorkspace.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
]);

assert.match(mainSource, /const gsc = useGscWorkspace\(\)/);
assert.match(mainSource, /const reportHistory = useReportHistory\(\)/);
assert.match(mainSource, /<GoogleWorkspace/);
assert.match(mainSource, /<HistoryWorkspace/);
assert.match(mainSource, /<WorkspaceReport/);
assert.doesNotMatch(mainSource, /getGscStatus\(\)/);
assert.doesNotMatch(mainSource, /<SearchConsoleApiConfig/);
assert.doesNotMatch(mainSource, /<RetainedJobsPanel/);
assert.doesNotMatch(mainSource, /function Report\(/);

assert.match(gscHookSource, /getGscStatus\(\)/);
assert.match(gscHookSource, /setResetKey\(\(value\) => value \+ 1\)/);
assert.match(gscHookSource, /rowsSource/);
assert.match(gscHookSource, /rowsSiteUrl/);
assert.match(gscHookSource, /searchInsights/);
assert.match(gscHookSource, /setSearchInsights: applySearchInsights/);
assert.match(gscHookSource, /clearRows\(\)/);
assert.match(historyHookSource, /toHistoryEntry\(result\)/);
assert.match(historyHookSource, /saveHistoryLimit\(limit\)/);
assert.match(googleSource, /<SearchAnalyticsPanel/);
assert.match(googleSource, /<GscSitemapsPanel/);
assert.match(googleSource, /connected \?/);
assert.match(googleSource, /source: "api"/);
assert.match(googleSource, /source: "csv"/);
assert.match(googleSource, /onInsights=\{gsc\.setSearchInsights\}/);
assert.match(historySource, /<ComparisonPanel/);
assert.match(historySource, /auditRunner\.continueJob\(job\)/);
assert.match(reportSource, /<UrlInspectionPanel/);
assert.match(reportSource, /searchInsights=\{gsc\.searchInsights\}/);
assert.match(reportSource, /downloadHtmlReport\(report, gsc\.rows, language\)/);

console.log("workspace state tests passed");
