import assert from "node:assert/strict";
import {
  compareIssueFingerprints,
  compareScanConfig,
  reportComparisonConfig,
  reportIssueFingerprints,
} from "../src/version-comparison.js";

const report = {
  options: {
    contentChecks: true,
    performanceChecks: false,
    internalCrawl: true,
    robotsSource: "root",
    urlQueryPolicy: "strip_tracking",
    trailingSlashPolicy: "remove",
  },
  limits: { maxUrls: 250, maxSitemaps: 20 },
  pages: [{
    url: "https://example.com/a/",
    issues: [
      { type: "title_missing", severity: "critical" },
      { type: "canonical_missing", severity: "notice" },
      { type: "new_issue", severity: "warning" },
      { type: "persistent_issue", severity: "warning" },
    ],
  }],
};
const current = reportIssueFingerprints(report);
const previous = [
  { key: "https://example.com/a|title_missing", url: "https://example.com/a/", type: "title_missing", severity: "warning" },
  { key: "https://example.com/a|canonical_missing", url: "https://example.com/a/", type: "canonical_missing", severity: "critical" },
  { key: "https://example.com/a|resolved_issue", url: "https://example.com/a/", type: "resolved_issue", severity: "warning" },
  { key: "https://example.com/a|persistent_issue", url: "https://example.com/a/", type: "persistent_issue", severity: "warning" },
];
const delta = compareIssueFingerprints(previous, current);
assert.equal(delta.introduced.length, 1);
assert.equal(delta.resolved.length, 1);
assert.equal(delta.worsened.length, 1);
assert.equal(delta.improved.length, 1);
assert.equal(delta.persistent.length, 1);
assert.equal(delta.worsened[0].beforeSeverity, "warning");
assert.equal(delta.worsened[0].afterSeverity, "critical");

const config = reportComparisonConfig(report);
assert.deepEqual(config, {
  contentChecks: true,
  performanceChecks: false,
  internalCrawl: true,
  robotsSource: "root",
  urlQueryPolicy: "strip_tracking",
  trailingSlashPolicy: "remove",
  maxUrls: 250,
  maxSitemaps: 20,
});
assert.deepEqual(compareScanConfig(config, config), { available: true, changes: [] });
const configDelta = compareScanConfig({ ...config, maxUrls: 100, contentChecks: false }, config);
assert.equal(configDelta.changes.length, 2);
assert.equal(configDelta.changes.some((item) => item.field === "maxUrls"), true);
assert.deepEqual(compareScanConfig(null, config), { available: false, changes: [] });

console.log("version-comparison-tests-passed");
