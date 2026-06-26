import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [panelSource, settingsSource, summarySource, workspaceSource, routeSource, cruxRouteSource, securitySource] = await Promise.all([
  fs.readFile(new URL("../src/components/PageSpeedInsightsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSetupPanels.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSummaryView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/routes/pagespeed-routes.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/routes/crux-routes.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/security.js", import.meta.url), "utf8"),
]);

assert.match(settingsSource, /writePageSpeedSessionKey/);
assert.match(settingsSource, /writeGoogleApiSessionKey/);
assert.match(settingsSource, /type="password"/);
assert.match(settingsSource, /autoComplete="off"/);
assert.match(settingsSource, /console\.cloud\.google\.com\/apis\/credentials/);
assert.match(settingsSource, /console\.cloud\.google\.com\/apis\/library\/pagespeedonline/);
assert.match(settingsSource, /console\.cloud\.google\.com\/apis\/library\/searchconsole/);
assert.match(settingsSource, /developers\.google\.com\/webmaster-tools\/v1\/how-tos\/authorizing/);
assert.match(settingsSource, /developers\.google\.com\/search\/docs\/monitor-debug\/search-console-start/);
assert.match(panelSource, /readActivePageSpeedSessionKey/);
assert.match(panelSource, /copy\.usingSharedKey/);
assert.match(panelSource, /apiGet\("\/api\/pagespeed\/status"/);
assert.match(panelSource, /defaultApiKeyConfigured/);
assert.match(panelSource, /apiPost\("\/api\/pagespeed\/run"/);
assert.match(panelSource, /apiPost\("\/api\/crux\/run"/);
assert.match(panelSource, /Promise\.allSettled/);
assert.match(panelSource, /type="checkbox"/);
assert.match(panelSource, /useState\(false\)/);
assert.match(panelSource, /preferredField\.collectionPeriod/);
assert.match(panelSource, /name="pagespeed-strategy"/);
assert.match(panelSource, /result\.lab\.metrics/);
assert.match(panelSource, /result\.field\.page/);
assert.match(panelSource, /result\.lab\.diagnostics/);
assert.match(panelSource, /result\.seo\?\.audits/);
assert.match(panelSource, /coreWebVitalsStatus/);
assert.match(panelSource, /preferredField = cruxField \|\| field/);
assert.match(panelSource, /CRUX_API_NOT_ENABLED/);
assert.match(panelSource, /isCruxApiNotEnabled\(requestError\)/);
assert.match(panelSource, /console\.cloud\.google\.com\/apis\/library\/chromeuxreport/);
assert.match(panelSource, /copy\.enableCruxApi/);
assert.match(panelSource, /copy\.retryCrux/);
assert.doesNotMatch(panelSource, /key=\{item\.id\}/);
assert.doesNotMatch(panelSource, /key=\{warning\}/);
assert.match(panelSource, /key=\{`\$\{item\.id\}-\$\{index\}`\}/);
assert.match(panelSource, /key=\{`\$\{warning\}-\$\{index\}`\}/);
assert.match(summarySource, /<PageSpeedInsightsPanel report=\{report\} language=\{language\}/);
assert.doesNotMatch(summarySource, /key=\{action\}/);
assert.match(summarySource, /key=\{`\$\{action\}-\$\{index\}`\}/);
assert.match(workspaceSource, /<ScanSummaryView/);
assert.match(workspaceSource, /language=\{language\}/);
assert.match(workspaceSource, /gscStatus=\{gsc\.status\}/);
assert.match(workspaceSource, /inspectionResults=\{inspectionResults\}/);
assert.match(routeSource, /requestPath !== "\/api\/pagespeed\/run"/);
assert.match(routeSource, /requestPath === "\/api\/pagespeed\/status"/);
assert.match(routeSource, /defaultApiKey/);
assert.match(routeSource, /readJsonBody\(req, 10000\)/);
assert.match(cruxRouteSource, /requestPath !== "\/api\/crux\/run"/);
assert.match(cruxRouteSource, /defaultApiKey/);
assert.match(cruxRouteSource, /readJsonBody\(req, 10000\)/);
assert.match(securitySource, /group: "pagespeed", limit: 6/);
assert.match(securitySource, /group: "crux", limit: 6/);

console.log("pagespeed-panel-tests-passed");
