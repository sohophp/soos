export const PAGESPEED_SESSION_KEY = "soos.pagespeed.api-key";

export function readPageSpeedSessionKey() {
  try {
    return globalThis.sessionStorage?.getItem(PAGESPEED_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function writePageSpeedSessionKey(value) {
  try {
    if (value) globalThis.sessionStorage?.setItem(PAGESPEED_SESSION_KEY, value);
    else globalThis.sessionStorage?.removeItem(PAGESPEED_SESSION_KEY);
  } catch {
    // Session-only storage may be unavailable in strict privacy modes.
  }
}
