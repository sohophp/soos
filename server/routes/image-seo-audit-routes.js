import { readJsonBody, sendJson } from "../http.js";

export function handleImageSeoAuditRoute(req, res, requestPath, options = {}) {
  if (req.method !== "POST" || requestPath !== "/api/image-seo-audit") return false;
  readJsonBody(req, 10000)
    .then((body) => options.auditPage(body.url, { enabledRules: body.enabledRules }))
    .then((result) => sendJson(res, 200, result))
    .catch((error) => {
      const status = ["PAGE_FETCH_FAILED", "NOT_HTML"].includes(error?.code) ? 502 : 400;
      options.sendRouteError(res, error, status, { retryable: status >= 500 });
    });
  return true;
}
