import assert from "node:assert/strict";
import { buildStandaloneHtmlReport, escapeHtml } from "../src/html-report.js";

assert.equal(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");

const html = buildStandaloneHtmlReport({
  scannedAt: "2026-06-12T00:00:00.000Z",
  input: {
    originalUrl: "https://example.com/",
    sitemapUrl: "https://example.com/sitemap.xml",
    robotsUrl: "https://example.com/robots.txt",
  },
  options: { contentChecks: true, internalCrawl: false },
  limits: { maxUrls: 250, maxSitemaps: 20 },
  summary: {
    healthScore: 88,
    urlCount: 1,
    affectedUrlCount: 1,
    issueCounts: { critical: 0, warning: 1 },
  },
  pages: [{
    url: "https://example.com/?x=<script>alert(1)</script>",
    status: 200,
    title: "<img src=x onerror=alert(1)>",
    finalUrl: "https://example.com/",
    canonical: "javascript:alert(1)",
    issues: [{
      severity: "warning",
      type: "title_bad",
      message: "<script>alert(1)</script>",
      detail: "\"quoted\"",
    }],
    googleReasons: [{ label: "Index", detail: "<b>blocked</b>" }],
  }],
}, {
  language: "zh-CN",
  gscRows: [
    { page: "https://example.com/?x=<script>alert(1)</script>", clicks: 2, impressions: 50, position: 6 },
    { page: "https://example.com/gsc-only", clicks: 1, impressions: 20, position: 9 },
  ],
  inspectionResults: [{
    ok: true,
    url: "https://example.com/?x=<script>alert(1)</script>",
    verdict: "FAIL",
    coverageState: "Crawled - currently not indexed",
    googleCanonical: "https://example.com/google",
    userCanonical: "https://example.com/",
  }, {
    ok: true,
    url: "https://example.com/inspection-only",
    verdict: "FAIL",
    coverageState: "Discovered - currently not indexed",
  }],
  searchInsights: [{
    type: "low_ctr",
    title: "High impressions with low CTR",
    page: "https://example.com/?x=<script>alert(1)</script>",
    metrics: "2 clicks / 50 impressions",
  }],
});

assert.match(html, /^<!doctype html>/);
assert.match(html, /SEO 检查报告/);
assert.match(html, /2 clicks · 50 impressions · position 6/);
assert.match(html, /网址检查/);
assert.match(html, /Crawled - currently not indexed/);
assert.match(html, /https:\/\/example\.com\/google/);
assert.match(html, /搜索机会/);
assert.match(html, /low_ctr/);
assert.match(html, /证据边界/);
assert.match(html, /Trust level:/);
assert.match(html, /不能据此断言/);
assert.match(html, /外部证据网址/);
assert.match(html, /https:\/\/example\.com\/gsc-only/);
assert.match(html, /Search Console/);
assert.match(html, /https:\/\/example\.com\/inspection-only/);
assert.match(html, /URL Inspection/);
assert.match(html, /不在当前已扫描 URL 列表中/);
assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
assert.doesNotMatch(html, /href="javascript:/);
assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(html, /refresh_token|access_token|client_secret/i);

console.log("html-report-tests-passed");
