import crypto from "node:crypto";
import { isAllowedRequestOrigin, securityHeaders } from "./security.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function headerValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function requestIdFromRequest(req) {
  const incoming = String(headerValue(req?.headers?.["x-request-id"]) || "").trim();
  return REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
}

export function beginRequest(req, res, logger = console, onFinish = null) {
  const requestId = requestIdFromRequest(req);
  const startedAt = Date.now();
  res.soosRequestId = requestId;
  const incomingOrigin = String(headerValue(req?.headers?.origin) || "").trim();
  res.soosAllowedOrigin = incomingOrigin && isAllowedRequestOrigin(req) ? incomingOrigin : "";
  res.setHeader?.("X-Request-ID", requestId);
  res.once?.("finish", () => {
    const entry = {
      type: "http_request",
      requestId,
      method: req.method || "",
      path: String(req.url || "").split("?")[0],
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    };
    logger.info?.(JSON.stringify(entry));
    onFinish?.(entry);
  });
  return { requestId, startedAt };
}

function responseHeaders(res, contentType) {
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Request-ID": res.soosRequestId || crypto.randomUUID(),
    ...securityHeaders({ allowedOrigin: res.soosAllowedOrigin }),
  };
  if (res.soosSessionCookie) headers["Set-Cookie"] = res.soosSessionCookie;
  return headers;
}

export function sendJson(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, responseHeaders(res, "application/json; charset=utf-8"));
  res.end(JSON.stringify(body));
}

export function sendHtml(res, status, html) {
  if (res.writableEnded) return;
  res.writeHead(status, responseHeaders(res, "text/html; charset=utf-8"));
  res.end(html);
}

export function errorCode(error, status, fallbackCode = "") {
  if (error?.code && /^[A-Z][A-Z0-9_]+$/.test(String(error.code))) return String(error.code);
  if (fallbackCode) return fallbackCode;
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "REQUEST_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return `HTTP_${status}`;
}

export function sendError(res, status, error, options = {}) {
  const message = String(error?.message || error || options.message || "Request failed");
  const code = errorCode(error, status, options.code);
  const retryable = options.retryable ?? (status === 429 || status >= 500);
  sendJson(res, status, {
    error: message,
    code,
    requestId: res.soosRequestId || "",
    retryable,
    ...(options.details === undefined ? {} : { details: options.details }),
  });
}

export async function readJsonBody(req, maxLength = 100000) {
  try {
    if (req.body && Buffer.isBuffer(req.body)) {
      if (req.body.length > maxLength) {
        const error = new Error("Request body is too large");
        error.code = "REQUEST_TOO_LARGE";
        throw error;
      }
      return JSON.parse(req.body.toString("utf8") || "{}");
    }
    if (req.body instanceof Uint8Array) {
      if (req.body.byteLength > maxLength) {
        const error = new Error("Request body is too large");
        error.code = "REQUEST_TOO_LARGE";
        throw error;
      }
      return JSON.parse(Buffer.from(req.body).toString("utf8") || "{}");
    }
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > maxLength) {
        const error = new Error("Request body is too large");
        error.code = "REQUEST_TOO_LARGE";
        throw error;
      }
      return JSON.parse(req.body || "{}");
    }
    if (req.body && typeof req.body === "object") return req.body;
    let raw = "";
    let bytes = 0;
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxLength) {
        const error = new Error("Request body is too large");
        error.code = "REQUEST_TOO_LARGE";
        throw error;
      }
      raw += chunk;
    }
    return JSON.parse(raw || "{}");
  } catch (error) {
    if (error?.code === "REQUEST_TOO_LARGE") throw error;
    const invalidJson = new Error(`Invalid JSON request body: ${error.message || error}`);
    invalidJson.code = "INVALID_JSON";
    throw invalidJson;
  }
}
