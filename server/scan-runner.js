import { ProxyAgent } from "undici";
import { enqueueInternalLinks, internalCrawlKey } from "../src/internal-crawl.js";
import {
  analyzeRobots,
  detectInputUrls,
  detectSitemapKind,
  extractAlternates,
  extractCanonical,
  extractCanonicalDeclarations,
  extractH1Count,
  extractHtmlLang,
  extractInternalLinks,
  extractMetaContent,
  extractTitle,
  hasNoindex,
  hasNoindexHeader,
  locs,
  normalizeUrl,
  parseRobots,
  robotsDecision,
  unique,
} from "./scan-parsers.js";
import { inspectJsonLd } from "./structured-data.js";
import {
  addAlternateReciprocityIssues,
  addDuplicateContentIssues,
  addIssue,
  buildBacklog,
  buildExecutiveSummary,
  buildStatusFlags,
  calculateHealthScore,
  classifyGoogleReasons,
  summarizeInternationalSignals,
  summarizeRobotsImpact,
  summarizeSitemapSignals,
} from "./scan-diagnostics.js";

const MAX_SITEMAPS = 30;
const MAX_URLS = 250;
const BACKGROUND_MAX_URLS = 2000;
const INTERNAL_CRAWL_MAX_URLS = 100;
const BACKGROUND_INTERNAL_CRAWL_MAX_URLS = 500;
const INTERNAL_CRAWL_MAX_DEPTH = 2;
const PAGE_CONCURRENCY = 5;
const PAGE_CHECKPOINT_BATCH_SIZE = 10;

export function createScanRunner({ fetchText, jobStore, proxyAllowed = () => process.env.SOOS_ALLOW_PROXY === "1" }) {
  const waitForJob = jobStore.wait;
  const saveAuditCheckpoint = jobStore.saveCheckpoint;
  async function collectSitemaps(startUrls, fetchContext, maxUrls = MAX_URLS) {
    const queue = Array.isArray(startUrls) ? [...startUrls] : [startUrls];
    const seen = new Set();
    const sitemapReports = [];
    const pageUrls = [];
    let urlLimitReached = false;
    let sitemapLimitReached = false;
    while (queue.length && sitemapReports.length < MAX_SITEMAPS && pageUrls.length < maxUrls) {
      const sitemapUrl = queue.shift();
      if (!sitemapUrl || seen.has(sitemapUrl)) continue;
      seen.add(sitemapUrl);
      try {
        const fetched = await fetchText(sitemapUrl, fetchContext);
        const kind = detectSitemapKind(fetched.text);
        const foundLocs = locs(fetched.text);
        const issues = fetched.ok ? [] : [{ severity: "critical", type: "sitemap_http_error", message: `HTTP ${fetched.status}` }];
        if (kind === "sitemapindex") {
          for (const loc of foundLocs) {
            if (seen.size + queue.length < MAX_SITEMAPS) queue.push(loc);
            else sitemapLimitReached = true;
          }
        } else if (kind === "urlset") {
          for (const loc of foundLocs) {
            if (pageUrls.length < maxUrls) pageUrls.push(loc);
            else urlLimitReached = true;
          }
        } else {
          issues.push({ severity: "critical", type: "sitemap_unknown", message: "Could not identify sitemapindex or urlset" });
        }
        sitemapReports.push({ url: sitemapUrl, status: fetched.status, kind, locCount: foundLocs.length, issues });
      } catch (error) {
        sitemapReports.push({
          url: sitemapUrl,
          status: null,
          kind: "error",
          locCount: 0,
          issues: [{ severity: "critical", type: "sitemap_fetch_failed", message: String(error.message || error) }],
        });
      }
    }
    if (queue.length) sitemapLimitReached = true;
    return {
      sitemapReports,
      pageUrls: unique(pageUrls).slice(0, maxUrls),
      truncated: urlLimitReached || sitemapLimitReached,
      urlLimitReached,
      sitemapLimitReached,
    };
  }

  async function collectSitemapsWithProgress(startUrls, fetchContext, onProgress, job, maxUrls = MAX_URLS) {
    const queue = Array.isArray(startUrls) ? [...startUrls] : [startUrls];
    const seen = new Set();
    const sitemapReports = [];
    const pageUrls = [];
    let urlLimitReached = false;
    let sitemapLimitReached = false;

    while (queue.length && sitemapReports.length < MAX_SITEMAPS && pageUrls.length < maxUrls) {
      await waitForJob(job);
      const sitemapUrl = queue.shift();
      if (!sitemapUrl || seen.has(sitemapUrl)) continue;
      seen.add(sitemapUrl);

      onProgress?.({
        processedSitemaps: sitemapReports.length,
        discoveredSitemaps: Math.max(seen.size + queue.length, 1),
        processedUrls: 0,
        totalUrls: pageUrls.length,
      });

      try {
        const fetched = await fetchText(sitemapUrl, fetchContext);
        const kind = detectSitemapKind(fetched.text);
        const foundLocs = locs(fetched.text);
        const issues = fetched.ok ? [] : [{ severity: "critical", type: "sitemap_http_error", message: `HTTP ${fetched.status}` }];
        if (kind === "sitemapindex") {
          for (const loc of foundLocs) {
            if (seen.size + queue.length < MAX_SITEMAPS) queue.push(loc);
            else sitemapLimitReached = true;
          }
        } else if (kind === "urlset") {
          for (const loc of foundLocs) {
            if (pageUrls.length < maxUrls) pageUrls.push(loc);
            else urlLimitReached = true;
          }
        } else {
          issues.push({ severity: "critical", type: "sitemap_unknown", message: "Could not identify sitemapindex or urlset" });
        }
        sitemapReports.push({ url: sitemapUrl, status: fetched.status, kind, locCount: foundLocs.length, issues });
      } catch (error) {
        sitemapReports.push({
          url: sitemapUrl,
          status: null,
          kind: "error",
          locCount: 0,
          issues: [{ severity: "critical", type: "sitemap_fetch_failed", message: String(error.message || error) }],
        });
      }

      onProgress?.({
        processedSitemaps: sitemapReports.length,
        discoveredSitemaps: Math.max(seen.size + queue.length, sitemapReports.length),
        processedUrls: 0,
        totalUrls: pageUrls.length,
      });
    }

    if (queue.length) sitemapLimitReached = true;
    return {
      sitemapReports,
      pageUrls: unique(pageUrls).slice(0, maxUrls),
      truncated: urlLimitReached || sitemapLimitReached,
      urlLimitReached,
      sitemapLimitReached,
    };
  }

  function inspectPerformanceSignals(html, response) {
    const countMatches = (pattern) => (html.match(pattern) || []).length;
    const htmlBytes = Buffer.byteLength(html || "", "utf8");
    const scriptCount = countMatches(/<script\b/gi);
    const stylesheetCount = countMatches(/<link\b[^>]*rel=["'][^"']*stylesheet/gi);
    const imageCount = countMatches(/<img\b/gi);
    const preloadCount = countMatches(/<link\b[^>]*rel=["'][^"']*preload/gi);
    const ttfbMs = response.durationMs || null;
    return {
      ttfbMs,
      htmlBytes,
      scriptCount,
      stylesheetCount,
      imageCount,
      preloadCount,
    };
  }

  function addPerformanceIssues(issues, signals) {
    if (signals.ttfbMs && signals.ttfbMs > 2500) {
      addIssue(issues, "warning", "perf_ttfb_slow", "TTFB looks slow", `${signals.ttfbMs}ms`);
    }
    if (signals.htmlBytes > 500000) {
      addIssue(issues, "notice", "perf_html_large", "HTML document is large", `${Math.round(signals.htmlBytes / 1024)}KB`);
    }
    if (signals.scriptCount > 30) {
      addIssue(issues, "notice", "perf_many_scripts", "Many script tags found", `${signals.scriptCount} scripts`);
    }
    if (signals.stylesheetCount > 12) {
      addIssue(issues, "notice", "perf_many_stylesheets", "Many stylesheet tags found", `${signals.stylesheetCount} stylesheets`);
    }
    if (signals.imageCount > 80) {
      addIssue(issues, "notice", "perf_many_images", "Many images found in HTML", `${signals.imageCount} images`);
    }
  }
  async function inspectPage(url, robots, sitemapUrlSet, options, fetchContext, job) {
    await waitForJob(job);
    const issues = [];
    const robotDecision = robots ? robotsDecision(robots.groups, url) : null;
    if (robotDecision && !robotDecision.allowed) {
      addIssue(issues, "critical", "robots_disallow", "Blocked by robots.txt for Googlebot", `${robotDecision.rule.type}: ${robotDecision.rule.pattern} wins for ${robotDecision.path}; matched: ${robotDecision.matchedRules.map((rule) => `${rule.type}:${rule.pattern}`).join(" > ")}`);
    }

    let response;
    try {
      response = await fetchText(url, fetchContext);
    } catch (error) {
      addIssue(issues, "critical", "fetch_failed", "Could not fetch URL", String(error.message || error));
      return { url, status: null, finalUrl: null, issues };
    }

    if (response.status >= 400) addIssue(issues, "critical", "http_error", `HTTP ${response.status}`, response.finalUrl);
    if (response.redirectChain?.length) {
      const chainDetail = response.redirectChain
        .map((hop) => `${hop.status} ${hop.url} -> ${hop.targetUrl || hop.location || "invalid"}`)
        .join(" | ");
      addIssue(issues, "warning", "redirect", `${response.redirectChain.length} redirect(s) before final URL`, chainDetail);
      if (response.redirectChain.length > 1) {
        addIssue(issues, "warning", "redirect_chain", "Multiple redirect hops", chainDetail);
      }
      if (response.redirectLoop) addIssue(issues, "critical", "redirect_loop", "Redirect loop detected", chainDetail);
      if (response.redirectInvalidLocation) addIssue(issues, "critical", "redirect_invalid_location", "Redirect has an invalid Location", chainDetail);
      if (response.redirectLimitReached) addIssue(issues, "critical", "redirect_limit", "Redirect chain exceeded 10 hops", chainDetail);
      if (response.redirectCrossHost) addIssue(issues, "warning", "redirect_cross_host", "Redirect chain changes hostname", chainDetail);
      if (response.redirectProtocolDowngrade) addIssue(issues, "critical", "redirect_https_downgrade", "Redirect chain downgrades HTTPS to HTTP", chainDetail);
    }
    if (response.redirectLoop || response.redirectInvalidLocation || response.redirectLimitReached) {
      return {
        url,
        status: response.status,
        finalUrl: response.finalUrl,
        redirectChain: response.redirectChain,
        issues,
      };
    }

    if (!/html/i.test(response.contentType) && !/<html[\s>]/i.test(response.text)) {
      addIssue(issues, "warning", "not_html", "URL does not look like HTML", response.contentType || "unknown content type");
      return {
        url,
        status: response.status,
        finalUrl: response.finalUrl,
        redirectChain: response.redirectChain,
        issues,
      };
    }

    const metaNoindex = hasNoindex(response.text);
    const headerNoindex = hasNoindexHeader(response.xRobotsTag);
    if (metaNoindex || headerNoindex) {
      const sources = [
        metaNoindex ? "robots/googlebot meta tag" : "",
        headerNoindex ? `X-Robots-Tag: ${response.xRobotsTag}` : "",
      ].filter(Boolean);
      addIssue(issues, "critical", "noindex", "Page has noindex directive", sources.join(" | "));
    }

    let title = null;
    let description = null;
    let h1Count = null;
    let lang = null;
    let viewport = null;
    let structuredData = null;

    if (options.contentChecks) {
      title = extractTitle(response.text);
      if (!title) addIssue(issues, "warning", "title_missing", "Missing title tag");
      else if (title.length < 15) addIssue(issues, "notice", "title_short", "Title looks too short", `${title.length} characters`);
      else if (title.length > 65) addIssue(issues, "notice", "title_long", "Title may be too long for search snippets", `${title.length} characters`);

      description = extractMetaContent(response.text, "description");
      if (!description) addIssue(issues, "warning", "description_missing", "Missing meta description");
      else if (description.length < 50) addIssue(issues, "notice", "description_short", "Meta description looks too short", `${description.length} characters`);
      else if (description.length > 170) addIssue(issues, "notice", "description_long", "Meta description may be too long", `${description.length} characters`);

      h1Count = extractH1Count(response.text);
      if (h1Count === 0) addIssue(issues, "warning", "h1_missing", "Missing H1 heading");
      else if (h1Count > 1) addIssue(issues, "notice", "h1_multiple", "Multiple H1 headings found", `${h1Count} H1 tags`);

      lang = extractHtmlLang(response.text);
      if (!lang) addIssue(issues, "notice", "html_lang_missing", "HTML lang attribute is missing");

      viewport = extractMetaContent(response.text, "viewport");
      if (!viewport) addIssue(issues, "warning", "viewport_missing", "Missing viewport meta tag");

      structuredData = inspectJsonLd(response.text, response.finalUrl || url, title);
      if (structuredData.invalidCount > 0) {
        addIssue(issues, "warning", "structured_data_invalid", "Invalid JSON-LD structured data", `${structuredData.invalidCount} invalid block(s)`);
      }
      const structuredWarnings = structuredData.diagnostics.filter((item) => item.severity === "warning");
      const structuredNotices = structuredData.diagnostics.filter((item) => item.severity === "notice");
      if (structuredWarnings.length) {
        addIssue(
          issues,
          "warning",
          "structured_data_validation",
          "Structured data has required-field or graph errors",
          `${structuredWarnings.length} issue(s): ${structuredWarnings.slice(0, 3).map((item) => `${item.type}.${item.property || item.code}`).join(", ")}`,
        );
      }
      if (structuredNotices.length) {
        addIssue(
          issues,
          "notice",
          "structured_data_recommended",
          "Structured data can be improved",
          `${structuredNotices.length} recommendation(s): ${structuredNotices.slice(0, 3).map((item) => `${item.type}.${item.property || item.code}`).join(", ")}`,
        );
      }
    }

    const pageUrl = response.finalUrl || url;
    const canonicalDeclarations = extractCanonicalDeclarations(response.text, pageUrl, response.linkHeader);
    const canonical = extractCanonical(response.text, pageUrl, response.linkHeader);
    const validCanonicalDeclarations = canonicalDeclarations.filter((item) => item.href);
    const uniqueCanonicals = [...new Set(validCanonicalDeclarations.map((item) => item.href))];
    const htmlCanonicals = [...new Set(validCanonicalDeclarations.filter((item) => item.source === "html").map((item) => item.href))];
    const headerCanonicals = [...new Set(validCanonicalDeclarations.filter((item) => item.source === "http_header").map((item) => item.href))];
    const invalidCanonicals = canonicalDeclarations.filter((item) => !item.href);
    if (invalidCanonicals.length) {
      addIssue(
        issues,
        "warning",
        "canonical_invalid",
        "Canonical declaration has an invalid or missing HTTP(S) URL",
        invalidCanonicals.map((item) => `${item.source}:${item.rawHref || "(empty)"}`).join(" | "),
      );
    }
    if (canonicalDeclarations.length > 1) {
      addIssue(
        issues,
        uniqueCanonicals.length > 1 ? "warning" : "notice",
        "canonical_multiple",
        "Multiple canonical declarations found",
        canonicalDeclarations.map((item) => `${item.source}:${item.href || item.rawHref || "(empty)"}`).join(" | "),
      );
    }
    if (uniqueCanonicals.length > 1) {
      addIssue(issues, "warning", "canonical_conflict", "Canonical declarations point to different URLs", uniqueCanonicals.join(" | "));
    }
    if (htmlCanonicals.length && headerCanonicals.length && !htmlCanonicals.some((item) => headerCanonicals.includes(item))) {
      addIssue(
        issues,
        "warning",
        "canonical_header_mismatch",
        "HTML and HTTP Link header canonicals disagree",
        `html:${htmlCanonicals.join(", ")} | http_header:${headerCanonicals.join(", ")}`,
      );
    }
    if (!canonical && !canonicalDeclarations.length) {
      addIssue(issues, "warning", "canonical_missing", "Missing canonical link");
    } else if (canonical) {
      if (new URL(canonical).origin !== new URL(url).origin) addIssue(issues, "warning", "canonical_cross_host", "Canonical points to another host", canonical);
      if (canonical !== normalizeUrl(response.finalUrl || url)) addIssue(issues, "notice", "canonical_mismatch", "Canonical differs from fetched URL", canonical);
      if (robots && !robotsDecision(robots.groups, canonical).allowed) addIssue(issues, "critical", "canonical_blocked", "Canonical URL is blocked by robots.txt", canonical);
      if (!sitemapUrlSet.has(canonical)) addIssue(issues, "notice", "canonical_not_in_sitemap", "Canonical URL is not in sitemap result set", canonical);
    }

    const alternates = extractAlternates(response.text, response.finalUrl || url);
    const internalLinks = extractInternalLinks(response.text, response.finalUrl || url);
    const alternatesByLanguage = new Map();
    const alternatesByTarget = new Map();
    for (const alternate of alternates) {
      if (!alternate.href) addIssue(issues, "warning", "alternate_invalid", "Alternate hreflang has invalid href", alternate.rawHref);
      else if (robots && !robotsDecision(robots.groups, alternate.href).allowed) {
        addIssue(issues, "critical", "alternate_blocked", "Alternate URL is blocked by robots.txt", alternate.href);
      }
      if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$|^x-default$/i.test(alternate.hreflang)) {
        addIssue(issues, "warning", "alternate_hreflang_invalid", "Alternate has suspicious hreflang value", alternate.hreflang);
      }
      const languageKey = alternate.hreflang.toLowerCase();
      if (!alternatesByLanguage.has(languageKey)) alternatesByLanguage.set(languageKey, []);
      alternatesByLanguage.get(languageKey).push(alternate.href || alternate.rawHref || "(empty)");
      if (alternate.href) {
        if (!alternatesByTarget.has(alternate.href)) alternatesByTarget.set(alternate.href, []);
        alternatesByTarget.get(alternate.href).push(alternate.hreflang);
      }
    }
    for (const [language, targets] of alternatesByLanguage) {
      if (targets.length > 1) {
        addIssue(issues, "warning", "alternate_duplicate_language", "Multiple hreflang declarations use the same language", `${language}: ${targets.join(" | ")}`);
      }
    }
    for (const [target, languages] of alternatesByTarget) {
      if (languages.length > 1) {
        addIssue(issues, "notice", "alternate_duplicate_target", "Multiple hreflang declarations point to the same URL", `${target}: ${languages.join(", ")}`);
      }
    }
    if (alternates.length) {
      const expectedSelf = normalizeUrl(canonical || response.finalUrl || url);
      if (expectedSelf && !alternates.some((alternate) => normalizeUrl(alternate.href) === expectedSelf)) {
        addIssue(issues, "warning", "alternate_self_missing", "Hreflang set has no self-referencing URL", expectedSelf);
      }
    }

    return {
      url,
      status: response.status,
      finalUrl: response.finalUrl,
      redirectChain: response.redirectChain,
      title,
      description,
      h1Count,
      lang,
      viewport,
      structuredData,
      canonical,
      canonicalDeclarations,
      alternates,
      internalLinks,
      issues,
    };
  }

  async function mapLimit(items, limit, worker, job) {
    const results = [];
    let index = 0;
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
          await waitForJob(job);
          const currentIndex = index++;
          results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
      }),
    );
    return results;
  }

  async function audit(sitemapUrl, options = {}, onProgress, job = null, execution = {}) {
    const auditOptions = {
      contentChecks: Boolean(options.contentChecks),
      performanceChecks: Boolean(options.performanceChecks),
      backgroundMode: Boolean(options.backgroundMode),
      maxUrls: options.backgroundMode ? BACKGROUND_MAX_URLS : MAX_URLS,
      internalCrawl: Boolean(options.internalCrawl),
      internalCrawlMaxUrls: options.backgroundMode ? BACKGROUND_INTERNAL_CRAWL_MAX_URLS : INTERNAL_CRAWL_MAX_URLS,
      internalCrawlMaxDepth: INTERNAL_CRAWL_MAX_DEPTH,
      urlQueryPolicy: ["preserve", "strip_tracking", "drop_all"].includes(options.urlQueryPolicy)
        ? options.urlQueryPolicy
        : "preserve",
      trailingSlashPolicy: ["preserve", "remove", "add"].includes(options.trailingSlashPolicy)
        ? options.trailingSlashPolicy
        : "preserve",
      robotsSource: options.robotsSource === "sitemap-directory" ? "sitemap-directory" : "root",
      proxyEnabled: Boolean(options.proxyEnabled),
      proxyUrl: typeof options.proxyUrl === "string" && options.proxyUrl.trim() ? options.proxyUrl.trim() : "http://127.0.0.1:7890",
    };
    const normalizedInput = normalizeUrl(sitemapUrl);
    if (!normalizedInput || !/^https?:\/\//i.test(normalizedInput)) throw new Error("Please enter a valid http(s) URL.");
    const startedAt = Date.now();
    const detected = detectInputUrls(normalizedInput, auditOptions);
    const robotsUrl = detected.robotsUrl;
    const checkpointKey = JSON.stringify({ normalizedInput, auditOptions });
    const savedCheckpoint = job?.checkpoint?.key === checkpointKey ? job.checkpoint : null;
    const fetchContext = {};
    if (auditOptions.proxyEnabled) {
      if (!proxyAllowed()) {
        throw new Error("Proxy fetching is disabled. Set SOOS_ALLOW_PROXY=1 only in a trusted local environment.");
      }
      try {
        fetchContext.dispatcher = new ProxyAgent(auditOptions.proxyUrl);
      } catch (error) {
        throw new Error(`Invalid proxy URL: ${auditOptions.proxyUrl} (${String(error.message || error)})`);
      }
    }
    let robots;
    let sitemapReports;
    let pageUrls;
    let truncated;
    let urlLimitReached;
    let sitemapLimitReached;
    let sitemapStartUrls = Array.isArray(savedCheckpoint?.sitemapStartUrls) && savedCheckpoint.sitemapStartUrls.length
      ? savedCheckpoint.sitemapStartUrls
      : [detected.sitemapUrl];
    if (
      ["inspecting", "discovering"].includes(savedCheckpoint?.phase)
      && Array.isArray(savedCheckpoint.pageUrls)
      && Array.isArray(savedCheckpoint.sitemapReports)
    ) {
      robots = savedCheckpoint.robots;
      sitemapReports = savedCheckpoint.sitemapReports;
      pageUrls = savedCheckpoint.pageUrls;
      truncated = Boolean(savedCheckpoint.truncated);
      urlLimitReached = Boolean(savedCheckpoint.urlLimitReached);
      sitemapLimitReached = Boolean(savedCheckpoint.sitemapLimitReached);
    } else {
      await waitForJob(job);
      onProgress?.({
        stage: "preparing",
        label: "Preparing scan",
        percent: 8,
        processedUrls: 0,
        totalUrls: 0,
        processedSitemaps: 0,
        discoveredSitemaps: 1,
      });
      try {
        await waitForJob(job);
        const fetchedRobots = await fetchText(robotsUrl, fetchContext);
        const parsedRobots = fetchedRobots.ok ? parseRobots(fetchedRobots.text) : { groups: [], sitemaps: [] };
        const declaredSitemaps = unique(parsedRobots.sitemaps.map((value) => normalizeUrl(value)).filter(Boolean));
        if (detected.inputType !== "sitemap" && declaredSitemaps.length) {
          sitemapStartUrls = declaredSitemaps;
        }
        robots = {
          url: robotsUrl,
          status: fetchedRobots.status,
          found: fetchedRobots.ok,
          groups: parsedRobots.groups,
          sitemaps: parsedRobots.sitemaps,
          contentPreview: fetchedRobots.ok ? fetchedRobots.text.slice(0, 4000) : "",
          analysis: fetchedRobots.ok ? analyzeRobots(parsedRobots, robotsUrl, sitemapStartUrls[0]) : null,
        };
      } catch (error) {
        robots = { url: robotsUrl, status: null, found: false, groups: [], sitemaps: [], error: String(error.message || error), analysis: null };
      }

      const sitemapCollection = await collectSitemapsWithProgress(
        sitemapStartUrls,
        fetchContext,
        (progress) => {
          const sitemapBase = progress.discoveredSitemaps ? Math.min(progress.processedSitemaps / progress.discoveredSitemaps, 1) : 0;
          onProgress?.({
            stage: "fetching",
            label: "Fetching sitemap and robots.txt",
            percent: Math.min(15 + Math.round(sitemapBase * 25), 40),
            ...progress,
          });
        },
        job,
        auditOptions.maxUrls,
      );
      ({ sitemapReports, pageUrls, truncated, urlLimitReached, sitemapLimitReached } = sitemapCollection);
      await saveAuditCheckpoint(job, {
        key: checkpointKey,
        phase: "inspecting",
        robots,
        sitemapStartUrls,
        sitemapReports,
        pageUrls,
        truncated,
        urlLimitReached,
        sitemapLimitReached,
        pages: [],
      });
    }
    const sitemapUrlSet = new Set(pageUrls.map((url) => normalizeUrl(url)).filter(Boolean));
    const restoredPages = ["inspecting", "discovering"].includes(savedCheckpoint?.phase) && Array.isArray(savedCheckpoint.pages)
      ? savedCheckpoint.pages
      : [];
    const checkpointPages = restoredPages.filter((page) => page.source !== "internal-crawl").slice(0, pageUrls.length);
    const inspectedPages = [...checkpointPages];
    let inspectedCount = inspectedPages.length;
    let processedBatches = 0;
    await waitForJob(job);
    onProgress?.({
      stage: "inspecting",
      label: "Inspecting URLs",
      percent: pageUrls.length ? Math.min(45 + Math.round((inspectedCount / pageUrls.length) * 45), 90) : 85,
      processedUrls: inspectedCount,
      totalUrls: pageUrls.length,
      processedSitemaps: sitemapReports.length,
      discoveredSitemaps: sitemapReports.length,
    });
    for (let offset = inspectedCount; savedCheckpoint?.phase !== "discovering" && offset < pageUrls.length; offset += PAGE_CHECKPOINT_BATCH_SIZE) {
      await waitForJob(job);
      const batchUrls = pageUrls.slice(offset, offset + PAGE_CHECKPOINT_BATCH_SIZE);
      const batchPages = await mapLimit(batchUrls, PAGE_CONCURRENCY, async (url) => {
        const page = await inspectPage(url, robots.found ? robots : null, sitemapUrlSet, auditOptions, fetchContext, job);
        inspectedCount += 1;
        const urlBase = pageUrls.length ? inspectedCount / pageUrls.length : 1;
        onProgress?.({
          stage: "inspecting",
          label: "Inspecting URLs",
          percent: Math.min(45 + Math.round(urlBase * 45), 90),
          processedUrls: inspectedCount,
          totalUrls: pageUrls.length,
          processedSitemaps: sitemapReports.length,
          discoveredSitemaps: sitemapReports.length,
        });
        return { ...page, source: "sitemap", crawlDepth: 0, discoveredFrom: "" };
      }, job);
      inspectedPages.push(...batchPages);
      await saveAuditCheckpoint(job, {
        key: checkpointKey,
        phase: "inspecting",
        robots,
        sitemapReports,
        pageUrls,
        truncated,
        urlLimitReached,
        sitemapLimitReached,
        pages: inspectedPages,
      }, batchPages, Math.floor(offset / PAGE_CHECKPOINT_BATCH_SIZE));
      processedBatches += 1;
      if (
        Number.isFinite(execution.maxBatches)
        && processedBatches >= execution.maxBatches
        && inspectedPages.length < pageUrls.length
      ) {
        return {
          pending: true,
          processedUrls: inspectedPages.length,
          totalUrls: pageUrls.length,
        };
      }
    }
    const discoveredPages = restoredPages.filter((page) => page.source === "internal-crawl");
    let crawlQueue = savedCheckpoint?.phase === "discovering" && Array.isArray(savedCheckpoint.crawlQueue)
      ? savedCheckpoint.crawlQueue
      : [];
    let crawlCursor = savedCheckpoint?.phase === "discovering"
      ? Math.max(0, Number(savedCheckpoint.crawlCursor) || 0)
      : 0;
    const crawlSeen = new Set(
      savedCheckpoint?.phase === "discovering" && Array.isArray(savedCheckpoint.crawlSeen)
        ? savedCheckpoint.crawlSeen
        : pageUrls.map((url) => internalCrawlKey(url)).filter(Boolean),
    );

    if (auditOptions.internalCrawl && savedCheckpoint?.phase !== "discovering") {
      for (const page of inspectedPages) {
        enqueueInternalLinks({
          queue: crawlQueue,
          seen: crawlSeen,
          links: page.internalLinks,
          siteRootUrl: detected.siteRootUrl,
          depth: 1,
          maxDepth: auditOptions.internalCrawlMaxDepth,
          maxUrls: auditOptions.internalCrawlMaxUrls,
          discoveredFrom: page.finalUrl || page.url,
        });
      }
      await saveAuditCheckpoint(job, {
        key: checkpointKey,
        phase: "discovering",
        robots,
        sitemapReports,
        pageUrls,
        truncated,
        urlLimitReached,
        sitemapLimitReached,
        pages: inspectedPages,
        crawlQueue,
        crawlCursor,
        crawlSeen: [...crawlSeen],
      });
    }

    while (auditOptions.internalCrawl && crawlCursor < crawlQueue.length) {
      if (Number.isFinite(execution.maxBatches) && processedBatches >= execution.maxBatches) {
        return {
          pending: true,
          processedUrls: inspectedPages.length + discoveredPages.length,
          totalUrls: pageUrls.length + crawlQueue.length,
        };
      }
      await waitForJob(job);
      const batchStart = crawlCursor;
      const batchItems = crawlQueue.slice(batchStart, batchStart + PAGE_CHECKPOINT_BATCH_SIZE);
      const batchPages = await mapLimit(batchItems, PAGE_CONCURRENCY, async (item) => {
        const page = await inspectPage(item.url, robots.found ? robots : null, sitemapUrlSet, auditOptions, fetchContext, job);
        return {
          ...page,
          source: "internal-crawl",
          crawlDepth: item.depth,
          discoveredFrom: item.discoveredFrom,
        };
      }, job);
      crawlCursor += batchItems.length;
      discoveredPages.push(...batchPages);
      for (const page of batchPages) {
        enqueueInternalLinks({
          queue: crawlQueue,
          seen: crawlSeen,
          links: page.internalLinks,
          siteRootUrl: detected.siteRootUrl,
          depth: (Number(page.crawlDepth) || 0) + 1,
          maxDepth: auditOptions.internalCrawlMaxDepth,
          maxUrls: auditOptions.internalCrawlMaxUrls,
          discoveredFrom: page.finalUrl || page.url,
        });
      }
      onProgress?.({
        stage: "discovering",
        label: "Discovering internal URLs",
        percent: Math.min(90 + Math.round((crawlCursor / Math.max(crawlQueue.length, 1)) * 7), 97),
        processedUrls: inspectedPages.length + discoveredPages.length,
        totalUrls: pageUrls.length + crawlQueue.length,
        processedSitemaps: sitemapReports.length,
        discoveredSitemaps: sitemapReports.length,
      });
      await saveAuditCheckpoint(job, {
        key: checkpointKey,
        phase: "discovering",
        robots,
        sitemapReports,
        pageUrls,
        truncated,
        urlLimitReached,
        sitemapLimitReached,
        pages: [...inspectedPages, ...discoveredPages],
        crawlQueue,
        crawlCursor,
        crawlSeen: [...crawlSeen],
      }, batchPages, 100000 + Math.floor(batchStart / PAGE_CHECKPOINT_BATCH_SIZE));
      processedBatches += 1;
    }
    const pages = structuredClone(inspectedPages);
    const crawledInternalPages = structuredClone(discoveredPages);
    if (auditOptions.contentChecks) addDuplicateContentIssues(pages);
    addAlternateReciprocityIssues(pages);
    for (const page of pages) {
      page.googleReasons = classifyGoogleReasons(page);
    }
    for (const page of crawledInternalPages) {
      page.googleReasons = classifyGoogleReasons(page);
    }
    if (robots.analysis) {
      robots.analysis.blockedSummaries = summarizeRobotsImpact(pages);
    }
    const sitemapSignals = summarizeSitemapSignals(pages);
    const internationalSignals = summarizeInternationalSignals(pages);
    const backlog = buildBacklog(pages, sitemapReports);
    const issueCounts = pages.reduce(
      (counts, page) => {
        for (const issue of page.issues) counts[issue.severity] += 1;
        return counts;
      },
      { critical: 0, warning: 0, notice: 0 },
    );

    onProgress?.({
      stage: "finalizing",
      label: "Finalizing report",
      percent: 98,
      processedUrls: pageUrls.length + crawledInternalPages.length,
      totalUrls: pageUrls.length + crawledInternalPages.length,
      processedSitemaps: sitemapReports.length,
      discoveredSitemaps: sitemapReports.length,
    });

    return {
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      limits: {
        maxSitemaps: MAX_SITEMAPS,
        maxUrls: auditOptions.maxUrls,
        internalCrawlMaxUrls: auditOptions.internalCrawlMaxUrls,
        internalCrawlMaxDepth: auditOptions.internalCrawlMaxDepth,
        pageConcurrency: PAGE_CONCURRENCY,
        backgroundMode: auditOptions.backgroundMode,
      },
      truncation: {
        truncated,
        urlLimitReached,
        sitemapLimitReached,
        internalCrawlLimitReached: auditOptions.internalCrawl && crawlQueue.length >= auditOptions.internalCrawlMaxUrls,
      },
      input: {
        originalUrl: normalizedInput,
        inputType: detected.inputType,
        siteRootUrl: detected.siteRootUrl,
        sitemapUrl: sitemapStartUrls[0] || detected.sitemapUrl,
        sitemapUrls: sitemapStartUrls,
        robotsUrl: detected.robotsUrl,
      },
      options: auditOptions,
      robots: {
        url: robots.url,
        status: robots.status,
        found: robots.found,
        groupCount: robots.groups.length,
        sitemapDirectives: robots.sitemaps,
        contentPreview: robots.contentPreview,
        analysis: robots.analysis,
        error: robots.error,
      },
      summary: {
        healthScore: calculateHealthScore(pages, sitemapReports),
        sitemapCount: sitemapReports.length,
        urlCount: pageUrls.length,
        discoveredUrlCount: crawledInternalPages.length,
        affectedUrlCount: pages.filter((page) => page.issues.length).length,
        googleBlockedCount: pages.filter((page) => page.googleReasons.some((reason) => reason.severity === "critical")).length,
        issueCounts,
      },
      executiveSummary: buildExecutiveSummary({
        summary: {
          affectedUrlCount: pages.filter((page) => page.issues.length).length,
          googleBlockedCount: pages.filter((page) => page.googleReasons.some((reason) => reason.severity === "critical")).length,
        },
        backlog,
        robots,
        sitemapSignals,
        internationalSignals,
      }),
      statusFlags: buildStatusFlags({
        robots,
        sitemapSignals,
        internationalSignals,
        summary: {
          affectedUrlCount: pages.filter((page) => page.issues.length).length,
        },
      }),
      backlog,
      sitemapSignals,
      internationalSignals,
      sitemaps: sitemapReports,
      pages,
      discoveredPages: crawledInternalPages,
    };
  }


  return { audit, collectSitemaps, inspectPage };
}
