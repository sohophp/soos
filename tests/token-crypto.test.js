import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createTokenKeyring,
  encryptStoredToken,
  inspectStoredToken,
  splitEncryptionSecrets,
} from "../server/token-crypto.js";

assert.deepEqual(splitEncryptionSecrets("old-a, old-b ,,old-c"), ["old-a", "old-b", "old-c"]);

const first = createTokenKeyring({ primarySecret: "first-key" });
const encrypted = encryptStoredToken("refresh-token", first);
assert.match(encrypted, /^enc:v2:[A-Za-z0-9_-]{12}:/);
assert.deepEqual(inspectStoredToken(encrypted, first), {
  value: "refresh-token",
  encrypted: true,
  needsRotation: false,
  keyId: first.primary.id,
});

const rotated = createTokenKeyring({
  primarySecret: "second-key",
  previousSecrets: ["first-key"],
});
const oldResult = inspectStoredToken(encrypted, rotated);
assert.equal(oldResult.value, "refresh-token");
assert.equal(oldResult.needsRotation, true);
const reencrypted = encryptStoredToken(encrypted, rotated);
assert.equal(inspectStoredToken(reencrypted, rotated).needsRotation, false);
assert.notEqual(reencrypted, encrypted);

const legacyIv = crypto.randomBytes(12);
const legacyCipher = crypto.createCipheriv("aes-256-gcm", first.primary.key, legacyIv);
const legacyEncrypted = Buffer.concat([legacyCipher.update("legacy-token", "utf8"), legacyCipher.final()]);
const legacy = [
  "enc:v1",
  legacyIv.toString("base64url"),
  legacyCipher.getAuthTag().toString("base64url"),
  legacyEncrypted.toString("base64url"),
].join(":");
assert.equal(inspectStoredToken(legacy, rotated).value, "legacy-token");
assert.equal(inspectStoredToken(legacy, rotated).needsRotation, true);

assert.throws(
  () => inspectStoredToken(encrypted, createTokenKeyring({ primarySecret: "unknown-key" })),
  /configured keys/,
);
assert.equal(encryptStoredToken("plain", createTokenKeyring()).startsWith("enc:"), false);

console.log("token-crypto-tests-passed");
