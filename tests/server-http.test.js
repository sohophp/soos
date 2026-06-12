import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  beginRequest,
  errorCode,
  readJsonBody,
  requestIdFromRequest,
} from "../server/http.js";

assert.equal(
  requestIdFromRequest({ headers: { "x-request-id": "request-test-123" } }),
  "request-test-123",
);
assert.match(
  requestIdFromRequest({ headers: { "x-request-id": "bad id" } }),
  /^[0-9a-f-]{36}$/,
);

assert.equal(errorCode({ code: "INVALID_JSON" }, 400), "INVALID_JSON");
assert.equal(errorCode(null, 404), "NOT_FOUND");
assert.equal(errorCode(null, 500), "INTERNAL_ERROR");

const responseHeaders = new Map();
const fakeResponse = {
  setHeader: (key, value) => responseHeaders.set(key.toLowerCase(), value),
  once: () => {},
};
beginRequest({
  method: "GET",
  url: "/api/test",
  headers: { origin: "https://soos.example.com", host: "soos.example.com", "x-forwarded-proto": "https" },
}, fakeResponse, { info: () => {} });
assert.equal(fakeResponse.soosAllowedOrigin, "https://soos.example.com");

const parsed = await readJsonBody(Readable.from([Buffer.from('{"ok":true}')]), 100);
assert.deepEqual(parsed, { ok: true });

await assert.rejects(
  () => readJsonBody(Readable.from([Buffer.from("{")]), 100),
  (error) => error.code === "INVALID_JSON" && /Invalid JSON/.test(error.message),
);

await assert.rejects(
  () => readJsonBody(Readable.from([Buffer.from('{"value":"1234567890"}')]), 8),
  (error) => error.code === "REQUEST_TOO_LARGE",
);

console.log("server-http-tests-passed");
