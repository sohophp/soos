import { normalizeGscSitemapResponse } from "../src/gsc-sitemaps.js";
import { normalizeGscSitesResponse } from "../src/gsc-sites.js";
import {
  compareGscSearchAnalytics,
  queryGscSearchAnalytics,
} from "./gsc-search-analytics.js";
import { createOAuthState } from "./oauth-security.js";
import { normalizeUrl, unique } from "./scan-parsers.js";

const GSC_SCOPE = "openid email profile https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function friendlyGscApiError(status, body, fallback) {
  const message = body?.error?.message || fallback || `Search Console HTTP ${status}`;
  if (status === 401) {
    return "Google rejected the access token. It may be expired or copied incorrectly; generate a fresh token with the webmasters.readonly scope.";
  }
  if (status === 403) {
    return "Google denied access to this Search Console property. Check that the Google account has permission and that Property URL exactly matches the property in Search Console.";
  }
  if (status === 404) {
    return "Search Console could not find that property. URL-prefix properties must match exactly, including protocol, www, and trailing slash; Domain properties use sc-domain:example.com.";
  }
  return message;
}

export function friendlyGscNetworkError(error) {
  const message = String(error?.message || error || "");
  if (/fetch failed|network|ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
    return "Could not reach Google Search Console API. Check the network or proxy connection, then try again.";
  }
  return message || "Could not reach Google Search Console API.";
}

export function createGscService({
  configStore,
  oauthRedirectUri,
  runtimeMetrics,
  fetchImpl = globalThis.fetch,
  wait = sleep,
} = {}) {
  if (!configStore?.readWithEnv || !configStore?.write) {
    throw new Error("GSC service requires a config store.");
  }
  if (typeof oauthRedirectUri !== "function") {
    throw new Error("GSC service requires oauthRedirectUri.");
  }

  async function monitoredGoogleFetch(service, url, options) {
    const startedAt = Date.now();
    try {
      const response = await fetchImpl(url, options);
      runtimeMetrics?.recordGoogle(service, response.ok, Date.now() - startedAt);
      return response;
    } catch (error) {
      runtimeMetrics?.recordGoogle(service, false, Date.now() - startedAt);
      throw error;
    }
  }

  async function postGoogleToken(params) {
    const response = await monitoredGoogleFetch("oauth-token", GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    }).catch((error) => {
      throw new Error(friendlyGscNetworkError(error));
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error_description || body?.error || `Google OAuth HTTP ${response.status}`);
    }
    return body;
  }

  async function fetchGoogleAccount(accessToken) {
    if (!accessToken) return {};
    const response = await monitoredGoogleFetch("userinfo", GOOGLE_USERINFO_URL, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!response?.ok) return {};
    const body = await response.json().catch(() => ({}));
    return {
      googleAccountEmail: body.email || "",
      googleAccountName: body.name || "",
      googleAccountPicture: body.picture || "",
    };
  }

  async function revokeGoogleToken(config) {
    const token = config?.refreshToken || config?.accessToken || "";
    if (!token) return { revoked: false };
    const response = await monitoredGoogleFetch("oauth-revoke", GOOGLE_OAUTH_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch((error) => ({ networkError: friendlyGscNetworkError(error) }));
    if (response.networkError) return { revoked: false, error: response.networkError };
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { revoked: false, error: body || `Google revoke HTTP ${response.status}` };
    }
    return { revoked: true };
  }

  async function refreshAccessToken(config) {
    if (!config.oauthClientId || !config.oauthClientSecret || !config.refreshToken) {
      throw new Error("OAuth refresh token is not configured.");
    }
    const token = await postGoogleToken({
      client_id: config.oauthClientId,
      client_secret: config.oauthClientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    });
    const next = {
      ...config,
      accessToken: token.access_token || config.accessToken || "",
      tokenUpdatedAt: new Date().toISOString(),
      tokenExpiresAt: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : "",
      updatedAt: new Date().toISOString(),
    };
    delete next.oauthClientSource;
    if (config.serverless && !config.databaseConfigured) return next;
    await configStore.write(next, config.sessionId);
    return next;
  }

  async function getConfigWithAccessToken(overrides = {}, requirements = {}) {
    const config = await configStore.readWithEnv(overrides.sessionId);
    if (typeof overrides.siteUrl === "string" && overrides.siteUrl.trim()) {
      config.siteUrl = overrides.siteUrl.trim();
    }
    if (requirements.requireSite !== false && !config.siteUrl) {
      throw new Error("Search Console property URL is required.");
    }
    if (config.refreshToken) {
      const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt).getTime() : 0;
      if (!config.accessToken || !expiresAt || Date.now() > expiresAt - 60 * 1000) {
        return refreshAccessToken(config);
      }
    }
    return config;
  }

  function statusFromConfig(config) {
    const tokenUpdatedAt = config.tokenUpdatedAt || config.updatedAt || "";
    const tokenAgeMs = tokenUpdatedAt ? Date.now() - new Date(tokenUpdatedAt).getTime() : null;
    const isOauth = Boolean(config.refreshToken);
    const expiresAt = config.tokenExpiresAt || "";
    const tokenLikelyExpired = isOauth
      ? Boolean(expiresAt && Date.now() > new Date(expiresAt).getTime() - 60 * 1000)
      : Number.isFinite(tokenAgeMs)
        ? tokenAgeMs > 55 * 60 * 1000
        : false;
    const hasApiCredential = Boolean(config.accessToken || config.refreshToken);
    const note = !config.oauthAppConfigured
      ? "Server OAuth app is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."
      : config.serverless && !config.databaseConfigured && !hasApiCredential
        ? "Vercel deployments need DATABASE_URL to save each user's Search Console connection."
        : config.databaseConfigured
          ? "Connect Google Search Console with the Google account that has access to this property."
          : isOauth
            ? "OAuth refresh token configured. soos will refresh Search Console access automatically."
            : config.accessToken
              ? tokenLikelyExpired
                ? "Manual access tokens usually expire after about 1 hour. Paste a fresh token, then test again."
                : "Manual token configured. Use Test API connection to confirm property access."
              : "Configure a Search Console property and access token, or use CSV import.";
    return {
      configured: Boolean(config.siteUrl && hasApiCredential),
      mode: isOauth ? "oauth-refresh" : config.accessToken ? "manual-token" : "not-configured",
      siteUrl: config.siteUrl || "",
      token: config.accessToken ? maskSecret(config.accessToken) : "",
      oauthConfigured: Boolean(config.oauthAppConfigured),
      oauthAppConfigured: Boolean(config.oauthAppConfigured),
      oauthClientSource: config.oauthClientSource || "",
      googleAccountEmail: config.googleAccountEmail || "",
      googleAccountName: config.googleAccountName || "",
      googleAccountPicture: config.googleAccountPicture || "",
      oauthRedirectUri: oauthRedirectUri(),
      refreshToken: config.refreshToken ? "configured" : "",
      serverless: Boolean(config.serverless),
      databaseConfigured: Boolean(config.databaseConfigured),
      persistentConfig: Boolean(!config.serverless || config.databaseConfigured),
      tokenExpiresAt: expiresAt,
      tokenUpdatedAt,
      tokenLikelyExpired,
      note,
    };
  }

  function buildOAuthUrl(config) {
    if (!config.siteUrl) throw new Error("Search Console property URL is required before starting OAuth.");
    if (!config.oauthClientId || !config.oauthClientSecret) {
      throw new Error("Google OAuth app is not configured on the server.");
    }
    const oauthState = createOAuthState();
    const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set("client_id", config.oauthClientId);
    authUrl.searchParams.set("redirect_uri", oauthRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GSC_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", oauthState.state);
    return {
      authUrl: authUrl.toString(),
      state: oauthState.state,
      stateCreatedAt: oauthState.createdAt,
      redirectUri: oauthRedirectUri(),
    };
  }

  async function listSites(options = {}) {
    const config = await getConfigWithAccessToken(options, { requireSite: false });
    if (!config.accessToken) throw new Error("Search Console API is not configured.");
    const response = await monitoredGoogleFetch("sites", "https://www.googleapis.com/webmasters/v3/sites", {
      headers: { "Authorization": `Bearer ${config.accessToken}` },
    }).catch((error) => {
      throw new Error(friendlyGscNetworkError(error));
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(friendlyGscApiError(response.status, body, `Search Console Sites HTTP ${response.status}`));
    }
    return {
      selectedSiteUrl: config.siteUrl || "",
      ...normalizeGscSitesResponse(body),
    };
  }

  async function testConnection(options = {}) {
    const config = await getConfigWithAccessToken(options);
    if (!config.siteUrl || !config.accessToken) throw new Error("Search Console API is not configured.");
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}`;
    const response = await monitoredGoogleFetch("property-test", endpoint, {
      headers: { "Authorization": `Bearer ${config.accessToken}` },
    }).catch((error) => {
      throw new Error(friendlyGscNetworkError(error));
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(friendlyGscApiError(response.status, body, `Search Console test HTTP ${response.status}`));
    }
    return {
      ok: true,
      siteUrl: config.siteUrl,
      permissionLevel: body.permissionLevel || "",
      message: "Search Console connection works for this property.",
      status: statusFromConfig(config),
    };
  }

  async function listSitemaps(options = {}) {
    const config = await getConfigWithAccessToken(options);
    if (!config.siteUrl || !config.accessToken) throw new Error("Search Console API is not configured.");
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/sitemaps`;
    const response = await monitoredGoogleFetch("sitemaps", endpoint, {
      headers: { "Authorization": `Bearer ${config.accessToken}` },
    }).catch((error) => {
      throw new Error(friendlyGscNetworkError(error));
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(friendlyGscApiError(response.status, body, `Search Console Sitemaps HTTP ${response.status}`));
    }
    return {
      siteUrl: config.siteUrl,
      ...normalizeGscSitemapResponse(body),
    };
  }

  async function inspectUrl(config, inspectionUrl) {
    const response = await monitoredGoogleFetch(
      "url-inspection",
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspectionUrl,
          siteUrl: config.siteUrl,
          languageCode: "en-US",
        }),
      },
    ).catch((error) => ({ ok: false, networkError: friendlyGscNetworkError(error) }));
    if (response.networkError) return { url: inspectionUrl, ok: false, error: response.networkError };
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        url: inspectionUrl,
        ok: false,
        error: friendlyGscApiError(response.status, body, `HTTP ${response.status}`),
      };
    }
    const index = body?.inspectionResult?.indexStatusResult || {};
    const mobile = body?.inspectionResult?.mobileUsabilityResult || {};
    const rich = body?.inspectionResult?.richResultsResult || {};
    return {
      url: inspectionUrl,
      ok: true,
      verdict: index.verdict || "",
      coverageState: index.coverageState || "",
      indexingState: index.indexingState || "",
      robotsTxtState: index.robotsTxtState || "",
      pageFetchState: index.pageFetchState || "",
      crawledAs: index.crawledAs || "",
      referringUrls: index.referringUrls || [],
      sitemap: index.sitemap || [],
      lastCrawlTime: index.lastCrawlTime || "",
      googleCanonical: index.googleCanonical || "",
      userCanonical: index.userCanonical || "",
      mobileVerdict: mobile.verdict || "",
      mobileIssues: mobile.issues || [],
      richResultsVerdict: rich.verdict || "",
      richResultsDetectedItems: rich.detectedItems || [],
    };
  }

  async function inspectUrls(urls, options = {}) {
    const config = await getConfigWithAccessToken(options);
    if (!config.siteUrl || !config.accessToken) throw new Error("Search Console API is not configured.");
    const uniqueUrls = unique((urls || []).filter((url) => /^https?:\/\//i.test(String(url || "")))).slice(0, 25);
    const results = [];
    for (const url of uniqueUrls) {
      results.push(await inspectUrl(config, url));
      await wait(150);
    }
    return {
      siteUrl: config.siteUrl,
      limit: 25,
      inspected: results.length,
      results,
    };
  }

  function searchAnalyticsDependencies() {
    return {
      getConfigWithAccessToken,
      friendlyNetworkError: friendlyGscNetworkError,
      friendlyApiError: friendlyGscApiError,
      normalizeUrl,
      fetchImpl: (url, options) => monitoredGoogleFetch("search-analytics", url, options),
    };
  }

  return {
    buildOAuthUrl,
    compareSearchAnalytics: (options) => compareGscSearchAnalytics(options, searchAnalyticsDependencies()),
    fetchGoogleAccount,
    getConfigWithAccessToken,
    inspectUrls,
    listSitemaps,
    listSites,
    postGoogleToken,
    querySearchAnalytics: (options) => queryGscSearchAnalytics(options, searchAnalyticsDependencies()),
    revokeGoogleToken,
    statusFromConfig,
    testConnection,
  };
}
