import assert from "node:assert/strict";
import {
  buildSearchAnalyticsChangeInsights,
  buildSearchAnalyticsComparison,
  buildSearchAnalyticsInsights,
  defaultGscDateRange,
  previousGscDateRange,
  summarizeSearchAnalyticsRows,
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

console.log("search-analytics-panel-tests-passed");
