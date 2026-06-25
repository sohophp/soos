import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { paginateResultRows } from "../src/result-pagination.js";

const [source, paginationSource] = await Promise.all([
  fs.readFile(
    new URL("../src/components/UrlStructureView.jsx", import.meta.url),
    "utf8",
  ),
  fs.readFile(
    new URL("../src/components/ResultPagination.jsx", import.meta.url),
    "utf8",
  ),
]);

assert.match(source, /buildInternalLinkGraph\(report\)/);
assert.match(source, /buildInternalLinkGraphCsvRows\(graph, labels\)/);
assert.match(source, /downloadCsvFile\("soos-internal-link-graph\.csv"/);
assert.match(source, /report\.truncation\?\.internalCrawlLimitReached/);
assert.match(source, /value=\{filter\}/);
assert.match(source, /<Sitemaps sitemaps=\{report\.sitemaps\}/);
assert.match(source, /<InternalDiscovery report=\{report\}/);
assert.match(source, /<InternalLinkGraph report=\{report\}/);
assert.match(source, /pagination\.items\.map/);
assert.match(source, /<ResultPagination/);
assert.doesNotMatch(source, /key=\{sitemap\.url\}/);
assert.doesNotMatch(source, /key=\{page\.url\}/);
assert.doesNotMatch(source, /key=\{row\.url\}/);
assert.match(paginationSource, /className="result-pagination"/);
assert.match(paginationSource, /pagination\.pageCount <= 1/);

const rows = Array.from({ length: 121 }, (_, index) => index + 1);
assert.deepEqual(paginateResultRows(rows, 2), {
  items: rows.slice(50, 100),
  page: 2,
  pageCount: 3,
  total: 121,
});
assert.equal(paginateResultRows(rows, 99).page, 3);

console.log("url structure view tests passed");
