import assert from "node:assert/strict";
import {
  buildCategoryDelta,
  buildIssueDelta,
  HISTORY_KEY,
  HISTORY_LIMIT_KEY,
  loadHistory,
  loadHistoryLimit,
  saveHistory,
  saveHistoryLimit,
  toHistoryEntry,
  trendLabel,
} from "../src/history.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

assert.deepEqual(loadHistory(memoryStorage({ [HISTORY_KEY]: "{bad json" })), []);
assert.deepEqual(loadHistory(memoryStorage({ [HISTORY_KEY]: JSON.stringify({ nope: true }) })), []);

const storage = memoryStorage();
saveHistory([{ id: "one" }], storage);
assert.deepEqual(loadHistory(storage), [{ id: "one" }]);
assert.equal(loadHistoryLimit(storage), 12);
saveHistoryLimit(20, storage);
assert.equal(storage.value(HISTORY_LIMIT_KEY), "20");
assert.equal(loadHistoryLimit(storage), 20);
assert.equal(loadHistoryLimit(memoryStorage({ [HISTORY_LIMIT_KEY]: "999" })), 12);

const report = {
  scannedAt: "2026-06-12T00:00:00.000Z",
  input: { sitemapUrl: "https://example.com/sitemap.xml" },
  summary: { healthScore: 90, issueCounts: { critical: 1, warning: 1, notice: 0 } },
  executiveSummary: { headline: "One issue" },
  statusFlags: [{ key: "canonical_conflict", severity: "warning" }],
  options: { contentChecks: true },
  limits: { maxUrls: 250, maxSitemaps: 20 },
  pages: [{
    url: "https://example.com/a",
    issues: [{ type: "title_missing", severity: "critical" }],
  }],
};
const entry = toHistoryEntry(report, () => 1000, () => 0.5);
assert.equal(entry.id, "rs-i");
assert.equal(entry.issueFingerprints.length, 1);
assert.deepEqual(entry.pageUrls, ["https://example.com/a"]);
assert.equal(entry.scanConfig.contentChecks, true);

const previous = {
  summary: { issueCounts: { critical: 1, warning: 0, notice: 1 } },
  issueFingerprints: [
    { key: "https://example.com/a|title_missing", url: "https://example.com/a", type: "title_missing", severity: "warning" },
    { key: "https://example.com/old|h1_missing", url: "https://example.com/old", type: "h1_missing", severity: "notice" },
  ],
  statusFlags: [{ key: "robots_blocked" }],
};
const delta = buildIssueDelta(previous, report);
assert.equal(delta.severityWorsened.length, 1);
assert.equal(delta.resolved.length, 1);
assert.equal(delta.worsened.find((item) => item.severity === "warning")?.delta, 1);

const categories = buildCategoryDelta(previous, report);
assert.deepEqual(categories.map((item) => item.key).sort(), ["canonical", "robots"]);
assert.equal(trendLabel(2, 1, { trendUp: "up", trendDown: "down", trendFlat: "flat" }), "up");
assert.equal(trendLabel(null, 1, {}), null);

console.log("history tests passed");
