import assert from "node:assert/strict";
import { buildReportCoverage } from "../src/report-coverage.js";

const limited = buildReportCoverage({
  scannedAt: "2026-06-24T00:00:00.000Z",
  input: { siteRootUrl: "https://example.com/" },
  summary: { urlCount: 250, discoveredUrlCount: 0 },
  pages: Array.from({ length: 250 }, (_, index) => ({ url: `https://example.com/${index}`, issues: [] })),
  discoveredPages: [],
  options: { internalCrawl: false },
  truncation: { truncated: true },
  robots: { found: true },
  sitemaps: [{ url: "https://example.com/sitemap.xml" }],
}, {
  gscConnected: false,
  inspectionCandidateCount: 100,
  inspectionCheckedCount: 0,
});

assert.equal(limited.scannedUrlCount, 250);
assert.equal(limited.sitemapUrlCount, 250);
assert.equal(limited.truncated, true);
assert.equal(limited.internalCrawlEnabled, false);
assert.equal(limited.gscConnected, false);
assert.equal(limited.trustLevel, "limited");
assert.equal(limited.limitations.some((item) => /not connected/i.test(item)), true);
assert.equal(limited.cannotConclude.some((item) => /Google-confirmed/i.test(item)), true);
assert.equal(limited.cannotConclude.some((item) => /full-site Google indexing/i.test(item)), true);

const sampled = buildReportCoverage({
  input: { siteRootUrl: "https://example.com/" },
  pages: [{ url: "https://example.com/", issues: [] }],
  options: { internalCrawl: true },
  truncation: { truncated: false },
}, {
  gscConnected: true,
  inspectionCandidateCount: 20,
  inspectionCheckedCount: 3,
  pageSpeedUsed: true,
});

assert.equal(sampled.trustLevel, "strong");
assert.equal(sampled.trustSignals.includes("search_console"), true);
assert.equal(sampled.trustSignals.includes("url_inspection_sample"), true);
assert.equal(sampled.limitations.some((item) => /subset/i.test(item)), true);
assert.equal(sampled.cannotConclude.some((item) => /every URL/i.test(item)), true);
assert.equal(sampled.pageSpeedUsed, true);
assert.equal(sampled.cruxUsed, false);

console.log("report-coverage-tests-passed");
