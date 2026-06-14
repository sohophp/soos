import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [panelSource, summarySource, workspaceSource, routeSource, cruxRouteSource, securitySource] = await Promise.all([
  fs.readFile(new URL("../src/components/PageSpeedInsightsPanel.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSummaryView.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/WorkspaceReport.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/routes/pagespeed-routes.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/routes/crux-routes.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../server/security.js", import.meta.url), "utf8"),
]);

assert.match(panelSource, /sessionStorage\?\.setItem\(SESSION_KEY/);
assert.match(panelSource, /type="password"/);
assert.match(panelSource, /autoComplete="off"/);
assert.match(panelSource, /apiPost\("\/api\/pagespeed\/run"/);
assert.match(panelSource, /apiPost\("\/api\/crux\/run"/);
assert.match(panelSource, /Promise\.allSettled/);
assert.match(panelSource, /type="checkbox"/);
assert.match(panelSource, /cruxField\.collectionPeriod/);
assert.match(panelSource, /name="pagespeed-strategy"/);
assert.match(panelSource, /result\.lab\.metrics/);
assert.match(panelSource, /result\.field\.page/);
assert.match(summarySource, /<PageSpeedInsightsPanel report=\{report\} language=\{language\}/);
assert.match(workspaceSource, /<ScanSummaryView report=\{report\} t=\{t\} language=\{language\}/);
assert.match(routeSource, /requestPath !== "\/api\/pagespeed\/run"/);
assert.match(routeSource, /readJsonBody\(req, 10000\)/);
assert.match(cruxRouteSource, /requestPath !== "\/api\/crux\/run"/);
assert.match(cruxRouteSource, /readJsonBody\(req, 10000\)/);
assert.match(securitySource, /group: "pagespeed", limit: 6/);
assert.match(securitySource, /group: "crux", limit: 6/);

console.log("pagespeed-panel-tests-passed");
