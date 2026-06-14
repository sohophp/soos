import { uniqueGscRows } from "./gsc-summary.js";
import {
  analyzeUrlVariantGroup,
  comparisonUrl,
  urlVariantFamily,
} from "./url-policy.js";

export function normalizeVariantUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

export function buildUrlSetFindings(report, gscRows, inspectionResults, copy) {
  const comparisonPolicy = {
    queryPolicy: report?.options?.urlQueryPolicy || "preserve",
    trailingSlashPolicy: report?.options?.trailingSlashPolicy || "preserve",
  };
  const normalizeSetUrl = (value) => comparisonUrl(value, comparisonPolicy);
  const pages = report?.pages || [];
  const scannedPages = [...pages, ...(report?.discoveredPages || [])];
  const hasInternalLinkData = scannedPages.some((page) => Array.isArray(page.internalLinks));
  const sitemapUrls = new Map();
  const internalUrls = new Map(
    (report?.discoveredPages || []).flatMap((page) => [page.url, ...(page.internalLinks || [])])
      .map((url) => [normalizeSetUrl(url), url])
      .filter(([key]) => key),
  );
  const inboundSources = new Map();
  const sourceUrls = new Map();
  const addSourceUrl = (value, source) => {
    const url = normalizeVariantUrl(value);
    if (!url) return;
    if (!sourceUrls.has(url)) sourceUrls.set(url, new Set());
    sourceUrls.get(url).add(source);
  };

  for (const page of pages) {
    const pageUrl = normalizeSetUrl(page.url);
    if (pageUrl) sitemapUrls.set(pageUrl, page.url);
    addSourceUrl(page.url, copy.sourceSitemap);
    for (const link of page.internalLinks || []) {
      const linkUrl = normalizeSetUrl(link);
      if (!linkUrl) continue;
      internalUrls.set(linkUrl, link);
      addSourceUrl(link, copy.sourceInternal);
      if (pageUrl !== linkUrl) {
        if (!inboundSources.has(linkUrl)) inboundSources.set(linkUrl, new Set());
        inboundSources.get(linkUrl).add(pageUrl);
      }
    }
  }

  const findings = [];
  const addFinding = (type, url, source, detail, severity = "warning") => {
    findings.push({ type, url, source, detail, severity });
  };

  if (hasInternalLinkData) {
    for (const [key, url] of internalUrls) {
      if (!sitemapUrls.has(key)) addFinding("internal_missing_sitemap", url, copy.sourceInternal, copy.internalMissingSitemap);
    }
  }

  for (const row of uniqueGscRows(gscRows)) {
    const url = row.page || row.key;
    const key = normalizeSetUrl(url);
    if (!key) continue;
    addSourceUrl(url, copy.sourceGsc);
    if (!sitemapUrls.has(key)) {
      addFinding(
        "gsc_missing_sitemap",
        url,
        copy.sourceGsc,
        `${row.clicks || 0} ${copy.clicks} / ${row.impressions || 0} ${copy.impressions}`,
        (row.impressions || 0) > 0 ? "warning" : "notice",
      );
    }
  }

  if (hasInternalLinkData) {
    for (const [key, url] of sitemapUrls) {
      const inboundCount = inboundSources.get(key)?.size || 0;
      if (!inboundCount) addFinding("sitemap_orphan", url, copy.sourceSitemap, `0 ${copy.inboundLinks}`);
    }
  }

  for (const item of inspectionResults || []) {
    addSourceUrl(item.url, copy.sourceGoogle);
    if (item.ok && !item.sitemap?.length) {
      addFinding("google_missing_sitemap", item.url, copy.sourceGoogle, copy.googleMissingSitemap, "notice");
    }
    if (item.ok && !item.referringUrls?.length) {
      addFinding("google_missing_referrer", item.url, copy.sourceGoogle, copy.googleMissingReferrer, "notice");
    }
  }

  const variantGroups = new Map();
  for (const [url, sources] of sourceUrls) {
    const family = urlVariantFamily(url);
    if (!family) continue;
    if (!variantGroups.has(family)) variantGroups.set(family, []);
    variantGroups.get(family).push({ url, sources: [...sources] });
  }
  for (const variants of variantGroups.values()) {
    if (variants.length < 2) continue;
    const diagnosis = analyzeUrlVariantGroup(variants.map((variant) => variant.url));
    if (!diagnosis?.reasons.length) continue;
    const reasonLabels = {
      protocol: copy.variantProtocol,
      hostname: copy.variantHostname,
      path_case: copy.variantPathCase,
      default_document: copy.variantDefaultDocument,
      trailing_slash: copy.variantTrailingSlash,
      query_order: copy.variantQueryOrder,
      tracking_query: copy.variantTrackingQuery,
      pagination_query: copy.variantPaginationQuery,
      functional_query: copy.variantFunctionalQuery,
      unknown_query: copy.variantUnknownQuery,
    };
    const detail = `${diagnosis.reasons.map((reason) => reasonLabels[reason] || reason).join(", ")}: ${variants
      .slice(0, 6)
      .map((variant) => variant.url)
      .join(" | ")}`;
    addFinding(`url_variant_${diagnosis.classification}`, variants[0].url, copy.sourceVariants, detail, diagnosis.severity);
  }

  const severityOrder = { critical: 0, warning: 1, notice: 2 };
  return findings.sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) || a.url.localeCompare(b.url),
  );
}

export function buildUrlSetCsvRows(findings, typeLabels) {
  return [
    ["type", "severity", "url", "source", "detail"],
    ...findings.map((item) => [
      typeLabels[item.type] || item.type,
      item.severity,
      item.url,
      item.source,
      item.detail,
    ]),
  ];
}
