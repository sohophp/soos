import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildAuditRequest,
  DEFAULT_SCAN_SETTINGS,
} from "../src/scan-settings.js";

assert.deepEqual(buildAuditRequest(), {
  sitemapUrl: "",
  options: {
    contentChecks: false,
    performanceChecks: false,
    backgroundMode: false,
    internalCrawl: false,
    urlQueryPolicy: "preserve",
    trailingSlashPolicy: "preserve",
    robotsSource: "root",
    proxyEnabled: false,
  },
});

assert.deepEqual(buildAuditRequest({
  ...DEFAULT_SCAN_SETTINGS,
  sitemapUrl: "https://example.com/sitemap.xml",
  contentChecks: true,
  performanceChecks: true,
  backgroundMode: true,
  internalCrawl: true,
  directoryRobots: true,
  urlQueryPolicy: "strip_tracking",
  trailingSlashPolicy: "remove",
}), {
  sitemapUrl: "https://example.com/sitemap.xml",
  options: {
    contentChecks: true,
    performanceChecks: true,
    backgroundMode: true,
    internalCrawl: true,
    urlQueryPolicy: "strip_tracking",
    trailingSlashPolicy: "remove",
    robotsSource: "sitemap-directory",
    proxyEnabled: false,
  },
});

const [mainSource, hookSource, panelSource] = await Promise.all([
  fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/hooks/useScanSettings.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../src/components/ScanSetupPanels.jsx", import.meta.url), "utf8"),
]);

assert.match(mainSource, /const scanSettings = useScanSettings\(\)/);
assert.match(mainSource, /<ScanLaunchPanel/);
assert.match(mainSource, /<ScanSettingsPanel/);
assert.doesNotMatch(mainSource, /className="searchbar"/);
assert.doesNotMatch(mainSource, /className="option-toggle"/);
assert.match(hookSource, /buildAuditRequest\(settings\)/);
assert.match(panelSource, /htmlFor="audit-url"/);
assert.match(panelSource, /<PrivacyDataPanel/);
assert.match(panelSource, /onPause=\{\(\) => onControl\("pause"\)\}/);

console.log("scan settings tests passed");
