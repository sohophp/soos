import assert from "node:assert/strict";
import {
  normalizePageSpeedResponse,
  runPageSpeed,
  validatePageSpeedRequest,
} from "../server/pagespeed-service.js";

assert.deepEqual(validatePageSpeedRequest({
  apiKey: "test-key",
  url: "https://example.com/page",
  strategy: "desktop",
  locale: "zh-CN",
}), {
  apiKey: "test-key",
  url: "https://example.com/page",
  strategy: "desktop",
  locale: "zh-CN",
});
assert.throws(
  () => validatePageSpeedRequest({ url: "https://example.com/" }),
  { code: "PAGESPEED_KEY_REQUIRED" },
);
assert.throws(
  () => validatePageSpeedRequest({ apiKey: "x", url: "file:///etc/passwd" }),
  { code: "PAGESPEED_URL_INVALID" },
);

const fixture = {
  id: "https://example.com/final",
  analysisUTCTimestamp: "2026-06-13T08:00:00.000Z",
  loadingExperience: {
    id: "https://example.com/page",
    overall_category: "AVERAGE",
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2800, category: "AVERAGE" },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.08, category: "FAST" },
    },
  },
  originLoadingExperience: {
    id: "https://example.com",
    origin_fallback: true,
    metrics: {
      INTERACTION_TO_NEXT_PAINT: { percentile: 240, category: "AVERAGE" },
    },
  },
  lighthouseResult: {
    requestedUrl: "https://example.com/page",
    finalUrl: "https://example.com/final",
    lighthouseVersion: "12.5.0",
    categories: {
      performance: {
        score: 0.82,
        auditRefs: [
          { id: "largest-contentful-paint", weight: 25, group: "metrics" },
          { id: "render-blocking-resources", weight: 0, group: "load-opportunities" },
          { id: "uses-long-cache-ttl", weight: 1, group: "diagnostics" },
        ],
      },
      seo: {
        score: 0.94,
        auditRefs: [
          { id: "document-title", weight: 1, group: "seo-content" },
          { id: "crawlable-anchors", weight: 1, group: "seo-crawl" },
        ],
      },
    },
    audits: {
      "largest-contentful-paint": {
        score: 0.6,
        numericValue: 3100,
        numericUnit: "millisecond",
        displayValue: "3.1 s",
      },
      "cumulative-layout-shift": {
        score: 0.9,
        numericValue: 0.12,
        numericUnit: "unitless",
        displayValue: "0.12",
      },
      "render-blocking-resources": {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        score: 0.4,
        displayValue: "Potential savings of 600 ms",
        details: { type: "opportunity", overallSavingsMs: 600, overallSavingsBytes: 12000 },
      },
      "uses-long-cache-ttl": {
        id: "uses-long-cache-ttl",
        title: "Use efficient cache lifetimes",
        description: "Long cache lifetimes can speed up repeat visits.",
        score: 0.5,
        scoreDisplayMode: "metricSavings",
        displayValue: "12 resources found",
      },
      "document-title": {
        id: "document-title",
        title: "Document has a title",
        score: 1,
        scoreDisplayMode: "binary",
      },
      "crawlable-anchors": {
        id: "crawlable-anchors",
        title: "Links are crawlable",
        description: "Search engines may use href attributes on links.",
        score: 0,
        scoreDisplayMode: "binary",
      },
    },
    runWarnings: ["Values are estimated."],
    timing: { total: 14678.4 },
    configSettings: { formFactor: "mobile", locale: "en-US" },
    environment: { benchmarkIndex: 1198.5 },
  },
};

const normalized = normalizePageSpeedResponse(fixture, {
  url: "https://example.com/page",
  strategy: "mobile",
});
assert.equal(normalized.scores.performance, 82);
assert.equal(normalized.scores.seo, 94);
assert.equal(normalized.lab.metrics.lcp.numericValue, 3100);
assert.equal(normalized.lab.opportunities[0].savingsMs, 600);
assert.equal(normalized.lab.diagnostics[0].id, "uses-long-cache-ttl");
assert.equal(normalized.seo.audits[0].id, "crawlable-anchors");
assert.equal(normalized.runtime.totalMs, 14678);
assert.equal(normalized.runtime.formFactor, "mobile");
assert.equal(normalized.runtime.benchmarkIndex, 1198.5);
assert.equal(normalized.redirected, true);
assert.equal(normalized.field.page.metrics.lcp.percentile, 2800);
assert.equal(normalized.field.page.coreWebVitals.status, "insufficient-data");
assert.equal(normalized.field.origin.originFallback, true);
assert.equal(normalized.field.deprecationNotice, true);

let requestedUrl = "";
const result = await runPageSpeed({
  apiKey: "secret-key",
  url: "https://example.com/page",
  strategy: "mobile",
  locale: "en",
}, {
  fetchImpl: async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});
assert.equal(result.finalUrl, "https://example.com/final");
const request = new URL(requestedUrl);
assert.equal(request.origin, "https://pagespeedonline.googleapis.com");
assert.equal(request.searchParams.get("key"), "secret-key");
assert.equal(request.searchParams.get("strategy"), "mobile");
assert.deepEqual(request.searchParams.getAll("category"), ["performance", "seo"]);

await assert.rejects(
  runPageSpeed({
    apiKey: "quota-key",
    url: "https://example.com/",
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: "Quota exceeded" },
    }), {
      status: 429,
      headers: { "content-type": "application/json" },
    }),
  }),
  { code: "PAGESPEED_QUOTA_EXCEEDED", status: 429 },
);

console.log("pagespeed-service-tests-passed");
