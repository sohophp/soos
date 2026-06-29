import assert from "node:assert/strict";
import {
  loadWorkspaceView,
  normalizeWorkspaceView,
  saveWorkspaceView,
  WORKSPACE_VIEW_KEYS,
} from "../src/workspace-views.js";
import { workspaceText } from "../src/i18n.js";

assert.deepEqual(WORKSPACE_VIEW_KEYS, ["scan", "images", "google", "issues", "urls", "history", "settings"]);
assert.equal(normalizeWorkspaceView("google"), "google");
assert.equal(normalizeWorkspaceView("unknown"), "scan");

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
};
assert.equal(loadWorkspaceView(storage), "scan");
assert.equal(saveWorkspaceView("history", storage), "history");
assert.equal(loadWorkspaceView(storage), "history");
assert.equal(saveWorkspaceView("invalid", storage), "scan");
assert.equal(loadWorkspaceView(storage), "scan");

const unavailableStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
assert.equal(loadWorkspaceView(unavailableStorage), "scan");
assert.equal(saveWorkspaceView("urls", unavailableStorage), "urls");

const englishKeys = Object.keys(workspaceText.en).sort();
for (const language of ["zh-CN", "zh-TW"]) {
  assert.deepEqual(Object.keys(workspaceText[language]).sort(), englishKeys);
  for (const view of WORKSPACE_VIEW_KEYS) assert.equal(typeof workspaceText[language][view], "string");
}

console.log("workspace-views-tests-passed");
