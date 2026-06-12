import crypto from "node:crypto";

const V1_PREFIX = "enc:v1";
const V2_PREFIX = "enc:v2";

function keyEntry(secret) {
  const value = String(secret || "");
  if (!value) return null;
  const digest = crypto.createHash("sha256").update(value).digest();
  return {
    id: crypto.createHash("sha256").update(digest).digest("base64url").slice(0, 12),
    key: digest,
  };
}

export function splitEncryptionSecrets(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function createTokenKeyring({ primarySecret = "", previousSecrets = [], legacySecrets = [] } = {}) {
  const entries = [];
  const seen = new Set();
  for (const secret of [primarySecret, ...previousSecrets, ...legacySecrets]) {
    const entry = keyEntry(secret);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return {
    primary: entries[0] || null,
    entries,
  };
}

function decryptWithKey(encrypted, key, iv, tag, aad = null) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function inspectStoredToken(value, keyring) {
  const input = String(value || "");
  if (!input) return { value: "", encrypted: false, needsRotation: false, keyId: "" };
  if (!input.startsWith("enc:")) {
    return {
      value: input,
      encrypted: false,
      needsRotation: Boolean(keyring.primary),
      keyId: "",
    };
  }
  if (!keyring.entries.length) throw new Error("A token encryption key is required to decrypt stored tokens.");

  const parts = input.split(":");
  if (input.startsWith(`${V2_PREFIX}:`) && parts.length === 6) {
    const [, , keyId, ivText, tagText, encryptedText] = parts;
    const preferred = keyring.entries.find((entry) => entry.id === keyId);
    const candidates = preferred
      ? [preferred, ...keyring.entries.filter((entry) => entry !== preferred)]
      : keyring.entries;
    for (const entry of candidates) {
      try {
        const aad = Buffer.from(`${V2_PREFIX}:${keyId}`, "utf8");
        return {
          value: decryptWithKey(
            Buffer.from(encryptedText, "base64url"),
            entry.key,
            Buffer.from(ivText, "base64url"),
            Buffer.from(tagText, "base64url"),
            aad,
          ),
          encrypted: true,
          needsRotation: entry.id !== keyring.primary?.id || keyId !== keyring.primary?.id,
          keyId,
        };
      } catch {
        // Try the next configured historical key.
      }
    }
  } else if (input.startsWith(`${V1_PREFIX}:`) && parts.length === 5) {
    const [, , ivText, tagText, encryptedText] = parts;
    for (const entry of keyring.entries) {
      try {
        return {
          value: decryptWithKey(
            Buffer.from(encryptedText, "base64url"),
            entry.key,
            Buffer.from(ivText, "base64url"),
            Buffer.from(tagText, "base64url"),
          ),
          encrypted: true,
          needsRotation: true,
          keyId: entry.id,
        };
      } catch {
        // Legacy v1 ciphertext did not include a key ID, so all known keys must be tried.
      }
    }
  } else {
    throw new Error("Stored token encryption format is invalid.");
  }
  throw new Error("Stored token could not be decrypted with the configured keys.");
}

export function encryptStoredToken(value, keyring) {
  const input = String(value || "");
  if (!input) return "";
  if (!keyring.primary) return input;
  const plaintext = input.startsWith("enc:") ? inspectStoredToken(input, keyring).value : input;
  const iv = crypto.randomBytes(12);
  const aad = Buffer.from(`${V2_PREFIX}:${keyring.primary.id}`, "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", keyring.primary.key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    V2_PREFIX,
    keyring.primary.id,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}
