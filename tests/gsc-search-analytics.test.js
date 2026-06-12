import assert from "node:assert/strict";
import {
  compareGscSearchAnalytics,
  normalizeSearchAnalyticsRows,
  queryGscSearchAnalytics,
} from "../server/gsc-search-analytics.js";

const normalized = normalizeSearchAnalyticsRows([
  { keys: ["https://example.com/a", "alpha"], clicks: 4, impressions: 100, ctr: 0.04, position: 5.5 },
  { keys: [], clicks: 1 },
], {
  dimension: "page_query",
  dimensions: ["page", "query"],
}, (value) => value.replace(/\/$/, ""));
assert.equal(normalized.length, 1);
assert.equal(normalized[0].page, "https://example.com/a");
assert.equal(normalized[0].query, "alpha");
assert.equal(normalized[0].key, "https://example.com/a");

const requests = [];
const dependencies = {
  getConfigWithAccessToken: async ({ siteUrl, sessionId }) => ({
    siteUrl: siteUrl || "sc-domain:example.com",
    accessToken: `token-${sessionId}`,
  }),
  friendlyNetworkError: (error) => `network: ${error.message}`,
  friendlyApiError: (status, body) => body.error?.message || `HTTP ${status}`,
  normalizeUrl: (value) => value.replace(/\/$/, ""),
  fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body, authorization: options.headers.Authorization });
    const previous = body.startDate === "2026-04-03";
    return new Response(JSON.stringify({
      rows: [{
        keys: ["https://example.com/a"],
        clicks: previous ? 3 : 5,
        impressions: previous ? 80 : 100,
        ctr: previous ? 0.0375 : 0.05,
        position: previous ? 7 : 5,
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
};

const result = await queryGscSearchAnalytics({
  startDate: "2026-05-01",
  endDate: "2026-05-28",
  siteUrl: "https://example.com/",
  dimension: "page",
  rowLimit: 50000,
  sessionId: "session-a",
}, dependencies);
assert.equal(result.rowLimit, 25000);
assert.deepEqual(result.dimensions, ["page"]);
assert.equal(result.rows[0].clicks, 5);
assert.equal(requests[0].authorization, "Bearer token-session-a");

const compared = await compareGscSearchAnalytics({
  startDate: "2026-05-01",
  endDate: "2026-05-28",
  siteUrl: "https://example.com/",
  dimension: "page",
  sessionId: "session-a",
}, dependencies);
assert.equal(compared.comparison.current.startDate, "2026-05-01");
assert.equal(compared.comparison.previous.startDate, "2026-04-03");
assert.equal(compared.comparison.previous.endDate, "2026-04-30");
assert.equal(compared.comparison.previous.rows[0].clicks, 3);

await assert.rejects(
  queryGscSearchAnalytics({
    startDate: "2026-05-28",
    endDate: "2026-05-01",
    siteUrl: "https://example.com/",
  }, dependencies),
  /startDate must be on or before endDate/,
);

const apiFailureDependencies = {
  ...dependencies,
  fetchImpl: async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
    status: 429,
    headers: { "content-type": "application/json" },
  }),
};
await assert.rejects(
  queryGscSearchAnalytics({
    startDate: "2026-05-01",
    endDate: "2026-05-28",
    siteUrl: "https://example.com/",
  }, apiFailureDependencies),
  /quota exceeded/,
);

console.log("gsc-search-analytics-tests-passed");
