import assert from "node:assert/strict";
import {
  isPublicIp,
  trustedGoogleHostname,
  verifyGooglebotIp,
  verifyGooglebotIps,
} from "../server/googlebot-verifier.js";

assert.equal(isPublicIp("127.0.0.1"), false);
assert.equal(isPublicIp("10.0.0.1"), false);
assert.equal(isPublicIp("8.8.8.8"), true);
assert.equal(trustedGoogleHostname("crawl-1.googlebot.com."), true);
assert.equal(trustedGoogleHostname("googlebot.com.attacker.example"), false);

const now = Date.parse("2026-06-11T00:00:00.000Z");
const cache = new Map();
let reverseCalls = 0;
const verified = await verifyGooglebotIp("66.249.66.1", {
  now,
  cache,
  reverse: async () => {
    reverseCalls += 1;
    return ["crawl-66-249-66-1.googlebot.com."];
  },
  lookup: async () => [{ address: "66.249.66.1", family: 4 }],
});
assert.equal(verified.verified, true);
assert.equal(verified.category, "common");
assert.equal(verified.hostname, "crawl-66-249-66-1.googlebot.com");

const cached = await verifyGooglebotIp("66.249.66.1", {
  now: now + 1000,
  cache,
  reverse: async () => {
    reverseCalls += 1;
    return [];
  },
});
assert.equal(cached.verified, true);
assert.equal(reverseCalls, 1);

const spoofed = await verifyGooglebotIp("203.0.113.7", {
  now,
  cache: new Map(),
  reverse: async () => ["googlebot.com.attacker.example"],
  lookup: async () => {
    throw new Error("lookup should not run for an untrusted hostname");
  },
});
assert.equal(spoofed.verified, false);

const batch = await verifyGooglebotIps([
  "127.0.0.1",
  "66.249.66.2",
  "66.249.66.2",
], {
  now,
  cache: new Map(),
  reverse: async () => ["crawl-66-249-66-2.googlebot.com"],
  lookup: async () => [{ address: "66.249.66.2", family: 4 }],
});
assert.equal(batch.results.length, 1);
assert.equal(batch.results[0].verified, true);
assert.equal(batch.verifiedAt, "2026-06-11T00:00:00.000Z");

console.log("googlebot-verifier-tests-passed");
