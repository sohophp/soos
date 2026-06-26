import { readJsonBody, sendJson } from "../http.js";

export function handlePageSpeedRoute(req, res, requestPath, options = {}) {
  if (req.method === "GET" && requestPath === "/api/pagespeed/status") {
    sendJson(res, 200, {
      defaultApiKeyConfigured: Boolean(options.defaultApiKeyConfigured?.()),
      defaultCruxApiKeyConfigured: Boolean(options.defaultCruxApiKeyConfigured?.()),
    });
    return true;
  }
  if (req.method !== "POST" || requestPath !== "/api/pagespeed/run") return false;
  readJsonBody(req, 10000)
    .then((body) => options.runPageSpeed(body, {
      defaultApiKey: options.defaultApiKey?.() || "",
    }))
    .then((result) => sendJson(res, 200, result))
    .catch((error) => {
      const status = error?.status === 429
        ? 429
        : error?.code === "PAGESPEED_NETWORK_ERROR" || error?.code === "PAGESPEED_TIMEOUT"
          ? 502
          : 400;
      options.sendRouteError(res, error, status, {
        retryable: status === 429 || status >= 500,
      });
    });
  return true;
}
