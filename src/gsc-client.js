import { apiGet, apiPost } from "./api-client.js";

export function getGscStatus() {
  return apiGet("/api/gsc/status", {
    fallbackMessage: "Could not refresh Search Console API status",
  });
}

export function clearGscConnection() {
  return apiPost("/api/gsc/clear", {}, {
    fallbackMessage: "Could not clear Search Console config",
  });
}

export function testGscConnection(siteUrl) {
  return apiPost("/api/gsc/test", { siteUrl }, {
    fallbackMessage: "Search Console API test failed",
  });
}

export function loadGscSites() {
  return apiGet("/api/gsc/sites", {
    fallbackMessage: "Could not load Search Console properties",
  });
}

export function saveGscProperty(siteUrl) {
  return apiPost("/api/gsc/config", { siteUrl }, {
    fallbackMessage: "Could not save Search Console property",
  });
}

export function startGscOAuth(siteUrl) {
  return apiPost("/api/gsc/oauth/start", { siteUrl }, {
    fallbackMessage: "Could not start OAuth",
  });
}

export function loadGscSearchAnalytics(request) {
  return apiPost("/api/gsc/search-analytics", request, {
    fallbackMessage: "Search Analytics failed",
  });
}

export function loadGscSitemaps(siteUrl) {
  return apiPost("/api/gsc/sitemaps", { siteUrl }, {
    fallbackMessage: "Could not load Search Console sitemaps",
  });
}

export function inspectGscUrls(urls, siteUrl) {
  return apiPost("/api/gsc/inspect", { urls, siteUrl }, {
    fallbackMessage: "URL Inspection failed",
  });
}
