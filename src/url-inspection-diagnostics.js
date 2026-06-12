import { buildGscRowMap, uniqueGscRows } from "./gsc-summary.js";
import { normalizeReportUrl } from "./url-policy.js";

export function buildUrlAlignmentRows(report, inspectionResults, copy) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  return (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url)) || {};
    const submittedUrl = inspection.url || page.url || "";
    const fetchedUrl = page.finalUrl || submittedUrl;
    const htmlCanonical = page.canonical || "";
    const googleCanonical = inspection.googleCanonical || "";
    const userCanonical = inspection.userCanonical || "";
    const submittedKey = normalizeReportUrl(submittedUrl);
    const fetchedKey = normalizeReportUrl(fetchedUrl);
    const htmlKey = normalizeReportUrl(htmlCanonical);
    const googleKey = normalizeReportUrl(googleCanonical);
    const userKey = normalizeReportUrl(userCanonical);
    const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
    const blocked = ["robots_disallow", "noindex", "http_error", "fetch_failed", "canonical_blocked"]
      .some((type) => issueTypes.has(type));
    const verdict = String(inspection.verdict || "").toUpperCase();
    let state = "unknown";
    let severity = "notice";
    let label = copy.unknownAlignment;

    if (!inspection.ok) {
      state = "inspection_failed";
      severity = "critical";
      label = copy.inspectionFailed;
    } else if (blocked) {
      state = "blocked";
      severity = "critical";
      label = copy.crawlBlocked;
    } else if (googleKey && googleKey !== submittedKey && googleKey !== fetchedKey && googleKey !== htmlKey) {
      state = "google_canonical_differs";
      severity = "warning";
      label = copy.googleCanonicalDiffers;
    } else if (submittedKey && fetchedKey && submittedKey !== fetchedKey) {
      state = "redirect";
      severity = "warning";
      label = copy.submittedRedirects;
    } else if (htmlKey && fetchedKey && htmlKey !== fetchedKey) {
      state = "html_canonical_differs";
      severity = "warning";
      label = copy.htmlCanonicalDiffers;
    } else if (verdict === "PASS") {
      state = "aligned_indexed";
      severity = "good";
      label = copy.alignedIndexed;
    } else if (
      fetchedKey
      && (!htmlKey || htmlKey === fetchedKey)
      && (!userKey || userKey === fetchedKey)
      && (!googleKey || googleKey === fetchedKey)
    ) {
      state = "aligned_not_indexed";
      severity = "critical";
      label = copy.alignedNotIndexed;
    }

    return {
      submittedUrl,
      fetchedUrl,
      htmlCanonical,
      userCanonical,
      googleCanonical,
      coverageState: inspection.coverageState || inspection.error || "",
      state,
      severity,
      label,
    };
  });
}

export function classifyIndexCoverage(inspection, page, gsc, copy, now = Date.now()) {
  const coverage = String(inspection.coverageState || "").toLowerCase();
  const robots = String(inspection.robotsTxtState || "").toLowerCase();
  const indexing = String(inspection.indexingState || "").toLowerCase();
  const fetchState = String(inspection.pageFetchState || "").toLowerCase();
  const verdict = String(inspection.verdict || "").toUpperCase();
  const issueTypes = new Set((page?.issues || []).map((issue) => issue.type));
  const submittedKey = normalizeReportUrl(inspection.url);
  const localCanonicalKey = normalizeReportUrl(page?.canonical || inspection.userCanonical || "");
  const googleCanonicalKey = normalizeReportUrl(inspection.googleCanonical || "");
  const canonicalAgreement = Boolean(
    googleCanonicalKey
    && localCanonicalKey
    && googleCanonicalKey === localCanonicalKey
    && googleCanonicalKey !== submittedKey
  );
  let reason = "other";
  let reasonLabel = copy.reasonOther;
  let disposition = "needs_fix";
  let dispositionLabel = copy.needsFix;

  if (!inspection.ok) {
    reason = "inspection_error";
    reasonLabel = copy.inspectionFailed;
  } else if (verdict === "PASS") {
    reason = "indexed";
    reasonLabel = copy.indexedState;
    disposition = "indexed";
    dispositionLabel = copy.indexedState;
  } else if (
    robots.includes("blocked")
    || robots.includes("disallow")
    || indexing.includes("blocked")
    || indexing.includes("noindex")
    || ["robots_disallow", "noindex", "canonical_blocked"].some((type) => issueTypes.has(type))
  ) {
    reason = "blocked";
    reasonLabel = copy.reasonBlocked;
  } else if (coverage.includes("soft 404")) {
    reason = "soft_404";
    reasonLabel = copy.reasonSoft404;
  } else if (
    coverage.includes("server error")
    || coverage.includes("redirect error")
    || (
      fetchState
      && !fetchState.includes("unspecified")
      && !["successful", "page_fetch_state_successful"].includes(fetchState)
    )
    || ["fetch_failed", "http_error"].some((type) => issueTypes.has(type))
  ) {
    reason = "fetch_problem";
    reasonLabel = copy.reasonFetch;
  } else if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    reason = "discovered_not_crawled";
    reasonLabel = copy.reasonDiscovered;
  } else if (coverage.includes("crawled") && coverage.includes("not indexed")) {
    reason = "crawled_not_indexed";
    reasonLabel = copy.reasonCrawled;
  } else if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    reason = "duplicate";
    reasonLabel = copy.reasonDuplicate;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  } else if (googleCanonicalKey && googleCanonicalKey !== submittedKey) {
    reason = "canonical_conflict";
    reasonLabel = copy.reasonCanonical;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  }

  const impressions = gsc?.impressions || 0;
  const clicks = gsc?.clicks || 0;
  const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
  const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.floor((now - lastCrawlMs) / 86400000) : null;
  const stale = crawlAgeDays != null && crawlAgeDays > 90;
  let priority = "low";
  if (disposition === "needs_fix" && (clicks > 0 || impressions >= 100 || reason === "blocked" || reason === "fetch_problem")) {
    priority = "high";
  } else if (disposition === "needs_fix" || impressions > 0 || stale) {
    priority = "medium";
  }

  return {
    url: inspection.url,
    reason,
    reasonLabel,
    disposition,
    dispositionLabel,
    priority,
    impressions,
    clicks,
    position: gsc?.position ?? null,
    lastCrawlTime: inspection.lastCrawlTime || "",
    crawlAgeDays,
    stale,
    coverageState: inspection.coverageState || inspection.error || "",
    googleCanonical: inspection.googleCanonical || "",
  };
}

export function buildIndexCoverageRows(report, inspectionResults, gscRows, copy, now = Date.now()) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  return (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url));
    const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
      || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
    return classifyIndexCoverage(inspection, page, gsc, copy, now);
  });
}

export function buildFreshnessRows(inspectionResults, gscRows, now = Date.now()) {
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  return (inspectionResults || [])
    .filter((item) => item.ok && String(item.verdict || "").toUpperCase() === "PASS")
    .map((inspection) => {
      const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
        || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
      const impressions = gsc?.impressions || 0;
      const clicks = gsc?.clicks || 0;
      if (!impressions && !clicks) return null;
      const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
      const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.max(0, Math.floor((now - lastCrawlMs) / 86400000)) : null;
      const demand = clicks > 0 || impressions >= 1000 ? "high" : impressions >= 100 ? "medium" : "low";
      const demandScore = clicks * 1000 + impressions;
      let freshness = "fresh";
      if (crawlAgeDays == null) freshness = "unknown";
      else if (crawlAgeDays > 180) freshness = "critical";
      else if (crawlAgeDays > 90) freshness = "stale";
      else if (crawlAgeDays > 30) freshness = "watch";
      return {
        url: inspection.url,
        googleCanonical: inspection.googleCanonical || "",
        lastCrawlTime: inspection.lastCrawlTime || "",
        crawlAgeDays,
        freshness,
        demand,
        demandScore,
        impressions,
        clicks,
        position: gsc?.position ?? null,
      };
    })
    .filter(Boolean);
}

export function sortFreshnessRows(rows, sortBy = "risk") {
  const riskRank = { critical: 4, stale: 3, unknown: 2, watch: 1, fresh: 0 };
  return [...(rows || [])].sort((a, b) => {
    if (sortBy === "demand") return b.demandScore - a.demandScore || (b.crawlAgeDays || 0) - (a.crawlAgeDays || 0);
    if (sortBy === "age") return (b.crawlAgeDays ?? -1) - (a.crawlAgeDays ?? -1) || b.demandScore - a.demandScore;
    return riskRank[b.freshness] - riskRank[a.freshness] || b.demandScore - a.demandScore;
  });
}

export function diagnoseInspectionResult(item) {
  const diagnoses = [];
  const coverage = String(item.coverageState || "").toLowerCase();
  const indexing = String(item.indexingState || "").toLowerCase();
  const robots = String(item.robotsTxtState || "").toLowerCase();
  const fetchState = String(item.pageFetchState || "").toLowerCase();
  const verdict = String(item.verdict || "").toUpperCase();
  const mobileVerdict = String(item.mobileVerdict || "").toUpperCase();
  const richVerdict = String(item.richResultsVerdict || "").toUpperCase();
  if (!item.ok) {
    diagnoses.push({
      type: "inspection_error",
      severity: "critical",
      title: "Inspection request failed",
      detail: item.error || "Google did not return URL Inspection data for this URL.",
      action: "Check the API connection, property access, and whether this URL belongs to the configured property.",
    });
    return diagnoses;
  }
  if (verdict === "FAIL" || coverage.includes("not indexed") || coverage.includes("excluded")) {
    diagnoses.push({
      type: "not_indexed",
      severity: "critical",
      title: "Not indexed by Google",
      detail: item.coverageState || "Google did not report this URL as indexed.",
      action: "Review crawlability, canonical tags, content quality, internal links, and sitemap inclusion.",
    });
  }
  if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    diagnoses.push({
      type: "discovered_not_crawled",
      severity: "warning",
      title: "Discovered, not crawled yet",
      detail: item.coverageState,
      action: "Strengthen internal links, verify crawl budget signals, keep the URL in sitemap, and make sure the server responds quickly.",
    });
  }
  if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    diagnoses.push({
      type: "duplicate_or_alternate",
      severity: "warning",
      title: "Google treats this as duplicate or alternate",
      detail: item.coverageState,
      action: "Confirm the canonical target is intentional. If this URL should rank, make canonical, sitemap, internal links, and content unique.",
    });
  }
  if (coverage.includes("soft 404")) {
    diagnoses.push({
      type: "soft_404",
      severity: "critical",
      title: "Soft 404 detected",
      detail: item.coverageState,
      action: "Add substantial useful content or return a real 404/410 if the page should not exist.",
    });
  }
  if (robots.includes("disallow") || robots.includes("blocked")) {
    diagnoses.push({
      type: "robots_blocked",
      severity: "critical",
      title: "Blocked by robots.txt",
      detail: item.robotsTxtState || "Google reports a robots.txt blocker.",
      action: "Remove the blocking robots.txt rule if this page should be indexed.",
    });
  }
  if (fetchState && !fetchState.includes("unspecified") && !["successful", "page_fetch_state_successful"].includes(fetchState)) {
    diagnoses.push({
      type: "fetch_problem",
      severity: "warning",
      title: "Google fetch has problems",
      detail: item.pageFetchState || "Google reported a non-successful fetch state.",
      action: "Check server availability, redirects, status codes, firewall rules, and rendering stability.",
    });
  }
  if (item.googleCanonical && item.userCanonical && normalizeReportUrl(item.googleCanonical) !== normalizeReportUrl(item.userCanonical)) {
    diagnoses.push({
      type: "canonical_mismatch",
      severity: "warning",
      title: "Google selected a different canonical",
      detail: `Google: ${item.googleCanonical}`,
      action: "Align canonical tags, internal links, redirects, and sitemap URLs around the preferred canonical.",
    });
  }
  if (!item.sitemap?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "not_seen_in_sitemap",
      severity: "notice",
      title: "Google did not report sitemap discovery",
      detail: "URL Inspection did not include a sitemap source for this URL.",
      action: "Keep the canonical URL in the submitted sitemap and ensure the sitemap is discoverable from robots.txt.",
    });
  }
  if (!item.referringUrls?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "no_referrers",
      severity: "notice",
      title: "No referring URLs reported",
      detail: "Google did not report internal or external referrers for this URL.",
      action: "Add internal links from relevant indexed pages so Google can discover and prioritize the URL.",
    });
  }
  if (mobileVerdict && mobileVerdict !== "PASS") {
    diagnoses.push({
      type: "mobile_usability",
      severity: "warning",
      title: "Mobile usability issue",
      detail: item.mobileVerdict,
      action: "Review mobile usability issues in Search Console and fix layout, tap target, and viewport problems.",
    });
  }
  if (richVerdict && richVerdict !== "PASS" && richVerdict !== "VERDICT_UNSPECIFIED") {
    diagnoses.push({
      type: "rich_results",
      severity: "notice",
      title: "Rich results need review",
      detail: item.richResultsVerdict,
      action: "Validate structured data with Google's rich results tooling and fix invalid detected items.",
    });
  }
  if (indexing && indexing !== "indexing_allowed" && indexing !== "allowed") {
    diagnoses.push({
      type: "indexing_state",
      severity: "notice",
      title: "Indexing state needs review",
      detail: item.indexingState || "Google returned a non-standard indexing state.",
      action: "Compare this state with meta robots, canonical signals, and crawl diagnostics.",
    });
  }
  return diagnoses;
}
