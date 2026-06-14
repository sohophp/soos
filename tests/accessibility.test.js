import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { dictionaries } from "../src/i18n.js";

const [
  mainSource,
  scanSetupSource,
  runtimeSource,
  findingsSource,
  configSource,
  analyticsSource,
  importSource,
  paginationSource,
  reportUiSource,
  inspectionDiagnosticsSource,
  styles,
] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSetupPanels.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanRuntimePanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlFindingsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchConsoleApiConfig.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchAnalyticsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/SearchConsoleImport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ResultPagination.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ReportUi.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/UrlInspectionDiagnostics.jsx", import.meta.url), "utf8"),
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
assert.match(mainSource, /role="tablist"/);
assert.match(mainSource, /role="tab"/);
assert.match(mainSource, /aria-selected=\{activeView === view\}/);
assert.match(mainSource, /aria-controls="workspace-panel"/);
assert.match(mainSource, /role="tabpanel"/);
assert.match(mainSource, /aria-labelledby=\{`workspace-tab-\$\{activeView\}`\}/);
assert.match(mainSource, /event\.key === "ArrowRight"/);
assert.match(mainSource, /event\.key === "ArrowLeft"/);
assert.match(mainSource, /event\.key === "Home"/);
assert.match(mainSource, /event\.key === "End"/);
assert.match(scanSetupSource, /htmlFor="audit-url"/);
assert.match(scanSetupSource, /className="scan-boundary-note" aria-label=\{t\.rawHtmlBoundaryTitle\}/);
assert.match(runtimeSource, /role="progressbar"/);
assert.match(runtimeSource, /aria-valuenow=/);
assert.match(runtimeSource, /aria-live="polite"/);
assert.match(findingsSource, /aria-expanded=\{open\}/);
assert.match(findingsSource, /aria-controls=\{detailId\}/);
assert.match(findingsSource, /role="region" aria-label=\{page\.url\}/);
assert.match(findingsSource, /aria-pressed=\{filter === item\}/);
assert.match(findingsSource, /role="group" aria-label=\{t\.urlFindings\}/);
assert.match(findingsSource, /role="status" aria-live="polite"/);
assert.match(findingsSource, /<ResultPagination/);
assert.match(mainSource, /className="error" role="alert"/);
assert.match(mainSource, /Symbol\.for\("soos\.reactRoot"\)/);
assert.match(mainSource, /reactRootElement\[reactRootKey\]/);
assert.match(configSource, /aria-controls="gsc-oauth-help"/);
assert.match(configSource, /role="status"/);
assert.match(configSource, /role="alert"/);
assert.match(analyticsSource, /role="status"/);
assert.match(analyticsSource, /role="alert"/);
assert.match(analyticsSource, /<summary>\{copy\.queryIntentSettings\}<\/summary>/);
assert.match(analyticsSource, /<strong>\{copy\.brandTerms\}<\/strong>/);
assert.match(analyticsSource, /<strong>\{copy\.localTerms\}<\/strong>/);
assert.match(analyticsSource, /<strong>\{copy\.excludeTerms\}<\/strong>/);
assert.match(importSource, /role="status"/);
assert.match(importSource, /role="alert"/);
assert.match(paginationSource, /aria-live="polite" aria-atomic="true"/);
assert.match(paginationSource, /aria-label=\{`\$\{copy\.previousPage\}: \$\{label\}`\}/);
assert.match(reportUiSource, /aria-hidden="true" focusable="false"/);
assert.match(inspectionDiagnosticsSource, /role="table"/);
assert.match(inspectionDiagnosticsSource, /role="columnheader"/);
assert.match(inspectionDiagnosticsSource, /role="cell"/);
assert.match(inspectionDiagnosticsSource, /aria-rowindex=/);
assert.match(styles, /\.skip-link:focus/);
assert.match(styles, /button:focus-visible/);
assert.match(styles, /\.workspace-panel:focus-visible/);
assert.match(styles, /\.url-alignment-table:focus-visible/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

console.log("accessibility-tests-passed");
