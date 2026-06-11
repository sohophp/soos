export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status || 0;
    this.code = options.code || "";
    this.requestId = options.requestId || "";
    this.details = options.details;
    this.retryable = options.retryable ?? (this.status === 0 || this.status === 429 || this.status >= 500);
  }
}

function responseRequestId(response, body) {
  return body?.requestId
    || response.headers?.get?.("x-request-id")
    || "";
}

async function parseResponseBody(response) {
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiRequest(url, options = {}) {
  const {
    body,
    fallbackMessage = "Request failed",
    headers,
    signal,
    ...requestOptions
  } = options;
  const requestHeaders = new Headers(headers || {});
  const hasBody = body !== undefined;
  if (hasBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(url, {
      ...requestOptions,
      headers: requestHeaders,
      signal,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError(error?.message || fallbackMessage, {
      code: "NETWORK_ERROR",
      details: error,
      retryable: true,
    });
  }

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    throw new ApiError(
      responseBody?.error?.message
        || responseBody?.error
        || responseBody?.message
        || fallbackMessage,
      {
        status: response.status,
        code: responseBody?.error?.code || responseBody?.code || `HTTP_${response.status}`,
        requestId: responseRequestId(response, responseBody),
        details: responseBody?.error?.details || responseBody?.details,
        retryable: responseBody?.error?.retryable,
      },
    );
  }

  return responseBody;
}

export function apiGet(url, options = {}) {
  return apiRequest(url, { ...options, method: "GET" });
}

export function apiPost(url, body = {}, options = {}) {
  return apiRequest(url, { ...options, method: "POST", body });
}

export function apiDelete(url, options = {}) {
  return apiRequest(url, { ...options, method: "DELETE" });
}
