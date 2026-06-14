import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  clampProgressValue,
  formatElapsedTime,
  formatStartedTime,
} from "../src/scan-runtime.js";

assert.equal(clampProgressValue(-1), 0);
assert.equal(clampProgressValue("42.5"), 42.5);
assert.equal(clampProgressValue(101), 100);
assert.equal(clampProgressValue("invalid"), 0);

assert.equal(formatElapsedTime(undefined), "0s");
assert.equal(formatElapsedTime(-1000), "0s");
assert.equal(formatElapsedTime(59999), "59s");
assert.equal(formatElapsedTime(60000), "1m 0s");
assert.equal(formatElapsedTime(125000), "2m 5s");

assert.equal(formatStartedTime(null), "-");
assert.equal(formatStartedTime("not-a-date"), "-");
assert.match(formatStartedTime("2026-06-12T00:00:00.000Z", "en-US"), /\d/);

const [mainSource, setupSource, componentSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSetupPanels.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanRuntimePanel.jsx", import.meta.url), "utf8"),
]);

assert.match(mainSource, /from "\.\/components\/ScanSetupPanels\.jsx"/);
assert.doesNotMatch(mainSource, /function ProgressBar/);
assert.doesNotMatch(mainSource, /function ProgressControls/);
assert.doesNotMatch(mainSource, /function RuntimePanel/);
assert.match(setupSource, /from "\.\/ScanRuntimePanel\.jsx"/);
assert.match(setupSource, /<ProgressBar progress=\{runner\.progress\}/);
assert.match(setupSource, /<RuntimePanel/);
assert.match(setupSource, /<ProgressControls/);
assert.match(componentSource, /role="progressbar"/);
assert.match(componentSource, /aria-live="polite"/);
assert.match(componentSource, /jobStatus === "paused"/);
assert.match(componentSource, /formatElapsedTime\(runtimeMeta\.stageElapsedMs\)/);

console.log("scan runtime tests passed");
