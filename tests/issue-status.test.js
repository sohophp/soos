import assert from "node:assert/strict";
import {
  applyIssueStatuses,
  issueStatusStorageKey,
  loadIssueStatuses,
  saveIssueStatuses,
  setIssueStatus,
} from "../src/issue-status.js";

const report = { input: { siteRootUrl: "https://Example.com/" } };
const storageData = new Map();
const storage = {
  getItem: (key) => storageData.get(key) || null,
  setItem: (key, value) => storageData.set(key, value),
};

assert.equal(issueStatusStorageKey(report), "soos:issue-status:https-example-com");
assert.deepEqual(loadIssueStatuses(report, storage), {});

const ignored = setIssueStatus({}, "canonical:a", "ignored");
assert.deepEqual(ignored, { "canonical:a": "ignored" });
assert.deepEqual(setIssueStatus(ignored, "canonical:a", "open"), {});
assert.deepEqual(setIssueStatus({}, "canonical:a", "unknown"), {});

saveIssueStatuses(report, {
  "canonical:a": "resolved",
  "content:b": "ignored",
  "open:c": "open",
}, storage);
assert.deepEqual(loadIssueStatuses(report, storage), {
  "canonical:a": "resolved",
  "content:b": "ignored",
});

const issues = applyIssueStatuses([
  { fingerprint: "canonical:a", status: "open" },
  { fingerprint: "fresh:c", status: "open" },
], loadIssueStatuses(report, storage));
assert.equal(issues[0].status, "resolved");
assert.equal(issues[1].status, "open");

console.log("issue-status-tests-passed");
