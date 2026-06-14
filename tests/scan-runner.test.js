import assert from "node:assert/strict";
import { createScanRunner } from "../server/scan-runner.js";

function fetched({
  status = 200,
  finalUrl,
  text = "",
  contentType = "text/html",
  xRobotsTag = "",
  linkHeader = "",
  durationMs = 25,
  redirectChain = [],
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    finalUrl,
    text,
    contentType,
    xRobotsTag,
    linkHeader,
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

const declaredSitemapRequests = [];
const declaredSitemapRunner = createScanRunner({
  fetchText: async (url) => {
    declaredSitemapRequests.push(url);
    if (url === "https://multi.example/robots.txt") {
      return fetched({
        finalUrl: url,
        contentType: "text/plain",
        text: [
          "User-agent: *",
          "Sitemap: https://multi.example/sitemap-pages.xml",
          "Sitemap: https://multi.example/sitemap-news.xml?edition=current",
        ].join("\n"),
      });
    }
    if (url === "https://multi.example/sitemap-pages.xml") {
      return fetched({
        finalUrl: url,
        contentType: "application/xml",
        text: "<urlset><url><loc>https://multi.example/page</loc></url></urlset>",
      });
    }
    if (url === "https://multi.example/sitemap-news.xml?edition=current") {
      return fetched({
        finalUrl: url,
        contentType: "application/xml",
        text: "<urlset><url><loc>https://multi.example/news</loc></url></urlset>",
      });
    }
    if (url === "https://multi.example/page" || url === "https://multi.example/news") {
      return fetched({
        finalUrl: url,
        text: `<html><head><link rel="canonical" href="${url}"></head><body></body></html>`,
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  },
  jobStore: { wait: async () => {}, saveCheckpoint: async () => {} },
});
const declaredSitemapReport = await declaredSitemapRunner.audit("https://multi.example/", {});
assert.deepEqual(declaredSitemapReport.input.sitemapUrls, [
  "https://multi.example/sitemap-pages.xml",
  "https://multi.example/sitemap-news.xml?edition=current",
]);
assert.equal(declaredSitemapReport.input.sitemapUrl, "https://multi.example/sitemap-pages.xml");
assert.equal(declaredSitemapReport.summary.sitemapCount, 2);
assert.equal(declaredSitemapReport.summary.urlCount, 2);
assert.equal(declaredSitemapRequests.includes("https://multi.example/sitemap.xml"), false);

const indexRunner = createScanRunner({
  fetchText: async (url) => {
    if (url === "https://index.example/robots.txt") {
      return fetched({
        finalUrl: url,
        contentType: "text/plain",
        text: "User-agent: *\nSitemap: https://index.example/sitemap-index.xml",
      });
    }
    if (url === "https://index.example/sitemap-index.xml") {
      return fetched({
        finalUrl: url,
        contentType: "application/xml",
        text: "<sitemapindex><sitemap><loc>https://index.example/child.xml</loc></sitemap></sitemapindex>",
      });
    }
    if (url === "https://index.example/child.xml") {
      return fetched({
        finalUrl: url,
        contentType: "application/xml",
        text: "<urlset><url><loc>https://index.example/page</loc></url></urlset>",
      });
    }
    if (url === "https://index.example/page") {
      return fetched({
        finalUrl: url,
        text: `<html><head><link rel="canonical" href="${url}"></head><body></body></html>`,
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  },
  jobStore: { wait: async () => {}, saveCheckpoint: async () => {} },
});
const indexReport = await indexRunner.audit("https://index.example/", {});
assert.deepEqual(indexReport.input.sitemapUrls, ["https://index.example/sitemap-index.xml"]);
assert.equal(indexReport.summary.sitemapCount, 2);

const inspectRunner = createScanRunner({
  fetchText: async (url) => {
    if (url.endsWith("/header-noindex")) {
      return fetched({
        finalUrl: url,
        contentType: "application/xhtml+xml; charset=utf-8",
        xRobotsTag: "googlebot: noindex, nofollow",
        text: `<html><head><link rel="canonical" href="${url}"></head><body></body></html>`,
      });
    }
    if (url.endsWith("/asset.json")) {
      return fetched({
        finalUrl: url,
        contentType: "application/json",
        text: "{\"ok\":true}",
      });
    }
    return fetched({ status: 503, finalUrl: url, contentType: "text/plain", text: "Unavailable" });
  },
  jobStore: { wait: async () => {} },
});
const headerNoindexUrl = "https://example.com/header-noindex";
const headerNoindexPage = await inspectRunner.inspectPage(
  headerNoindexUrl,
  null,
  new Set([headerNoindexUrl]),
  { contentChecks: false },
  {},
);
assert.match(
  headerNoindexPage.issues.find((issue) => issue.type === "noindex").detail,
  /X-Robots-Tag: googlebot: noindex/,
);
const jsonPage = await inspectRunner.inspectPage(
  "https://example.com/asset.json",
  null,
  new Set(),
  { contentChecks: false },
  {},
);
assert.equal(jsonPage.issues.some((issue) => issue.type === "not_html"), true);
const unavailablePage = await inspectRunner.inspectPage(
  "https://example.com/unavailable",
  null,
  new Set(),
  { contentChecks: false },
  {},
);
assert.equal(unavailablePage.issues.some((issue) => issue.type === "http_error"), true);
assert.equal(unavailablePage.issues.some((issue) => issue.type === "not_html"), true);

const evidenceRunner = createScanRunner({
  fetchText: async (url) => fetched({
    finalUrl: url,
    linkHeader: '<https://example.com/header-canonical>; rel="canonical"',
    text: `<html><head>
      <link rel="canonical" href="/html-canonical">
      <link rel="canonical" href="javascript:alert(1)">
      <link rel="alternate" hreflang="en" href="/en">
      <link rel="alternate" hreflang="en" href="/en-duplicate">
      <link rel="alternate" hreflang="fr" href="/en">
    </head><body></body></html>`,
  }),
  jobStore: { wait: async () => {} },
});
const evidencePage = await evidenceRunner.inspectPage(
  "https://example.com/evidence",
  null,
  new Set(["https://example.com/html-canonical"]),
  { contentChecks: false },
  {},
);
assert.equal(evidencePage.canonical, "https://example.com/html-canonical");
assert.equal(evidencePage.canonicalDeclarations.length, 3);
for (const type of [
  "canonical_invalid",
  "canonical_multiple",
  "canonical_conflict",
  "canonical_header_mismatch",
  "alternate_duplicate_language",
  "alternate_duplicate_target",
  "alternate_self_missing",
]) {
  assert.equal(evidencePage.issues.some((issue) => issue.type === type), true, type);
}

console.log("scan-runner-tests-passed");
