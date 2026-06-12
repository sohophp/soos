import assert from "node:assert/strict";
import {
  clientIpFromRequest,
  createRateLimiter,
  isAllowedRequestOrigin,
  rateLimitRule,
  requestPublicOrigin,
  requiresSameOrigin,
  securityHeaders,
} from "../server/security.js";

const productionEnv = { SOOS_PUBLIC_BASE_URL: "https://soos.example.com" };
assert.equal(requestPublicOrigin({ headers: {} }, productionEnv), "https://soos.example.com");
assert.equal(isAllowedRequestOrigin({ headers: { origin: "https://soos.example.com" } }, productionEnv), true);
assert.equal(isAllowedRequestOrigin({ headers: { origin: "https://evil.example" } }, productionEnv), false);
assert.equal(isAllowedRequestOrigin({
  headers: { origin: "http://127.0.0.1:5173", host: "127.0.0.1:4177" },
}, {}), true);
assert.equal(isAllowedRequestOrigin({ headers: {} }, productionEnv), true);
assert.equal(requiresSameOrigin("POST"), true);
assert.equal(requiresSameOrigin("GET"), false);
assert.equal(clientIpFromRequest({ headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" } }), "203.0.113.4");

const headers = securityHeaders({ allowedOrigin: "https://soos.example.com" });
assert.equal(headers["Access-Control-Allow-Origin"], "https://soos.example.com");
assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
assert.equal(headers["X-Frame-Options"], "DENY");
assert.equal(securityHeaders({})["Access-Control-Allow-Origin"], undefined);

let now = 1000;
const limiter = createRateLimiter({ now: () => now });
assert.equal(limiter.check("key", 2, 1000).allowed, true);
assert.equal(limiter.check("key", 2, 1000).allowed, true);
const blocked = limiter.check("key", 2, 1000);
assert.equal(blocked.allowed, false);
assert.equal(blocked.retryAfterSeconds, 1);
now = 2000;
assert.equal(limiter.check("key", 2, 1000).allowed, true);

assert.equal(rateLimitRule("POST", "/api/gsc/inspect").group, "gsc-inspect");
assert.equal(rateLimitRule("GET", "/api/gsc/inspect"), null);

console.log("security-tests-passed");
