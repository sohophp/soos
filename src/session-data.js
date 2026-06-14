import { apiGet, apiPost } from "./api-client.js";

export function getSessionDataSummary() {
  return apiGet("/api/session-data", {
    fallbackMessage: "Could not load session data summary",
  });
}

export function deleteSessionData() {
  return apiPost("/api/session-data/delete", { confirm: "DELETE" }, {
    fallbackMessage: "Could not delete session data",
  });
}

export function localSoosDataSummary(storage = globalThis.localStorage) {
  const keys = [];
  try {
    for (let index = 0; index < (storage?.length || 0); index += 1) {
      const key = storage.key(index);
      if (String(key || "").toLowerCase().startsWith("soos")) keys.push(key);
    }
  } catch {
    return { keys: [], count: 0 };
  }
  return { keys, count: keys.length };
}

export function clearLocalSoosData(storage = globalThis.localStorage) {
  const summary = localSoosDataSummary(storage);
  for (const key of summary.keys) {
    try {
      storage?.removeItem(key);
    } catch {
      // Browser privacy modes can make storage unavailable.
    }
  }
  return summary.count;
}

export function browserSoosDataSummary(
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
) {
  const local = localSoosDataSummary(localStorage);
  const session = localSoosDataSummary(sessionStorage);
  return {
    local,
    session,
    count: local.count + session.count,
  };
}

export function clearBrowserSoosData(
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
) {
  return clearLocalSoosData(localStorage) + clearLocalSoosData(sessionStorage);
}
