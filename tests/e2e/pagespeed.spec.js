import { expect, test } from "@playwright/test";
import { createLargeReport } from "./report-fixture.js";

const ACTIVE_JOB_KEY = "soos:active-audit-job";
const report = createLargeReport();

const pageSpeedResult = {
  requestedUrl: report.pages[0].url,
  finalUrl: `${report.pages[0].url}?rendered=1`,
  redirected: true,
  strategy: "mobile",
  analyzedAt: "2026-06-15T02:00:00.000Z",
  lighthouseVersion: "12.5.0",
  scores: { performance: 62, seo: 83 },
  runtime: { totalMs: 12400, formFactor: "mobile", locale: "en" },
  lab: {
    metrics: {
      lcp: { score: 0.45, numericValue: 4100, displayValue: "4.1 s" },
      cls: { score: 0.9, numericValue: 0.08, displayValue: "0.08" },
      tbt: { score: 0.55, numericValue: 480, displayValue: "480 ms" },
    },
    opportunities: [{
      id: "render-blocking-resources",
      title: "Eliminate render-blocking resources",
      score: 0.4,
      savingsMs: 620,
      savingsBytes: 24576,
      displayValue: "",
    }],
    diagnostics: [{
      id: "uses-long-cache-ttl",
      title: "Use efficient cache lifetimes",
      description: "A long cache lifetime can speed up repeat visits.",
      displayValue: "12 resources found",
      score: 0.5,
      scoreDisplayMode: "metricSavings",
    }],
    warnings: ["The page loaded with a redirect."],
  },
  seo: {
    audits: [{
      id: "crawlable-anchors",
      title: "Links are not crawlable",
      description: "Search engines may use href attributes on links.",
      score: 0,
      scoreDisplayMode: "binary",
    }],
  },
  field: {
    page: { available: false, metrics: {} },
    origin: { available: false, metrics: {} },
  },
};

const cruxResult = {
  source: "crux_api",
  page: {
    available: true,
    scope: "url",
    collectionPeriod: { firstDate: "2026-05-17", lastDate: "2026-06-13" },
    metrics: {
      lcp: { percentile: 2600, category: "needs-improvement" },
      cls: { percentile: 0.08, category: "good" },
      inp: { percentile: 180, category: "good" },
    },
  },
  origin: { available: false, metrics: {} },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/audit-jobs/e2e-pagespeed/run") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-pagespeed",
          status: "done",
          progress: { stage: "finalizing", percent: 100 },
          result: report,
        }),
      });
      return;
    }
    if (url.pathname === "/api/pagespeed/run") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pageSpeedResult),
      });
      return;
    }
    if (url.pathname === "/api/crux/run") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cruxResult),
      });
      return;
    }
    if (url.pathname === "/api/gsc/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: false }),
      });
      return;
    }
    if (url.pathname === "/api/audit-jobs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10, pageCount: 1 }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ id: "e2e-pagespeed", startedAt: Date.now() - 1000 }));
  }, { key: ACTIVE_JOB_KEY });
});

test("renders actionable PageSpeed and CrUX diagnostics", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PageSpeed Insights" })).toBeVisible();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByLabel("Google API key").fill("browser-session-key");
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.getByRole("checkbox", { name: "Also load dedicated CrUX field data" }).check();
  await page.getByRole("button", { name: "Run PageSpeed", exact: true }).click();

  await expect(page.getByText("Core Web Vitals failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Links are not crawlable", { exact: true })).toBeVisible();
  await expect(page.getByText("Use efficient cache lifetimes", { exact: true })).toBeVisible();
  await expect(page.getByText("PageSpeed tested a redirected URL", { exact: true })).toBeVisible();
  await expect(page.getByText("The page loaded with a redirect.", { exact: true })).toBeVisible();
  await expect(page.getByText("Dedicated CrUX API", { exact: false })).toBeVisible();
  await expect(page.getByText("PageSpeed field data (legacy)", { exact: true })).toHaveCount(0);

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(consoleErrors).toEqual([]);
});

test("turns a disabled CrUX API response into an enable and retry action", async ({ page }) => {
  const enableUrl = "https://console.developers.google.com/apis/api/chromeuxreport.googleapis.com/overview?project=1086129575293";
  await page.route("**/api/crux/run", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: `Chrome UX Report API has not been used before. Enable it by visiting ${enableUrl} then retry.`,
        code: "CRUX_API_NOT_ENABLED",
        requestId: "crux-disabled-test",
        retryable: false,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByLabel("Google API key").fill("browser-session-key");
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.getByRole("checkbox", { name: "Also load dedicated CrUX field data" }).check();
  await page.getByRole("button", { name: "Run PageSpeed", exact: true }).click();

  await expect(page.getByText("Chrome UX Report API is not enabled for this Google Cloud project.", { exact: true })).toBeVisible();
  await expect(page.getByText("CRUX_API_NOT_ENABLED · request crux-disabled-test", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enable CrUX API", exact: true })).toHaveAttribute("href", enableUrl);
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByText("Performance", { exact: true })).toBeVisible();
  await expect(page.getByText("Chrome UX Report API has not been used before.", { exact: false })).toHaveCount(0);

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
});
