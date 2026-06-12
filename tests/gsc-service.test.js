import assert from "node:assert/strict";
import {
  createGscService,
  friendlyGscApiError,
  friendlyGscNetworkError,
} from "../server/gsc-service.js";

const writes = [];
const requests = [];
let config = {
  siteUrl: "https://example.com/",
  accessToken: "",
  refreshToken: "refresh-secret",
  oauthClientId: "client-id",
  oauthClientSecret: "client-secret",
  oauthAppConfigured: true,
  sessionId: "session-a",
  serverless: false,
  databaseConfigured: true,
  tokenExpiresAt: "2020-01-01T00:00:00.000Z",
  googleAccountEmail: "owner@example.com",
};
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const service = createGscService({
  configStore: {
    readWithEnv: async () => ({ ...config }),
    write: async (next) => {
      writes.push(next);
      config = { ...next };
    },
  },
  oauthRedirectUri: () => "https://soos.example/api/gsc/oauth/callback",
  runtimeMetrics: { recordGoogle: () => {} },
  wait: async () => {},
  fetchImpl: async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return response({ access_token: "fresh-access-token", expires_in: 3600 });
    }
    if (String(url).includes("/sites/") && !String(url).endsWith("/sites")) {
      return response({ permissionLevel: "siteOwner" });
    }
    if (String(url).endsWith("/sites")) {
      return response({ siteEntry: [{ siteUrl: "https://example.com/", permissionLevel: "siteOwner" }] });
    }
    throw new Error(`Unexpected request: ${url}`);
  },
});

const oauth = service.buildOAuthUrl(config);
const authUrl = new URL(oauth.authUrl);
assert.equal(authUrl.searchParams.get("client_id"), "client-id");
assert.equal(authUrl.searchParams.get("access_type"), "offline");
assert.equal(authUrl.searchParams.get("prompt"), "consent");
assert.equal(oauth.redirectUri, "https://soos.example/api/gsc/oauth/callback");

const result = await service.testConnection({ sessionId: "session-a" });
assert.equal(result.ok, true);
assert.equal(result.permissionLevel, "siteOwner");
assert.equal(writes.length, 1);
assert.equal(writes[0].accessToken, "fresh-access-token");
assert.equal(requests[0].options.body.get("refresh_token"), "refresh-secret");

const status = service.statusFromConfig(config);
assert.equal(status.configured, true);
assert.equal(status.googleAccountEmail, "owner@example.com");
assert.equal(status.refreshToken, "configured");
assert.ok(!JSON.stringify(status).includes("refresh-secret"));
assert.ok(!JSON.stringify(status).includes("client-secret"));

const sites = await service.listSites({ sessionId: "session-a" });
assert.equal(sites.sites.length, 1);
assert.equal(sites.sites[0].siteUrl, "https://example.com/");

assert.match(friendlyGscApiError(403, {}, ""), /denied access/i);
assert.match(friendlyGscNetworkError(new Error("fetch failed")), /Could not reach Google/i);

console.log("gsc service tests passed");
