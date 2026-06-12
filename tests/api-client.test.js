import assert from "node:assert/strict";
import { ApiError, apiGet, apiPost, formatApiError } from "../src/api-client.js";

const originalFetch = globalThis.fetch;

assert.equal(
  formatApiError(new ApiError("Try later", { code: "RATE_LIMITED", requestId: "req-123" })),
  "Try later (RATE_LIMITED · request req-123)",
);
assert.equal(formatApiError(new Error("Local failure")), "Local failure");

globalThis.fetch = async (url, options) => new Response(JSON.stringify({
  url,
  method: options.method,
  received: JSON.parse(options.body),
}), {
  status: 200,
  headers: { "content-type": "application/json" },
});

const success = await apiPost("/api/example", { value: 3 });
assert.deepEqual(success, {
  url: "/api/example",
  method: "POST",
  received: { value: 3 },
});

globalThis.fetch = async () => new Response(JSON.stringify({
  error: {
    code: "RATE_LIMITED",
    message: "Try later",
    retryable: true,
    details: { limit: 10 },
  },
  requestId: "req-123",
}), {
  status: 429,
  headers: { "content-type": "application/json" },
});

await assert.rejects(
  () => apiGet("/api/example"),
  (error) => {
    assert.equal(error instanceof ApiError, true);
    assert.equal(error.message, "Try later");
    assert.equal(error.status, 429);
    assert.equal(error.code, "RATE_LIMITED");
    assert.equal(error.requestId, "req-123");
    assert.equal(error.retryable, true);
    assert.deepEqual(error.details, { limit: 10 });
    return true;
  },
);

globalThis.fetch = async () => new Response("Upstream unavailable", {
  status: 502,
  headers: { "content-type": "text/plain" },
});

await assert.rejects(
  () => apiGet("/api/example"),
  (error) => error instanceof ApiError
    && error.message === "Upstream unavailable"
    && error.status === 502
    && error.retryable,
);

globalThis.fetch = async () => {
  throw new TypeError("fetch failed");
};

await assert.rejects(
  () => apiGet("/api/example"),
  (error) => error instanceof ApiError && error.code === "NETWORK_ERROR" && error.retryable,
);

globalThis.fetch = originalFetch;
console.log("api-client-tests-passed");
