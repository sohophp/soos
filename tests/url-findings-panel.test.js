import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildUrlSourceSets,
  paginateUrlFindings,
  pageMatchesUrlFilters,
} from "../src/report-filters.js";

const source = await fs.readFile(
  new URL("../src/components/UrlFindingsPanel.jsx", import.meta.url),
  "utf8",
);
assert.match(source, /aria-expanded=\{open\}/);
assert.match(source, /aria-controls=\{detailId\}/);
assert.match(source, /aria-pressed=\{filter === item\}/);
assert.match(source, /<ResultPagination/);
assert.match(source, /onIssueFilterChange\(null\)/);
assert.match(source, /onExportCsv\(pages\)/);
assert.match(source, /paginateUrlFindings\(pages, pageNumber\)/);
assert.match(source, /issueUrls: issueFilter\?\.affectedUrls \|\| \[\]/);
assert.doesNotMatch(source, /key=\{page\.url\}/);
assert.match(source, /key=\{`\$\{page\.url\}-\$\{page\.finalUrl/);

const pages = Array.from({ length: 51 }, (_, index) => ({
  url: `https://example.com/page-${index + 1}`,
  title: `Page ${index + 1}`,
  issues: index === 0
    ? [{ type: "title_missing", severity: "warning", message: "Missing title" }]
    : [],
  internalLinks: [],
}));
const firstPage = paginateUrlFindings(pages, 1);
assert.equal(firstPage.pageCount, 2);
assert.equal(firstPage.items.length, 50);
assert.equal(firstPage.items.at(-1).url, "https://example.com/page-50");
const secondPage = paginateUrlFindings(pages, 99);
assert.equal(secondPage.page, 2);
assert.equal(secondPage.items.length, 1);

const sourceSets = buildUrlSourceSets(
  { pages, discoveredPages: [] },
  [{ page: pages[0].url }],
  [],
);
const matching = pages.filter((page) => pageMatchesUrlFilters(page, {
  severity: "all",
  issueType: "title_missing",
  source: "gsc",
  change: "all",
  sourceSets,
  comparisonEntry: null,
}));
assert.equal(matching.length, 1);
assert.equal(matching[0].url, pages[0].url);

const googleIssueMatching = pages.filter((page) => pageMatchesUrlFilters(page, {
  severity: "all",
  issueType: "google_not_indexed",
  issueUrls: [pages[1].url],
  source: "all",
  change: "all",
  sourceSets,
  comparisonEntry: null,
}));
assert.equal(googleIssueMatching.length, 1);
assert.equal(googleIssueMatching[0].url, pages[1].url);

console.log("url findings panel tests passed");
