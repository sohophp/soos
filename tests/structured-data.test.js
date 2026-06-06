import assert from "node:assert/strict";
import { inspectJsonLd } from "../server/api.js";

const wrap = (value) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

const valid = inspectJsonLd(
  wrap({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@id": "https://example.com/#org",
        "@type": "Organization",
        name: "Example",
        url: "https://example.com/",
        logo: "https://example.com/logo.png",
      },
      {
        "@type": "Product",
        name: "Widget",
        offers: { "@type": "Offer", price: "10", priceCurrency: "USD" },
        brand: { "@id": "https://example.com/#org" },
      },
    ],
  }),
  "https://example.com/product",
  "Widget",
);

assert.equal(valid.nodeCount, 2);
assert.equal(valid.diagnostics.filter((item) => item.severity === "warning").length, 0);

const broken = inspectJsonLd(
  wrap({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Product", brand: { "@id": "#missing" } },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Question",
            acceptedAnswer: { "@type": "Answer" },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ "@type": "ListItem", name: "Home" }],
      },
    ],
  }),
  "https://example.com/page",
  "Page",
);

const codes = broken.diagnostics.map((item) => item.code);
assert.ok(codes.includes("unresolved_reference"));
assert.ok(codes.includes("missing_required_any"));
assert.ok(broken.diagnostics.some((item) => item.type === "Answer" && item.property === "text"));
assert.ok(broken.diagnostics.some((item) => item.code === "invalid_breadcrumb"));

console.log(`structured-data-tests-passed: ${broken.diagnostics.length} findings`);
