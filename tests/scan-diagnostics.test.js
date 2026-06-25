import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addAlternateReciprocityIssues,
  addDuplicateContentIssues,
  buildBacklog,
  buildExecutiveSummary,
  buildStatusFlags,
  calculateHealthScore,
  classifyGoogleReasons,
  summarizeInternationalSignals,
  summarizeRobotsImpact,
  summarizeSitemapSignals,
} from "../server/scan-diagnostics.js";

const pages = [
  {
    url: "https://example.com/a",
    finalUrl: "https://example.com/a",
    canonical: "https://example.com/b",
    canonicalDeclarations: [
      { source: "html", href: "https://example.com/b", rawHref: "/b" },
      { source: "http_header", href: "https://example.com/c", rawHref: "https://example.com/c" },
    ],
    title: "Duplicate",
    description: "Same description",
    status: 200,
    alternates: [{ hreflang: "en", href: "https://example.com/b" }],
    issues: [
      { severity: "critical", type: "robots_disallow", message: "Blocked", detail: "Disallow: /a" },
      { severity: "warning", type: "canonical_mismatch", message: "Canonical differs" },
      { severity: "warning", type: "canonical_not_in_sitemap", message: "Missing canonical" },
      { severity: "warning", type: "canonical_conflict", message: "Canonical conflict" },
      { severity: "warning", type: "alternate_self_missing", message: "Missing self-reference" },
    ],
  },
  {
    url: "https://example.com/b",
    finalUrl: "https://example.com/b",
    canonical: "https://example.com/b",
    title: "Duplicate",
    description: "Same description",
    status: 200,
    alternates: [],
    issues: [],
  },
];

addAlternateReciprocityIssues(pages);
assert.equal(pages[0].issues.some((issue) => issue.type === "alternate_not_reciprocal"), true);

addDuplicateContentIssues(pages);
assert.equal(pages.every((page) => page.issues.some((issue) => issue.type === "title_duplicate")), true);
assert.equal(pages.every((page) => page.issues.some((issue) => issue.type === "description_duplicate")), true);

const robots = summarizeRobotsImpact(pages);
assert.equal(robots[0].rule, "Disallow: /a");
assert.equal(robots[0].count, 1);

const sitemapSignals = summarizeSitemapSignals(pages);
assert.equal(sitemapSignals.some((item) => item.key === "canonical_mismatch"), true);
assert.equal(sitemapSignals.some((item) => item.key === "canonical_not_in_sitemap"), true);
assert.equal(sitemapSignals.some((item) => item.key === "canonical_conflict"), true);

const international = summarizeInternationalSignals(pages);
assert.equal(international.some((item) => item.key === "alternate_not_reciprocal"), true);
assert.equal(international.some((item) => item.key === "alternate_self_missing"), true);

const reasons = classifyGoogleReasons(pages[0]);
assert.equal(reasons.some((reason) => reason.code === "blocked_by_robots"), true);
assert.equal(reasons.some((reason) => reason.code === "not_selected_as_canonical"), true);

const backlog = buildBacklog(pages, [{ url: "https://example.com/sitemap.xml", issues: ["bad xml"] }]);
assert.equal(backlog[0].key, "sitemap_errors");
assert.equal(backlog.some((item) => item.key === "robots_disallow"), true);
assert.equal(backlog.some((item) => item.key === "canonical_not_in_sitemap"), true);
assert.equal(backlog.some((item) => item.key === "alternate_not_reciprocal"), true);

const recommendationCoverageBacklog = buildBacklog([
  {
    url: "https://example.com/recommendations",
    issues: [
      { severity: "notice", type: "canonical_multiple", message: "Multiple canonical declarations" },
      { severity: "warning", type: "not_html", message: "Not HTML" },
      { severity: "warning", type: "alternate_invalid", message: "Invalid alternate" },
      { severity: "warning", type: "alternate_hreflang_invalid", message: "Invalid hreflang" },
      { severity: "notice", type: "alternate_duplicate_target", message: "Duplicate hreflang target" },
      { severity: "notice", type: "title_short", message: "Short title" },
      { severity: "notice", type: "title_long", message: "Long title" },
      { severity: "notice", type: "description_short", message: "Short description" },
      { severity: "notice", type: "description_long", message: "Long description" },
      { severity: "notice", type: "h1_multiple", message: "Multiple H1" },
      { severity: "notice", type: "html_lang_missing", message: "Missing lang" },
      { severity: "warning", type: "structured_data_validation", message: "Structured data validation" },
      { severity: "notice", type: "structured_data_recommended", message: "Structured data recommended" },
      { severity: "warning", type: "perf_ttfb_slow", message: "Slow TTFB" },
      { severity: "notice", type: "perf_html_large", message: "Large HTML" },
      { severity: "notice", type: "perf_many_scripts", message: "Many scripts" },
      { severity: "notice", type: "perf_many_stylesheets", message: "Many stylesheets" },
      { severity: "notice", type: "perf_many_images", message: "Many images" },
    ],
  },
], []);
for (const key of [
  "canonical_multiple",
  "not_html",
  "alternate_invalid",
  "alternate_hreflang_invalid",
  "alternate_duplicate_target",
  "title_short",
  "title_long",
  "description_short",
  "description_long",
  "h1_multiple",
  "html_lang_missing",
  "structured_data_validation",
  "structured_data_recommended",
  "perf_ttfb_slow",
  "perf_html_large",
  "perf_many_scripts",
  "perf_many_stylesheets",
  "perf_many_images",
]) {
  assert.equal(recommendationCoverageBacklog.some((item) => item.key === key), true, key);
}

const scanRunnerSource = readFileSync(new URL("../server/scan-runner.js", import.meta.url), "utf8");
const generatedIssueTypes = new Set(
  [...scanRunnerSource.matchAll(/addIssue\(\s*issues[\s\S]*?"(?:critical|warning|notice)"\s*,\s*"([a-z0-9_]+)"/g)]
    .map((match) => match[1]),
);
const backlogCoverage = buildBacklog(
  [...generatedIssueTypes].map((type) => ({
    url: `https://example.com/${type}`,
    issues: [{ severity: "warning", type, message: type }],
  })),
  [],
);
const coveredBacklogTypes = new Set(backlogCoverage.map((item) => item.key));
for (const type of generatedIssueTypes) {
  assert.equal(coveredBacklogTypes.has(type), true, `Missing backlog recommendation for ${type}`);
}

const score = calculateHealthScore(pages, []);
assert.equal(score < 100, true);
assert.equal(score >= 0, true);

const executive = buildExecutiveSummary({
  summary: { googleBlockedCount: 1, affectedUrlCount: 2 },
  backlog,
  robots: { analysis: { blockedSummaries: robots } },
  sitemapSignals,
  internationalSignals: international,
});
assert.match(executive.headline, /crawl or indexing blockers/);
assert.equal(executive.topActions.length > 0, true);

const flags = buildStatusFlags({
  robots: { analysis: { blockedSummaries: robots } },
  sitemapSignals,
  internationalSignals: international,
  summary: { affectedUrlCount: 2 },
});
assert.equal(flags.some((flag) => flag.key === "robots_blocked"), true);
assert.equal(flags.some((flag) => flag.key === "canonical_conflict"), true);

console.log("scan-diagnostics-tests-passed");
