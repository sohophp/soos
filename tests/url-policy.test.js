import assert from "node:assert/strict";
import {
  analyzeRedirectChain,
  canonicalAuditUrl,
  comparisonUrl,
  isRedirectStatus,
} from "../src/url-policy.js";

assert.equal(canonicalAuditUrl("/page?x=1#part", "HTTPS://Example.COM:443/base"), "https://example.com/page?x=1");
assert.equal(canonicalAuditUrl("mailto:test@example.com"), "");
assert.equal(isRedirectStatus(301), true);
assert.equal(isRedirectStatus(304), false);
assert.equal(
  comparisonUrl("https://Example.com/page/?utm_source=x&id=2#part", {
    queryPolicy: "strip_tracking",
    trailingSlashPolicy: "remove",
  }),
  "https://example.com/page?id=2",
);
assert.equal(
  comparisonUrl("https://example.com/page?id=2", {
    queryPolicy: "drop_all",
    trailingSlashPolicy: "add",
  }),
  "https://example.com/page/",
);
assert.equal(
  comparisonUrl("https://example.com/page?id=2", {
    queryPolicy: "preserve",
    trailingSlashPolicy: "preserve",
  }),
  "https://example.com/page?id=2",
);

const normal = analyzeRedirectChain("https://example.com/old", [
  { url: "https://example.com/old", status: 301, location: "/middle" },
  { url: "https://example.com/middle", status: 302, location: "https://www.example.com/final" },
]);
assert.equal(normal.redirectCount, 2);
assert.equal(normal.crossHost, true);
assert.equal(normal.loop, false);
assert.equal(normal.finalTarget, "https://www.example.com/final");

const loop = analyzeRedirectChain("https://example.com/a", [
  { url: "https://example.com/a", status: 301, location: "/b" },
  { url: "https://example.com/b", status: 302, location: "/a" },
]);
assert.equal(loop.loop, true);

const downgrade = analyzeRedirectChain("https://example.com/", [
  { url: "https://example.com/", status: 301, location: "http://example.com/" },
]);
assert.equal(downgrade.protocolDowngrade, true);

const invalid = analyzeRedirectChain("https://example.com/", [
  { url: "https://example.com/", status: 301, location: "javascript:alert(1)" },
]);
assert.equal(invalid.invalidLocation, true);

const excessive = analyzeRedirectChain(
  "https://example.com/0",
  Array.from({ length: 11 }, (_, index) => ({
    url: `https://example.com/${index}`,
    status: 301,
    location: `/${index + 1}`,
  })),
);
assert.equal(excessive.limitReached, true);

console.log("url-policy-tests-passed");
