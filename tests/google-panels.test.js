import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildInspectionQuotaSummary,
  buildInspectionQueueState,
  localizeInspectionResults,
  mergeInspectionBatch,
  summarizeInspectionDiagnoses,
} from "../src/url-inspection-view.js";
import {
  buildGooglebotLogCsvRows,
  buildGooglebotLogDiagnosis,
} from "../src/googlebot-diagnostics.js";

const candidates = Array.from({ length: 30 }, (_, index) => ({
  url: `https://example.com/page-${index}`,
  key: `https://example.com/page-${index}`,
  priority: index < 5 ? 10 : 50,
  sources: index % 2 ? ["sitemap"] : ["sitemap", "gsc"],
  reasons: ["baseline"],
}));
const inspected = [
  { url: "https://example.com/page-0", ok: true, verdict: "PASS" },
  { url: "https://example.com/page-1", ok: false, verdict: "FAIL" },
];
const queue = buildInspectionQueueState(candidates, inspected);
assert.equal(queue.pendingCandidates.length, 28);
assert.equal(queue.nextCandidates.length, 25);
assert.equal(queue.nextUrls[0], "https://example.com/page-2");
assert.equal(queue.anomalyCount, 5);
assert.equal(queue.sourceCounts.sitemap, 30);
assert.equal(queue.sourceCounts.gsc, 15);
assert.equal(queue.indexedCount, 1);
assert.equal(queue.failedCount, 1);

const quota = buildInspectionQuotaSummary(candidates, inspected, {
  configured: false,
  siteUrl: "",
  hasGscRows: false,
  internalCrawl: false,
  comparisonAvailable: false,
  historyPageSnapshotAvailable: false,
  truncated: true,
});
assert.deepEqual({
  total: quota.total,
  inspected: quota.inspected,
  remaining: quota.remaining,
  totalBatches: quota.totalBatches,
  remainingBatches: quota.remainingBatches,
  nextBatchSize: quota.nextBatchSize,
}, {
  total: 30,
  inspected: 2,
  remaining: 28,
  totalBatches: 2,
  remainingBatches: 2,
  nextBatchSize: 25,
});
assert.deepEqual(quota.scopeReasons, [
  "gsc_not_connected",
  "gsc_rows_unavailable",
  "internal_discovery_disabled",
  "history_comparison_missing",
  "scan_truncated",
]);

const localized = localizeInspectionResults([
  {
    url: "https://example.com/problem",
    ok: true,
    verdict: "FAIL",
    coverageState: "Discovered - currently not indexed",
  },
], "test", {
  test: {
    not_indexed: ["Localized title", "Localized action"],
  },
});
assert.equal(localized[0].diagnoses.some((item) => item.title === "Localized title"), true);
const diagnosisSummary = summarizeInspectionDiagnoses(localized);
assert.equal(diagnosisSummary.warning > 0 || diagnosisSummary.notice > 0, true);

const merged = mergeInspectionBatch(
  { results: [inspected[0]] },
  { results: [{ url: "https://example.com/page-2", ok: true, verdict: "PASS" }] },
  [candidates[2]],
);
assert.equal(merged.inspected, 2);
assert.equal(merged.results.length, 2);
assert.equal(merged.results[1].candidate.url, candidates[2].url);

const logCopy = {
  nonSitemap: "Outside sitemap",
  parameters: "Parameter crawl",
  assets: "Asset crawl",
  blocked: "Blocked crawl",
  unverified: "Unverified",
  missing: "Missing crawl",
};
const logReport = {
  input: { siteRootUrl: "https://example.com/" },
  pages: [
    { url: "https://example.com/", issues: [] },
    { url: "https://example.com/blocked", issues: [{ type: "robots_disallow" }] },
    { url: "https://example.com/missing", issues: [] },
  ],
};
const logAnalysis = {
  records: [
    {
      ip: "66.249.66.1",
      path: "/blocked",
      host: "",
      status: 200,
      timestamp: "2026-06-11T00:00:00.000Z",
    },
    {
      ip: "66.249.66.1",
      path: "/asset.js?utm_source=test",
      host: "",
      status: 503,
      timestamp: "2026-06-12T00:00:00.000Z",
    },
    {
      ip: "203.0.113.10",
      path: "/fake",
      host: "",
      status: 200,
      timestamp: "2026-06-12T01:00:00.000Z",
    },
  ],
  verifications: [
    { ip: "66.249.66.1", verified: true },
    { ip: "203.0.113.10", verified: false },
  ],
};
const logDiagnosis = buildGooglebotLogDiagnosis(
  logAnalysis,
  logReport,
  [{ page: "https://example.com/missing", impressions: 100, clicks: 2 }],
  logCopy,
);
assert.equal(logDiagnosis.verifiedRecords.length, 2);
assert.equal(logDiagnosis.unverifiedRecords.length, 1);
assert.equal(logDiagnosis.uniqueUrls, 2);
for (const type of ["errors", "nonSitemap", "parameters", "assets", "blocked", "unverified", "missing"]) {
  assert.ok(logDiagnosis.findings.some((item) => item.type === type), `missing ${type}`);
}
assert.equal(
  logDiagnosis.findings.find((item) => item.type === "errors").severity,
  "critical",
);
assert.equal(
  logDiagnosis.findings.find((item) => item.type === "missing" && item.url.endsWith("/missing")).severity,
  "warning",
);
assert.equal(buildGooglebotLogCsvRows(logDiagnosis.findings)[0][0], "type");

const [
  mainSource,
  reportSource,
  inspectionSource,
  logSource,
  urlSetSource,
  structuredSource,
  paginationSource,
  diagnosticsSource,
  sitemapSource,
  configSource,
  analyticsSource,
] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlInspectionPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GooglebotLogAnalysis.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GoogleUrlSetComparison.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/StructuredDataDiagnostics.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ResultPagination.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlInspectionDiagnostics.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GscSitemapsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchConsoleApiConfig.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchAnalyticsPanel.jsx", import.meta.url), "utf8"),
]);
assert.doesNotMatch(mainSource, /function UrlInspectionPanel/);
assert.doesNotMatch(mainSource, /function GooglebotLogAnalysis/);
assert.match(mainSource, /<WorkspaceReport/);
assert.match(reportSource, /<UrlInspectionPanel/);
assert.match(reportSource, /<GooglebotLogAnalysis/);
assert.match(inspectionSource, /mergeInspectionBatch\(current, body, nextCandidates\)/);
assert.match(logSource, /buildGooglebotLogDiagnosis\(analysis, report, gscRows, copy\)/);
assert.match(logSource, /role="status"/);
assert.match(logSource, /role="alert"/);
assert.match(logSource, /paginateResultRows\(visibleFindings, pageNumber\)/);
assert.match(logSource, /pagination\.items\.map/);
assert.match(urlSetSource, /paginateResultRows\(visibleFindings, pageNumber\)/);
assert.match(urlSetSource, /pagination\.items\.map/);
assert.match(structuredSource, /paginateResultRows\(filteredRows, pageNumber\)/);
assert.match(structuredSource, /pagination\.items\.map/);
assert.match(paginationSource, /workspaceText\[language\]/);
assert.match(inspectionSource, /resultPagination\.items\.map/);
assert.match(inspectionSource, /pagination=\{resultPagination\}/);
assert.doesNotMatch(inspectionSource, /key=\{item\.url\}/);
assert.match(diagnosticsSource, /pagination\.items\.map/);
assert.match(diagnosticsSource, /<ResultPagination/);
assert.doesNotMatch(diagnosticsSource, /key=\{row\.url\}/);
assert.doesNotMatch(diagnosticsSource, /key=\{row\.submittedUrl\}/);
assert.doesNotMatch(structuredSource, /key=\{row\.url\}/);
assert.match(sitemapSource, /normalizeGscSitemapUrl/);
assert.match(sitemapSource, /requestIdRef/);
assert.match(sitemapSource, /loadSitemaps\(\)/);
assert.match(sitemapSource, /body\.siteUrl/);
assert.match(sitemapSource, /currentSitemapUrls/);
assert.match(sitemapSource, /currentMatchCount/);
assert.doesNotMatch(configSource, />\{copy\.refresh\}</);
assert.doesNotMatch(configSource, />\{testing \? copy\.testing : copy\.test\}</);
assert.match(analyticsSource, /if \(body\.dimension === "page"\) onRows/);
assert.match(analyticsSource, /setComparisonRanges\(null\)/);
assert.ok((analyticsSource.match(/onRows\(\[\]\)/g) || []).length >= 2);
assert.match(inspectionSource, /if \(!gscStatus\?\.configured\)/);

console.log("google panels tests passed");
