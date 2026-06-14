export function createLargeReport(pageCount = 125) {
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const number = index + 1;
    const url = `https://example.test/page-${number}`;
    const issues = number % 3 === 0
      ? [{
        type: "title_missing",
        severity: "warning",
        message: "Page title is missing.",
      }]
      : [];
    return {
      url,
      finalUrl: url,
      status: 200,
      contentType: "text/html",
      title: issues.length ? "" : `Example page ${number}`,
      description: `Description for example page ${number}.`,
      h1Count: 1,
      lang: "en",
      viewport: true,
      canonical: url,
      alternates: [],
      redirectChain: [],
      structuredData: {
        count: 0,
        validCount: 0,
        invalidCount: 0,
        items: [],
      },
      googleReasons: [],
      issues,
    };
  });
  const warningCount = pages.filter((page) => page.issues.length).length;
  return {
    scannedAt: "2026-06-13T08:00:00.000Z",
    input: {
      inputType: "website",
      originalUrl: "https://example.test/",
      siteRootUrl: "https://example.test/",
      sitemapUrl: "https://example.test/sitemap.xml",
      robotsUrl: "https://example.test/robots.txt",
    },
    options: {
      pageContent: true,
      performance: false,
      internalCrawl: false,
      background: true,
      queryPolicy: "preserve",
      trailingSlashPolicy: "preserve",
    },
    limits: {
      maxUrls: 2000,
      maxSitemaps: 50,
    },
    truncation: {
      truncated: false,
      internalCrawlLimitReached: false,
    },
    summary: {
      healthScore: 82,
      urlCount: pageCount,
      discoveredUrlCount: 0,
      affectedUrlCount: warningCount,
      googleBlockedCount: 0,
      issueCounts: {
        critical: 0,
        warning: warningCount,
        notice: 0,
      },
    },
    executiveSummary: {
      headline: `${warningCount} pages need metadata cleanup.`,
      topActions: ["Add concise titles to affected pages."],
    },
    statusFlags: [],
    backlog: [],
    pages,
    discoveredPages: [],
    sitemaps: [{
      url: "https://example.test/sitemap.xml",
      kind: "urlset",
      locCount: pageCount,
    }],
    sitemapUrls: pages.map((page) => page.url),
    sitemapSignals: [],
    internationalSignals: [],
    robots: {
      url: "https://example.test/robots.txt",
      found: false,
      error: "Not found",
      groupCount: 0,
      sitemapDirectives: [],
    },
  };
}
