import assert from "node:assert/strict";
import {
  analyzeRobots,
  detectInputUrls,
  detectSitemapKind,
  extractAlternates,
  extractCanonical,
  extractH1Count,
  extractHtmlLang,
  extractInternalLinks,
  extractMetaContent,
  extractTitle,
  hasNoindex,
  locs,
  parseRobots,
  robotsDecision,
  tags,
} from "../server/scan-parsers.js";

assert.deepEqual(detectInputUrls("https://example.com/docs/", {}), {
  inputType: "site",
  siteRootUrl: "https://example.com/docs/",
  sitemapUrl: "https://example.com/docs/sitemap.xml",
  robotsUrl: "https://example.com/robots.txt",
});
assert.equal(
  detectInputUrls("https://example.com/docs/sitemap.xml", { robotsSource: "sitemap-directory" }).robotsUrl,
  "https://example.com/docs/robots.txt",
);
assert.equal(detectInputUrls("https://example.com/robots.txt", {}).inputType, "robots");

const sitemapXml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/a?x=1&amp;y=2</loc></url>
  <url><loc>https://example.com/b</loc></url>
</urlset>`;
assert.equal(detectSitemapKind(sitemapXml), "urlset");
assert.deepEqual(locs(sitemapXml), [
  "https://example.com/a?x=1&y=2",
  "https://example.com/b",
]);
assert.equal(tags("<root><item>one</item><item>two</item></root>", "item").length, 2);
assert.equal(detectSitemapKind("<sitemapindex></sitemapindex>"), "sitemapindex");
assert.equal(detectSitemapKind("<html></html>"), "unknown");

const robots = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/public$
Sitemap: https://example.com/sitemap.xml
`);
assert.equal(robots.groups.length, 1);
assert.equal(robots.sitemaps.length, 1);
const blockedDecision = robotsDecision(robots.groups, "https://example.com/private/page");
assert.equal(blockedDecision.allowed, false);
assert.equal(blockedDecision.path, "/private/page");
assert.deepEqual(blockedDecision.matchedRules.map((rule) => rule.pattern), ["/private/"]);
assert.equal(robotsDecision(robots.groups, "https://example.com/private/public").allowed, true);
assert.equal(robotsDecision(robots.groups, "https://example.com/private/public/more").allowed, false);
const robotsAnalysis = analyzeRobots(
  robots,
  "https://example.com/robots.txt",
  "https://example.com/sitemap.xml",
);
assert.equal(robotsAnalysis.fullBlock, false);
assert.equal(robotsAnalysis.issues.length, 0);

const blockedAnalysis = analyzeRobots(
  parseRobots("User-agent: Googlebot\nDisallow: /"),
  "https://example.com/robots.txt",
  "https://example.com/sitemap.xml",
);
assert.equal(blockedAnalysis.fullBlock, true);
assert.equal(blockedAnalysis.issues.some((issue) => issue.type === "robots_full_block"), true);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <title> Test &amp; Page </title>
  <meta name="description" content="Description">
  <meta name="robots" content="index, noindex">
  <link rel="canonical" href="/canonical">
  <link rel="alternate" hreflang="en" href="/en">
</head>
<body>
  <h1>First</h1><h1><span>Second</span></h1>
  <a href="/inside">Inside</a>
  <a href="https://www.example.com/www">WWW</a>
  <a href="https://outside.example/page">Outside</a>
  <a href="/inside#fragment">Duplicate</a>
</body>
</html>`;
assert.equal(extractTitle(html), "Test &amp; Page");
assert.equal(extractMetaContent(html, "description"), "Description");
assert.equal(extractCanonical(html, "https://example.com/page"), "https://example.com/canonical");
assert.equal(extractHtmlLang(html), "zh-CN");
assert.equal(extractH1Count(html), 2);
assert.equal(hasNoindex(html), true);
assert.deepEqual(extractAlternates(html, "https://example.com/page"), [{
  hreflang: "en",
  href: "https://example.com/en",
  rawHref: "/en",
}]);
assert.deepEqual(extractInternalLinks(html, "https://example.com/page"), [
  "https://example.com/inside",
  "https://www.example.com/www",
]);

console.log("scan-parser-tests-passed");
