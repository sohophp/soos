import assert from "node:assert/strict";
import { createScanRunner } from "../server/scan-runner.js";

function fetched({
  status = 200,
  finalUrl,
  text = "",
  contentType = "text/html",
  durationMs = 25,
  redirectChain = [],
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    finalUrl,
    text,
    contentType,
    durationMs,
    redirectChain,
    redirectLoop: false,
    redirectInvalidLocation: false,
    redirectLimitReached: false,
    redirectCrossHost: false,
    redirectProtocolDowngrade: false,
  };
}

const responses = new Map([
  ["https://example.com/robots.txt", fetched({
    finalUrl: "https://example.com/robots.txt",
    contentType: "text/plain",
    text: "User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml",
  })],
  ["https://example.com/sitemap.xml", fetched({
    finalUrl: "https://example.com/sitemap.xml",
    contentType: "application/xml",
    text: "<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/private</loc></url></urlset>",
  })],
  ["https://example.com/", fetched({
    finalUrl: "https://example.com/",
    text: `<!doctype html><html lang="en"><head>
      <title>Example home page title</title>
      <meta name="description" content="A sufficiently descriptive example page for the scanner regression test.">
      <meta name="viewport" content="width=device-width">
      <link rel="canonical" href="https://example.com/">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Example","url":"https://example.com/"}</script>
      </head><body><h1>Example</h1><a href="/private">Private</a></body></html>`,
  })],
  ["https://example.com/private", fetched({
    finalUrl: "https://example.com/private",
    text: "<html><head><title>Private page title</title><link rel=\"canonical\" href=\"https://example.com/private\"></head><body><h1>Private</h1></body></html>",
  })],
]);

const checkpoints = [];
const progress = [];
const runner = createScanRunner({
  fetchText: async (url) => {
    const response = responses.get(url);
    if (!response) throw new Error(`Unexpected URL ${url}`);
    return response;
  },
  jobStore: {
    wait: async () => {},
    saveCheckpoint: async (...args) => checkpoints.push(args),
  },
  proxyAllowed: () => false,
});

const report = await runner.audit(
  "https://example.com/sitemap.xml",
  { contentChecks: true },
  (value) => progress.push(value),
);
assert.equal(report.summary.sitemapCount, 1);
assert.equal(report.summary.urlCount, 2);
assert.equal(report.pages.length, 2);
assert.equal(report.pages[0].canonical, "https://example.com/");
assert.equal(report.pages[0].structuredData.types.includes("WebSite"), true);
assert.equal(report.pages[1].issues.some((issue) => issue.type === "robots_disallow"), true);
assert.match(
  report.pages[1].issues.find((issue) => issue.type === "robots_disallow").detail,
  /matched: disallow:\/private/,
);
assert.equal(report.summary.googleBlockedCount, 1);
assert.equal(report.statusFlags.some((flag) => flag.key === "robots_blocked"), true);
assert.equal(checkpoints.length > 0, true);
assert.equal(progress.at(-1).stage, "finalizing");

await assert.rejects(
  runner.audit("https://example.com/sitemap.xml", { proxyEnabled: true }),
  /Proxy fetching is disabled/,
);

console.log("scan-runner-tests-passed");
