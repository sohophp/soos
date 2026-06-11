import assert from "node:assert/strict";
import {
  analyzeRedirectChain,
  analyzeUrlVariantGroup,
  canonicalAuditUrl,
  comparisonUrl,
  isRedirectStatus,
  normalizeReportUrl,
  urlVariantFamily,
} from "../src/url-policy.js";

assert.equal(canonicalAuditUrl("/page?x=1#part", "HTTPS://Example.COM:443/base"), "https://example.com/page?x=1");
assert.equal(canonicalAuditUrl("mailto:test@example.com"), "");
assert.equal(isRedirectStatus(301), true);
assert.equal(isRedirectStatus(304), false);
assert.equal(normalizeReportUrl("https://example.com/page/?x=1#part"), "https://example.com/page");
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
assert.equal(
  comparisonUrl("https://example.com/page?b=2&a=1", {
    queryPolicy: "preserve",
    trailingSlashPolicy: "preserve",
  }),
  "https://example.com/page?a=1&b=2",
);
assert.equal(urlVariantFamily("https://www.example.com/Docs/index.html?utm_source=x"), "example.com/docs");

const queryOrderVariant = analyzeUrlVariantGroup([
  "https://example.com/page?a=1&b=2",
  "https://example.com/page?b=2&a=1",
]);
assert.equal(queryOrderVariant.classification, "reasonable");
assert.deepEqual(queryOrderVariant.reasons, ["query_order"]);

const defaultDocumentVariant = analyzeUrlVariantGroup([
  "https://example.com/docs/",
  "https://example.com/docs/index.html",
]);
assert.equal(defaultDocumentVariant.classification, "normalize");
assert.equal(defaultDocumentVariant.reasons.includes("default_document"), true);

const caseVariant = analyzeUrlVariantGroup([
  "https://example.com/Product/",
  "https://example.com/product",
]);
assert.equal(caseVariant.classification, "conflict");
assert.equal(caseVariant.reasons.includes("path_case"), true);
assert.equal(caseVariant.reasons.includes("trailing_slash"), true);

const paginationVariant = analyzeUrlVariantGroup([
  "https://example.com/articles?page=1",
  "https://example.com/articles?page=2",
]);
assert.equal(paginationVariant.classification, "reasonable");
assert.equal(paginationVariant.reasons.includes("pagination_query"), true);

const trackingVariant = analyzeUrlVariantGroup([
  "https://example.com/article?id=8",
  "https://example.com/article?id=8&utm_source=newsletter",
]);
assert.equal(trackingVariant.classification, "reasonable");
assert.equal(trackingVariant.reasons.includes("tracking_query"), true);

const functionalVariant = analyzeUrlVariantGroup([
  "https://example.com/products?sort=price",
  "https://example.com/products?sort=name",
]);
assert.equal(functionalVariant.classification, "conflict");
assert.equal(functionalVariant.reasons.includes("functional_query"), true);

assert.equal(analyzeUrlVariantGroup([
  "https://example.com/product?id=1",
  "https://example.com/product?id=2",
]), null);

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
