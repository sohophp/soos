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
  gscRows: [{ page: "https://example.com/?x=<script>alert(1)</script>", clicks: 2, impressions: 50, position: 6 }],
});

assert.match(html, /^<!doctype html>/);
assert.match(html, /SEO 检查报告/);
assert.match(html, /2 clicks · 50 impressions · position 6/);
assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
assert.doesNotMatch(html, /href="javascript:/);
assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(html, /refresh_token|access_token|client_secret/i);

console.log("html-report-tests-passed");
