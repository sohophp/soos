import { normalizeUrl } from './scan-parsers.js';

export function summarizeRobotsImpact(pages) {
  const bucket = new Map();

  const add = (ruleText, scope, url, detail = "") => {
    const key = `${scope}::${ruleText}`;
    if (!bucket.has(key)) {
      bucket.set(key, {
        rule: ruleText,
        scope,
        count: 0,
        sampleUrls: [],
        affectedUrls: [],
        details: new Set(),
      });
    }
    const entry = bucket.get(key);
    entry.count += 1;
    if (entry.sampleUrls.length < 5) entry.sampleUrls.push(url);
    if (entry.affectedUrls.length < 500 && !entry.affectedUrls.includes(url)) entry.affectedUrls.push(url);
    if (detail) entry.details.add(detail);
  };

  for (const page of pages) {
    for (const issue of page.issues) {
      if (issue.type === "robots_disallow") {
        add(issue.detail || "robots rule", "submitted_url", page.url, issue.message);
      }
      if (issue.type === "canonical_blocked") {
        add("canonical target blocked", "canonical_target", page.url, issue.detail || page.canonical || "");
      }
      if (issue.type === "alternate_blocked") {
        add("alternate target blocked", "alternate_target", page.url, issue.detail || "");
      }
    }
  }

  return [...bucket.values()]
    .map((entry) => ({
      rule: entry.rule,
      scope: entry.scope,
      count: entry.count,
      sampleUrls: entry.sampleUrls,
      affectedUrls: entry.affectedUrls,
      details: [...entry.details].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count);
}

export function summarizeSitemapSignals(pages) {
  const definitions = [
    {
      key: "redirect",
      title: "Redirect URLs still in sitemap",
      scope: "submitted_url",
      sample: (page) => page.finalUrl || page.url,
    },
    {
      key: "noindex",
      title: "Noindex URLs still in sitemap",
      scope: "submitted_url",
      sample: (page) => page.url,
    },
    {
      key: "canonical_mismatch",
      title: "Submitted URLs canonicalize elsewhere",
      scope: "canonical_target",
      sample: (page) => page.canonical || "",
    },
    {
      key: "canonical_not_in_sitemap",
      title: "Canonical targets missing from sitemap",
      scope: "canonical_target",
      sample: (page) => page.canonical || "",
    },
    {
      key: "http_error",
      title: "Broken URLs still in sitemap",
      scope: "submitted_url",
      sample: (page) => page.finalUrl || page.url,
    },
  ];

  return definitions
    .map((definition) => {
      const matched = pages.filter((page) => page.issues.some((issue) => issue.type === definition.key));
      return {
        key: definition.key,
        title: definition.title,
        scope: definition.scope,
        count: matched.length,
        sampleUrls: matched.slice(0, 5).map((page) => page.url),
        details: matched
          .map((page) => definition.sample(page))
          .filter(Boolean)
          .slice(0, 5),
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function addAlternateReciprocityIssues(pages) {
  const pageIndex = new Map();

  for (const page of pages) {
    for (const candidate of [page.url, page.finalUrl]) {
      const normalized = normalizeUrl(candidate);
      if (normalized) pageIndex.set(normalized, page);
    }
  }

  for (const page of pages) {
    const sourceTargets = new Set([normalizeUrl(page.url), normalizeUrl(page.finalUrl)].filter(Boolean));
    for (const alternate of page.alternates || []) {
      const alternateUrl = normalizeUrl(alternate.href);
      if (!alternateUrl) continue;
      const targetPage = pageIndex.get(alternateUrl);
      if (!targetPage) continue;

      const returnsLink = (targetPage.alternates || []).some((targetAlternate) => {
        const targetHref = normalizeUrl(targetAlternate.href);
        return targetHref && sourceTargets.has(targetHref);
      });
      if (!returnsLink) {
        addIssue(
          page.issues,
          "warning",
          "alternate_not_reciprocal",
          "Alternate page does not return a matching hreflang link",
          alternateUrl,
        );
      }

      const targetSelf = normalizeUrl(targetPage.finalUrl || targetPage.url);
      const targetCanonical = normalizeUrl(targetPage.canonical || targetPage.finalUrl || targetPage.url);
      if (targetCanonical && targetSelf && targetCanonical !== targetSelf) {
        addIssue(
          page.issues,
          "warning",
          "alternate_target_canonical_mismatch",
          "Alternate target canonicalizes to a different URL",
          `${alternateUrl} -> ${targetCanonical}`,
        );
      }
    }
  }
}

export function summarizeInternationalSignals(pages) {
  const definitions = [
    {
      key: "alternate_not_reciprocal",
      title: "Alternate pages do not link back",
      scope: "alternate_target",
      sample: (page) => page.alternates?.map((item) => item.href).filter(Boolean).slice(0, 2) || [],
    },
    {
      key: "alternate_target_canonical_mismatch",
      title: "Alternate targets canonicalize elsewhere",
      scope: "alternate_target",
      sample: (page) => page.canonical || "",
    },
    {
      key: "alternate_hreflang_invalid",
      title: "Invalid hreflang values",
      scope: "alternate_target",
      sample: (page) => page.alternates?.map((item) => item.hreflang).filter(Boolean).slice(0, 2) || [],
    },
  ];

  return definitions
    .map((definition) => {
      const matched = pages.filter((page) => page.issues.some((issue) => issue.type === definition.key));
      return {
        key: definition.key,
        title: definition.title,
        scope: definition.scope,
        count: matched.length,
        sampleUrls: matched.slice(0, 5).map((page) => page.url),
        details: matched
          .flatMap((page) => {
            const value = definition.sample(page);
            return Array.isArray(value) ? value : [value];
          })
          .filter(Boolean)
          .slice(0, 5),
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function buildExecutiveSummary({ summary, backlog, robots, sitemapSignals, internationalSignals }) {
  const headlineParts = [];
  const primaryActions = [];

  if (summary.googleBlockedCount > 0) {
    headlineParts.push(`${summary.googleBlockedCount} URL(s) have strong crawl or indexing blockers`);
  } else if (summary.affectedUrlCount > 0) {
    headlineParts.push(`${summary.affectedUrlCount} URL(s) need cleanup, but no hard blockers were found`);
  } else {
    headlineParts.push("No obvious crawl or indexing blockers were found in the scanned URLs");
  }

  if (robots?.analysis?.blockedSummaries?.length) {
    headlineParts.push("robots.txt is actively blocking part of the submitted set");
    primaryActions.push("Review robots.txt rules blocking submitted, canonical, or alternate URLs.");
  }

  if (sitemapSignals?.some((item) => item.key === "redirect" || item.key === "noindex" || item.key === "http_error")) {
    headlineParts.push("the sitemap is still submitting non-indexable URLs");
    primaryActions.push("Replace redirected, broken, or noindex URLs in the sitemap with final indexable URLs.");
  }

  if (sitemapSignals?.some((item) => item.key === "canonical_mismatch" || item.key === "canonical_not_in_sitemap")) {
    headlineParts.push("canonical signals do not line up cleanly with the sitemap");
    primaryActions.push("Align sitemap entries with self-canonical final URLs.");
  }

  if (internationalSignals?.length) {
    headlineParts.push("hreflang relationships need cleanup");
    primaryActions.push("Fix hreflang return links and alternate targets that canonicalize elsewhere.");
  }

  if (!primaryActions.length && backlog?.length) {
    primaryActions.push(backlog[0].action);
  }

  return {
    headline: headlineParts.join("; "),
    topActions: [...new Set(primaryActions)].slice(0, 3),
  };
}

export function buildStatusFlags({ robots, sitemapSignals, internationalSignals, summary }) {
  const flags = [];

  if (robots?.analysis?.blockedSummaries?.length) {
    flags.push({ key: "robots_blocked", label: "Robots blocked", severity: "critical" });
  }

  if (sitemapSignals?.some((item) => ["redirect", "noindex", "http_error"].includes(item.key))) {
    flags.push({ key: "sitemap_misaligned", label: "Sitemap misaligned", severity: "warning" });
  }

  if (sitemapSignals?.some((item) => ["canonical_mismatch", "canonical_not_in_sitemap"].includes(item.key))) {
    flags.push({ key: "canonical_conflict", label: "Canonical conflict", severity: "warning" });
  }

  if (internationalSignals?.length) {
    flags.push({ key: "international_mismatch", label: "International mismatch", severity: "warning" });
  }

  if (!flags.length && summary?.affectedUrlCount > 0) {
    flags.push({ key: "cleanup_needed", label: "Cleanup needed", severity: "notice" });
  }

  if (!flags.length) {
    flags.push({ key: "healthy", label: "No obvious blockers", severity: "ok" });
  }

  return flags;
}

export function addIssue(issues, severity, type, message, detail = null) {
  issues.push({ severity, type, message, detail });
}

export function classifyGoogleReasons(page) {
  const issueTypes = new Set(page.issues.map((issue) => issue.type));
  const reasons = [];
  const add = (code, label, detail, severity = "warning") => {
    reasons.push({ code, label, detail, severity });
  };

  if (issueTypes.has("robots_disallow")) {
    add("blocked_by_robots", "Blocked by robots.txt", "Googlebot is not allowed to crawl this submitted URL.", "critical");
  }
  if (issueTypes.has("noindex")) {
    add("submitted_noindex", "Submitted URL marked noindex", "The URL appears in the sitemap but tells search engines not to index it.", "critical");
  }
  if (issueTypes.has("http_error") || page.status >= 400) {
    add("submitted_http_error", `Submitted URL returns HTTP ${page.status || "error"}`, "Google cannot index URLs that return client/server errors.", "critical");
  }
  if (issueTypes.has("fetch_failed")) {
    add("fetch_failed", "Submitted URL could not be fetched", "Network, DNS, timeout, or TLS errors can stop Google from discovering page content.", "critical");
  }
  if (issueTypes.has("canonical_blocked")) {
    add("canonical_blocked", "Canonical URL is blocked", "Google may ignore the canonical target because robots.txt blocks it.", "critical");
  }
  if (issueTypes.has("canonical_mismatch") || issueTypes.has("canonical_cross_host")) {
    add(
      "not_selected_as_canonical",
      "Submitted URL not selected as canonical",
      "The sitemap URL points to a page whose canonical points elsewhere, so Google may index the canonical instead.",
      "warning",
    );
  }
  if (issueTypes.has("redirect")) {
    add("submitted_redirects", "Submitted URL redirects", "Sitemaps should contain final canonical URLs, not redirected URLs.", "warning");
  }
  if (["redirect_loop", "redirect_invalid_location", "redirect_limit", "redirect_https_downgrade"].some((type) => issueTypes.has(type))) {
    add("redirect_failure", "Redirect chain cannot resolve safely", "Google may be unable or unwilling to reach a stable HTTPS destination.", "critical");
  }
  if (issueTypes.has("not_html")) {
    add("not_html", "Submitted URL is not an HTML page", "Non-HTML resources are usually not indexed like normal landing pages.", "warning");
  }
  if (issueTypes.has("canonical_missing")) {
    add("canonical_missing", "Canonical is missing", "Google may choose a different canonical when duplicate signals are unclear.", "notice");
  }
  if (issueTypes.has("alternate_blocked") || issueTypes.has("alternate_invalid") || issueTypes.has("alternate_hreflang_invalid")) {
    add("hreflang_problem", "Alternate/hreflang has issues", "Incorrect alternate tags can weaken international targeting and canonical clustering.", "notice");
  }

  return reasons;
}

export function buildBacklog(pages, sitemaps) {
  const definitions = [
    {
      key: "robots_disallow",
      title: "Unblock sitemap URLs in robots.txt",
      severity: "critical",
      action: "Allow Googlebot to crawl submitted URLs, or remove blocked URLs from the sitemap.",
    },
    {
      key: "noindex",
      title: "Remove noindex from submitted URLs",
      severity: "critical",
      action: "Only keep indexable URLs in the sitemap.",
    },
    {
      key: "http_error",
      title: "Fix 4xx/5xx sitemap URLs",
      severity: "critical",
      action: "Return 200 for canonical landing pages, or remove broken URLs from the sitemap.",
    },
    {
      key: "fetch_failed",
      title: "Fix fetch failures",
      severity: "critical",
      action: "Check DNS, TLS, firewall, bot protection, and server timeout behavior.",
    },
    {
      key: "redirect_loop",
      title: "Fix redirect loops",
      severity: "critical",
      action: "Make every submitted URL resolve to one stable final destination without revisiting an earlier URL.",
    },
    {
      key: "redirect_invalid_location",
      title: "Fix invalid redirect destinations",
      severity: "critical",
      action: "Return a valid absolute or relative HTTP(S) Location value.",
    },
    {
      key: "redirect_limit",
      title: "Shorten excessive redirect chains",
      severity: "critical",
      action: "Resolve submitted URLs within a small number of redirect hops.",
    },
    {
      key: "redirect_https_downgrade",
      title: "Remove HTTPS to HTTP redirects",
      severity: "critical",
      action: "Keep the entire redirect chain on HTTPS.",
    },
    {
      key: "redirect_chain",
      title: "Shorten multi-hop redirects",
      severity: "warning",
      action: "Redirect submitted URLs directly to their final canonical destination.",
    },
    {
      key: "redirect_cross_host",
      title: "Review cross-host redirects",
      severity: "warning",
      action: "Confirm hostname changes are intentional and use the preferred host in sitemap and internal links.",
    },
    {
      key: "canonical_blocked",
      title: "Unblock canonical targets",
      severity: "critical",
      action: "Canonical URLs must be crawlable by Googlebot.",
    },
    {
      key: "canonical_mismatch",
      title: "Align sitemap URLs with canonical URLs",
      severity: "warning",
      action: "Use the final self-canonical URL in the sitemap.",
    },
    {
      key: "canonical_cross_host",
      title: "Review cross-host canonicals",
      severity: "warning",
      action: "Only canonicalize across hosts when that is intentional.",
    },
    {
      key: "redirect",
      title: "Replace redirected sitemap URLs",
      severity: "warning",
      action: "Submit destination URLs instead of redirecting URLs.",
    },
    {
      key: "canonical_missing",
      title: "Add canonical tags",
      severity: "warning",
      action: "Add a self-referencing canonical to indexable pages.",
    },
    {
      key: "alternate_blocked",
      title: "Unblock alternate URLs",
      severity: "warning",
      action: "hreflang alternates should be crawlable and indexable.",
    },
    {
      key: "title_missing",
      title: "Add missing title tags",
      severity: "warning",
      action: "Every indexable page should have a unique, descriptive title.",
    },
    {
      key: "description_missing",
      title: "Add missing meta descriptions",
      severity: "warning",
      action: "Descriptions do not directly control crawling, but they improve snippet quality and audit clarity.",
    },
    {
      key: "h1_missing",
      title: "Add missing H1 headings",
      severity: "warning",
      action: "Use one clear H1 that matches the page intent.",
    },
    {
      key: "viewport_missing",
      title: "Add viewport meta tags",
      severity: "warning",
      action: "Mobile-friendly pages should declare viewport behavior.",
    },
    {
      key: "structured_data_invalid",
      title: "Fix invalid JSON-LD structured data",
      severity: "warning",
      action: "Invalid structured data can prevent rich result eligibility.",
    },
    {
      key: "title_duplicate",
      title: "Make duplicated titles unique",
      severity: "notice",
      action: "Unique titles help Google distinguish pages with similar content.",
    },
    {
      key: "description_duplicate",
      title: "Make duplicated meta descriptions unique",
      severity: "notice",
      action: "Unique descriptions make duplicate clusters easier to diagnose.",
    },
  ];

  const backlog = definitions
    .map((definition) => {
      const urls = pages
        .filter((page) => page.issues.some((issue) => issue.type === definition.key))
        .map((page) => page.url);
      return { ...definition, count: urls.length, sampleUrls: urls.slice(0, 5) };
    })
    .filter((item) => item.count > 0);

  const badSitemaps = sitemaps.filter((sitemap) => sitemap.issues?.length);
  if (badSitemaps.length) {
    backlog.unshift({
      key: "sitemap_errors",
      title: "Fix sitemap files that cannot be parsed or fetched",
      severity: "critical",
      action: "Google needs readable sitemapindex/urlset XML files before URL-level signals matter.",
      count: badSitemaps.length,
      sampleUrls: badSitemaps.slice(0, 5).map((sitemap) => sitemap.url),
    });
  }

  return backlog.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, notice: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count;
  });
}

export function calculateHealthScore(pages, sitemaps) {
  const issuePenalty = { critical: 8, warning: 3, notice: 1 };
  const urlCount = Math.max(pages.length, 1);
  const pagePenalty = pages.reduce(
    (total, page) => total + page.issues.reduce((sum, issue) => sum + issuePenalty[issue.severity], 0),
    0,
  );
  const sitemapPenalty = sitemaps.reduce((total, sitemap) => total + (sitemap.issues?.length || 0) * 10, 0);
  const raw = 100 - Math.round((pagePenalty + sitemapPenalty) / urlCount);
  return Math.max(0, Math.min(100, raw));
}

export function addDuplicateContentIssues(pages) {
  const addDuplicates = (field, issueType, message) => {
    const groups = new Map();
    for (const page of pages) {
      const value = (page[field] || "").trim().toLowerCase();
      if (!value) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(page);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const sample = group.slice(0, 4).map((page) => page.url).join(" | ");
      for (const page of group) {
        addIssue(page.issues, "notice", issueType, message, sample);
      }
    }
  };

  addDuplicates("title", "title_duplicate", "Duplicate title across sitemap URLs");
  addDuplicates("description", "description_duplicate", "Duplicate meta description across sitemap URLs");
}
