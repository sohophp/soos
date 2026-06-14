import { expect, test } from "@playwright/test";

const siteUrl = "https://example.test/";
const rows = [
  {
    keys: [siteUrl, "technical seo audit"],
    label: `${siteUrl} · technical seo audit`,
    page: siteUrl,
    query: "technical seo audit",
    clicks: 1,
    impressions: 300,
    ctr: 1 / 300,
    position: 2.5,
  },
  {
    keys: ["https://example.test/guide", "technical seo audit"],
    label: "https://example.test/guide · technical seo audit",
    page: "https://example.test/guide",
    query: "technical seo audit",
    clicks: 2,
    impressions: 120,
    ctr: 2 / 120,
    position: 5.5,
  },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/gsc/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: true,
          refreshToken: true,
          oauthConfigured: true,
          siteUrl,
          googleAccountEmail: "owner@example.test",
          databaseConfigured: true,
        }),
      });
      return;
    }
    if (url.pathname === "/api/gsc/sites") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sites: [{ siteUrl, permissionLevel: "siteOwner" }],
        }),
      });
      return;
    }
    if (url.pathname === "/api/gsc/search-analytics") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dimension: "page_query",
          rows,
          comparison: {
            current: {
              startDate: "2026-05-15",
              endDate: "2026-06-11",
              rows,
            },
            previous: {
              startDate: "2026-04-17",
              endDate: "2026-05-14",
              rows,
            },
          },
        }),
      });
      return;
    }
    if (url.pathname === "/api/gsc/sitemaps") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteUrl,
          sitemaps: [{
            path: "https://example.test/sitemap.xml",
            lastSubmitted: "2026-06-01T00:00:00Z",
            lastDownloaded: "2026-06-12T00:00:00Z",
            pending: false,
            sitemapIndex: true,
            type: "sitemap",
            errors: 0,
            warnings: 0,
            contents: [],
            submittedUrls: 0,
          }],
          summary: {
            total: 1,
            pending: 0,
            withErrors: 0,
            withWarnings: 0,
            submittedUrls: 0,
          },
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
});

test("renders date-scaled Search Analytics evidence without small-sample regressions", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Google", exact: true }).click();
  await expect(page.getByText("owner@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText(`Property: ${siteUrl}`, { exact: true })).toBeVisible();
  await expect(page.getByText("https://example.test/sitemap.xml", { exact: true })).toBeVisible();
  await page.getByLabel("Dimension").selectOption("page_query");
  await page.getByRole("button", { name: "Load Search Analytics" }).click();

  const lowCtrCard = page.locator(".search-analytics-insight").filter({
    hasText: "High impressions, low CTR",
  });
  await expect(lowCtrCard).toBeVisible();
  await expect(lowCtrCard.getByText(/Evidence: 28 days/)).toBeVisible();
  await expect(lowCtrCard.getByText(/conservative CTR benchmark 3\.0%/)).toBeVisible();
  await expect(lowCtrCard.getByText(/90% CTR upper bound/)).toBeVisible();
  await expect(page.getByText("No high-confidence regression detected for this period.")).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(consoleErrors).toEqual([]);
});
