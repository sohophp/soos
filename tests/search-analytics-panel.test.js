import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildSearchAnalyticsChangeInsights,
  buildSearchAnalyticsComparison,
  buildSearchAnalyticsInsights,
  buildQueryIntentClusters,
  classifySearchQueryIntent,
  defaultGscDateRange,
  gscDateRangeDays,
  normalizeSearchQuery,
  parseQueryIntentTerms,
  previousGscDateRange,
  scaledSearchThreshold,
  summarizeSearchAnalyticsRows,
  wilsonUpperBound,
} from "../src/search-analytics.js";

const range = defaultGscDateRange();
assert.match(range.startDate, /^\d{4}-\d{2}-\d{2}$/);
assert.match(range.endDate, /^\d{4}-\d{2}-\d{2}$/);

assert.deepEqual(previousGscDateRange("2026-05-01", "2026-05-28"), {
  startDate: "2026-04-03",
  endDate: "2026-04-30",
  durationDays: 28,
});
assert.equal(previousGscDateRange("2026-05-28", "2026-05-01"), null);
assert.equal(gscDateRangeDays("2026-05-01", "2026-05-28"), 28);
assert.equal(gscDateRangeDays("invalid", "2026-05-28"), 28);
assert.equal(scaledSearchThreshold(100, 7, 50), 50);
assert.equal(scaledSearchThreshold(100, 84, 50), 300);
assert.ok(wilsonUpperBound(1, 300) < 0.03);
assert.ok(wilsonUpperBound(0, 100) > 0.01);
assert.equal(normalizeSearchQuery("  SEO-Audit Tools! "), "seo audit tools");
assert.deepEqual(parseQueryIntentTerms("SOOS, Shanghai; docs\nSOOS"), ["soos", "shanghai", "docs"]);
assert.equal(classifySearchQueryIntent("Example login", "https://example.com/"), "branded");
assert.equal(classifySearchQueryIntent("SOOS pricing", "", { brandTerms: ["soos"] }), "branded");
assert.equal(classifySearchQueryIntent("SEO agency Shanghai", "", { localTerms: ["Shanghai"] }), "local");
assert.equal(classifySearchQueryIntent("free template", "", { excludeTerms: ["template"] }), "excluded");
assert.equal(classifySearchQueryIntent("seo agency near me"), "local");
assert.equal(classifySearchQueryIntent("customer login"), "navigational");
assert.equal(classifySearchQueryIntent("how to audit seo"), "informational");
assert.equal(classifySearchQueryIntent("technical seo audit"), "topic");

const intentClusters = buildQueryIntentClusters([
  { page: "/a", query: "seo audit tool", impressions: 80 },
  { page: "/b", query: "SEO audit tools", impressions: 70 },
  { page: "/c", query: "customer login", impressions: 50 },
]);
assert.equal(intentClusters.length, 2);
assert.equal(intentClusters.find((item) => item.intent === "topic").queries.length, 2);
const configuredClusters = buildQueryIntentClusters([
  { page: "/brand-a", query: "SOOS pricing", impressions: 80 },
  { page: "/brand-b", query: "soos pricing", impressions: 70 },
  { page: "/excluded", query: "free template", impressions: 100 },
], "", {
  brandTerms: ["soos"],
  excludeTerms: ["template"],
});
assert.equal(configuredClusters.length, 1);
assert.equal(configuredClusters[0].intent, "branded");
assert.equal(configuredClusters[0].rows.length, 2);

const comparison = buildSearchAnalyticsComparison(
  [
    { keys: ["/a"], label: "/a", clicks: 8, impressions: 200, ctr: 0.04, position: 8 },
    { keys: ["/new"], label: "/new", clicks: 1, impressions: 20, ctr: 0.05, position: 12 },
  ],
  [
    { keys: ["/a"], label: "/a", clicks: 12, impressions: 100, ctr: 0.12, position: 5 },
    { keys: ["/lost"], label: "/lost", clicks: 2, impressions: 40, ctr: 0.05, position: 9 },
  ],
);
assert.deepEqual(summarizeSearchAnalyticsRows([]), {
  rows: 0,
  clicks: 0,
  impressions: 0,
  ctr: null,
  position: null,
});
assert.equal(comparison.current.clicks, 9);
assert.equal(comparison.previous.clicks, 14);
assert.equal(comparison.delta.clicks, -5);
assert.equal(comparison.rows.find((row) => row.label === "/new").state, "new");
assert.equal(comparison.rows.find((row) => row.label === "/lost").state, "lost");
const changeInsights = buildSearchAnalyticsChangeInsights(comparison);
assert.equal(changeInsights.some((item) => item.type === "clicks_down"), true);
assert.equal(changeInsights.some((item) => item.type === "position_down"), true);
assert.equal(changeInsights.some((item) => item.type === "new_visibility"), true);
assert.equal(changeInsights.some((item) => item.type === "lost_visibility"), true);

const tinyComparison = buildSearchAnalyticsComparison(
  [{ keys: ["/tiny"], clicks: 0, impressions: 5, ctr: 0, position: 9 }],
  [{ keys: ["/tiny"], clicks: 1, impressions: 5, ctr: 0.2, position: 5 }],
);
const tinyChangeInsights = buildSearchAnalyticsChangeInsights(tinyComparison);
assert.equal(tinyChangeInsights.some((item) => item.type === "clicks_down"), false);
assert.equal(tinyChangeInsights.some((item) => item.type === "position_down"), false);

const noInsights = buildSearchAnalyticsInsights([{ page: "https://example.com/", query: "x" }], "page", "en");
assert.deepEqual(noInsights, []);

const pageQueryRows = [
  { page: "https://example.com/a", query: "alpha", impressions: 300, clicks: 1, ctr: 0.0033, position: 2.5 },
  { page: "https://example.com/alpha-guide", query: "alpha", impressions: 120, clicks: 2, ctr: 0.0167, position: 5.5 },
  { page: "https://example.com/b", query: "beta", impressions: 120, clicks: 0, ctr: 0, position: 6.2 },
  { page: "https://example.com/e", query: "epsilon", impressions: 90, clicks: 5, ctr: 0.056, position: 6.8 },
  { page: "https://example.com/c", query: "gamma", impressions: 180, clicks: 3, ctr: 0.016, position: 14.4 },
  { page: "https://example.com/d", query: "delta", impressions: 150, clicks: 2, ctr: 0.013, position: 11.2 },
];
const insights = buildSearchAnalyticsInsights(pageQueryRows, "page_query", "zh-CN");
assert.equal(insights.some((item) => item.type === "low_ctr"), true);
assert.equal(insights.some((item) => item.type === "striking_distance"), true);
assert.equal(insights.some((item) => item.type === "page_two"), true);
assert.equal(insights.some((item) => item.type === "cannibalization"), true);
assert.equal(insights.some((item) => item.title.includes("高展示")), true);
assert.equal(insights.find((item) => item.type === "cannibalization").title.includes("多个页面竞争"), true);
assert.equal(insights.find((item) => item.type === "low_ctr").evidence.durationDays, 28);
assert.equal(insights.find((item) => item.type === "low_ctr").evidence.ctrBenchmark, 0.03);

const shortWindowInsights = buildSearchAnalyticsInsights([
  { page: "https://example.com/short", query: "short sample", impressions: 30, clicks: 1, ctr: 0.033, position: 6 },
], "page_query", "en", { durationDays: 7 });
assert.equal(shortWindowInsights.some((item) => item.type === "striking_distance"), true);
assert.equal(buildSearchAnalyticsInsights([
  { page: "https://example.com/short", query: "short sample", impressions: 30, clicks: 1, ctr: 0.033, position: 6 },
], "page_query", "en").some((item) => item.type === "striking_distance"), false);

const uncertainCtrInsights = buildSearchAnalyticsInsights([
  { page: "https://example.com/uncertain", query: "uncertain sample", impressions: 100, clicks: 0, ctr: 0, position: 6 },
], "page_query", "en");
assert.equal(uncertainCtrInsights.some((item) => item.type === "low_ctr"), false);

const intentInsights = buildSearchAnalyticsInsights([
  { page: "https://example.com/", query: "example official", impressions: 180, clicks: 20, ctr: 0.11, position: 1.2 },
  { page: "https://example.com/about", query: "example official", impressions: 100, clicks: 6, ctr: 0.06, position: 3.2 },
  { page: "https://example.com/local", query: "seo agency near me", impressions: 160, clicks: 8, ctr: 0.05, position: 4.2 },
  { page: "https://example.com/services", query: "local seo agency", impressions: 90, clicks: 3, ctr: 0.033, position: 6.1 },
], "page_query", "en", { siteUrl: "https://example.com/" });
assert.equal(intentInsights.some((item) => item.type === "branded_cannibalization" && item.severity === "notice"), true);
assert.equal(intentInsights.some((item) => item.type === "local_cannibalization" && item.severity === "warning"), true);

const customIntentInsights = buildSearchAnalyticsInsights([
  { page: "https://example.com/a", query: "SOOS pricing", impressions: 180, clicks: 20, ctr: 0.11, position: 1.2 },
  { page: "https://example.com/b", query: "soos pricing", impressions: 100, clicks: 6, ctr: 0.06, position: 3.2 },
  { page: "https://example.com/c", query: "free template", impressions: 200, clicks: 3, ctr: 0.015, position: 7.2 },
  { page: "https://example.com/d", query: "free templates", impressions: 120, clicks: 2, ctr: 0.016, position: 8.1 },
], "page_query", "en", {
  queryIntentConfig: {
    brandTerms: ["soos"],
    excludeTerms: ["template"],
  },
});
assert.equal(customIntentInsights.some((item) => item.type === "branded_cannibalization"), true);
assert.equal(
  customIntentInsights.some((item) => item.type === "cannibalization" && item.detail.includes("template")),
  false,
);

const panelSource = await fs.readFile(new URL("../src/components/SearchAnalyticsPanel.jsx", import.meta.url), "utf8");
assert.match(panelSource, /function resetLocalResults\(\)/);
assert.match(panelSource, /function changeDimension\(nextDimension\)/);
assert.match(panelSource, /changeDimension\(event\.target\.value\)/);
assert.match(panelSource, /if \(summary\?\.dimension === "page_query"\) onInsights\?\.\(insights\)/);
assert.match(panelSource, /if \(loadedDimension === "page"\) onRows\(loadedRows\)/);
assert.match(panelSource, /if \(loadedDimension !== "page_query"\) onInsights\?\.\(\[\]\)/);

console.log("search-analytics-panel-tests-passed");
