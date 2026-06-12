import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  clearLocalSoosData,
  localSoosDataSummary,
} from "../src/session-data.js";
import { privacyDataText } from "../src/i18n.js";

const mainSource = await fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

function createStorage(initial) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const storage = createStorage({
  "soos.auditHistory.v1": "[]",
  "soos:active-audit-job": "{}",
  "SOOS.workspaceView.v1": "settings",
  "another-app": "keep",
});
const summary = localSoosDataSummary(storage);
assert.equal(summary.count, 3);
assert.equal(summary.keys.includes("another-app"), false);
assert.equal(clearLocalSoosData(storage), 3);
assert.equal(storage.getItem("another-app"), "keep");
assert.equal(localSoosDataSummary(storage).count, 0);

const privacyKeys = Object.keys(privacyDataText.en).sort();
for (const language of ["zh-CN", "zh-TW"]) {
  assert.deepEqual(Object.keys(privacyDataText[language]).sort(), privacyKeys);
  for (const key of privacyKeys) {
    assert.ok(privacyDataText[language][key], `${language}.${key}`);
  }
}

assert.match(mainSource, /const \[dataResetKey, setDataResetKey\] = useState\(0\)/);
assert.match(mainSource, /setDataResetKey\(\(value\) => value \+ 1\)/);
for (const keyPrefix of ["gsc-config", "gsc-analytics", "gsc-sitemaps", "gsc-import"]) {
  assert.ok(mainSource.includes(`key={\`${keyPrefix}-\${dataResetKey}\`}`), keyPrefix);
}

console.log("session-data-client-tests-passed");
