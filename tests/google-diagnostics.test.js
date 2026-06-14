import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildUrlSetCsvRows,
  buildUrlSetFindings,
  normalizeVariantUrl,
} from "../src/google-url-sets.js";
import {
  buildStructuredDataCoverage,
  buildStructuredDataCsvRows,
  buildStructuredDataRows,
  googleRichIssues,
  summarizeStructuredDataRows,
} from "../src/structured-data-diagnostics.js";

const copy = {
  sourceSitemap: "Sitemap",
  sourceInternal: "Internal",
  sourceGsc: "GSC",
  sourceGoogle: "Google",
  sourceVariants: "Variants",
  internalMissingSitemap: "Internal missing",
  googleMissingSitemap: "Google missing sitemap",
  googleMissingReferrer: "Google missing referrer",
  clicks: "clicks",
  impressions: "impressions",
  inboundLinks: "inbound",
  variantProtocol: "protocol",
  variantHostname: "hostname",
  variantPathCase: "path case",
  variantDefaultDocument: "default document",
  variantTrailingSlash: "trailing slash",
  variantQueryOrder: "query order",
  variantTrackingQuery: "tracking",
  variantPaginationQuery: "pagination",
  variantFunctionalQuery: "functional",
  variantUnknownQuery: "unknown",
};

assert.equal(normalizeVariantUrl("https://example.com/page#part"), "https://example.com/page");
assert.equal(normalizeVariantUrl("invalid value"), "invalid value");

const urlFindings = buildUrlSetFindings({
  options: { urlQueryPolicy: "preserve", trailingSlashPolicy: "preserve" },
  pages: [
    {
      url: "https://example.com/Product",
      internalLinks: ["https://example.com/Product", "https://example.com/outside"],
    },
  ],
  discoveredPages: [],
}, [
  { page: "https://example.com/gsc-only", clicks: 2, impressions: 50 },
], [
  {
    url: "https://example.com/product",
    ok: true,
    sitemap: [],
    referringUrls: [],
  },
], copy);

assert.ok(urlFindings.some((item) => item.type === "internal_missing_sitemap"));
assert.ok(urlFindings.some((item) => item.type === "gsc_missing_sitemap"));
assert.ok(urlFindings.some((item) => item.type === "sitemap_orphan"));
assert.ok(urlFindings.some((item) => item.type === "google_missing_sitemap"));
assert.ok(urlFindings.some((item) => item.type === "google_missing_referrer"));
assert.ok(urlFindings.some((item) => item.type === "url_variant_conflict" && item.severity === "critical"));
assert.equal(buildUrlSetCsvRows(urlFindings, { sitemap_orphan: "Orphan" })[0][0], "type");

const richIssues = googleRichIssues({
  richResultsDetectedItems: [{
    richResultType: "Product",
    items: [{ issues: [{ severity: "ERROR", issueMessage: "Missing price" }] }],
  }],
});
assert.deepEqual(richIssues, [{
  type: "Product",
  severity: "error",
  detail: "Missing price",
}]);

const structuredRows = buildStructuredDataRows({
  pages: [
    {
      url: "https://example.com/product",
      structuredData: {
        count: 1,
        nodeCount: 2,
        types: ["Product", "Organization"],
        validatedTypes: ["Product"],
        unvalidatedTypes: ["Organization"],
        diagnostics: [
          { severity: "warning", code: "missing_required", type: "Product", property: "offers", detail: "Missing offers" },
          { severity: "notice", code: "missing_recommended", type: "Product", property: "brand", detail: "Add brand" },
        ],
      },
    },
    {
      url: "https://example.com/empty",
      structuredData: { count: 0, nodeCount: 0, types: [], diagnostics: [] },
    },
  ],
}, [{
  url: "https://example.com/product/",
  richResultsVerdict: "FAIL",
  richResultsDetectedItems: [{
    type: "Product",
    items: [{ issues: [{ message: "Google issue" }] }],
  }],
}]);

assert.equal(structuredRows.length, 1);
assert.equal(structuredRows[0].googleIssues.length, 1);
assert.deepEqual(summarizeStructuredDataRows(structuredRows), {
  errors: 1,
  recommendations: 1,
  google: 1,
});
assert.deepEqual(buildStructuredDataCoverage(structuredRows), [
  { type: "Product", pages: 1, validated: true },
  { type: "Organization", pages: 1, validated: false },
]);
assert.equal(buildStructuredDataCsvRows(structuredRows, "No issues").length, 4);

const [mainSource, inspectionSource, urlViewSource, structuredViewSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlInspectionPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GoogleUrlSetComparison.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/StructuredDataDiagnostics.jsx", import.meta.url), "utf8"),
]);
assert.doesNotMatch(mainSource, /function buildUrlSetFindings/);
assert.doesNotMatch(mainSource, /function StructuredDataDiagnostics/);
assert.match(inspectionSource, /<GoogleUrlSetComparison report=\{report\}/);
assert.match(inspectionSource, /<StructuredDataDiagnostics report=\{report\}/);
assert.match(inspectionSource, /language=\{language\}/);
assert.match(urlViewSource, /buildUrlSetCsvRows\(findings, typeLabels\)/);
assert.match(urlViewSource, /<ResultPagination/);
assert.match(structuredViewSource, /buildStructuredDataCsvRows\(rows, copy\.structuredNoIssues\)/);
assert.match(structuredViewSource, /<ResultPagination/);

console.log("google diagnostics tests passed");
