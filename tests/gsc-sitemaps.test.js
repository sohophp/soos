import assert from "node:assert/strict";
import {
  normalizeGscSitemapResponse,
  normalizeGscSitemapUrl,
} from "../src/gsc-sitemaps.js";

assert.equal(
  normalizeGscSitemapUrl("HTTPS://Example.COM:443/sitemap.xml?type=pages#section"),
  "https://example.com/sitemap.xml?type=pages",
);
assert.notEqual(
  normalizeGscSitemapUrl("https://example.com/sitemap.xml?type=pages"),
  normalizeGscSitemapUrl("https://example.com/sitemap.xml?type=news"),
);
assert.notEqual(
  normalizeGscSitemapUrl("https://example.com/sitemaps/"),
  normalizeGscSitemapUrl("https://example.com/sitemaps"),
);
assert.notEqual(
  normalizeGscSitemapUrl("http://example.com/sitemap.xml"),
  normalizeGscSitemapUrl("https://example.com/sitemap.xml"),
);
assert.notEqual(
  normalizeGscSitemapUrl("https://example.com/Sitemap.xml"),
  normalizeGscSitemapUrl("https://example.com/sitemap.xml"),
);

const result = normalizeGscSitemapResponse({
  sitemap: [
    {
      path: "https://example.com/sitemap.xml",
      lastSubmitted: "2026-06-01T00:00:00Z",
      lastDownloaded: "2026-06-06T00:00:00Z",
      isPending: false,
      isSitemapsIndex: true,
      type: "sitemap",
      errors: "2",
      warnings: 1,
      contents: [
        { type: "web", submitted: "120", indexed: "87" },
        { type: "image", submitted: 30, indexed: 22 },
      ],
    },
    {
      path: "https://example.com/news.xml",
      isPending: true,
      contents: [],
    },
  ],
});

assert.equal(result.summary.total, 2);
assert.equal(result.summary.pending, 1);
assert.equal(result.summary.withErrors, 1);
assert.equal(result.summary.withWarnings, 1);
assert.equal(result.summary.submittedUrls, 150);
assert.equal(result.sitemaps[0].submittedUrls, 150);
assert.equal(result.sitemaps[0].contents[0].submitted, 120);
assert.equal("indexed" in result.sitemaps[0].contents[0], false);

assert.deepEqual(normalizeGscSitemapResponse({}), {
  sitemaps: [],
  summary: {
    total: 0,
    pending: 0,
    withErrors: 0,
    withWarnings: 0,
    submittedUrls: 0,
  },
});

console.log("gsc-sitemaps-tests-passed");
