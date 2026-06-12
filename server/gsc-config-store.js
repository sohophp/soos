import fs from "node:fs/promises";
import {
  createTokenKeyring,
  encryptStoredToken,
  inspectStoredToken,
  splitEncryptionSecrets,
} from "./token-crypto.js";

export function parseEnvText(text) {
  const env = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsAt = line.indexOf("=");
    if (equalsAt <= 0) continue;
    const key = line.slice(0, equalsAt).trim();
    let value = line.slice(equalsAt + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function createEnvReader({
  envPath,
  processEnv = process.env,
  readFile = fs.readFile,
} = {}) {
  let dotEnvCache = null;

  async function readDotEnvValues() {
    if (processEnv.SOOS_DISABLE_DOTENV === "1" || !envPath) return {};
    if (dotEnvCache) return dotEnvCache;
    try {
      dotEnvCache = parseEnvText(await readFile(envPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      dotEnvCache = {};
    }
    return dotEnvCache;
  }

  async function value(name) {
    if (processEnv[name]) return processEnv[name];
    const env = await readDotEnvValues();
    return env[name] || "";
  }

  return {
    value,
    databaseUrl: () => value("DATABASE_URL"),
    oauthClientId: () => value("GOOGLE_OAUTH_CLIENT_ID"),
    oauthClientSecret: () => value("GOOGLE_OAUTH_CLIENT_SECRET"),
    readDotEnvValues,
  };
}

export function sanitizeGscConfigForStorage(config) {
  const {
    adminConfigured,
    adminKeyRequired,
    databaseConfigured,
    oauthAppConfigured,
    oauthClientId,
    oauthClientSource,
    oauthClientSecret,
    persistentConfig,
    sessionId,
    serverless,
    ...stored
  } = config || {};
  return stored;
}

export function createGscConfigStore({
  configPath,
  envReader,
  getSql,
  ensureDatabase,
  isServerlessRuntime = () => false,
  readFile = fs.readFile,
  writeFile = fs.writeFile,
  removeFile = fs.rm,
} = {}) {
  if (!envReader?.value) throw new Error("GSC config store requires an environment reader.");
  if (typeof getSql !== "function") throw new Error("GSC config store requires getSql.");
  if (typeof ensureDatabase !== "function") throw new Error("GSC config store requires ensureDatabase.");

  const configKey = (sessionId) => `gsc_config:${sessionId}`;

  async function tokenKeyring() {
    const [primarySecret, previousText, clientSecret] = await Promise.all([
      envReader.value("SOOS_TOKEN_ENCRYPTION_KEY"),
      envReader.value("SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS"),
      envReader.oauthClientSecret(),
    ]);
    return createTokenKeyring({
      primarySecret: primarySecret || clientSecret,
      previousSecrets: splitEncryptionSecrets(previousText),
      legacySecrets: primarySecret ? [clientSecret] : [],
    });
  }

  async function protect(config) {
    const stored = sanitizeGscConfigForStorage(config);
    const keyring = await tokenKeyring();
    return {
      ...stored,
      accessToken: encryptStoredToken(stored.accessToken || "", keyring),
      refreshToken: encryptStoredToken(stored.refreshToken || "", keyring),
    };
  }

  async function reveal(config) {
    const keyring = await tokenKeyring();
    return {
      ...(config || {}),
      accessToken: inspectStoredToken(config?.accessToken || "", keyring).value,
      refreshToken: inspectStoredToken(config?.refreshToken || "", keyring).value,
    };
  }

  async function needsTokenRotation(config) {
    const keyring = await tokenKeyring();
    return ["accessToken", "refreshToken"].some((field) => {
      const value = config?.[field] || "";
      return value && inspectStoredToken(value, keyring).needsRotation;
    });
  }

  async function oauthAppConfig() {
    const [clientId, clientSecret] = await Promise.all([
      envReader.oauthClientId(),
      envReader.oauthClientSecret(),
    ]);
    return {
      oauthClientId: clientId,
      oauthClientSecret: clientSecret,
      oauthAppConfigured: Boolean(clientId && clientSecret),
    };
  }

  async function readFromDatabase(sessionId) {
    const sql = await getSql();
    if (!sql) return null;
    await ensureDatabase(sql);
    const rows = await sql`SELECT value FROM soos_config WHERE key = ${configKey(sessionId)} LIMIT 1`;
    const value = rows[0]?.value;
    const stored = typeof value === "string" ? JSON.parse(value || "{}") : value || {};
    const revealed = await reveal(stored);
    if (await needsTokenRotation(stored)) await writeToDatabase(revealed, sessionId);
    return revealed;
  }

  async function writeToDatabase(config, sessionId) {
    const sql = await getSql();
    if (!sql) return false;
    await ensureDatabase(sql);
    const stored = await protect(config);
    await sql`
      INSERT INTO soos_config (key, value, updated_at)
      VALUES (${configKey(sessionId)}, ${JSON.stringify(stored)}::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    return true;
  }

  async function clearFromDatabase(sessionId) {
    const sql = await getSql();
    if (!sql) return false;
    await ensureDatabase(sql);
    await sql`DELETE FROM soos_config WHERE key = ${configKey(sessionId)}`;
    return true;
  }

  async function read(sessionId) {
    const databaseConfig = await readFromDatabase(sessionId);
    if (databaseConfig) return databaseConfig;
    try {
      const stored = JSON.parse(await readFile(configPath, "utf8"));
      const revealed = await reveal(stored);
      if (await needsTokenRotation(stored)) {
        await writeFile(configPath, JSON.stringify(await protect(revealed), null, 2), "utf8");
      }
      return revealed;
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
  }

  async function write(config, sessionId) {
    if (await writeToDatabase(config, sessionId)) return;
    await writeFile(configPath, JSON.stringify(await protect(config), null, 2), "utf8");
  }

  async function clear(sessionId) {
    if (await clearFromDatabase(sessionId)) return;
    await removeFile(configPath, { force: true });
  }

  async function persistentEnabled() {
    return Boolean(await envReader.databaseUrl());
  }

  async function readWithEnv(sessionId) {
    const [config, databaseConfigured, oauthApp, accessToken, legacyAccessToken] = await Promise.all([
      read(sessionId),
      persistentEnabled(),
      oauthAppConfig(),
      envReader.value("SOOS_GSC_ACCESS_TOKEN"),
      envReader.value("GSC_ACCESS_TOKEN"),
    ]);
    const envAccessToken = accessToken || legacyAccessToken || "";
    return {
      ...config,
      siteUrl: config.siteUrl || "",
      accessToken: config.accessToken || envAccessToken,
      refreshToken: config.refreshToken || "",
      oauthClientId: oauthApp.oauthClientId || "",
      oauthClientSecret: oauthApp.oauthClientSecret || "",
      oauthAppConfigured: oauthApp.oauthAppConfigured,
      oauthClientSource: oauthApp.oauthAppConfigured ? "server-env" : "",
      sessionId,
      serverless: Boolean(isServerlessRuntime()),
      databaseConfigured,
    };
  }

  return {
    clear,
    persistentEnabled,
    protect,
    read,
    readWithEnv,
    reveal,
    write,
  };
}
