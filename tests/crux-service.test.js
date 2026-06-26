import assert from "node:assert/strict";
import {
  normalizeCruxRecord,
  runCrux,
  validateCruxRequest,
} from "../server/crux-service.js";

assert.deepEqual(validateCruxRequest({
  apiKey: "test-key",
  url: "https://example.com/page",
  formFactor: "desktop",
}), {
  apiKey: "test-key",
  url: "https://example.com/page",
  origin: "https://example.com",
  formFactor: "DESKTOP",
});
assert.throws(
  () => validateCruxRequest({ url: "https://example.com/" }),
  { code: "CRUX_KEY_REQUIRED" },
);
assert.throws(
  () => validateCruxRequest({ apiKey: "x", url: "file:///etc/passwd" }),
  { code: "CRUX_URL_INVALID" },
);

const pageFixture = {
  record: {
    key: {
      formFactor: "PHONE",
      url: "https://example.com/page",
    },
    metrics: {
      largest_contentful_paint: {
        histogram: [
          { start: 0, end: 2500, density: 0.7 },
          { start: 2500, end: 4000, density: 0.2 },
          { start: 4000, density: 0.1 },
        ],
        percentiles: { p75: 2400 },
      },
      cumulative_layout_shift: {
        percentiles: { p75: "0.18" },
      },
      interaction_to_next_paint: {
        percentiles: { p75: 560 },
      },
    },
    collectionPeriod: {
      firstDate: { year: 2026, month: 5, day: 15 },
      lastDate: { year: 2026, month: 6, day: 11 },
    },
  },
  urlNormalizationDetails: {
    normalizedUrl: "https://example.com/page",
  },
};

const normalized = normalizeCruxRecord(pageFixture, "url");
assert.equal(normalized.available, true);
assert.equal(normalized.metrics.lcp.category, "good");
assert.equal(normalized.metrics.cls.category, "needs-improvement");
assert.equal(normalized.metrics.inp.category, "poor");
assert.equal(normalized.collectionPeriod.firstDate, "2026-05-15");
assert.equal(normalized.collectionPeriod.lastDate, "2026-06-11");
assert.equal(normalized.metrics.lcp.histogram[0].density, 0.7);

const requests = [];
const result = await runCrux({
  apiKey: "secret-key",
  url: "https://example.com/page",
  formFactor: "PHONE",
}, {
  fetchImpl: async (url, options) => {
    requests.push({
      url: String(url),
      body: JSON.parse(options.body),
    });
    return new Response(JSON.stringify(pageFixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});
assert.equal(result.preferredScope, "url");
assert.equal(requests.length, 2);
assert.equal(new URL(requests[0].url).origin, "https://chromeuxreport.googleapis.com");
assert.equal(new URL(requests[0].url).searchParams.get("key"), "secret-key");
assert.equal(requests[0].body.url, "https://example.com/page");
assert.equal(requests[1].body.origin, "https://example.com");
assert.equal(requests[0].body.formFactor, "PHONE");
assert.ok(requests[0].body.metrics.includes("interaction_to_next_paint"));

const defaultKeyRequests = [];
await runCrux({
  url: "https://example.com/page",
}, {
  defaultApiKey: "default-crux-secret",
  fetchImpl: async (url, options) => {
    defaultKeyRequests.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify(pageFixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});
assert.equal(new URL(defaultKeyRequests[0].url).searchParams.get("key"), "default-crux-secret");

const noData = await runCrux({
  apiKey: "secret-key",
  url: "https://example.com/new",
}, {
  fetchImpl: async () => new Response(JSON.stringify({
    error: { message: "No data" },
  }), {
    status: 404,
    headers: { "content-type": "application/json" },
  }),
});
assert.equal(noData.page.available, false);
assert.equal(noData.origin.available, false);
assert.equal(noData.preferredScope, "");

await assert.rejects(
  runCrux({
    apiKey: "disabled-key",
    url: "https://example.com/",
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: "Chrome UX Report API has not been used in project." },
    }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }),
  }),
  { code: "CRUX_API_NOT_ENABLED", status: 403 },
);

console.log("crux-service-tests-passed");
