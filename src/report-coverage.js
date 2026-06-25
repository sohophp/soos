export function buildReportCoverage(report, context = {}) {
  const sitemapUrlCount = Number(report?.summary?.urlCount) || (report?.pages || []).length || 0;
  const scannedUrlCount = (report?.pages || []).length;
  const discoveredUrlCount = Number(report?.summary?.discoveredUrlCount) || (report?.discoveredPages || []).length || 0;
  const inspectionCandidateCount = Number(context.inspectionCandidateCount) || 0;
  const inspectionCheckedCount = Number(context.inspectionCheckedCount) || (context.inspectionResults || []).filter((item) => item?.ok).length;
  const gscConnected = Boolean(context.gscConnected || context.gscStatus?.configured);
  const pageSpeedUsed = Boolean(context.pageSpeedUsed || report?.pageSpeedResults?.length);
  const cruxUsed = Boolean(context.cruxUsed || report?.cruxResults?.length);
  const internalCrawlEnabled = Boolean(report?.options?.internalCrawl);
  const truncated = Boolean(report?.truncation?.truncated);
  const limitations = [];
  const cannotConclude = [];

  if (truncated) {
    limitations.push("The scan hit a configured sitemap, URL, or internal discovery limit.");
    cannotConclude.push("Do not treat missing findings as proof that the unscanned URL set is healthy.");
  }
  if (!internalCrawlEnabled) {
    limitations.push("Recursive internal discovery was not enabled.");
    cannotConclude.push("Do not conclude that sitemap pages are reachable from the homepage unless link graph data exists.");
  }
  if (!gscConnected) {
    limitations.push("Google Search Console data was not connected for this report.");
    cannotConclude.push("Do not label issues as Google-confirmed without URL Inspection or Search Analytics evidence.");
  }
  if (!inspectionCheckedCount) {
    limitations.push("URL Inspection has not checked representative URLs for this report.");
    cannotConclude.push("Do not claim full-site Google indexing status from local scan data alone.");
  } else if (inspectionCandidateCount && inspectionCheckedCount < inspectionCandidateCount) {
    limitations.push("URL Inspection covers only a subset of candidate URLs.");
    cannotConclude.push("Do not generalize inspected URL results to every URL in the sitemap.");
  }
  if (!pageSpeedUsed) {
    limitations.push("PageSpeed Insights was not run.");
    cannotConclude.push("Do not infer Lighthouse lab performance or SEO audit status from lightweight HTML signals.");
  }
  if (!cruxUsed) {
    limitations.push("CrUX field data was not loaded.");
    cannotConclude.push("Do not infer real-user Core Web Vitals from this report.");
  }

  const trustSignals = [
    scannedUrlCount > 0 ? "local_scan" : "",
    report?.robots?.found ? "robots_txt" : "",
    report?.sitemaps?.length ? "sitemap_xml" : "",
    internalCrawlEnabled ? "internal_links" : "",
    gscConnected ? "search_console" : "",
    inspectionCheckedCount ? "url_inspection_sample" : "",
    pageSpeedUsed ? "pagespeed" : "",
    cruxUsed ? "crux" : "",
  ].filter(Boolean);

  let trustLevel = "limited";
  if (gscConnected && inspectionCheckedCount && !truncated) trustLevel = "strong";
  else if (scannedUrlCount && !truncated) trustLevel = "moderate";

  return {
    site: report?.input?.siteRootUrl || report?.input?.originalUrl || "",
    scannedAt: report?.scannedAt || "",
    scannedUrlCount,
    sitemapUrlCount,
    discoveredUrlCount,
    truncated,
    internalCrawlEnabled,
    gscConnected,
    inspectionCheckedCount,
    inspectionCandidateCount,
    pageSpeedUsed,
    cruxUsed,
    trustLevel,
    trustSignals,
    limitations,
    cannotConclude,
  };
}
