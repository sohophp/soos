import assert from "node:assert/strict";
import {
  classifyIssueConfidence,
  issueCountsBySeverity,
  normalizeGoogleInspectionIssues,
  normalizeReportIssues,
} from "../src/issue-model.js";
import { fixInstructionFor } from "../src/fix-instructions.js";
import { scoreIssuePriority } from "../src/issue-priority.js";

const report = {
  scannedAt: "2026-06-24T00:00:00.000Z",
  input: { siteRootUrl: "https://example.com/" },
  pages: [
    {
      url: "https://example.com/blocked",
      finalUrl: "https://example.com/blocked",
      canonical: "https://example.com/blocked",
      issues: [
        {
          severity: "critical",
          type: "robots_disallow",
          message: "Blocked by robots.txt for Googlebot",
          detail: "Disallow: /blocked",
        },
      ],
    },
    ...Array.from({ length: 30 }, (_, index) => ({
      url: `https://example.com/canonical-${index}`,
      finalUrl: `https://example.com/canonical-${index}`,
      canonical: "https://example.com/preferred",
      issues: [
        {
          severity: "notice",
          type: "canonical_mismatch",
          message: "Canonical differs from fetched URL",
          detail: "https://example.com/preferred",
        },
      ],
    })),
    {
      url: "https://example.com/title",
      finalUrl: "https://example.com/title",
      issues: [
        {
          severity: "notice",
          type: "title_short",
          message: "Title looks too short",
          detail: "9 characters",
        },
      ],
    },
  ],
};

const issues = normalizeReportIssues(report, {
  gscRows: [
    { page: "https://example.com/blocked", clicks: 12, impressions: 1200 },
  ],
  inspectionResults: [
    {
      ok: true,
      url: "https://example.com/google-canonical",
      verdict: "PASS",
      userCanonical: "https://example.com/google-canonical",
      googleCanonical: "https://example.com/google-selected",
      coverageState: "Indexed",
    },
    {
      ok: true,
      url: "https://example.com/not-indexed",
      verdict: "FAIL",
      coverageState: "Crawled - currently not indexed",
    },
  ],
});

const robotsIssue = issues.find((issue) => issue.type === "robots_disallow");
const canonicalIssue = issues.find((issue) => issue.type === "canonical_mismatch");
const titleIssue = issues.find((issue) => issue.type === "title_short");
const googleCanonicalIssue = issues.find((issue) => issue.type === "google_selected_canonical_differs");
const googleNotIndexedIssue = issues.find((issue) => issue.type === "google_not_indexed");

assert.equal(robotsIssue.category, "crawlability");
assert.equal(robotsIssue.severity, "critical");
assert.equal(robotsIssue.confidence, "likely");
assert.equal(robotsIssue.recommendedFix.steps.some((step) => /robots\.txt/.test(step)), true);
assert.equal(robotsIssue.verification[0].requiresGoogleData, false);

assert.equal(canonicalIssue.category, "canonical");
assert.equal(canonicalIssue.affectedUrlCount, 30);
assert.equal(canonicalIssue.priorityScore > titleIssue.priorityScore, true);
assert.equal(canonicalIssue.recommendedFix.steps.some((step) => /sitemap/i.test(step)), true);

assert.equal(googleCanonicalIssue.confidence, "confirmed");
assert.equal(googleCanonicalIssue.sourceCapabilities.includes("google"), true);
assert.equal(googleCanonicalIssue.verification[0].requiresGoogleData, true);
assert.equal(googleNotIndexedIssue.impact.includes("inspected URLs"), true);

assert.equal(issues[0].priorityScore >= robotsIssue.priorityScore, true);
assert.equal(robotsIssue.priorityScore > titleIssue.priorityScore, true);

const counts = issueCountsBySeverity(issues);
assert.equal(counts.critical >= 2, true);
assert.equal(counts.low >= 1, true);

assert.equal(
  classifyIssueConfidence({
    sourceCapabilities: ["google"],
    evidence: [{ source: "google" }],
  }),
  "confirmed",
);
assert.equal(
  classifyIssueConfidence({
    sourceCapabilities: ["scan"],
    evidence: [{ source: "scan" }],
  }),
  "likely",
);

const googleIssues = normalizeGoogleInspectionIssues(report, [{
  ok: true,
  url: "https://example.com/sample",
  verdict: "FAIL",
  coverageState: "Excluded by noindex tag",
}]);
assert.equal(googleIssues[0].sourceCapabilities.includes("google"), true);

const googleConfirmed = {
  severity: "critical",
  category: "indexability",
  confidence: "confirmed",
  affectedUrlCount: 1,
  sourceCapabilities: ["google"],
};
const contentHint = {
  severity: "low",
  category: "content",
  confidence: "likely",
  affectedUrlCount: 200,
  sourceCapabilities: ["scan"],
};
assert.equal(scoreIssuePriority(googleConfirmed) > scoreIssuePriority(contentHint), true);

const sitemapRedirectFix = fixInstructionFor("redirect");
assert.equal(sitemapRedirectFix.steps.some((step) => /final HTTP 200 URL/i.test(step)), true);

console.log("issue-model-tests-passed");
