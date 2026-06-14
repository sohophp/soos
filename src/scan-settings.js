export const DEFAULT_SCAN_SETTINGS = Object.freeze({
  sitemapUrl: "",
  contentChecks: false,
  directoryRobots: false,
  performanceChecks: false,
  backgroundMode: false,
  internalCrawl: false,
  urlQueryPolicy: "preserve",
  trailingSlashPolicy: "preserve",
});

export function buildAuditRequest(settings = DEFAULT_SCAN_SETTINGS) {
  return {
    sitemapUrl: settings.sitemapUrl || "",
    options: {
      contentChecks: Boolean(settings.contentChecks),
      performanceChecks: Boolean(settings.performanceChecks),
      backgroundMode: Boolean(settings.backgroundMode),
      internalCrawl: Boolean(settings.internalCrawl),
      urlQueryPolicy: settings.urlQueryPolicy || "preserve",
      trailingSlashPolicy: settings.trailingSlashPolicy || "preserve",
      robotsSource: settings.directoryRobots ? "sitemap-directory" : "root",
      proxyEnabled: false,
    },
  };
}
