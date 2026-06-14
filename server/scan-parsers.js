import { canonicalAuditUrl } from "../src/url-policy.js";

export function normalizeUrl(value, base) {
  return canonicalAuditUrl(value, base) || null;
}

function directoryUrl(url) {
  const copy = new URL(url.toString());
  if (!copy.pathname.endsWith("/")) copy.pathname = copy.pathname.replace(/\/[^/]*$/, "/");
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

export function detectInputUrls(inputUrl, options = {}) {
  const url = new URL(inputUrl);
  const pathname = url.pathname.toLowerCase();
  const robotsIsInput = pathname.endsWith("/robots.txt");
  const sitemapIsInput = pathname.endsWith(".xml") || pathname.includes("sitemap");
  const inputType = robotsIsInput ? "robots" : sitemapIsInput ? "sitemap" : "site";
  const siteRoot = inputType === "site" ? siteRootFromInput(url) : directoryUrl(url);
  return {
    inputType,
    siteRootUrl: siteRoot.toString(),
    sitemapUrl: inputType === "sitemap" ? url.toString() : new URL("sitemap.xml", siteRoot).toString(),
    robotsUrl: inputType === "robots"
      ? url.toString()
      : options.robotsSource === "sitemap-directory"
        ? new URL("robots.txt", siteRoot).toString()
        : `${url.origin}/robots.txt`,
  };
}

export function decodeXml(text) {
  return String(text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

export function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export function tags(xml, name) {
  const out = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi");
  let match;
  while ((match = re.exec(xml))) out.push(match[1].trim());
  return out;
}

export function locs(xml) {
  return unique(tags(xml, "loc").map(decodeXml));
}

export function detectSitemapKind(xml) {
  if (/<sitemapindex[\s>]/i.test(xml)) return "sitemapindex";
  if (/<urlset[\s>]/i.test(xml)) return "urlset";
  return "unknown";
}

export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
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

export function analyzeRobots(parsedRobots, robotsUrl, expectedSitemapUrl) {
  const groups = parsedRobots?.groups || [];
  const sitemaps = parsedRobots?.sitemaps || [];
  const issues = [];
  const googleGroups = groups.filter((group) => (
    group.agents.some((agent) => agent === "*" || "googlebot".includes(agent))
  ));
  const rootUrl = new URL("/", robotsUrl).toString();
  const fullBlock = !robotsDecision(groups, rootUrl).allowed;
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

function agentMatchLength(agent, bot) {
  if (agent === "*") return 0;
  return bot.includes(agent) ? agent.length : -1;
}

export function robotsDecision(groups, targetUrl, bot = "googlebot") {
  const url = new URL(targetUrl);
  const pathWithQuery = `${url.pathname}${url.search}`;
  const normalizedBot = String(bot || "").toLowerCase();
  const candidates = groups
    .map((group) => ({
      group,
      specificity: Math.max(...group.agents.map((agent) => agentMatchLength(agent, normalizedBot)), -1),
    }))
    .filter(({ specificity }) => specificity >= 0);
  const bestSpecificity = Math.max(...candidates.map(({ specificity }) => specificity), -1);
  const groupsToUse = candidates
    .filter(({ specificity }) => specificity === bestSpecificity)
    .map(({ group }) => group);
  const matchingRules = groupsToUse
    .flatMap((group) => group.rules)
    .filter((rule) => ruleMatches(rule.pattern, pathWithQuery))
    .sort((a, b) => (
      b.pattern.length - a.pattern.length
      || Number(b.type === "allow") - Number(a.type === "allow")
    ));
  const winner = matchingRules[0];
  return {
    allowed: !winner || winner.type === "allow",
    rule: winner || null,
    path: pathWithQuery,
    matchedRules: matchingRules,
  };
}

export function attrMap(raw) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = re.exec(raw))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

export function extractHead(html) {
  return /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] || String(html || "").slice(0, 50000);
}

export function textContent(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLinkHeader(value) {
  const parts = [];
  let start = 0;
  let inAngle = false;
  let quote = "";
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "<") {
      inAngle = true;
    } else if (character === ">") {
      inAngle = false;
    } else if (character === "," && !inAngle) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function linkRelation(parameters) {
  const match = /(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]+))/i.exec(parameters);
  return (match?.[1] || match?.[2] || match?.[3] || "").toLowerCase().split(/\s+/).filter(Boolean);
}

export function extractCanonicalDeclarations(html, baseUrl, linkHeader = "") {
  const re = /<link\b([^>]*?)>/gi;
  const head = extractHead(html);
  const declarations = [];
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    if ((attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")) {
      declarations.push({
        source: "html",
        rawHref: attrs.href || "",
        href: normalizeUrl(attrs.href, baseUrl),
      });
    }
  }
  for (const part of splitLinkHeader(linkHeader)) {
    const headerMatch = /^<([^>]*)>([\s\S]*)$/.exec(part);
    if (!headerMatch || !linkRelation(headerMatch[2]).includes("canonical")) continue;
    declarations.push({
      source: "http_header",
      rawHref: headerMatch[1].trim(),
      href: normalizeUrl(headerMatch[1].trim(), baseUrl),
    });
  }
  return declarations;
}

export function extractCanonical(html, baseUrl, linkHeader = "") {
  return extractCanonicalDeclarations(html, baseUrl, linkHeader)
    .find((declaration) => declaration.href)?.href || null;
}

export function extractTitle(html) {
  return textContent(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(extractHead(html))?.[1] || "");
}

export function extractMetaContent(html, nameToFind) {
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

export function extractH1Count(html) {
  return [...String(html || "").matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => textContent(match[1]))
    .filter(Boolean)
    .length;
}

export function extractHtmlLang(html) {
  return attrMap(/<html\b([^>]*)>/i.exec(html)?.[1] || "").lang || "";
}

export function extractAlternates(html, baseUrl) {
  const re = /<link\b([^>]*?)>/gi;
  const head = extractHead(html);
  const alternates = [];
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    if (!(attrs.rel || "").toLowerCase().split(/\s+/).includes("alternate") || !attrs.hreflang) continue;
    alternates.push({
      hreflang: attrs.hreflang,
      href: normalizeUrl(attrs.href, baseUrl),
      rawHref: attrs.href || "",
    });
  }
  return alternates;
}

export function extractInternalLinks(html, baseUrl) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const links = new Set();
  const re = /<a\b([^>]*?)>/gi;
  let match;
  while ((match = re.exec(html)) && links.size < 500) {
    const href = attrMap(match[1]).href;
    if (!href) continue;
    const normalized = normalizeUrl(href, base);
    if (!normalized) continue;
    const target = new URL(normalized);
    const targetHost = target.hostname.toLowerCase().replace(/^www\./, "");
    const baseHost = base.hostname.toLowerCase().replace(/^www\./, "");
    if (!["http:", "https:"].includes(target.protocol) || targetHost !== baseHost) continue;
    links.add(target.toString());
  }
  return [...links];
}

export function hasNoindex(html) {
  const re = /<meta\b([^>]*?)>/gi;
  const head = extractHead(html);
  let match;
  while ((match = re.exec(head))) {
    const attrs = attrMap(match[1]);
    const name = (attrs.name || attrs.property || "").toLowerCase();
    if ((name === "robots" || name === "googlebot") && /(^|,|\s)noindex($|,|\s)/i.test(attrs.content || "")) {
      return true;
    }
  }
  return false;
}

export function hasNoindexHeader(value) {
  return /(^|[,\s:])noindex(?=$|[,\s;])/i.test(String(value || ""));
}
