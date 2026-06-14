import { expect, test } from "@playwright/test";

const siteUrl = "https://example.test/";
const accountEmail = "owner@example.test";

test("refreshes the connected account after the OAuth popup closes and disconnects cleanly", async ({ context, page }) => {
  let connected = false;
  let statusRequests = 0;
  let oauthStarts = 0;
  let disconnects = 0;

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/test/oauth-complete") {
      connected = true;
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html>
          <meta charset="utf-8">
          <title>OAuth complete</title>
          <script>
            localStorage.setItem("soos:gsc-oauth-connected", String(Date.now()));
            window.opener.postMessage(
              { type: "soos:gsc-oauth-connected" },
              window.location.origin
            );
            setTimeout(() => window.close(), 100);
          </script>`,
      });
      return;
    }

    if (url.pathname === "/api/gsc/status") {
      statusRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: connected,
          refreshToken: connected,
          oauthConfigured: true,
          siteUrl: connected ? siteUrl : "",
          googleAccountEmail: connected ? accountEmail : "",
          databaseConfigured: true,
          serverless: false,
        }),
      });
      return;
    }

    if (url.pathname === "/api/gsc/oauth/start") {
      oauthStarts += 1;
      expect(await request.postDataJSON()).toEqual({ siteUrl });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authUrl: `${url.origin}/api/test/oauth-complete`,
        }),
      });
      return;
    }

    if (url.pathname === "/api/gsc/sites") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sites: connected ? [{ siteUrl, permissionLevel: "siteOwner" }] : [],
          selectedSiteUrl: connected ? siteUrl : "",
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
          sitemaps: [],
          summary: {
            total: 0,
            pending: 0,
            withErrors: 0,
            withWarnings: 0,
            submittedUrls: 0,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/gsc/clear") {
      disconnects += 1;
      connected = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: false,
          oauthConfigured: true,
          databaseConfigured: true,
          serverless: false,
          revoke: { revoked: true },
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

  await page.goto("/");
  await page.getByRole("tab", { name: "Google", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Search Console CSV" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google sitemap status" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Search Analytics API" })).toHaveCount(0);
  await page.getByLabel("Property URL").fill(siteUrl);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect Google Search Console", exact: true }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.isClosed()).toBe(true);

  await expect(page.getByText(accountEmail, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh status" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Test API connection" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Search Console CSV" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Google sitemap status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search Analytics API" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("OAuth connected");
  expect(oauthStarts).toBe(1);
  expect(statusRequests).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: "Disconnect" }).click();

  await expect(page.getByRole("button", { name: "Connect Google Search Console", exact: true })).toBeVisible();
  await expect(page.getByText(accountEmail, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Search Console CSV" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google sitemap status" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Search Console connection removed");
  expect(disconnects).toBe(1);
});
