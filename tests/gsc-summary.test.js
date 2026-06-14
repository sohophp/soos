import assert from "node:assert/strict";
import {
  buildGscOpportunities,
  buildSearchVisibility,
  isTechnicallyIndexablePage,
  uniqueGscRows,
} from "../src/gsc-summary.js";

const report = {
  pages: [
    { url: "https://example.com/a", issues: [] },
    { url: "https://example.com/b", issues: [{ type: "noindex" }] },
    { url: "https://example.com/c", issues: [] },
    { url: "https://example.com/d", issues: [{ type: "canonical_mismatch" }] },
  ],
};

const rows = [
  { page: "https://example.com/a", key: "https://example.com/a", clicks: 0, impressions: 180, position: 25 },
  { page: "https://example.com/a", key: "https://example.com/a", clicks: 4, impressions: 220, position: 24 },
  { page: "https://example.com/b", key: "https://example.com/b", clicks: 10, impressions: 150, position: 5 },
  { page: "https://example.com/outside", key: "https://example.com/outside", clicks: 3, impressions: 90, position: 8 },
];

const unique = uniqueGscRows(rows);
assert.equal(unique.length, 3);
assert.equal(unique.find((row) => row.key === "https://example.com/a")?.impressions, 220);
assert.equal(
  uniqueGscRows([{ page: "https://example.com/page/", impressions: 1 }])[0].key,
  "https://example.com/page",
);

const opportunities = buildGscOpportunities(report, rows, "en");
assert.equal(opportunities.some((item) => item.key === "low_ranking"), true);
assert.equal(opportunities.some((item) => item.key === "blocked_with_visibility"), true);
assert.equal(opportunities.some((item) => item.key === "gsc_not_in_sitemap"), true);

const visibility = buildSearchVisibility(report);
assert.deepEqual(visibility, {
  total: 4,
  readiness: 50,
  technicallyIndexable: 2,
  hardBlocked: 1,
  canonicalized: 1,
});
assert.equal(isTechnicallyIndexablePage({ issues: [{ type: "canonical_conflict" }] }), false);

console.log("gsc-summary-tests-passed");
