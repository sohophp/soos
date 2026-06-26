import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildAuditCsvRows,
  buildSummaryReport,
  classifyGscForPage,
  issueCategories,
} from "../src/report-exports.js";

const page = {
  url: "https://example.com/page",
  finalUrl: "https://example.com/final",
  status: 200,
  canonical: "https://example.com/final",
  redirectChain: [{
    status: 301,
    url: "https://example.com/page",
    targetUrl: "https://example.com/final",
  }],
  issues: [
    { severity: "warning", type: "robots_disallow", message: "Blocked", detail: "Rule" },
    { severity: "notice", type: "title_missing", message: "Missing title", detail: "" },
  ],
  googleReasons: [{ label: "Canonical", detail: "Different target" }],
};

assert.equal(issueCategories(page), "robots | content");
assert.equal(
  issueCategories({
    issues: [
      { type: "canonical_header_mismatch" },
      { type: "alternate_self_missing" },
    ],
  }),
  "international | canonical",
);
assert.equal(classifyGscForPage(page, null), "no_gsc_row");
assert.equal(classifyGscForPage({ issues: [] }, { impressions: 0 }), "no_impressions");
assert.equal(
  classifyGscForPage({ issues: [{ type: "noindex" }] }, { impressions: 10 }),
  "technical_blocker_with_visibility",
);
assert.equal(classifyGscForPage({ issues: [] }, { impressions: 10, position: 30 }), "low_ranking");
assert.equal(classifyGscForPage({ issues: [] }, { impressions: 200, clicks: 1, position: 5 }), "low_ctr");
assert.equal(classifyGscForPage({ issues: [] }, { impressions: 200, clicks: 20, position: 5 }), "has_visibility");

const report = {
  scannedAt: "2026-06-12T00:00:00.000Z",
  input: {
    originalUrl: "https://example.com/",
    sitemapUrl: "https://example.com/sitemap.xml",
    robotsUrl: "https://example.com/robots.txt",
  },
  summary: {
    healthScore: 75,
    urlCount: 1,
    sitemapCount: 1,
    affectedUrlCount: 1,
    googleBlockedCount: 1,
    issueCounts: { critical: 0, warning: 1, notice: 1 },
  },
  pages: [page],
  backlog: [{ title: "Fix robots", count: 1, action: "Allow URL", sampleUrls: [page.url] }],
  robots: {
    analysis: {
      blockedSummaries: [{ scope: "submitted_url", rule: "Disallow: /", count: 1, sampleUrls: [page.url] }],
    },
  },
  sitemapSignals: [{ title: "Redirect", count: 1, sampleUrls: [page.url], details: [page.finalUrl] }],
  internationalSignals: [{ title: "hreflang", count: 1, sampleUrls: [page.url], details: ["en"] }],
};

const gscRows = [
  { page: "https://example.com/page/", clicks: 2, impressions: 100, position: 7 },
  { page: "https://example.com/gsc-only", clicks: 1, impressions: 20, position: 9 },
];
const exportContext = {
  inspectionResults: [{
    ok: true,
    url: "https://example.com/page/",
    verdict: "FAIL",
    coverageState: "Crawled - currently not indexed",
    googleCanonical: "https://example.com/google-canonical",
    userCanonical: "https://example.com/final",
  }, {
    ok: true,
    url: "https://example.com/inspection-only",
    verdict: "FAIL",
    coverageState: "Discovered - currently not indexed",
  }],
  searchInsights: [{
    type: "low_ctr",
    title: "High impressions with low CTR",
    page: "https://example.com/page/",
    metrics: "2 clicks / 100 impressions",
  }],
};
const csvRows = buildAuditCsvRows(report, gscRows, null, exportContext);
assert.equal(csvRows[0][0], "url");
assert.equal(csvRows[0].includes("inspection_verdict"), true);
assert.equal(csvRows[0].includes("search_insights"), true);
assert.equal(csvRows.filter((row) => row[0] === page.url).length, 2);
assert.equal(csvRows.find((row) => row[0] === page.url)?.[13], 2);
assert.equal(csvRows.find((row) => row[0] === page.url)?.[17], "FAIL");
assert.equal(csvRows.find((row) => row[0] === page.url)?.[18], "Crawled - currently not indexed");
assert.equal(csvRows.find((row) => row[0] === page.url)?.[19], "https://example.com/google-canonical");
assert.match(csvRows.find((row) => row[0] === page.url)?.[21], /low_ctr/);
assert.ok(csvRows.some((row) => row[7] === "gsc_not_in_sitemap"));

const filteredRows = buildAuditCsvRows(report, gscRows, [page]);
assert.equal(filteredRows.some((row) => row[7] === "gsc_not_in_sitemap"), false);

const summary = buildSummaryReport(report);
for (const section of [
  "soos Audit Summary",
  "Overview",
  "Prioritized Fix Plan",
  "Fix First",
  "Robots Impact",
  "Sitemap Signals",
  "International Signals",
]) {
  assert.match(summary, new RegExp(section));
}
assert.match(summary, /Health score: 75/);
assert.match(summary, /Evidence limits/);
assert.match(summary, /Trust level:/);
assert.match(summary, /Do not conclude:/);
assert.match(summary, /Allow URL/);
assert.match(summary, /Sitemap URLs blocked by robots\.txt/);
const googleSummary = buildSummaryReport(report, { gscRows, ...exportContext });
assert.match(googleSummary, /Google reports affected URLs are not indexed/);
assert.match(googleSummary, /High impressions with low CTR/);
assert.match(googleSummary, /External evidence URLs/);
assert.match(googleSummary, /https:\/\/example\.com\/gsc-only \(Search Console:/);
assert.match(googleSummary, /https:\/\/example\.com\/inspection-only \(URL Inspection:/);
const connectedNoRowsSummary = buildSummaryReport(report, { gscStatus: { configured: true }, gscRows: [] });
assert.doesNotMatch(connectedNoRowsSummary, /Google Search Console data was not connected/);
assert.match(connectedNoRowsSummary, /search_console/);

const [mainSource, reportSource, overviewSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GoogleOverview.jsx", import.meta.url), "utf8"),
]);
assert.doesNotMatch(mainSource, /function buildSummaryReport/);
assert.doesNotMatch(mainSource, /function SearchVisibility/);
assert.doesNotMatch(mainSource, /function GscOpportunities/);
assert.match(mainSource, /<WorkspaceReport/);
assert.match(reportSource, /<GoogleOverview report=\{report\}/);
assert.match(reportSource, /downloadSummaryReport\(report, \{/);
assert.match(reportSource, /downloadAuditCsv\(report, gsc\.rows, pages, \{/);
assert.match(reportSource, /downloadHtmlReport\(report, gsc\.rows, language, \{/);
assert.match(reportSource, /gscStatus: gsc\.status/);
assert.match(reportSource, /inspectionResults,/);
assert.match(reportSource, /inspectionCandidateCount: inspectionCandidates\.length/);
assert.match(reportSource, /searchInsights: gsc\.searchInsights/);
assert.match(overviewSource, /buildSearchVisibility\(report\)/);
assert.match(overviewSource, /buildGscOpportunities\(report, rows \|\| \[\], language\)/);
assert.match(overviewSource, /key=\{`\$\{item\.key\}-\$\{item\.severity\}-\$\{index\}`\}/);

console.log("report exports tests passed");
