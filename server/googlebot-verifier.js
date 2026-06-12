import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_IPS = 100;
const DEFAULT_BATCH_SIZE = 10;
const googlebotDnsCache = new Map();

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function isPublicIp(value) {
  if (!net.isIP(value)) return false;
  const ip = String(value).toLowerCase();
  if (ip.startsWith("::ffff:")) return isPublicIp(ip.slice(7));
  if (ip === "::" || ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("ff")) return false;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}

export function trustedGoogleHostname(hostname) {
  const value = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return value.endsWith(".googlebot.com") || value.endsWith(".google.com") || value.endsWith(".googleusercontent.com");
}

export async function verifyGooglebotIp(ip, options = {}) {
  const now = options.now || Date.now();
  const cache = options.cache || googlebotDnsCache;
  const reverse = options.reverse || dns.reverse;
  const lookup = options.lookup || dns.lookup;
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now) return cached.value;
  const result = { ip, verified: false, hostname: "", category: "unverified" };
  try {
    const hostnames = await reverse(ip);
    const hostname = hostnames.find(trustedGoogleHostname) || "";
    if (hostname) {
      const addresses = await lookup(hostname, { all: true });
      if (addresses.some((entry) => entry.address === ip)) {
        result.verified = true;
        result.hostname = hostname.replace(/\.$/, "");
        result.category = hostname.includes("googlebot.com")
          ? "common"
          : hostname.includes("gae.googleusercontent.com") || hostname.includes("google-proxy-")
            ? "user_triggered"
            : "special";
      }
    }
  } catch {
    // DNS failures classify the request as unverified without failing the batch.
  }
  cache.set(ip, {
    value: result,
    expiresAt: now + (options.cacheTtlMs || DEFAULT_CACHE_TTL_MS),
  });
  return result;
}

export async function verifyGooglebotIps(values, options = {}) {
  const maxIps = options.maxIps || DEFAULT_MAX_IPS;
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const ips = unique((values || []).map(String).filter(isPublicIp)).slice(0, maxIps);
  const results = [];
  for (let offset = 0; offset < ips.length; offset += batchSize) {
    results.push(...await Promise.all(
      ips.slice(offset, offset + batchSize).map((ip) => verifyGooglebotIp(ip, options)),
    ));
  }
  return {
    verifiedAt: new Date(options.now || Date.now()).toISOString(),
    results,
  };
}
