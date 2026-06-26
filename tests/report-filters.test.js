import assert from "node:assert/strict";
import {
  buildUrlSourceSets,
  pageMatchesUrlFilters,
  urlChangeState,
  urlFilterCounts,
} from "../src/report-filters.js";

const pages = [
  {
    url: "https://example.com/a/",
    title: "Alpha",
    issues: [{ type: "title_missing", severity: "warning", message: "Missing title" }],
    internalLinks: ["https://example.com/b/"],
  },
  {
    url: "https://example.com/b/",
    title: "Beta",
    issues: [{ type: "canonical_missing", severity: "critical", message: "Missing canonical" }],
    internalLinks: [],
  },
  {
    url: "https://example.com/c/",
    title: "Gamma",
    issues: [],
    internalLinks: [],
  },
];
const report = {
  pages,
  discoveredPages: [{ url: "https://example.com/discovered/", internalLinks: ["https://example.com/a/"] }],
};
const sourceSets = buildUrlSourceSets(
  report,
  [{ page: "https://example.com/a/" }],
  [{ url: "https://example.com/c/" }],
);
assert.equal(sourceSets.sitemap.size, 3);
assert.equal(sourceSets.internal.has("https://example.com/b"), true);
assert.equal(sourceSets.gsc.has("https://example.com/a"), true);
assert.equal(sourceSets.google.has("https://example.com/c"), true);

const comparisonEntry = {
  issueFingerprints: [
    { url: "https://example.com/a/", type: "title_missing" },
    { url: "https://example.com/b/", type: "http_error" },
    { url: "https://example.com/c/", type: "description_missing" },
  ],
};
assert.equal(urlChangeState(pages[0], comparisonEntry), "persistent");
assert.equal(urlChangeState(pages[1], comparisonEntry), "regressed");
assert.equal(urlChangeState(pages[2], comparisonEntry), "improved");
assert.equal(urlChangeState(pages[0], null), "unavailable");

assert.equal(pageMatchesUrlFilters(pages[0], {
  severity: "warning",
  source: "gsc",
  change: "persistent",
  sourceSets,
  comparisonEntry,
}), true);
assert.equal(pageMatchesUrlFilters(pages[1], {
  severity: "warning",
  source: "all",
  change: "all",
  sourceSets,
  comparisonEntry,
}), false);
assert.equal(pageMatchesUrlFilters(pages[2], {
  severity: "ok",
  source: "google",
  change: "improved",
  query: "gamma",
  sourceSets,
  comparisonEntry,
}), true);
assert.equal(pageMatchesUrlFilters(pages[2], {
  severity: "all",
  issueType: "google_not_indexed",
  issueUrls: ["https://example.com/c/"],
  source: "all",
  change: "all",
  sourceSets,
  comparisonEntry,
}), true);
assert.equal(pageMatchesUrlFilters(pages[1], {
  severity: "all",
  issueType: "google_not_indexed",
  issueUrls: ["https://example.com/c/"],
  source: "all",
  change: "all",
  sourceSets,
  comparisonEntry,
}), false);

const counts = urlFilterCounts(pages, sourceSets, comparisonEntry);
assert.equal(counts.sources.gsc, 1);
assert.equal(counts.sources.google, 1);
assert.equal(counts.changes.regressed, 1);
assert.equal(counts.changes.persistent, 1);
assert.equal(counts.changes.improved, 1);

console.log("report-filters-tests-passed");
