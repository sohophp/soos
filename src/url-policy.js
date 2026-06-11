const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const TRACKING_PARAM = /^(?:utm_.+|gclid|dclid|fbclid|msclkid|_ga|_gl|mc_cid|mc_eid)$/i;
const PAGINATION_PARAM = /^(?:page|paged|pagenum|page_num|offset|start)$/i;
const FUNCTIONAL_PARAM = /^(?:id|q|query|s|search|sort|order|filter|category|cat|tag|type|view|lang|locale)$/i;
const CONTENT_IDENTITY_PARAM = /^(?:id|q|query|s|search)$/i;
const DEFAULT_DOCUMENT = /\/(?:index|default)\.(?:html?|php|aspx?)$/i;

export function canonicalAuditUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function isRedirectStatus(status) {
  return REDIRECT_STATUSES.has(Number(status));
}

export function comparisonUrl(value, policy = {}) {
  const normalized = canonicalAuditUrl(value);
  if (!normalized) return "";
  const url = new URL(normalized);
  const queryPolicy = ["preserve", "strip_tracking", "drop_all"].includes(policy.queryPolicy)
    ? policy.queryPolicy
    : "preserve";
  const trailingSlashPolicy = ["preserve", "remove", "add"].includes(policy.trailingSlashPolicy)
    ? policy.trailingSlashPolicy
    : "preserve";

  if (queryPolicy === "drop_all") {
    url.search = "";
  } else if (queryPolicy === "strip_tracking") {
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname !== "/") {
    if (trailingSlashPolicy === "remove") url.pathname = url.pathname.replace(/\/+$/, "");
    if (trailingSlashPolicy === "add" && !url.pathname.endsWith("/")) url.pathname += "/";
  }
  return url.toString();
}

export function normalizeReportUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").trim().replace(/\/$/, "");
  }
}

function variantParts(value) {
  const normalized = canonicalAuditUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const pathnameWithoutDefault = url.pathname.replace(DEFAULT_DOCUMENT, "/");
  const comparisonPath = pathnameWithoutDefault === "/" ? "/" : pathnameWithoutDefault.replace(/\/+$/, "");
  const familyPath = comparisonPath.toLowerCase();
  const queryEntries = [...url.searchParams.entries()];
  const sortedQuery = [...queryEntries].sort(([aKey, aValue], [bKey, bValue]) => (
    aKey.localeCompare(bKey) || aValue.localeCompare(bValue)
  ));
  const withoutTracking = sortedQuery.filter(([key]) => !TRACKING_PARAM.test(key));

  return {
    url: normalized,
    protocol: url.protocol,
    hostname: url.hostname,
    hostnameFamily: url.hostname.replace(/^www\./, ""),
    pathname: url.pathname,
    pathnameWithoutDefault,
    comparisonPath,
    familyPath,
    hasDefaultDocument: DEFAULT_DOCUMENT.test(url.pathname),
    hasTrailingSlash: url.pathname !== "/" && url.pathname.endsWith("/"),
    rawQuery: url.search.slice(1),
    sortedQuery: new URLSearchParams(sortedQuery).toString(),
    queryWithoutTracking: new URLSearchParams(withoutTracking).toString(),
    queryEntries,
  };
}

export function urlVariantFamily(value) {
  const parts = variantParts(value);
  if (!parts) return "";
  return `${parts.hostnameFamily}${new URL(parts.url).port ? `:${new URL(parts.url).port}` : ""}${parts.familyPath}`;
}

export function analyzeUrlVariantGroup(values = []) {
  const parts = [...new Set(values)].map(variantParts).filter(Boolean);
  if (parts.length < 2) return null;

  const reasons = new Set();
  const protocols = new Set(parts.map((item) => item.protocol));
  const hostnames = new Set(parts.map((item) => item.hostname));
  const comparisonPaths = new Set(parts.map((item) => item.comparisonPath));
  const lowerComparisonPaths = new Set(parts.map((item) => item.comparisonPath.toLowerCase()));
  const defaultStates = new Set(parts.map((item) => item.hasDefaultDocument));
  const slashStates = new Set(parts.map((item) => item.hasTrailingSlash));
  const rawQueries = new Set(parts.map((item) => item.rawQuery));
  const sortedQueries = new Set(parts.map((item) => item.sortedQuery));
  const nonTrackingQueries = new Set(parts.map((item) => item.queryWithoutTracking));

  if (protocols.size > 1) reasons.add("protocol");
  if (hostnames.size > 1) reasons.add("hostname");
  if (comparisonPaths.size > 1 && lowerComparisonPaths.size < comparisonPaths.size) reasons.add("path_case");
  if (defaultStates.size > 1) reasons.add("default_document");
  if (slashStates.size > 1) reasons.add("trailing_slash");

  if (rawQueries.size > 1) {
    if (sortedQueries.size === 1) {
      reasons.add("query_order");
    } else if (nonTrackingQueries.size === 1) {
      reasons.add("tracking_query");
    } else {
      const allKeys = new Set(parts.flatMap((item) => item.queryEntries.map(([key]) => key)));
      const changedKeys = new Set([...allKeys].filter((key) => {
        const values = parts.map((item) => item.queryEntries
          .filter(([entryKey]) => entryKey === key)
          .map(([, value]) => value)
          .sort()
          .join("\u0000"));
        return new Set(values).size > 1;
      }));
      if ([...changedKeys].every((key) => TRACKING_PARAM.test(key))) reasons.add("tracking_query");
      else if ([...changedKeys].every((key) => TRACKING_PARAM.test(key) || PAGINATION_PARAM.test(key))) reasons.add("pagination_query");
      else if ([...changedKeys].length && [...changedKeys].every((key) => CONTENT_IDENTITY_PARAM.test(key))) return null;
      else if ([...changedKeys].some((key) => FUNCTIONAL_PARAM.test(key))) reasons.add("functional_query");
      else reasons.add("unknown_query");
    }
  }

  const severeReasons = ["protocol", "path_case", "functional_query", "unknown_query"];
  const normalizeReasons = ["hostname", "default_document", "trailing_slash"];
  const classification = severeReasons.some((reason) => reasons.has(reason))
    ? "conflict"
    : normalizeReasons.some((reason) => reasons.has(reason))
      ? "normalize"
      : "reasonable";

  return {
    classification,
    severity: classification === "conflict" ? "critical" : classification === "normalize" ? "warning" : "notice",
    reasons: [...reasons],
    urls: parts.map((item) => item.url),
  };
}

export function analyzeRedirectChain(startUrl, hops = [], options = {}) {
  const maxRedirects = Math.max(1, Number(options.maxRedirects) || 10);
  const start = canonicalAuditUrl(startUrl);
  const seen = new Set(start ? [start] : []);
  const chain = [];
  let loop = false;
  let invalidLocation = false;
  let crossHost = false;
  let protocolDowngrade = false;

  for (const hop of hops) {
    const fromUrl = canonicalAuditUrl(hop.url);
    const targetUrl = canonicalAuditUrl(hop.location, fromUrl);
    const normalizedHop = {
      url: fromUrl || String(hop.url || ""),
      status: Number(hop.status) || 0,
      location: String(hop.location || ""),
      targetUrl,
    };
    chain.push(normalizedHop);
    if (!targetUrl) {
      invalidLocation = true;
      break;
    }
    try {
      const from = new URL(fromUrl);
      const target = new URL(targetUrl);
      if (from.hostname !== target.hostname) crossHost = true;
      if (from.protocol === "https:" && target.protocol === "http:") protocolDowngrade = true;
    } catch {
      invalidLocation = true;
      break;
    }
    if (seen.has(targetUrl)) {
      loop = true;
      break;
    }
    seen.add(targetUrl);
  }

  return {
    chain,
    redirectCount: chain.length,
    loop,
    invalidLocation,
    crossHost,
    protocolDowngrade,
    limitReached: chain.length > maxRedirects && !loop && !invalidLocation,
    finalTarget: chain.at(-1)?.targetUrl || start,
  };
}
