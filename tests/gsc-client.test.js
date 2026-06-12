import assert from "node:assert/strict";
import {
  clearGscConnection,
  getGscStatus,
  inspectGscUrls,
  loadGscSearchAnalytics,
  loadGscSites,
  loadGscSitemaps,
  saveGscProperty,
  startGscOAuth,
  testGscConnection,
} from "../src/gsc-client.js";

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({
    url,
    method: options.method,
    body: options.body ? JSON.parse(options.body) : null,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

await getGscStatus();
await clearGscConnection();
await testGscConnection("sc-domain:example.com");
await loadGscSites();
await saveGscProperty("sc-domain:example.com");
await startGscOAuth("https://example.com/");
await loadGscSearchAnalytics({ siteUrl: "https://example.com/", dimension: "page", comparePrevious: true });
await loadGscSitemaps("https://example.com/");
await inspectGscUrls(["https://example.com/a"], "https://example.com/");

assert.deepEqual(requests, [
  { url: "/api/gsc/status", method: "GET", body: null },
  { url: "/api/gsc/clear", method: "POST", body: {} },
  { url: "/api/gsc/test", method: "POST", body: { siteUrl: "sc-domain:example.com" } },
  { url: "/api/gsc/sites", method: "GET", body: null },
  { url: "/api/gsc/config", method: "POST", body: { siteUrl: "sc-domain:example.com" } },
  { url: "/api/gsc/oauth/start", method: "POST", body: { siteUrl: "https://example.com/" } },
  {
    url: "/api/gsc/search-analytics",
    method: "POST",
    body: { siteUrl: "https://example.com/", dimension: "page", comparePrevious: true },
  },
  { url: "/api/gsc/sitemaps", method: "POST", body: { siteUrl: "https://example.com/" } },
  {
    url: "/api/gsc/inspect",
    method: "POST",
    body: { urls: ["https://example.com/a"], siteUrl: "https://example.com/" },
  },
]);

globalThis.fetch = originalFetch;
console.log("gsc-client-tests-passed");
