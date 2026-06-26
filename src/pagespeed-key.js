export const PAGESPEED_SESSION_KEY = "soos.pagespeed.api-key";
export const GOOGLE_API_SESSION_KEY = "soos.google.api-key";

function readSessionValue(key) {
  try {
    return globalThis.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionValue(key, value) {
  try {
    if (value) globalThis.sessionStorage?.setItem(key, value);
    else globalThis.sessionStorage?.removeItem(key);
  } catch {
    // Session-only storage may be unavailable in strict privacy modes.
  }
}

export function readGoogleApiSessionKey() {
  return readSessionValue(GOOGLE_API_SESSION_KEY);
}

export function writeGoogleApiSessionKey(value) {
  writeSessionValue(GOOGLE_API_SESSION_KEY, value);
}

export function readPageSpeedSessionKey() {
  return readSessionValue(PAGESPEED_SESSION_KEY);
}

export function writePageSpeedSessionKey(value) {
  writeSessionValue(PAGESPEED_SESSION_KEY, value);
}

export function readActivePageSpeedSessionKey() {
  return readPageSpeedSessionKey() || readGoogleApiSessionKey();
}
