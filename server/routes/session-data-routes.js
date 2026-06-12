import { readJsonBody, sendJson } from "../http.js";

export function handleSessionDataRoute(req, res, requestPath, dependencies) {
  const {
    sessionId,
    sessionDataSummary,
    deleteAllSessionData,
    rotateSession,
    persistentConfigEnabled,
    sendRouteError,
  } = dependencies;

  if (req.method === "GET" && requestPath === "/api/session-data") {
    sessionDataSummary(sessionId)
      .then((summary) => sendJson(res, 200, summary))
      .catch((error) => sendRouteError(res, error, 500));
    return true;
  }

  if (req.method === "POST" && requestPath === "/api/session-data/delete") {
    readJsonBody(req, 10000)
      .then(async (body) => {
        if (body.confirm !== "DELETE") {
          const error = new Error("Explicit deletion confirmation is required.");
          error.code = "CONFIRMATION_REQUIRED";
          throw error;
        }
        const result = await deleteAllSessionData(sessionId);
        rotateSession(res);
        return sendJson(res, 200, {
          ...result,
          remaining: {
            gscConfig: false,
            jobs: 0,
            batches: 0,
            leases: 0,
            storage: await persistentConfigEnabled() ? "neon" : "memory",
          },
        });
      })
      .catch((error) => sendRouteError(
        res,
        error,
        error?.code === "CONFIRMATION_REQUIRED" ? 400 : 500,
      ));
    return true;
  }

  return false;
}
