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

const [mainSource, reportSource, summarySource, issuesSource, uiSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSummaryView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/IssuesView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ReportUi.jsx", import.meta.url), "utf8"),
]);
assert.match(mainSource, /<WorkspaceReport/);
assert.match(reportSource, /<ReportEmptyState t=\{t\} \/>/);
assert.match(uiSource, /export function ReportEmptyState/);
assert.match(summarySource, /<StatusFlags flags=\{report\.statusFlags\}/);
assert.match(summarySource, /report\.summary\.healthScore/);
assert.match(summarySource, /report\.truncation\?\.truncated/);
assert.match(issuesSource, /robotsImpactIssueType\(item\.scope\)/);
assert.match(issuesSource, /navigator\.clipboard\.writeText/);
assert.match(issuesSource, /onSelectIssue\?\.\(\{ type: issueType \}\)/);
assert.match(issuesSource, /report\.internationalSignals/);

console.log("report views tests passed");
