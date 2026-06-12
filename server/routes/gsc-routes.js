import { readJsonBody, sendHtml, sendJson } from "../http.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function handleGscRoute(req, res, requestPath, dependencies) {
  const {
    sessionId,
    isServerlessRuntime,
    persistentConfigEnabled,
    readConfig,
    readConfigWithEnv,
    writeConfig,
    clearConfig,
    statusFromConfig,
    revokeGoogleToken,
    rotateSession,
    buildOAuthUrl,
    validateOAuthState,
    postGoogleToken,
    oauthRedirectUri,
    fetchGoogleAccount,
    testConnection,
    listSites,
    querySearchAnalytics,
    compareSearchAnalytics,
    listSitemaps,
    inspectUrls,
    sendRouteError,
  } = dependencies;

  if (req.method === "GET" && requestPath === "/api/gsc/status") {
    readConfigWithEnv(sessionId)
      .then((config) => sendJson(res, 200, statusFromConfig(config)))
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/config") {
    readJsonBody(req, 50000)
      .then(async (body) => {
        if (isServerlessRuntime() && !await persistentConfigEnabled()) {
          throw new Error("Set DATABASE_URL before saving Search Console connections on Vercel.");
        }
        const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";
        const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!siteUrl) throw new Error("Search Console property URL is required.");
        const current = await readConfig(sessionId);
        await writeConfig({
          ...current,
          siteUrl,
          accessToken: accessToken || current.accessToken || "",
          tokenUpdatedAt: accessToken
            ? new Date().toISOString()
            : current.tokenUpdatedAt || current.updatedAt || "",
          updatedAt: new Date().toISOString(),
        }, sessionId);
        return sendJson(res, 200, statusFromConfig(await readConfigWithEnv(sessionId)));
      })
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/clear") {
    readJsonBody(req, 50000)
      .then(async () => {
        if (isServerlessRuntime() && !await persistentConfigEnabled()) {
          throw new Error("Vercel deployments do not persist UI-saved OAuth config without DATABASE_URL.");
        }
        const revoke = await revokeGoogleToken(await readConfigWithEnv(sessionId));
        await clearConfig(sessionId);
        const nextSessionId = rotateSession(res);
        const config = await readConfigWithEnv(nextSessionId);
        return sendJson(res, 200, { ...statusFromConfig(config), revoke });
      })
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/oauth/start") {
    readJsonBody(req, 50000)
      .then(async (body) => {
        if (isServerlessRuntime() && !await persistentConfigEnabled()) {
          throw new Error("Set DATABASE_URL before starting OAuth on Vercel.");
        }
        const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";
        if (!siteUrl) throw new Error("Search Console property URL is required before starting OAuth.");
        const storedConfig = await readConfig(sessionId);
        await writeConfig({
          ...storedConfig,
          siteUrl,
          updatedAt: new Date().toISOString(),
        }, sessionId);
        const config = await readConfigWithEnv(sessionId);
        const oauth = buildOAuthUrl(config);
        await writeConfig({
          ...storedConfig,
          siteUrl,
          oauthState: oauth.state,
          oauthStateCreatedAt: oauth.stateCreatedAt,
          updatedAt: new Date().toISOString(),
        }, sessionId);
        return sendJson(res, 200, {
          authUrl: oauth.authUrl,
          redirectUri: oauth.redirectUri,
          status: statusFromConfig(config),
        });
      })
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "GET" && requestPath === "/api/gsc/oauth/callback") {
    const callbackUrl = new URL(req.url || "", "http://localhost");
    const code = callbackUrl.searchParams.get("code") || "";
    const state = callbackUrl.searchParams.get("state") || "";
    readConfigWithEnv(sessionId)
      .then(async (config) => {
        if (!code) throw new Error("OAuth callback did not include an authorization code.");
        validateOAuthState(config.oauthState, state, config.oauthStateCreatedAt);
        await writeConfig({
          ...config,
          oauthState: "",
          oauthStateCreatedAt: "",
          updatedAt: new Date().toISOString(),
        }, sessionId);
        const token = await postGoogleToken({
          client_id: config.oauthClientId,
          client_secret: config.oauthClientSecret,
          code,
          redirect_uri: oauthRedirectUri(),
          grant_type: "authorization_code",
        });
        const next = {
          ...config,
          accessToken: token.access_token || "",
          refreshToken: token.refresh_token || config.refreshToken || "",
          ...await fetchGoogleAccount(token.access_token || ""),
          tokenUpdatedAt: new Date().toISOString(),
          tokenExpiresAt: token.expires_in
            ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
            : "",
          oauthState: "",
          oauthStateCreatedAt: "",
          updatedAt: new Date().toISOString(),
        };
        delete next.oauthClientSource;
        if (!next.refreshToken) {
          throw new Error("Google did not return a refresh token. Start OAuth again and approve offline access.");
        }
        const nextSessionId = rotateSession(res);
        await writeConfig(next, nextSessionId);
        if (config.databaseConfigured) await clearConfig(sessionId);
        return sendHtml(res, 200, "<!doctype html><meta charset=\"utf-8\"><title>soos OAuth connected</title><body style=\"font-family:system-ui;padding:24px\"><h1>Search Console OAuth connected</h1><p>You can close this tab and return to soos.</p><script>try{localStorage.setItem(\"soos:gsc-oauth-connected\",String(Date.now()));if(window.opener){window.opener.postMessage({type:\"soos:gsc-oauth-connected\"},window.location.origin)}setTimeout(function(){window.close()},800)}catch(error){}</script></body>");
      })
      .catch((error) => sendHtml(res, 400, `<!doctype html><meta charset="utf-8"><title>soos OAuth error</title><body style="font-family:system-ui;padding:24px"><h1>OAuth failed</h1><p>${escapeHtml(error.message || error)}</p></body>`));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/test") {
    readJsonBody(req, 50000)
      .then((body) => testConnection({ siteUrl: body.siteUrl, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "GET" && requestPath === "/api/gsc/sites") {
    listSites({ sessionId })
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/search-analytics") {
    readJsonBody(req, 50000)
      .then((body) => body.comparePrevious
        ? compareSearchAnalytics({ ...body, sessionId })
        : querySearchAnalytics({ ...body, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/sitemaps") {
    readJsonBody(req, 50000)
      .then((body) => listSitemaps({ siteUrl: body.siteUrl, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/gsc/inspect") {
    readJsonBody(req, 200000)
      .then((body) => inspectUrls(body.urls || [], { siteUrl: body.siteUrl, sessionId }))
      .then((result) => sendJson(res, 200, result))
      .catch((error) => sendRouteError(res, error, 400));
    return true;
  }

  return false;
}
