import assert from "node:assert/strict";
import { createScanFetcher } from "../server/scan-fetch.js";

function response(status, url, body = "", headers = {}) {
  let cancelled = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Headers(headers),
    body: {
      cancel: async () => {
        cancelled = true;
      },
    },
    text: async () => body,
    get cancelled() {
      return cancelled;
    },
  };
}

const requested = [];
const closed = [];
const clearedTimers = [];
let clock = 100;
const responses = new Map([
  ["https://example.com/start", response(301, "https://example.com/start", "", { location: "/middle" })],
  ["https://example.com/middle", response(302, "https://example.com/middle", "", { location: "https://www.example.com/final" })],
  ["https://www.example.com/final", response(200, "https://www.example.com/final", "<html>ok</html>", {
    "content-type": "text/html; charset=utf-8",
    "x-robots-tag": "googlebot: noindex, nofollow",
    link: "<https://www.example.com/final>; rel=\"canonical\"",
  })],
]);
const fetchText = createScanFetcher({
  fetchImpl: async (url, options) => {
    requested.push({ url, options });
    clock += 5;
    return responses.get(url);
  },
  createDispatcher: async (url) => ({
    dispatcher: {
      close: async () => closed.push(url),
    },
  }),
  resolveTarget: async () => {},
  now: () => clock,
  setTimer: () => "timer-a",
  clearTimer: (timer) => clearedTimers.push(timer),
});

const result = await fetchText("https://example.com/start");
assert.equal(result.status, 200);
assert.equal(result.finalUrl, "https://www.example.com/final");
assert.equal(result.redirectChain.length, 2);
assert.equal(result.redirectCrossHost, true);
assert.equal(result.text, "<html>ok</html>");
assert.equal(result.contentType, "text/html; charset=utf-8");
assert.equal(result.xRobotsTag, "googlebot: noindex, nofollow");
assert.equal(result.linkHeader, "<https://www.example.com/final>; rel=\"canonical\"");
assert.equal(result.durationMs, 15);
assert.equal(requested.length, 3);
assert.equal(requested.every(({ options }) => options.redirect === "manual"), true);
assert.equal(requested.every(({ options }) => options.headers["User-Agent"] === "soos/0.2 SEO audit"), true);
assert.equal(closed.length, 3);
assert.deepEqual(clearedTimers, ["timer-a"]);

const loopResponses = new Map([
  ["https://example.com/a", response(301, "https://example.com/a", "", { location: "/b" })],
  ["https://example.com/b", response(302, "https://example.com/b", "", { location: "/a" })],
]);
const loopFetch = createScanFetcher({
  fetchImpl: async (url) => loopResponses.get(url),
  createDispatcher: async () => ({ dispatcher: { close: async () => {} } }),
  setTimer: () => "timer-b",
  clearTimer: () => {},
});
const loop = await loopFetch("https://example.com/a");
assert.equal(loop.redirectLoop, true);
assert.equal(loop.text, "");

let verifiedProxyUrl = "";
const proxyDispatcher = {};
const proxyFetch = createScanFetcher({
  fetchImpl: async (url, options) => {
    assert.equal(options.dispatcher, proxyDispatcher);
    return response(200, url, "proxy");
  },
  resolveTarget: async (url) => {
    verifiedProxyUrl = url;
  },
  createDispatcher: async () => {
    throw new Error("must not create pinned dispatcher for provided proxy");
  },
  setTimer: () => "timer-c",
  clearTimer: () => {},
});
assert.equal((await proxyFetch("https://example.com/", { dispatcher: proxyDispatcher })).text, "proxy");
assert.equal(verifiedProxyUrl, "https://example.com/");

await assert.rejects(fetchText("javascript:alert(1)"), /Invalid HTTP/);

console.log("scan-fetch-tests-passed");
