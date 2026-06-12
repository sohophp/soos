export const WORKSPACE_VIEW_KEYS = ["scan", "google", "issues", "urls", "history", "settings"];

const STORAGE_KEY = "soos.workspaceView.v1";

export function normalizeWorkspaceView(value) {
  return WORKSPACE_VIEW_KEYS.includes(value) ? value : "scan";
}

export function loadWorkspaceView(storage = globalThis.localStorage) {
  try {
    return normalizeWorkspaceView(storage?.getItem(STORAGE_KEY));
  } catch {
    return "scan";
  }
}

export function saveWorkspaceView(value, storage = globalThis.localStorage) {
  const normalized = normalizeWorkspaceView(value);
  try {
    storage?.setItem(STORAGE_KEY, normalized);
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory view still works.
  }
  return normalized;
}
