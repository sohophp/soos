import assert from "node:assert/strict";
import {
  enqueueInternalLinks,
  internalCrawlKey,
  isInternalCrawlCandidate,
} from "../src/internal-crawl.js";

const queue = [];
const seen = new Set(["https://example.com/already"]);
enqueueInternalLinks({
  queue,
  seen,
  links: [
    "https://example.com/page",
    "https://www.example.com/other?view=1#section",
    "https://example.com/file.pdf",
    "https://outside.example/page",
    "mailto:test@example.com",
    "https://example.com/page",
  ],
  siteRootUrl: "https://example.com/",
  depth: 1,
  maxDepth: 2,
  maxUrls: 10,
  discoveredFrom: "https://example.com/",
});

assert.equal(queue.length, 2);
assert.equal(queue[0].depth, 1);
assert.equal(queue[0].discoveredFrom, "https://example.com/");
assert.equal(queue[1].url, "https://www.example.com/other?view=1");
assert.equal(isInternalCrawlCandidate("https://example.com/app.js", "https://example.com/"), false);
assert.equal(isInternalCrawlCandidate("https://shop.example.com/page", "https://example.com/"), false);
assert.equal(internalCrawlKey("https://example.com/page#part"), "https://example.com/page");

const before = queue.length;
enqueueInternalLinks({
  queue,
  seen,
  links: ["https://example.com/deep"],
  siteRootUrl: "https://example.com/",
  depth: 3,
  maxDepth: 2,
  maxUrls: 10,
});
assert.equal(queue.length, before);

console.log("internal-crawl-tests-passed");
