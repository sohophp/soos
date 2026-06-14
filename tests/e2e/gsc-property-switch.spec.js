import { expect, test } from "@playwright/test";

const firstProperty = "https://first.example/";
const secondProperty = "sc-domain:second.example";

function sitemapResponse(siteUrl, path) {
  return {
    siteUrl,
    sitemaps: [{
      path,
      lastSubmitted: "2026-06-01T00:00:00Z",
      lastDownloaded: "2026-06-12T00:00:00Z",
      pending: false,
      sitemapIndex: false,
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
  };
}

test("keeps sitemap data scoped to the latest selected property", async ({ page }) => {
  const sitemapRequests = [];

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
          siteUrl: firstProperty,
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
          sites: [
            { siteUrl: firstProperty, permissionLevel: "siteOwner" },
            { siteUrl: secondProperty, permissionLevel: "siteFullUser" },
          ],
        }),
      });
      return;
    }

    if (url.pathname === "/api/gsc/config") {
      const body = await request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: true,
          refreshToken: true,
          oauthConfigured: true,
          siteUrl: body.siteUrl,
          googleAccountEmail: "owner@example.test",
          databaseConfigured: true,
        }),
      });
      return;
    }

    if (url.pathname === "/api/gsc/sitemaps") {
      const body = await request.postDataJSON();
      sitemapRequests.push(body.siteUrl);
      if (body.siteUrl === firstProperty) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sitemapResponse(firstProperty, "https://first.example/sitemap.xml?set=main")),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sitemapResponse(secondProperty, "https://second.example/sitemap.xml?set=news")),
        });
      }
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Google", exact: true }).click();
  await page.getByLabel("Property URL").selectOption(secondProperty);

  await expect(page.getByText(`Property: ${secondProperty}`, { exact: true })).toBeVisible();
  await expect(page.getByText("https://second.example/sitemap.xml?set=news", { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByText("https://first.example/sitemap.xml?set=main", { exact: true })).toHaveCount(0);
  expect(sitemapRequests).toContain(firstProperty);
  expect(sitemapRequests).toContain(secondProperty);

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
});
