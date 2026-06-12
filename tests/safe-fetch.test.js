import assert from "node:assert/strict";
import {
  createPinnedDispatcher,
  isBlockedHostname,
  isPublicIp,
  resolvePublicHttpTarget,
} from "../server/safe-fetch.js";

for (const address of [
  "127.0.0.1",
  "10.0.0.1",
  "169.254.169.254",
  "172.16.0.1",
  "192.168.1.1",
  "100.64.0.1",
  "::1",
  "fc00::1",
  "fe80::1",
  "::ffff:127.0.0.1",
]) assert.equal(isPublicIp(address), false, address);
assert.equal(isPublicIp("8.8.8.8"), true);
assert.equal(isPublicIp("2606:4700:4700::1111"), true);
assert.equal(isBlockedHostname("metadata.google.internal"), true);
assert.equal(isBlockedHostname("service.local"), true);
assert.equal(isBlockedHostname("example.com"), false);

await assert.rejects(
  resolvePublicHttpTarget("http://localhost/admin"),
  /not allowed/,
);
await assert.rejects(
  resolvePublicHttpTarget("http://[::1]/admin"),
  /non-public/,
);
await assert.rejects(
  resolvePublicHttpTarget("http://127.0.0.1/redirect-target"),
  /non-public/,
);
await assert.rejects(
  resolvePublicHttpTarget("http://example.com/", {
    lookup: async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }],
  }),
  /non-public/,
);
await assert.rejects(
  resolvePublicHttpTarget("http://user:pass@example.com/"),
  /credentials/,
);

const resolved = await resolvePublicHttpTarget("https://example.com/", {
  lookup: async () => [{ address: "93.184.216.34", family: 4 }],
});
assert.equal(resolved.selected.address, "93.184.216.34");

const pinned = await createPinnedDispatcher("https://example.com/", {
  lookup: async () => [{ address: "93.184.216.34", family: 4 }],
});
assert.equal(pinned.selected.address, "93.184.216.34");
await pinned.dispatcher.close();

console.log("safe-fetch-tests-passed");
