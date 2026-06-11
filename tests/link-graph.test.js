import assert from "node:assert/strict";
import { buildInternalLinkGraph, linkGraphKey } from "../src/link-graph.js";

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

assert.equal(graph.rows.length, 6);
assert.equal(graph.edgeCount, 5);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/orphan").state, "orphan");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/").state, "healthy");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/deep").state, "deep");
assert.equal(graph.rows.find((row) => row.url === "https://example.com/discovered").inboundCount, 2);
assert.equal(graph.rows.find((row) => row.url === "https://example.com/leaf").state, "weak");
assert.equal(linkGraphKey("https://example.com/a#section"), "https://example.com/a");

console.log("link-graph-tests-passed");
