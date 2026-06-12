const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function firstHeader(value) {
  return String(Array.isArray(value) ? value[0] : value || "").split(",")[0].trim();
}

function normalizedOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function requestPublicOrigin(req, env = process.env) {
  const configured = normalizedOrigin(env.SOOS_PUBLIC_BASE_URL || "");
  if (configured) return configured;
  const host = firstHeader(req?.headers?.["x-forwarded-host"] || req?.headers?.host);
  if (!host) return "";
  const protocol = firstHeader(req?.headers?.["x-forwarded-proto"]) || (env.VERCEL ? "https" : "http");
  return normalizedOrigin(`${protocol}://${host}`);
}

export function isAllowedRequestOrigin(req, env = process.env) {
  const origin = normalizedOrigin(firstHeader(req?.headers?.origin));
  if (!origin) return true;
  const publicOrigin = requestPublicOrigin(req, env);
  if (publicOrigin && origin === publicOrigin) return true;
  if (!env.VERCEL && !env.SOOS_PUBLIC_BASE_URL) {
    try {
      const url = new URL(origin);
      return LOOPBACK_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export function requiresSameOrigin(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

export function clientIpFromRequest(req) {
  return firstHeader(
    req?.headers?.["x-forwarded-for"]
    || req?.headers?.["x-real-ip"]
    || req?.socket?.remoteAddress
    || "unknown",
  );
}

export function securityHeaders(options = {}) {
  const allowedOrigin = options.allowedOrigin || "";
  return {
    ...(allowedOrigin ? {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Vary": "Origin",
    } : {}),
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Request-ID",
    "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export function createRateLimiter(options = {}) {
  const now = options.now || Date.now;
  const buckets = new Map();

  function check(key, limit, windowMs) {
    const timestamp = now();
    const current = buckets.get(key);
    if (!current || timestamp >= current.resetAt) {
      const next = { count: 1, resetAt: timestamp + windowMs };
      buckets.set(key, next);
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - timestamp) / 1000)),
      };
    }
    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - current.count),
      resetAt: current.resetAt,
      retryAfterSeconds: 0,
    };
  }

  return { check };
}

export const HIGH_COST_RATE_LIMITS = [
  { method: "POST", pattern: /^\/api\/audit-jobs$/, group: "audit-create", limit: 10, windowMs: 60000 },
  { method: "POST", pattern: /^\/api\/audit$/, group: "audit-sync", limit: 5, windowMs: 60000 },
  { method: "POST", pattern: /^\/api\/audit-jobs\/[^/]+\/run$/, group: "audit-run", limit: 180, windowMs: 60000 },
  { method: "POST", pattern: /^\/api\/gsc\/inspect$/, group: "gsc-inspect", limit: 20, windowMs: 60000 },
  { method: "POST", pattern: /^\/api\/gsc\/search-analytics$/, group: "gsc-analytics", limit: 30, windowMs: 60000 },
  { method: "POST", pattern: /^\/api\/googlebot\/verify$/, group: "dns-verify", limit: 20, windowMs: 60000 },
];

export function rateLimitRule(method, path) {
  return HIGH_COST_RATE_LIMITS.find((rule) =>
    rule.method === String(method || "").toUpperCase() && rule.pattern.test(path),
  ) || null;
}
