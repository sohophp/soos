import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildFreshnessRows,
  buildIndexCoverageRows,
  buildUrlAlignmentRows,
  classifyIndexCoverage,
  diagnoseInspectionResult,
  sortFreshnessRows,
} from "../src/url-inspection-diagnostics.js";

const copy = {
  unknownAlignment: "unknown",
  inspectionFailed: "failed",
  crawlBlocked: "blocked",
  googleCanonicalDiffers: "google canonical differs",
  submittedRedirects: "redirect",
  htmlCanonicalDiffers: "html canonical differs",
  alignedIndexed: "aligned indexed",
  alignedNotIndexed: "aligned not indexed",
  reasonOther: "other",
  needsFix: "needs fix",
  indexedState: "indexed",
  reasonBlocked: "blocked",
  reasonSoft404: "soft 404",
  reasonFetch: "fetch",
  reasonDiscovered: "discovered",
  reasonCrawled: "crawled",
  reasonDuplicate: "duplicate",
  reasonCanonical: "canonical",
  expectedExclusion: "expected exclusion",
};

const report = {
  pages: [
    {
      url: "https://example.com/redirect",
      finalUrl: "https://example.com/final",
      canonical: "https://example.com/final",
      issues: [{ type: "redirect" }],
    },
    {
      url: "https://example.com/blocked",
      issues: [{ type: "noindex" }],
    },
    {
      url: "https://example.com/duplicate",
      canonical: "https://example.com/canonical",
      issues: [],
    },
    {
      url: "https://example.com/indexed",
      issues: [],
    },
  ],
};

const alignmentRows = buildUrlAlignmentRows(report, [
  { url: "https://example.com/redirect", ok: true, verdict: "FAIL" },
  { url: "https://example.com/blocked", ok: true, verdict: "FAIL" },
  { url: "https://example.com/indexed", ok: true, verdict: "PASS" },
  {
    url: "https://example.com/duplicate",
    ok: true,
    verdict: "FAIL",
    googleCanonical: "https://example.com/other",
  },
], copy);
assert.deepEqual(alignmentRows.map((row) => row.state), [
  "redirect",
  "blocked",
  "aligned_indexed",
  "google_canonical_differs",
]);

const now = Date.parse("2026-06-11T00:00:00.000Z");
const duplicate = classifyIndexCoverage({
  url: "https://example.com/duplicate",
  ok: true,
  verdict: "FAIL",
  coverageState: "Duplicate, Google chose different canonical than user",
  googleCanonical: "https://example.com/canonical",
  lastCrawlTime: "2026-01-01T00:00:00.000Z",
}, report.pages[2], { impressions: 50, clicks: 0 }, copy, now);
assert.equal(duplicate.reason, "duplicate");
assert.equal(duplicate.disposition, "expected_exclusion");
assert.equal(duplicate.crawlAgeDays, 161);

const coverageRows = buildIndexCoverageRows(report, [
  {
    url: "https://example.com/blocked",
    ok: true,
    verdict: "FAIL",
    indexingState: "BLOCKED_BY_META_TAG",
  },
  {
    url: "https://example.com/indexed",
    ok: true,
    verdict: "PASS",
  },
], [
  { page: "https://example.com/blocked", key: "https://example.com/blocked", impressions: 200, clicks: 2 },
], copy, now);
assert.equal(coverageRows[0].reason, "blocked");
assert.equal(coverageRows[0].priority, "high");
assert.equal(coverageRows[1].disposition, "indexed");

const freshnessRows = buildFreshnessRows([
  {
    url: "https://example.com/indexed",
    ok: true,
    verdict: "PASS",
    lastCrawlTime: "2025-11-01T00:00:00.000Z",
  },
  {
    url: "https://example.com/fresh",
    ok: true,
    verdict: "PASS",
    lastCrawlTime: "2026-06-01T00:00:00.000Z",
  },
], [
  { page: "https://example.com/indexed", key: "https://example.com/indexed", impressions: 1000, clicks: 1 },
  { page: "https://example.com/fresh", key: "https://example.com/fresh", impressions: 20, clicks: 0 },
], now);
assert.equal(freshnessRows[0].freshness, "critical");
assert.equal(freshnessRows[0].demand, "high");
assert.equal(freshnessRows[1].freshness, "fresh");
assert.equal(sortFreshnessRows(freshnessRows, "risk")[0].url, "https://example.com/indexed");

const diagnoses = diagnoseInspectionResult({
  url: "https://example.com/problem",
  ok: true,
  verdict: "FAIL",
  coverageState: "Discovered - currently not indexed",
  robotsTxtState: "DISALLOWED",
  pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED",
  googleCanonical: "https://example.com/canonical",
  userCanonical: "https://example.com/problem",
  sitemap: [],
  referringUrls: [],
});
assert.equal(diagnoses.some((item) => item.type === "not_indexed"), true);
assert.equal(diagnoses.some((item) => item.type === "discovered_not_crawled"), true);
assert.equal(diagnoses.some((item) => item.type === "robots_blocked"), true);
assert.equal(diagnoses.some((item) => item.type === "canonical_mismatch"), true);
assert.equal(diagnoses.some((item) => item.type === "fetch_problem"), false);

const failed = diagnoseInspectionResult({ ok: false, error: "quota exceeded" });
assert.deepEqual(failed.map((item) => item.type), ["inspection_error"]);

const diagnosticsSource = await fs.readFile(
  new URL("../src/components/UrlInspectionDiagnostics.jsx", import.meta.url),
  "utf8",
);
assert.match(diagnosticsSource, /paginateResultRows\(visibleRows, pageNumber\)/);
assert.match(diagnosticsSource, /paginateResultRows\(sortedRows, pageNumber\)/);
assert.match(diagnosticsSource, /paginateResultRows\(group\.rows, groupPages\[group\.reason\] \|\| 1, 8\)/);
assert.match(diagnosticsSource, /pagination\.items\.map/);
assert.match(diagnosticsSource, /language=\{language\}/);
assert.match(diagnosticsSource, /role="table"/);
assert.match(diagnosticsSource, /aria-rowcount=\{visibleRows\.length \+ 1\}/);
assert.match(diagnosticsSource, /aria-rowindex=/);
assert.doesNotMatch(diagnosticsSource, /group\.rows\.slice\(0, 8\)/);

console.log("url-inspection-diagnostics-tests-passed");
