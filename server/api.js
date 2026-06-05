import http from "node:http";
import { URL, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ProxyAgent } from "undici";
import { neon } from "@neondatabase/serverless";

const PORT = Number(process.env.SOOS_API_PORT || 4177);
const USER_AGENT = "soos/0.1 SEO audit";
const MAX_SITEMAPS = 30;
const MAX_URLS = 250;
const BACKGROUND_MAX_URLS = 2000;
const PAGE_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 15000;
const JOB_TTL_MS = 1000 * 60 * 60 * 4;
const jobs = new Map();
const GSC_CONFIG_PATH = path.join(process.cwd(), ".soos-gsc.json");
const ENV_PATH = path.join(process.cwd(), ".env");
const GSC_SCOPE = "openid email profile https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const SESSION_COOKIE = "soos_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJobError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sendJson(res, status, body) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (res.soosSessionCookie) headers["Set-Cookie"] = res.soosSessionCookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, html) {
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };
  if (res.soosSessionCookie) headers["Set-Cookie"] = res.soosSessionCookie;
  res.writeHead(status, headers);
  res.end(html);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jobSnapshot(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result || null,
    error: job.error || null,
  };
}

function createJob() {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    status: "queued",
    progress: {
      stage: "queued",
      label: "Queued",
      percent: 0,
      processedUrls: 0,
      totalUrls: 0,
      processedSitemaps: 0,
      discoveredSitemaps: 0,
    },
    result: null,
    error: null,
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function cleanupJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if ((job.status === "done" || job.status === "error" || job.status === "stopped") && job.updatedAt < cutoff) {
      jobs.delete(id);
    }
  }
}

function updateJob(job, patch) {
  if (patch.status) job.status = patch.status;
  if (patch.result !== undefined) job.result = patch.result;
  if (patch.error !== undefined) job.error = patch.error;
  if (patch.progress) {
    job.progress = {
      ...job.progress,
      ...patch.progress,
    };
  }
  job.updatedAt = Date.now();
}

async function waitForJob(job) {
  while (job?.status === "paused") {
    await sleep(250);
  }
  if (job?.status === "stopped") {
    throw createJobError("JOB_STOPPED", "Audit stopped");
  }
}

function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function directoryUrl(url) {
  const copy = new URL(url.toString());
  if (!copy.pathname.endsWith("/")) {
    copy.pathname = copy.pathname.replace(/\/[^/]*$/, "/");
  }
  copy.search = "";
  copy.hash = "";
  return copy;
}

function siteRootFromInput(url) {
  const copy = new URL(url.toString());
  copy.search = "";
  copy.hash = "";
  if (!copy.pathname || copy.pathname === "/") {
    copy.pathname = "/";
    return copy;
  }
  if (!copy.pathname.endsWith("/")) copy.pathname += "/";
  return copy;
}

function detectInputUrls(inputUrl, options) {
  const url = new URL(inputUrl);
  const pathname = url.pathname.toLowerCase();
  const robotsIsInput = pathname.endsWith("/robots.txt");
  const sitemapIsInput = pathname.endsWith(".xml") || pathname.includes("sitemap");
  const inputType = robotsIsInput ? "robots" : sitemapIsInput ? "sitemap" : "site";
  const siteRoot = inputType === "site" ? siteRootFromInput(url) : directoryUrl(url);
  const sitemapUrl = inputType === "sitemap" ? url.toString() : new URL("sitemap.xml", siteRoot).toString();
  const robotsUrl =
    inputType === "robots"
      ? url.toString()
      : options.robotsSource === "sitemap-directory"
        ? new URL("robots.txt", siteRoot).toString()
        : `${url.origin}/robots.txt`;
  return {
    inputType,
    siteRootUrl: siteRoot.toString(),
    sitemapUrl,
    robotsUrl,
  };
}

function decodeXml(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tags(xml, name) {
  const out = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi");
  let match;
  while ((match = re.exec(xml))) out.push(match[1].trim());
  return out;
}

function locs(xml) {
  return unique(tags(xml, "loc").map(decodeXml));
}

function detectSitemapKind(xml) {
  if (/<sitemapindex[\s>]/i.test(xml)) return "sitemapindex";
  if (/<urlset[\s>]/i.test(xml)) return "urlset";
  return "unknown";
}

async function fetchText(url, fetchContext = {}) {
  const requestStartedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const requestOptions = {
    signal: controller.signal,
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT },
  };
  if (fetchContext.dispatcher) requestOptions.dispatcher = fetchContext.dispatcher;
  try {
    const response = await fetch(url, requestOptions);
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || "",
      durationMs: Date.now() - requestStartedAt,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || !rest.length) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: key, pattern: value });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }
  return { groups, sitemaps };
}

function analyzeRobots(parsedRobots, robotsUrl, expectedSitemapUrl) {
  const groups = parsedRobots?.groups || [];
  const sitemaps = parsedRobots?.sitemaps || [];
  const issues = [];
  const googleGroups = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || "googlebot".includes(agent) || agent.includes("googlebot")),
  );
  const fullBlock = googleGroups.some((group) =>
    group.rules.some((rule) => rule.type === "disallow" && (rule.pattern === "/" || rule.pattern === "/*")),
  );

  if (!groups.length) issues.push({ severity: "notice", type: "robots_no_rules", message: "robots.txt has no crawl rules" });
  if (!googleGroups.length) issues.push({ severity: "notice", type: "robots_no_googlebot_group", message: "No Googlebot or wildcard group found" });
  if (fullBlock) issues.push({ severity: "critical", type: "robots_full_block", message: "robots.txt blocks Googlebot from the whole site" });
  if (!sitemaps.length) {
    issues.push({ severity: "notice", type: "robots_no_sitemap_directive", message: "robots.txt has no Sitemap directive" });
  } else if (!sitemaps.some((url) => normalizeUrl(url) === normalizeUrl(expectedSitemapUrl))) {
    issues.push({
      severity: "notice",
      type: "robots_sitemap_mismatch",
      message: "robots.txt Sitemap directives do not include the detected sitemap URL",
      detail: expectedSitemapUrl,
    });
  }

  return {
    url: robotsUrl,
    groupCount: groups.length,
    googleGroupCount: googleGroups.length,
    ruleCount: groups.reduce((count, group) => count + group.rules.length, 0),
    sitemapDirectives: sitemaps,
    fullBlock,
    issues,
  };
}

function summarizeRobotsImpact(pages) {
  const bucket = new Map();

  const add = (ruleText, scope, url, detail = "") => {
    const key = `${scope}::${ruleText}`;
    if (!bucket.has(key)) {
      bucket.set(key, {
        rule: ruleText,
        scope,
        count: 0,
        sampleUrls: [],
        details: new Set(),
      });
    }
    const entry = bucket.get(key);
    entry.count += 1;
    if (entry.sampleUrls.length < 5) entry.sampleUrls.push(url);
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
      details: [...entry.details].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count);
}

function summarizeSitemapSignals(pages) {
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

function addAlternateReciprocityIssues(pages) {
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

function summarizeInternationalSignals(pages) {
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

function buildExecutiveSummary({ summary, backlog, robots, sitemapSignals, internationalSignals }) {
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

function buildStatusFlags({ robots, sitemapSignals, internationalSignals, summary }) {
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

function robotsPatternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}`);
}

function ruleMatches(pattern, pathWithQuery) {
  if (!pattern) return false;
  const cleanPattern = pattern.replace(/\$$/, "");
  const exactEnd = pattern.endsWith("$");
  const match = robotsPatternToRegExp(cleanPattern).exec(pathWithQuery);
  return Boolean(match && (!exactEnd || match[0].length === pathWithQuery.length));
}

function robotsDecision(groups, targetUrl, bot = "googlebot") {
  const url = new URL(targetUrl);
  const pathWithQuery = `${url.pathname}${url.search}`;
  const matchingGroups = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || bot.includes(agent) || agent.includes(bot)),
  );
  const groupsToUse = matchingGroups.length ? matchingGroups : groups.filter((group) => group.agents.includes("*"));
  const matchingRules = groupsToUse
    .flatMap((group) => group.rules)
    .filter((rule) => ruleMatches(rule.pattern, pathWithQuery))
    .sort((a, b) => b.pattern.length - a.pattern.length);
  const winner = matchingRules[0];
  return { allowed: !winner || winner.type === "allow", rule: winner || null };
}

function attrMap(raw) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = re.exec(raw))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function extractHead(html) {
  return /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] || html.slice(0, 50000);
}

function extractCanonical(html, baseUrl) {
  const re = /<link\b([^>]*?)>/gi;
  const head = extractHead(html);
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    if ((attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")) {
      return normalizeUrl(attrs.href, baseUrl);
    }
  }
  return null;
}

function textContent(value) {
  return (value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  return textContent(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(extractHead(html))?.[1] || "");
}

function extractMetaContent(html, nameToFind) {
  const re = /<meta\b([^>]*?)>/gi;
  const head = extractHead(html);
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    const name = (attrs.name || attrs.property || "").toLowerCase();
    if (name === nameToFind.toLowerCase()) return attrs.content || "";
  }
  return "";
}

function extractH1Count(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textContent(match[1])).filter(Boolean).length;
}

function extractHtmlLang(html) {
  const attrs = attrMap(/<html\b([^>]*)>/i.exec(html)?.[1] || "");
  return attrs.lang || "";
}

function inspectJsonLd(html) {
  const headAndBodyStart = html.slice(0, 250000);
  const re = /<script\b([^>]*?)>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let invalidCount = 0;
  let match;
  while ((match = re.exec(headAndBodyStart))) {
    const attrs = attrMap(match[1]);
    if ((attrs.type || "").toLowerCase() !== "application/ld+json") continue;
    try {
      const parsed = JSON.parse(match[2].trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        const type = value?.["@type"] || value?.["@graph"]?.map((item) => item?.["@type"]).filter(Boolean).join(", ");
        blocks.push({ type: Array.isArray(type) ? type.join(", ") : type || "unknown" });
      }
    } catch {
      invalidCount += 1;
    }
  }
  return { count: blocks.length + invalidCount, validCount: blocks.length, invalidCount, types: blocks.map((block) => block.type) };
}

function extractAlternates(html, baseUrl) {
  const re = /<link\b([^>]*?)>/gi;
  const head = extractHead(html);
  const alternates = [];
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    if (!(attrs.rel || "").toLowerCase().split(/\s+/).includes("alternate") || !attrs.hreflang) continue;
    alternates.push({ hreflang: attrs.hreflang, href: normalizeUrl(attrs.href, baseUrl), rawHref: attrs.href || "" });
  }
  return alternates;
}

function hasNoindex(html) {
  const re = /<meta\b([^>]*?)>/gi;
  const head = extractHead(html);
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    const name = (attrs.name || attrs.property || "").toLowerCase();
    if ((name === "robots" || name === "googlebot") && /(^|,|\s)noindex($|,|\s)/i.test(attrs.content || "")) return true;
  }
  return false;
}

function addIssue(issues, severity, type, message, detail = null) {
  issues.push({ severity, type, message, detail });
}

function classifyGoogleReasons(page) {
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

function buildBacklog(pages, sitemaps) {
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

function calculateHealthScore(pages, sitemaps) {
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

function addDuplicateContentIssues(pages) {
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

async function collectSitemaps(startUrl, fetchContext, maxUrls = MAX_URLS) {
  const queue = [startUrl];
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

async function collectSitemapsWithProgress(startUrl, fetchContext, onProgress, job, maxUrls = MAX_URLS) {
  const queue = [startUrl];
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
  else if (response.status >= 300) addIssue(issues, "warning", "redirect", `Redirected with HTTP ${response.status}`, response.finalUrl);

  if (!/html/i.test(response.contentType) && !/<html[\s>]/i.test(response.text)) {
    addIssue(issues, "warning", "not_html", "URL does not look like HTML", response.contentType || "unknown content type");
    return { url, status: response.status, finalUrl: response.finalUrl, issues };
  }

  if (hasNoindex(response.text)) addIssue(issues, "critical", "noindex", "Page has noindex directive", "robots/googlebot meta tag");

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

    structuredData = inspectJsonLd(response.text);
    if (structuredData.invalidCount > 0) {
      addIssue(issues, "warning", "structured_data_invalid", "Invalid JSON-LD structured data", `${structuredData.invalidCount} invalid block(s)`);
    }
  }

  const canonical = extractCanonical(response.text, response.finalUrl || url);
  if (!canonical) {
    addIssue(issues, "warning", "canonical_missing", "Missing canonical link");
  } else {
    if (new URL(canonical).origin !== new URL(url).origin) addIssue(issues, "warning", "canonical_cross_host", "Canonical points to another host", canonical);
    if (canonical !== normalizeUrl(response.finalUrl || url)) addIssue(issues, "notice", "canonical_mismatch", "Canonical differs from fetched URL", canonical);
    if (robots && !robotsDecision(robots.groups, canonical).allowed) addIssue(issues, "critical", "canonical_blocked", "Canonical URL is blocked by robots.txt", canonical);
    if (!sitemapUrlSet.has(canonical)) addIssue(issues, "notice", "canonical_not_in_sitemap", "Canonical URL is not in sitemap result set", canonical);
  }

  const alternates = extractAlternates(response.text, response.finalUrl || url);
  for (const alternate of alternates) {
    if (!alternate.href) addIssue(issues, "warning", "alternate_invalid", "Alternate hreflang has invalid href", alternate.rawHref);
    else if (robots && !robotsDecision(robots.groups, alternate.href).allowed) {
      addIssue(issues, "critical", "alternate_blocked", "Alternate URL is blocked by robots.txt", alternate.href);
    }
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$|^x-default$/i.test(alternate.hreflang)) {
      addIssue(issues, "warning", "alternate_hreflang_invalid", "Alternate has suspicious hreflang value", alternate.hreflang);
    }
  }

  return {
    url,
    status: response.status,
    finalUrl: response.finalUrl,
    title,
    description,
    h1Count,
    lang,
    viewport,
    structuredData,
    canonical,
    alternates,
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

async function audit(sitemapUrl, options = {}, onProgress, job = null) {
  const auditOptions = {
    contentChecks: Boolean(options.contentChecks),
    performanceChecks: Boolean(options.performanceChecks),
    backgroundMode: Boolean(options.backgroundMode),
    maxUrls: options.backgroundMode ? BACKGROUND_MAX_URLS : MAX_URLS,
    robotsSource: options.robotsSource === "sitemap-directory" ? "sitemap-directory" : "root",
    proxyEnabled: Boolean(options.proxyEnabled),
    proxyUrl: typeof options.proxyUrl === "string" && options.proxyUrl.trim() ? options.proxyUrl.trim() : "http://127.0.0.1:7890",
  };
  const normalizedInput = normalizeUrl(sitemapUrl);
  if (!normalizedInput || !/^https?:\/\//i.test(normalizedInput)) throw new Error("Please enter a valid http(s) URL.");
  const startedAt = Date.now();
  const detected = detectInputUrls(normalizedInput, auditOptions);
  const robotsUrl = detected.robotsUrl;
  const fetchContext = {};
  if (auditOptions.proxyEnabled) {
    try {
      fetchContext.dispatcher = new ProxyAgent(auditOptions.proxyUrl);
    } catch (error) {
      throw new Error(`Invalid proxy URL: ${auditOptions.proxyUrl} (${String(error.message || error)})`);
    }
  }
  let robots;
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
    robots = {
      url: robotsUrl,
      status: fetchedRobots.status,
      found: fetchedRobots.ok,
      groups: parsedRobots.groups,
      sitemaps: parsedRobots.sitemaps,
      contentPreview: fetchedRobots.ok ? fetchedRobots.text.slice(0, 4000) : "",
      analysis: fetchedRobots.ok ? analyzeRobots(parsedRobots, robotsUrl, detected.sitemapUrl) : null,
    };
  } catch (error) {
    robots = { url: robotsUrl, status: null, found: false, groups: [], sitemaps: [], error: String(error.message || error), analysis: null };
  }

  const { sitemapReports, pageUrls, truncated, urlLimitReached, sitemapLimitReached } = await collectSitemapsWithProgress(
    detected.sitemapUrl,
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
  const sitemapUrlSet = new Set(pageUrls.map((url) => normalizeUrl(url)).filter(Boolean));
  let inspectedCount = 0;
  await waitForJob(job);
  onProgress?.({
    stage: "inspecting",
    label: "Inspecting URLs",
    percent: pageUrls.length ? 45 : 85,
    processedUrls: 0,
    totalUrls: pageUrls.length,
    processedSitemaps: sitemapReports.length,
    discoveredSitemaps: sitemapReports.length,
  });
  const pages = await mapLimit(pageUrls, PAGE_CONCURRENCY, async (url) => {
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
    return page;
  }, job);
  if (auditOptions.contentChecks) addDuplicateContentIssues(pages);
  addAlternateReciprocityIssues(pages);
  for (const page of pages) {
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
    processedUrls: pageUrls.length,
    totalUrls: pageUrls.length,
    processedSitemaps: sitemapReports.length,
    discoveredSitemaps: sitemapReports.length,
  });

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    limits: { maxSitemaps: MAX_SITEMAPS, maxUrls: auditOptions.maxUrls, pageConcurrency: PAGE_CONCURRENCY, backgroundMode: auditOptions.backgroundMode },
    truncation: { truncated, urlLimitReached, sitemapLimitReached },
    input: {
      originalUrl: normalizedInput,
      inputType: detected.inputType,
      siteRootUrl: detected.siteRootUrl,
      sitemapUrl: detected.sitemapUrl,
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
  };
}

async function readJsonBody(req, maxLength = 100000) {
  if (req.body && Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  if (req.body instanceof Uint8Array) return JSON.parse(Buffer.from(req.body).toString("utf8") || "{}");
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxLength) throw new Error("Request body is too large");
  }
  return JSON.parse(raw || "{}");
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function oauthRedirectUri() {
  const publicBaseUrl = process.env.SOOS_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/$/, "")}/api/gsc/oauth/callback`;
  return `http://127.0.0.1:${PORT}/api/gsc/oauth/callback`;
}

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

let dotEnvCache = null;

async function readDotEnvValues() {
  if (dotEnvCache) return dotEnvCache;
  try {
    dotEnvCache = parseEnvText(await fs.readFile(ENV_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    dotEnvCache = {};
  }
  return dotEnvCache;
}

async function envValue(name) {
  if (process.env[name]) return process.env[name];
  const env = await readDotEnvValues();
  return env[name] || "";
}

async function databaseUrl() {
  return envValue("DATABASE_URL");
}

async function oauthClientId() {
  return envValue("GOOGLE_OAUTH_CLIENT_ID");
}

async function oauthClientSecret() {
  return envValue("GOOGLE_OAUTH_CLIENT_SECRET");
}

async function oauthAppConfig() {
  const [clientId, clientSecret] = await Promise.all([oauthClientId(), oauthClientSecret()]);
  return {
    oauthClientId: clientId,
    oauthClientSecret: clientSecret,
    oauthAppConfigured: Boolean(clientId && clientSecret),
  };
}

function parseCookieHeader(header) {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const equalsAt = part.indexOf("=");
    if (equalsAt <= 0) continue;
    cookies[part.slice(0, equalsAt).trim()] = decodeURIComponent(part.slice(equalsAt + 1).trim());
  }
  return cookies;
}

function validSessionId(value) {
  return /^[a-f0-9]{32}$/i.test(String(value || ""));
}

function buildSessionCookie(sessionId) {
  const secure = process.env.VERCEL || /^https:\/\//i.test(process.env.SOOS_PUBLIC_BASE_URL || "");
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function ensureGscSession(req, res) {
  const cookies = parseCookieHeader(req.headers?.cookie || "");
  let sessionId = cookies[SESSION_COOKIE] || "";
  if (!validSessionId(sessionId)) {
    sessionId = crypto.randomBytes(16).toString("hex");
    res.soosSessionCookie = buildSessionCookie(sessionId);
  }
  return sessionId;
}

function gscConfigKey(sessionId) {
  return `gsc_config:${sessionId}`;
}

let neonSql = null;
let neonReady = false;

async function getNeonSql() {
  const url = await databaseUrl();
  if (!url) return null;
  if (!neonSql) neonSql = neon(url);
  return neonSql;
}

async function ensureNeonConfigTable(sql) {
  if (neonReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS soos_config (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  neonReady = true;
}

function sanitizeGscConfigForStorage(config) {
  const {
    adminConfigured,
    adminKeyRequired,
    databaseConfigured,
    oauthAppConfigured,
    oauthClientId,
    oauthClientSource,
    oauthClientSecret,
    persistentConfig,
    sessionId,
    serverless,
    ...stored
  } = config || {};
  return stored;
}

async function readGscConfigFromDatabase(sessionId) {
  const sql = await getNeonSql();
  if (!sql) return null;
  await ensureNeonConfigTable(sql);
  const rows = await sql`SELECT value FROM soos_config WHERE key = ${gscConfigKey(sessionId)} LIMIT 1`;
  const value = rows[0]?.value;
  if (typeof value === "string") return JSON.parse(value || "{}");
  return value || {};
}

async function writeGscConfigToDatabase(config, sessionId) {
  const sql = await getNeonSql();
  if (!sql) return false;
  await ensureNeonConfigTable(sql);
  const stored = sanitizeGscConfigForStorage(config);
  await sql`
    INSERT INTO soos_config (key, value, updated_at)
    VALUES (${gscConfigKey(sessionId)}, ${JSON.stringify(stored)}::jsonb, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return true;
}

async function clearGscConfigFromDatabase(sessionId) {
  const sql = await getNeonSql();
  if (!sql) return false;
  await ensureNeonConfigTable(sql);
  await sql`DELETE FROM soos_config WHERE key = ${gscConfigKey(sessionId)}`;
  return true;
}

async function persistentGscConfigEnabled() {
  return Boolean(await databaseUrl());
}

function parseEnvText(text) {
  const env = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsAt = line.indexOf("=");
    if (equalsAt <= 0) continue;
    const key = line.slice(0, equalsAt).trim();
    let value = line.slice(equalsAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function readDotEnvConfig() {
  const env = await readDotEnvValues();
  return {
    accessToken: env.SOOS_GSC_ACCESS_TOKEN || env.GSC_ACCESS_TOKEN || "",
    source: "env",
  };
}

function readProcessEnvConfig() {
  return {
    accessToken: process.env.SOOS_GSC_ACCESS_TOKEN || process.env.GSC_ACCESS_TOKEN || "",
    source: "process-env",
  };
}

async function readGscConfigWithEnv(sessionId) {
  const [config, dotEnvConfig, databaseConfigured, oauthApp] = await Promise.all([
    readGscConfig(sessionId),
    readDotEnvConfig(),
    persistentGscConfigEnabled(),
    oauthAppConfig(),
  ]);
  const processEnvConfig = readProcessEnvConfig();
  const envConfig = {
    accessToken: processEnvConfig.accessToken || dotEnvConfig.accessToken || "",
    source: processEnvConfig.accessToken ? "process-env" : dotEnvConfig.source || "",
  };
  const serverless = isServerlessRuntime();
  return {
    ...config,
    siteUrl: config.siteUrl || "",
    accessToken: config.accessToken || envConfig.accessToken || "",
    refreshToken: config.refreshToken || "",
    oauthClientId: oauthApp.oauthClientId || "",
    oauthClientSecret: oauthApp.oauthClientSecret || "",
    oauthAppConfigured: oauthApp.oauthAppConfigured,
    oauthClientSource: oauthApp.oauthAppConfigured ? "server-env" : "",
    sessionId,
    serverless,
    databaseConfigured,
  };
}

async function readGscConfig(sessionId) {
  const databaseConfig = await readGscConfigFromDatabase(sessionId);
  if (databaseConfig) return databaseConfig;
  try {
    return JSON.parse(await fs.readFile(GSC_CONFIG_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function writeGscConfig(config, sessionId) {
  const stored = sanitizeGscConfigForStorage(config);
  if (await writeGscConfigToDatabase(stored, sessionId)) return;
  await fs.writeFile(GSC_CONFIG_PATH, JSON.stringify(stored, null, 2), "utf8");
}

async function clearGscConfig(sessionId) {
  if (await clearGscConfigFromDatabase(sessionId)) return;
  await fs.rm(GSC_CONFIG_PATH, { force: true });
}

function gscStatusFromConfig(config) {
  const tokenUpdatedAt = config.tokenUpdatedAt || config.updatedAt || "";
  const tokenAgeMs = tokenUpdatedAt ? Date.now() - new Date(tokenUpdatedAt).getTime() : null;
  const isOauth = Boolean(config.refreshToken);
  const expiresAt = config.tokenExpiresAt || "";
  const tokenLikelyExpired = isOauth
    ? Boolean(expiresAt && Date.now() > new Date(expiresAt).getTime() - 60 * 1000)
    : Number.isFinite(tokenAgeMs)
      ? tokenAgeMs > 55 * 60 * 1000
      : false;
  const hasApiCredential = Boolean(config.accessToken || config.refreshToken);
  const note = !config.oauthAppConfigured
    ? "Server OAuth app is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."
    : config.serverless && !config.databaseConfigured && !hasApiCredential
    ? "Vercel deployments need DATABASE_URL to save each user's Search Console connection."
    : config.databaseConfigured
      ? "Connect Google Search Console with the Google account that has access to this property."
    : isOauth
      ? "OAuth refresh token configured. soos will refresh Search Console access automatically."
      : config.accessToken
        ? tokenLikelyExpired
          ? "Manual access tokens usually expire after about 1 hour. Paste a fresh token, then test again."
          : "Manual token configured. Use Test API connection to confirm property access."
        : "Configure a Search Console property and access token, or use CSV import.";
  return {
    configured: Boolean(config.siteUrl && hasApiCredential),
    mode: isOauth ? "oauth-refresh" : config.accessToken ? "manual-token" : "not-configured",
    siteUrl: config.siteUrl || "",
    token: config.accessToken ? maskSecret(config.accessToken) : "",
    oauthConfigured: Boolean(config.oauthAppConfigured),
    oauthAppConfigured: Boolean(config.oauthAppConfigured),
    oauthClientSource: config.oauthClientSource || "",
    googleAccountEmail: config.googleAccountEmail || "",
    googleAccountName: config.googleAccountName || "",
    googleAccountPicture: config.googleAccountPicture || "",
    oauthRedirectUri: oauthRedirectUri(),
    refreshToken: config.refreshToken ? "configured" : "",
    serverless: Boolean(config.serverless),
    databaseConfigured: Boolean(config.databaseConfigured),
    persistentConfig: Boolean(!config.serverless || config.databaseConfigured),
    tokenExpiresAt: expiresAt,
    tokenUpdatedAt,
    tokenLikelyExpired,
    note,
  };
}

function friendlyGscApiError(status, body, fallback) {
  const message = body?.error?.message || fallback || `Search Console HTTP ${status}`;
  if (status === 401) {
    return "Google rejected the access token. It may be expired or copied incorrectly; generate a fresh token with the webmasters.readonly scope.";
  }
  if (status === 403) {
    return "Google denied access to this Search Console property. Check that the Google account has permission and that Property URL exactly matches the property in Search Console.";
  }
  if (status === 404) {
    return "Search Console could not find that property. URL-prefix properties must match exactly, including protocol, www, and trailing slash; Domain properties use sc-domain:example.com.";
  }
  return message;
}

function friendlyGscNetworkError(error) {
  const message = String(error?.message || error || "");
  if (/fetch failed|network|ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
    return "Could not reach Google Search Console API. Check the network or proxy connection, then try again.";
  }
  return message || "Could not reach Google Search Console API.";
}

async function postGoogleToken(params) {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).catch((error) => {
    throw new Error(friendlyGscNetworkError(error));
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error_description || body?.error || `Google OAuth HTTP ${response.status}`);
  }
  return body;
}

async function fetchGoogleAccount(accessToken) {
  if (!accessToken) return {};
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  }).catch(() => null);
  if (!response?.ok) return {};
  const body = await response.json().catch(() => ({}));
  return {
    googleAccountEmail: body.email || "",
    googleAccountName: body.name || "",
    googleAccountPicture: body.picture || "",
  };
}

async function revokeGoogleToken(config) {
  const token = config?.refreshToken || config?.accessToken || "";
  if (!token) return { revoked: false };
  const response = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch((error) => ({ networkError: friendlyGscNetworkError(error) }));
  if (response.networkError) return { revoked: false, error: response.networkError };
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { revoked: false, error: body || `Google revoke HTTP ${response.status}` };
  }
  return { revoked: true };
}

async function refreshGscAccessToken(config) {
  if (!config.oauthClientId || !config.oauthClientSecret || !config.refreshToken) {
    throw new Error("OAuth refresh token is not configured.");
  }
  const token = await postGoogleToken({
    client_id: config.oauthClientId,
    client_secret: config.oauthClientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });
  const next = {
    ...config,
    accessToken: token.access_token || config.accessToken || "",
    tokenUpdatedAt: new Date().toISOString(),
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : "",
    updatedAt: new Date().toISOString(),
  };
  delete next.oauthClientSource;
  if (config.serverless && !config.databaseConfigured) return next;
  await writeGscConfig(next, config.sessionId);
  return next;
}

async function getGscConfigWithAccessToken(overrides = {}) {
  const config = await readGscConfigWithEnv(overrides.sessionId);
  if (typeof overrides.siteUrl === "string" && overrides.siteUrl.trim()) {
    config.siteUrl = overrides.siteUrl.trim();
  }
  if (!config.siteUrl) throw new Error("Search Console property URL is required.");
  if (config.refreshToken) {
    const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt).getTime() : 0;
    if (!config.accessToken || !expiresAt || Date.now() > expiresAt - 60 * 1000) {
      return refreshGscAccessToken(config);
    }
  }
  return config;
}

function buildGscOAuthUrl(config) {
  if (!config.siteUrl) throw new Error("Search Console property URL is required before starting OAuth.");
  if (!config.oauthClientId || !config.oauthClientSecret) throw new Error("Google OAuth app is not configured on the server.");
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", config.oauthClientId);
  authUrl.searchParams.set("redirect_uri", oauthRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GSC_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), state, redirectUri: oauthRedirectUri() };
}

async function testGscConnection(options = {}) {
  const config = await getGscConfigWithAccessToken(options);
  if (!config.siteUrl || !config.accessToken) {
    throw new Error("Search Console API is not configured.");
  }
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}`;
  const response = await fetch(endpoint, {
    headers: { "Authorization": `Bearer ${config.accessToken}` },
  }).catch((error) => {
    throw new Error(friendlyGscNetworkError(error));
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(friendlyGscApiError(response.status, body, `Search Console test HTTP ${response.status}`));
  }
  return {
    ok: true,
    siteUrl: config.siteUrl,
    permissionLevel: body.permissionLevel || "",
    message: "Search Console connection works for this property.",
    status: gscStatusFromConfig(config),
  };
}

async function inspectGscUrl(config, inspectionUrl) {
  const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl: config.siteUrl,
      languageCode: "en-US",
    }),
  }).catch((error) => ({
    ok: false,
    networkError: friendlyGscNetworkError(error),
  }));
  if (response.networkError) {
    return {
      url: inspectionUrl,
      ok: false,
      error: response.networkError,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      url: inspectionUrl,
      ok: false,
      error: friendlyGscApiError(response.status, body, `HTTP ${response.status}`),
    };
  }
  const index = body?.inspectionResult?.indexStatusResult || {};
  const mobile = body?.inspectionResult?.mobileUsabilityResult || {};
  const rich = body?.inspectionResult?.richResultsResult || {};
  return {
    url: inspectionUrl,
    ok: true,
    verdict: index.verdict || "",
    coverageState: index.coverageState || "",
    indexingState: index.indexingState || "",
    robotsTxtState: index.robotsTxtState || "",
    pageFetchState: index.pageFetchState || "",
    crawledAs: index.crawledAs || "",
    referringUrls: index.referringUrls || [],
    sitemap: index.sitemap || [],
    lastCrawlTime: index.lastCrawlTime || "",
    googleCanonical: index.googleCanonical || "",
    userCanonical: index.userCanonical || "",
    mobileVerdict: mobile.verdict || "",
    mobileIssues: mobile.issues || [],
    richResultsVerdict: rich.verdict || "",
    richResultsDetectedItems: rich.detectedItems || [],
  };
}

async function inspectGscUrls(urls, options = {}) {
  const config = await getGscConfigWithAccessToken(options);
  if (!config.siteUrl || !config.accessToken) {
    throw new Error("Search Console API is not configured.");
  }
  const uniqueUrls = unique((urls || []).filter((url) => /^https?:\/\//i.test(String(url || "")))).slice(0, 25);
  const results = [];
  for (const url of uniqueUrls) {
    results.push(await inspectGscUrl(config, url));
    await sleep(150);
  }
  return {
    siteUrl: config.siteUrl,
    limit: 25,
    inspected: results.length,
    results,
  };
}
function formatDateOnly(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

const GSC_SEARCH_ANALYTICS_DIMENSIONS = {
  page: ["page"],
  query: ["query"],
  page_query: ["page", "query"],
  country: ["country"],
  device: ["device"],
};

function safeSearchAnalyticsDimension(value) {
  return GSC_SEARCH_ANALYTICS_DIMENSIONS[value] ? value : "page";
}

async function queryGscSearchAnalytics({ startDate, endDate, rowLimit = 25000, siteUrl = "", dimension = "page", sessionId = "" }) {
  const config = await getGscConfigWithAccessToken({ siteUrl, sessionId });
  if (!config.siteUrl || !config.accessToken) {
    throw new Error("Search Console API is not configured.");
  }
  const safeStartDate = formatDateOnly(startDate);
  const safeEndDate = formatDateOnly(endDate);
  if (!safeStartDate || !safeEndDate) throw new Error("startDate and endDate must be YYYY-MM-DD.");
  const safeRowLimit = Math.max(1, Math.min(Number(rowLimit) || 25000, 25000));
  const safeDimension = safeSearchAnalyticsDimension(dimension);
  const dimensions = GSC_SEARCH_ANALYTICS_DIMENSIONS[safeDimension];
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: safeStartDate,
      endDate: safeEndDate,
      dimensions,
      rowLimit: safeRowLimit,
    }),
  }).catch((error) => {
    throw new Error(friendlyGscNetworkError(error));
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(friendlyGscApiError(response.status, body, `Search Analytics HTTP ${response.status}`));
  }
  const rows = (body.rows || []).map((row) => {
    const keys = row.keys || [];
    const pageIndex = dimensions.indexOf("page");
    const page = pageIndex >= 0 ? keys[pageIndex] || "" : "";
    return {
      dimension: safeDimension,
      dimensions,
      keys,
      page,
      query: dimensions.includes("query") ? keys[dimensions.indexOf("query")] || "" : "",
      country: dimensions.includes("country") ? keys[dimensions.indexOf("country")] || "" : "",
      device: dimensions.includes("device") ? keys[dimensions.indexOf("device")] || "" : "",
      label: keys.join(" | "),
      key: page ? normalizeUrl(page) || page.replace(/\/$/, "") : keys.join("|"),
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? null,
      position: row.position ?? null,
    };
  }).filter((row) => row.keys.length);
  return {
    siteUrl: config.siteUrl,
    startDate: safeStartDate,
    endDate: safeEndDate,
    dimension: safeDimension,
    dimensions,
    rowLimit: safeRowLimit,
    rows,
  };
}
export function handleRequest(req, res) {
  cleanupJobs();
  const requestPath = (req.url || "").split("?")[0];
  if (req.method === "OPTIONS") return sendJson(res, 200, {});
  const sessionId = ensureGscSession(req, res);
  if (req.method === "GET" && requestPath === "/api/gsc/status") {
    readGscConfigWithEnv(sessionId)
      .then((config) => sendJson(res, 200, gscStatusFromConfig(config)))
      .catch((error) => sendJson(res, 500, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/config") {
    readJsonBody(req, 50000)
      .then(async (body) => {
        if (isServerlessRuntime() && !await persistentGscConfigEnabled()) {
          throw new Error("Set DATABASE_URL before saving Search Console connections on Vercel.");
        }
        const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";
        const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!siteUrl) throw new Error("Search Console property URL is required.");
        const current = await readGscConfig(sessionId);
        const next = {
          ...current,
          siteUrl,
          accessToken: accessToken || current.accessToken || "",
          tokenUpdatedAt: accessToken ? new Date().toISOString() : current.tokenUpdatedAt || current.updatedAt || "",
          updatedAt: new Date().toISOString(),
        };
        await writeGscConfig(next, sessionId);
        const statusConfig = await readGscConfigWithEnv(sessionId);
        return sendJson(res, 200, gscStatusFromConfig(statusConfig));
      })
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/clear") {
    readJsonBody(req, 50000)
      .then(async () => {
        if (isServerlessRuntime() && !await persistentGscConfigEnabled()) {
          throw new Error("Vercel deployments do not persist UI-saved OAuth config without DATABASE_URL.");
        }
        const current = await readGscConfigWithEnv(sessionId);
        const revoke = await revokeGoogleToken(current);
        await clearGscConfig(sessionId);
        const config = await readGscConfigWithEnv(sessionId);
        return sendJson(res, 200, { ...gscStatusFromConfig(config), revoke });
      })
      .catch((error) => sendJson(res, 500, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/oauth/start") {
    readJsonBody(req, 50000)
      .then(async (body) => {
        if (isServerlessRuntime() && !await persistentGscConfigEnabled()) {
          throw new Error("Set DATABASE_URL before starting OAuth on Vercel.");
        }
        const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";
        if (!siteUrl) throw new Error("Search Console property URL is required before starting OAuth.");
        const storedConfig = await readGscConfig(sessionId);
        await writeGscConfig({
          ...storedConfig,
          siteUrl,
          updatedAt: new Date().toISOString(),
        }, sessionId);
        const config = await readGscConfigWithEnv(sessionId);
        const oauth = buildGscOAuthUrl(config);
        await writeGscConfig({
          ...storedConfig,
          siteUrl,
          oauthState: oauth.state,
          updatedAt: new Date().toISOString(),
        }, sessionId);
        return sendJson(res, 200, {
          authUrl: oauth.authUrl,
          redirectUri: oauth.redirectUri,
          status: gscStatusFromConfig(config),
        });
      })
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "GET" && requestPath === "/api/gsc/oauth/callback") {
    const callbackUrl = new URL(req.url || "", `http://127.0.0.1:${PORT}`);
    const code = callbackUrl.searchParams.get("code") || "";
    const state = callbackUrl.searchParams.get("state") || "";
    readGscConfigWithEnv(sessionId)
      .then(async (config) => {
        if (!code) throw new Error("OAuth callback did not include an authorization code.");
        if (!config.oauthState || state !== config.oauthState) throw new Error("OAuth state did not match. Start OAuth again.");
        const token = await postGoogleToken({
          client_id: config.oauthClientId,
          client_secret: config.oauthClientSecret,
          code,
          redirect_uri: oauthRedirectUri(),
          grant_type: "authorization_code",
        });
        const googleAccount = await fetchGoogleAccount(token.access_token || "");
        const next = {
          ...config,
          accessToken: token.access_token || "",
          refreshToken: token.refresh_token || config.refreshToken || "",
          ...googleAccount,
          tokenUpdatedAt: new Date().toISOString(),
          tokenExpiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : "",
          oauthState: "",
          updatedAt: new Date().toISOString(),
        };
        delete next.oauthClientSource;
        if (!next.refreshToken) throw new Error("Google did not return a refresh token. Start OAuth again and approve offline access.");
        await writeGscConfig(next, sessionId);
        return sendHtml(res, 200, `<!doctype html><meta charset="utf-8"><title>soos OAuth connected</title><body style="font-family:system-ui;padding:24px"><h1>Search Console OAuth connected</h1><p>You can close this tab and return to soos.</p><script>try{if(window.opener){window.opener.postMessage({type:"soos:gsc-oauth-connected"},"*");setTimeout(function(){window.close()},800)}}catch(error){}</script></body>`);
      })
      .catch((error) => sendHtml(res, 400, `<!doctype html><meta charset="utf-8"><title>soos OAuth error</title><body style="font-family:system-ui;padding:24px"><h1>OAuth failed</h1><p>${escapeHtml(error.message || error)}</p></body>`));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/test") {
    readJsonBody(req, 50000)
      .then((body) => testGscConnection({ siteUrl: body.siteUrl, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/search-analytics") {
    readJsonBody(req, 50000)
      .then((body) => queryGscSearchAnalytics({ ...body, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/gsc/inspect") {
    readJsonBody(req, 200000)
      .then((body) => inspectGscUrls(body.urls || [], { siteUrl: body.siteUrl, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "GET" && /^\/api\/audit-jobs\/[^/]+$/.test(requestPath)) {
    const id = requestPath.split("/").pop();
    const job = jobs.get(id);
    if (!job) return sendJson(res, 404, { error: "Job not found" });
    return sendJson(res, 200, jobSnapshot(job));
  }
  if (req.method === "POST" && /^\/api\/audit-jobs\/[^/]+\/control$/.test(requestPath)) {
    const parts = requestPath.split("/");
    const id = parts[3];
    const job = jobs.get(id);
    if (!job) return sendJson(res, 404, { error: "Job not found" });
    readJsonBody(req, 20000)
      .then((body) => {
      try {
        if (body.action === "pause" && job.status === "running") {
          updateJob(job, { status: "paused", progress: { label: "Paused" } });
        } else if (body.action === "resume" && job.status === "paused") {
          updateJob(job, { status: "running", progress: { label: job.progress.stage === "inspecting" ? "Inspecting URLs" : job.progress.label } });
        } else if (body.action === "stop" && (job.status === "running" || job.status === "paused")) {
          updateJob(job, { status: "stopped", progress: { label: "Stopped" }, error: null });
        }
        return sendJson(res, 200, jobSnapshot(job));
      } catch (error) {
        return sendJson(res, 400, { error: String(error.message || error) });
      }
    })
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method === "POST" && requestPath === "/api/audit-jobs") {
    readJsonBody(req, 100000)
      .then((body) => {
      try {
        const job = createJob();
        updateJob(job, {
          status: "running",
          progress: {
            stage: "preparing",
            label: "Preparing scan",
            percent: 5,
          },
        });
        audit(body.sitemapUrl, body.options, (progress) => updateJob(job, { progress }), job)
          .then((result) => {
            if (job.status === "stopped") return;
            updateJob(job, {
              status: "done",
              progress: {
                stage: "done",
                label: "Completed",
                percent: 100,
                processedUrls: result.summary.urlCount,
                totalUrls: result.summary.urlCount,
                processedSitemaps: result.summary.sitemapCount,
                discoveredSitemaps: result.summary.sitemapCount,
              },
              result,
            });
          })
          .catch((error) => {
            if (error?.code === "JOB_STOPPED" || job.status === "stopped") {
              updateJob(job, {
                status: "stopped",
                progress: {
                  ...job.progress,
                  label: "Stopped",
                },
                error: null,
              });
              return;
            }
            updateJob(job, {
              status: "error",
              error: String(error.message || error),
            });
          });
        return sendJson(res, 202, jobSnapshot(job));
      } catch (error) {
        return sendJson(res, 400, { error: String(error.message || error) });
      }
    })
      .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
    return;
  }
  if (req.method !== "POST" || requestPath !== "/api/audit") return sendJson(res, 404, { error: "Not found" });
  readJsonBody(req, 100000)
    .then(async (body) => {
    try {
      sendJson(res, 200, await audit(body.sitemapUrl, body.options));
    } catch (error) {
      sendJson(res, 400, { error: String(error.message || error) });
    }
  })
    .catch((error) => sendJson(res, 400, { error: String(error.message || error) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  http.createServer(handleRequest).listen(PORT, "127.0.0.1", () => {
    console.log(`soos API listening on http://127.0.0.1:${PORT}`);
  });
}
