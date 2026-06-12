import assert from "node:assert/strict";
import { normalizeGscSitesResponse } from "../src/gsc-sites.js";

const result = normalizeGscSitesResponse({
  siteEntry: [
    { siteUrl: "https://restricted.example.com/", permissionLevel: "siteRestrictedUser" },
    { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
    { siteUrl: "https://full.example.com/", permissionLevel: "siteFullUser" },
    { siteUrl: "https://unverified.example.com/", permissionLevel: "siteUnverifiedUser" },
    { siteUrl: "https://full.example.com/", permissionLevel: "siteRestrictedUser" },
    { siteUrl: "", permissionLevel: "siteOwner" },
  ],
});

assert.equal(result.total, 4);
assert.equal(result.verifiedCount, 3);
assert.deepEqual(result.sites.map((site) => site.siteUrl), [
  "sc-domain:example.com",
  "https://full.example.com/",
  "https://restricted.example.com/",
  "https://unverified.example.com/",
]);
assert.equal(result.sites[1].permissionLevel, "siteFullUser");
assert.equal(result.sites[3].verified, false);
assert.deepEqual(normalizeGscSitesResponse({}), { sites: [], verifiedCount: 0, total: 0 });

console.log("gsc-sites-tests-passed");
