import assert from "node:assert/strict";
import {
  buildUrlInspectionCandidates,
  inspectionCandidateKey,
} from "../src/url-inspection-candidates.js";

const report = {
  pages: [
    {
      url: "https://example.com/blocked",
      issues: [{ type: "robots_disallow" }],
      internalLinks: ["https://example.com/internal-only", "https://example.com/shared?view=1"],
    },
    {
      url: "https://example.com/redirect",
      issues: [{ type: "redirect" }],
      internalLinks: [],
    },
    {
      url: "https://example.com/normal",
      issues: [],
      internalLinks: [],
    },
  ],
  discoveredPages: [
    {
      url: "https://example.com/crawled-only",
      issues: [],
      internalLinks: ["https://example.com/deeper-only"],
    },
  ],
};

const rows = [
  { page: "https://example.com/gsc-only", impressions: 500 },
  { page: "https://example.com/shared?view=1", impressions: 200 },
  { page: "https://example.com/normal", impressions: 10 },
];

const candidates = buildUrlInspectionCandidates(report, rows);
assert.equal(candidates[0].url, "https://example.com/blocked");
assert.equal(candidates[0].priority, 10);
assert.equal(candidates[1].url, "https://example.com/redirect");
assert.equal(candidates[1].priority, 15);
assert.equal(candidates[2].url, "https://example.com/gsc-only");
assert.equal(candidates[2].priority, 20);

const shared = candidates.find((item) => item.url === "https://example.com/shared?view=1");
assert.deepEqual(shared.sources.sort(), ["gsc", "internal"]);
assert.equal(shared.priority, 20);
assert.equal(candidates.filter((item) => item.key === shared.key).length, 1);
assert.equal(candidates.find((item) => item.url === "https://example.com/crawled-only").priority, 25);
assert.ok(candidates.some((item) => item.url === "https://example.com/deeper-only"));

assert.notEqual(
  inspectionCandidateKey("https://example.com/shared?view=1"),
  inspectionCandidateKey("https://example.com/shared?view=2"),
);
assert.equal(inspectionCandidateKey("mailto:test@example.com"), "");

const graphCandidates = buildUrlInspectionCandidates({
  input: { siteRootUrl: "https://graph.example/" },
  pages: [
    { url: "https://graph.example/", issues: [], internalLinks: ["https://graph.example/a"] },
    { url: "https://graph.example/a", issues: [], internalLinks: ["https://graph.example/b"] },
    { url: "https://graph.example/b", issues: [], internalLinks: ["https://graph.example/deep"] },
    { url: "https://graph.example/deep", issues: [], internalLinks: [] },
    { url: "https://graph.example/unreachable", issues: [], internalLinks: [] },
  ],
}, []);
assert.equal(graphCandidates.find((item) => item.url === "https://graph.example/unreachable").priority, 12);
assert.ok(graphCandidates.find((item) => item.url === "https://graph.example/unreachable").reasons.includes("homepage_unreachable"));
assert.equal(graphCandidates.find((item) => item.url === "https://graph.example/deep").priority, 35);

const historicalCandidates = buildUrlInspectionCandidates({
  pages: [
    {
      url: "https://example.com/existing",
      issues: [{ type: "title_missing", severity: "critical" }],
      internalLinks: [],
    },
    {
      url: "https://example.com/new-clean",
      issues: [],
      internalLinks: [],
    },
    {
      url: "https://example.com/new-issue",
      issues: [{ type: "canonical_missing", severity: "warning" }],
      internalLinks: [],
    },
  ],
}, [], {
  pageUrls: ["https://example.com/existing"],
  issueFingerprints: [
    {
      key: "https://example.com/existing|title_missing",
      url: "https://example.com/existing",
      type: "title_missing",
      severity: "warning",
    },
  ],
});
const worsened = historicalCandidates.find((item) => item.url === "https://example.com/existing");
assert.equal(worsened.priority, 4);
assert.ok(worsened.reasons.includes("history_severity_worsened:title_missing"));
assert.ok(worsened.sources.includes("history"));
const introduced = historicalCandidates.find((item) => item.url === "https://example.com/new-issue");
assert.equal(introduced.priority, 6);
assert.ok(introduced.reasons.includes("history_issue_introduced:canonical_missing"));
assert.ok(introduced.reasons.includes("history_new_page"));
const newClean = historicalCandidates.find((item) => item.url === "https://example.com/new-clean");
assert.equal(newClean.priority, 8);
assert.ok(newClean.reasons.includes("history_new_page"));

console.log("url-inspection-candidates-tests-passed");
