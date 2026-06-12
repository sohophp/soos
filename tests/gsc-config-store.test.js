import assert from "node:assert/strict";
import { createEnvReader, createGscConfigStore, parseEnvText } from "../server/gsc-config-store.js";

assert.deepEqual(parseEnvText(`
# comment
GOOGLE_OAUTH_CLIENT_ID="client-id"
GOOGLE_OAUTH_CLIENT_SECRET='client-secret'
INVALID
`), {
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
});

let storedText = "";
let removed = false;
const processEnv = {
  SOOS_DISABLE_DOTENV: "1",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  SOOS_TOKEN_ENCRYPTION_KEY: "test-encryption-key-with-enough-entropy",
  SOOS_GSC_ACCESS_TOKEN: "environment-token",
};
const envReader = createEnvReader({ processEnv });
const store = createGscConfigStore({
  configPath: "memory://gsc-config",
  envReader,
  getSql: async () => null,
  ensureDatabase: async () => {},
  isServerlessRuntime: () => false,
  readFile: async () => {
    if (!storedText) {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    }
    return storedText;
  },
  writeFile: async (_path, text) => {
    storedText = text;
  },
  removeFile: async () => {
    removed = true;
    storedText = "";
  },
});

await store.write({
  siteUrl: "https://example.com/",
  accessToken: "stored-access-token",
  refreshToken: "stored-refresh-token",
  oauthClientSecret: "must-not-persist",
  databaseConfigured: true,
}, "session-a");

assert.ok(!storedText.includes("stored-access-token"));
assert.ok(!storedText.includes("stored-refresh-token"));
assert.ok(!storedText.includes("must-not-persist"));

const revealed = await store.read("session-a");
assert.equal(revealed.accessToken, "stored-access-token");
assert.equal(revealed.refreshToken, "stored-refresh-token");

const withEnv = await store.readWithEnv("session-a");
assert.equal(withEnv.accessToken, "stored-access-token");
assert.equal(withEnv.oauthClientId, "client-id");
assert.equal(withEnv.oauthClientSecret, "client-secret");
assert.equal(withEnv.oauthAppConfigured, true);
assert.equal(withEnv.databaseConfigured, false);
assert.equal(withEnv.sessionId, "session-a");

await store.clear("session-a");
assert.equal(removed, true);

const envOnly = await store.readWithEnv("session-b");
assert.equal(envOnly.accessToken, "environment-token");
assert.equal(envOnly.siteUrl, "");

console.log("gsc config store tests passed");
