import assert from "node:assert/strict";
import { isPublicIp, trustedGoogleHostname } from "../server/api.js";
import { absoluteLogUrl, parseAccessLog, STATIC_ASSET_PATH } from "../src/googlebot-log.js";

const combined = [
  '66.249.66.1 - - [06/Jun/2026:12:00:00 +0000] "GET /page?x=1 HTTP/1.1" 200 123 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
  '203.0.113.4 - - [06/Jun/2026:12:01:00 +0000] "GET /human HTTP/1.1" 200 123 "-" "Mozilla/5.0"',
].join("\n");
const combinedResult = parseAccessLog(combined);
assert.equal(combinedResult.records.length, 1);
assert.equal(combinedResult.records[0].path, "/page?x=1");
assert.equal(combinedResult.records[0].status, 200);
assert.deepEqual(combinedResult.formats, ["Nginx/Apache"]);

const cloudflare = JSON.stringify([
  {
    ClientIP: "66.249.66.2",
    ClientRequestMethod: "GET",
    ClientRequestURI: "/cloudflare",
    ClientRequestHost: "www.example.com",
    ClientRequestUserAgent: "Googlebot/2.1",
    EdgeResponseStatus: 503,
    EdgeStartTimestamp: 1780747200000000000,
  },
]);
const cloudflareResult = parseAccessLog(cloudflare);
assert.equal(cloudflareResult.records[0].host, "www.example.com");
assert.equal(cloudflareResult.records[0].status, 503);
assert.match(cloudflareResult.records[0].timestamp, /^2026-/);

const vercelNdjson = JSON.stringify({
  ip: "66.249.66.3",
  requestPath: "/vercel",
  method: "GET",
  statusCode: 404,
  userAgent: "GoogleOther",
  timestamp: 1780747200000,
});
const vercelResult = parseAccessLog(vercelNdjson);
assert.equal(vercelResult.records[0].path, "/vercel");
assert.equal(vercelResult.records[0].status, 404);

const csv = [
  "ClientIP,ClientRequestURI,ClientRequestUserAgent,EdgeResponseStatus",
  '66.249.66.4,/csv,"Google-InspectionTool",200',
].join("\n");
assert.equal(parseAccessLog(csv).records.length, 1);

assert.equal(absoluteLogUrl({ path: "/page?x=1", host: "www.example.com" }, "https://example.com/"), "https://www.example.com/page?x=1");
assert.ok(STATIC_ASSET_PATH.test("/assets/app.js?x=1"));
assert.equal(isPublicIp("127.0.0.1"), false);
assert.equal(isPublicIp("192.168.1.1"), false);
assert.equal(isPublicIp("::ffff:127.0.0.1"), false);
assert.equal(isPublicIp("fe80::1"), false);
assert.equal(isPublicIp("8.8.8.8"), true);
assert.equal(trustedGoogleHostname("crawl-66-249-66-1.googlebot.com."), true);
assert.equal(trustedGoogleHostname("googlebot.com.evil.example"), false);

console.log("googlebot-log-tests-passed");
