import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { dictionaries } from "../src/i18n.js";

const [mainSource, findingsSource, configSource, analyticsSource, importSource, styles] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlFindingsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchConsoleApiConfig.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchAnalyticsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchConsoleImport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);

for (const language of ["en", "zh-CN", "zh-TW"]) {
  for (const key of ["skipToContent", "languageLabel", "auditUrlLabel"]) {
    assert.ok(dictionaries[language][key], `${language}.${key}`);
  }
}

assert.match(mainSource, /className="skip-link" href="#workspace-content"/);
assert.match(mainSource, /id="workspace-content" tabIndex="-1"/);
assert.match(mainSource, /htmlFor="language-select"/);
assert.match(mainSource, /htmlFor="audit-url"/);
assert.match(mainSource, /role="progressbar"/);
assert.match(mainSource, /aria-valuenow=/);
assert.match(findingsSource, /aria-expanded=\{open\}/);
assert.match(findingsSource, /aria-pressed=\{filter === item\}/);
assert.match(mainSource, /className="error" role="alert"/);
assert.match(mainSource, /Symbol\.for\("soos\.reactRoot"\)/);
assert.match(mainSource, /reactRootElement\[reactRootKey\]/);
assert.match(configSource, /aria-controls="gsc-oauth-help"/);
assert.match(configSource, /role="status"/);
assert.match(configSource, /role="alert"/);
assert.match(analyticsSource, /role="status"/);
assert.match(analyticsSource, /role="alert"/);
assert.match(importSource, /role="status"/);
assert.match(importSource, /role="alert"/);
assert.match(styles, /\.skip-link:focus/);
assert.match(styles, /button:focus-visible/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

console.log("accessibility-tests-passed");
