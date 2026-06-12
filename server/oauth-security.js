import crypto from "node:crypto";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function createOAuthState(now = Date.now()) {
  return {
    state: crypto.randomBytes(24).toString("base64url"),
    createdAt: new Date(now).toISOString(),
  };
}

export function validateOAuthState(expected, received, createdAt, now = Date.now()) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  if (!expectedBuffer.length || expectedBuffer.length !== receivedBuffer.length) {
    throw new Error("OAuth state did not match. Start OAuth again.");
  }
  if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("OAuth state did not match. Start OAuth again.");
  }
  const createdTime = new Date(createdAt || "").getTime();
  if (!Number.isFinite(createdTime) || now - createdTime > OAUTH_STATE_TTL_MS || createdTime > now + 60_000) {
    throw new Error("OAuth state expired. Start OAuth again.");
  }
  return true;
}
