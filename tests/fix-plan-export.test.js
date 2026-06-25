import assert from "node:assert/strict";
import { buildFixPlanCsvRows } from "../src/fix-plan-export.js";

const rows = buildFixPlanCsvRows([{
  priorityScore: 91,
  severity: "critical",
  category: "indexability",
  type: "google_not_indexed",
  confidence: "confirmed",
  affectedUrlCount: 2,
  title: "Google reports affected URLs are not indexed",
  summary: "2 affected URLs need indexability review.",
  impact: "Google-confirmed indexing issue.",
  recommendedFix: {
    steps: ["Fix crawl blockers.", "Request validation."],
  },
  verification: [{
    steps: ["Rescan the URL.", "Run URL Inspection again."],
  }],
  evidence: [{
    url: "https://example.com/a",
    label: "URL Inspection coverage",
    detail: "Crawled - currently not indexed",
  }],
}]);

assert.deepEqual(rows[0], [
  "priority",
  "severity",
  "category",
  "type",
  "confidence",
  "affected_urls",
  "title",
  "summary",
  "impact",
  "fix_steps",
  "verification_steps",
  "evidence",
]);
assert.equal(rows[1][0], 91);
assert.equal(rows[1][3], "google_not_indexed");
assert.equal(rows[1][5], 2);
assert.equal(rows[1][9], "Fix crawl blockers.\nRequest validation.");
assert.equal(rows[1][10], "Rescan the URL.\nRun URL Inspection again.");
assert.equal(rows[1][11], "https://example.com/a | URL Inspection coverage | Crawled - currently not indexed");

console.log("fix plan export tests passed");
