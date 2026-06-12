import { sendJson } from "../http.js";

export function handleSystemRoute(req, res, requestPath, options = {}) {
  if (req.method === "GET" && (requestPath === "/api/health" || requestPath === "/api/healthz")) {
    sendJson(res, 200, {
      status: "ok",
      service: "soos-api",
      version: options.version || "0.2.0",
      timestamp: new Date(options.now?.() ?? Date.now()).toISOString(),
      uptimeSeconds: Math.floor(options.uptime?.() ?? process.uptime()),
      requestId: res.soosRequestId,
    });
    return true;
  }
  if (req.method === "GET" && requestPath === "/api/metrics") {
    sendJson(res, 200, options.runtimeMetrics.snapshot());
    return true;
  }
  return false;
}
