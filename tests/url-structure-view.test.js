import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(
  new URL("../src/components/UrlStructureView.jsx", import.meta.url),
  "utf8",
);

assert.match(source, /buildInternalLinkGraph\(report\)/);
assert.match(source, /buildInternalLinkGraphCsvRows\(graph, labels\)/);
assert.match(source, /downloadCsvFile\("soos-internal-link-graph\.csv"/);
assert.match(source, /report\.truncation\?\.internalCrawlLimitReached/);
assert.match(source, /value=\{filter\}/);
assert.match(source, /<Sitemaps sitemaps=\{report\.sitemaps\}/);
assert.match(source, /<InternalDiscovery report=\{report\}/);
assert.match(source, /<InternalLinkGraph report=\{report\}/);

console.log("url structure view tests passed");
