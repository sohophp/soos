import assert from "node:assert/strict";
import {
  buildInternalLinkGraph,
  buildInternalLinkGraphCsvRows,
  linkGraphKey,
} from "../src/link-graph.js";

const graph = buildInternalLinkGraph({
  input: { siteRootUrl: "https://example.com/" },
  pages: [
    {
      url: "https://example.com/",
      source: "sitemap",
      internalLinks: ["https://example.com/a", "https://example.com/discovered#top"],
    },
    {
      url: "https://example.com/a",
      source: "sitemap",
      internalLinks: ["https://example.com/discovered", "https://example.com/leaf"],
    },
    {
      url: "https://example.com/orphan",
      source: "sitemap",
      internalLinks: [],
    },
  ],
  discoveredPages: [
    {
      url: "https://example.com/discovered",
      source: "internal-crawl",
      crawlDepth: 1,
      internalLinks: ["https://example.com/middle"],
    },
    {
      url: "https://example.com/middle",
      source: "internal-crawl",
      crawlDepth: 2,
      internalLinks: ["https://example.com/deep"],
    },
    {
      url: "https://example.com/deep",
      source: "internal-crawl",
      crawlDepth: 2,
      internalLinks: [],
    },
    {
      url: "https://example.com/leaf",
      source: "internal-crawl",
      crawlDepth: 1,
      internalLinks: [],
    },
  ],
});

assert.equal(graph.rows.length, 7);
assert.equal(graph.edgeCount, 6);
assert.equal(graph.rootAvailable, true);
assert.equal(graph.reachableCount, 6);
assert.equal(graph.maxClickDepth, 3);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/orphan").state, "unreachable");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/orphan").clickDepth, null);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/").state, "healthy");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/deep").state, "deep");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/deep").clickDepth, 3);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/discovered").inboundCount, 2);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/leaf").state, "weak");
assert.equal(linkGraphKey("https://example.com/a#section"), "https://example.com/a");

const noRoot = buildInternalLinkGraph({
  input: { siteRootUrl: "https://example.com/" },
  pages: [{ url: "https://example.com/orphan", source: "sitemap", internalLinks: [] }],
});
assert.equal(noRoot.rootAvailable, false);
assert.equal(noRoot.rows[0].state, "orphan");
assert.equal(noRoot.rows[0].clickDepth, null);

const csvRows = buildInternalLinkGraphCsvRows(graph, { unreachable: "Unreachable" });
assert.equal(csvRows[0][0], "state");
assert.equal(csvRows.length, graph.rows.length + 1);
const orphanCsv = csvRows.find((row) => row[1] === "https://example.com/orphan");
assert.equal(orphanCsv[0], "Unreachable");
assert.equal(orphanCsv[3], "");

console.log("link-graph-tests-passed");
