import assert from "node:assert/strict";
import { inspectJsonLd } from "../server/structured-data.js";

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
assert.ok(valid.validatedTypes.includes("Product"));

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

const extended = inspectJsonLd(
  wrap({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: "Short dataset",
        description: "Too short",
        distribution: { "@type": "DataDownload" },
      },
      {
        "@type": "SoftwareApplication",
        name: "App",
        offers: { "@type": "Offer", price: "-1" },
      },
      {
        "@type": "QAPage",
        mainEntity: {
          "@type": "Question",
          name: "How?",
          answerCount: "invalid",
          acceptedAnswer: { "@type": "Answer" },
        },
      },
      {
        "@type": "ItemList",
        itemListElement: [
          { "@type": "ListItem", position: 2, url: "/a" },
          { "@type": "ListItem", position: 4, url: "/a" },
        ],
      },
      {
        "@type": "Event",
        name: "Event",
        startDate: "not-a-date",
        location: { "@type": "Place" },
      },
      {
        "@type": "JobPosting",
        title: "Developer",
        description: "Build things",
        datePosted: "2026-06-06",
        hiringOrganization: { "@type": "Organization" },
        jobLocation: { "@type": "Place" },
      },
    ],
  }),
  "https://example.com/list",
  "List",
);

assert.ok(extended.diagnostics.some((item) => item.code === "invalid_length" && item.type === "Dataset"));
assert.ok(extended.diagnostics.some((item) => item.code === "invalid_value" && item.type === "Offer"));
assert.ok(extended.diagnostics.some((item) => item.code === "invalid_value" && item.property === "answerCount"));
assert.ok(extended.diagnostics.some((item) => item.code === "duplicate_value" && item.type === "ListItem"));
assert.ok(extended.diagnostics.some((item) => item.code === "non_sequential" && item.type === "ItemList"));
assert.ok(extended.diagnostics.some((item) => item.code === "invalid_date" && item.type === "Event"));
assert.ok(extended.diagnostics.some((item) => item.type === "Organization" && item.property === "name"));
assert.ok(extended.diagnostics.some((item) => item.type === "Place" && item.property === "address"));

const finalCoverage = inspectJsonLd(
  wrap({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        name: "Video",
        thumbnailUrl: "https://example.com/video.jpg",
        uploadDate: "2026-06-06",
        contentUrl: "https://example.com/video.mp4",
      },
      {
        "@type": "VacationRental",
        name: "House",
        identifier: "house-1",
        image: ["/1.jpg", "/2.jpg"],
        latitude: 1,
        longitude: 2,
        containsPlace: {
          "@type": "Accommodation",
          occupancy: { "@type": "QuantitativeValue" },
        },
      },
      {
        "@type": "ClaimReview",
        claimReviewed: "A claim",
        url: "https://example.com/fact",
        reviewRating: { "@type": "Rating", ratingValue: 1 },
      },
      {
        "@type": "MathSolver",
        url: "https://example.com/solver",
        usageInfo: "https://example.com/usage",
        potentialAction: { "@type": "SolveMathAction" },
      },
      {
        "@type": "CustomSeoThing",
        name: "Custom",
      },
    ],
  }),
  "https://example.com/fact",
  "A claim",
);

assert.ok(!finalCoverage.diagnostics.some((item) => item.type === "VideoObject" && item.property === "description" && item.severity === "warning"));
assert.ok(finalCoverage.diagnostics.some((item) => item.code === "insufficient_images" && item.type === "VacationRental"));
assert.ok(finalCoverage.diagnostics.some((item) => item.type === "QuantitativeValue" && item.property === "maxValue"));
assert.ok(finalCoverage.diagnostics.some((item) => item.type === "Rating" && item.property === "bestRating"));
assert.ok(finalCoverage.diagnostics.some((item) => item.type === "SolveMathAction" && item.property === "target"));
assert.ok(finalCoverage.diagnostics.some((item) => item.code === "type_not_validated" && item.type === "CustomSeoThing"));
assert.ok(finalCoverage.validatedTypes.includes("MathSolver"));
assert.ok(finalCoverage.unvalidatedTypes.includes("CustomSeoThing"));

console.log(`structured-data-tests-passed: ${broken.diagnostics.length + extended.diagnostics.length + finalCoverage.diagnostics.length} findings`);
