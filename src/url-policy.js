const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const TRACKING_PARAM = /^(?:utm_.+|gclid|dclid|fbclid|msclkid|_ga|_gl|mc_cid|mc_eid)$/i;

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

  if (url.pathname !== "/") {
    if (trailingSlashPolicy === "remove") url.pathname = url.pathname.replace(/\/+$/, "");
    if (trailingSlashPolicy === "add" && !url.pathname.endsWith("/")) url.pathname += "/";
  }
  return url.toString();
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
