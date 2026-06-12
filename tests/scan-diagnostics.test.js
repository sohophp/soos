import assert from "node:assert/strict";
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
    title: "Duplicate",
    description: "Same description",
    status: 200,
    alternates: [{ hreflang: "en", href: "https://example.com/b" }],
    issues: [
      { severity: "critical", type: "robots_disallow", message: "Blocked", detail: "Disallow: /a" },
      { severity: "warning", type: "canonical_mismatch", message: "Canonical differs" },
      { severity: "warning", type: "canonical_not_in_sitemap", message: "Missing canonical" },
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

const international = summarizeInternationalSignals(pages);
assert.equal(international.some((item) => item.key === "alternate_not_reciprocal"), true);

const reasons = classifyGoogleReasons(pages[0]);
assert.equal(reasons.some((reason) => reason.code === "blocked_by_robots"), true);
assert.equal(reasons.some((reason) => reason.code === "not_selected_as_canonical"), true);

const backlog = buildBacklog(pages, [{ url: "https://example.com/sitemap.xml", issues: ["bad xml"] }]);
assert.equal(backlog[0].key, "sitemap_errors");
assert.equal(backlog.some((item) => item.key === "robots_disallow"), true);

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
