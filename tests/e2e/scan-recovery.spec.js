import { expect, test } from "@playwright/test";
import { createLargeReport } from "./report-fixture.js";

const ACTIVE_JOB_KEY = "soos:active-audit-job";
const report = createLargeReport();

async function mockApi(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/audit-jobs/e2e-recovery/run") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-recovery",
          status: "done",
          progress: {
            stage: "finalizing",
            percent: 100,
            processedUrls: report.pages.length,
            totalUrls: report.pages.length,
          },
          result: report,
        }),
      });
      return;
    }
    if (url.pathname === "/api/gsc/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: false, connected: false }),
      });
      return;
    }
    if (url.pathname === "/api/audit-jobs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          pageCount: 1,
          retentionSeconds: 604800,
          storage: "memory",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      id: "e2e-recovery",
      startedAt: Date.now() - 2500,
    }));
  }, { key: ACTIVE_JOB_KEY });
});

test("restores an active scan after reload and clears the checkpoint", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PageSpeed Insights" })).toBeVisible();
  await expect(page.getByText("125", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), ACTIVE_JOB_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "PageSpeed Insights" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("paginates a large URL report without viewport overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PageSpeed Insights" })).toBeVisible();
  await page.getByRole("tab", { name: "URLs", exact: true }).click();

  await expect(page.getByText("125 matching URLs", { exact: true })).toBeVisible();
  await expect(page.locator("article.row")).toHaveCount(50);
  await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Next page/ }).click();
  await expect(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
  await expect(page.locator("article.row").first()).toContainText("page-51");

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
});

test("localizes a restored large report and keeps tab navigation accessible", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PageSpeed Insights" })).toBeVisible();

  const languages = [
    {
      value: "en",
      title: "Google crawl diagnostics",
      scan: "Scan",
      urls: "URLs",
      matchCount: "125 matching URLs",
      crux: "Also load dedicated CrUX field data",
    },
    {
      value: "zh-CN",
      title: "Google 抓取诊断",
      scan: "扫描",
      urls: "网址",
      matchCount: "125 个匹配网址",
      crux: "同时加载独立 CrUX 真实用户数据",
    },
    {
      value: "zh-TW",
      title: "Google 抓取診斷",
      scan: "掃描",
      urls: "網址",
      matchCount: "125 個符合網址",
      crux: "同時載入獨立 CrUX 真實使用者資料",
    },
  ];

  for (const language of languages) {
    await page.locator("#language-select").selectOption(language.value);
    await expect(page.getByRole("heading", { name: language.title })).toBeVisible();
    await page.getByRole("tab", { name: language.scan, exact: true }).click();
    await expect(page.getByRole("checkbox", { name: language.crux })).toBeVisible();
    await page.getByRole("tab", { name: language.urls, exact: true }).click();
    await expect(page.getByText(language.matchCount, { exact: true })).toBeVisible();
  }

  await page.locator("#language-select").selectOption("en");
  const scanTab = page.getByRole("tab", { name: "Scan", exact: true });
  await scanTab.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Settings", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(scanTab).toHaveAttribute("aria-selected", "true");

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(consoleErrors).toEqual([]);
});
