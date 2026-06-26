import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  browserSoosDataSummary,
  clearBrowserSoosData,
  clearLocalSoosData,
  localSoosDataSummary,
} from "../src/session-data.js";
import { privacyDataText } from "../src/i18n.js";

const [mainSource, gscHookSource, googleWorkspaceSource, privacyPanelSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useGscWorkspace.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/GoogleWorkspace.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/PrivacyDataPanel.jsx", import.meta.url), "utf8"),
]);

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

const localStorage = createStorage({ "soos.history": "[]", "another-app": "keep" });
const sessionStorage = createStorage({ "soos.pagespeed.api-key": "secret", "other-session": "keep" });
assert.equal(browserSoosDataSummary(localStorage, sessionStorage).count, 2);
assert.equal(clearBrowserSoosData(localStorage, sessionStorage), 2);
assert.equal(localStorage.getItem("another-app"), "keep");
assert.equal(sessionStorage.getItem("other-session"), "keep");
assert.equal(sessionStorage.getItem("soos.pagespeed.api-key"), null);

const privacyKeys = Object.keys(privacyDataText.en).sort();
for (const language of ["zh-CN", "zh-TW"]) {
  assert.deepEqual(Object.keys(privacyDataText[language]).sort(), privacyKeys);
  for (const key of privacyKeys) {
    assert.ok(privacyDataText[language][key], `${language}.${key}`);
  }
}

assert.match(mainSource, /scanSettings\.reset\(\)/);
assert.match(mainSource, /reportHistory\.reset\(\)/);
assert.match(mainSource, /gsc\.reset\(\)/);
assert.match(mainSource, /retainedJobs\.reset\(\)/);
assert.match(mainSource, /auditRunner\.reset\(\)/);
assert.match(gscHookSource, /const \[resetKey, setResetKey\] = useState\(0\)/);
assert.match(gscHookSource, /setResetKey\(\(value\) => value \+ 1\)/);
assert.match(privacyPanelSource, /friendlyError/);
assert.match(privacyPanelSource, /copy\.apiUnavailable/);
assert.match(privacyPanelSource, /Error code explanation/);
for (const keyPrefix of ["gsc-config", "gsc-import"]) {
  assert.ok(googleWorkspaceSource.includes(`key={\`${keyPrefix}-\${gsc.resetKey}\`}`), keyPrefix);
}
for (const keyPrefix of ["gsc-analytics", "gsc-sitemaps"]) {
  assert.ok(
    googleWorkspaceSource.includes(`key={\`${keyPrefix}-\${gsc.resetKey}-\${gsc.siteUrl}\`}`),
    keyPrefix,
  );
}

console.log("session-data-client-tests-passed");
