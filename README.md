# soos SEO Assistant

soos is a local-first React + Node SEO audit tool for sitemap, robots.txt, indexability, international SEO, lightweight performance checks, and Google Search Console diagnostics.

## Features

- Accepts a website URL, sitemap URL, or robots.txt URL and detects the best audit target.
- Reads `sitemap.xml` and `sitemapindex` files, including child sitemaps.
- Audits canonical, hreflang/alternate, title, description, H1, lang, viewport, JSON-LD, robots rules, and sitemap consistency.
- Optional page content checks and lightweight performance checks.
- Pause, resume, stop, background worker scans, history, CSV export, and summary export.
- Google Search Console CSV import with English and Chinese column support.
- Google Search Console API integration for Search Analytics dimensions and URL Inspection.
- OAuth refresh token support so access tokens can refresh automatically.

## Requirements

- Node.js 20 or newer is recommended.
- npm.
- For Google Search Console API features, a Google Cloud OAuth client and access to the target Search Console property.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173/`
- API: `http://127.0.0.1:4177`

If port `4177` is busy:

```powershell
$env:SOOS_API_PORT='4178'; npm run dev:api
$env:SOOS_API_PORT='4178'; npm run dev:web -- --port 5177
```

Build for production:

```bash
npm run build
```

Check API syntax:

```bash
node --check server/api.js
```

## Configuration

Runtime Google Search Console config is stored locally in `.soos-gsc.json`. This file may contain OAuth credentials and tokens, and is intentionally ignored by Git.

`.env` is only for non-OAuth deployment helpers such as a temporary manual access token or public base URL:

```env
SOOS_GSC_ACCESS_TOKEN=optional-manual-access-token
SOOS_PUBLIC_BASE_URL=https://your-deployed-domain.example
```

OAuth Client ID, OAuth Client Secret, and refresh token are managed through the UI and `.soos-gsc.json`, not `.env`.

## Google Search Console OAuth

1. Create or select a Google Cloud project.
2. Enable Google Search Console API.
3. Configure OAuth consent screen and add your Google account as a test user if the app is in testing mode.
4. Create an OAuth Client ID.
5. Add an authorized redirect URI for the host you are using. It must end with `/api/gsc/oauth/callback`.
6. In soos, fill Property URL and OAuth credentials. Use the `?` help button beside OAuth Client ID for setup steps.
7. Click `Save API config`, then `Start OAuth`.
8. After Google authorization, return to soos and click `Refresh status`, then `Test API connection`.

Property URL examples:

- URL-prefix property: `https://www.example.com/`
- Domain property: `sc-domain:example.com`

## Deployment

GitHub Pages can host only the static frontend build. It cannot run `server/api.js`, so full API features such as crawling, Search Console OAuth callback, Search Analytics, and URL Inspection will not work on GitHub Pages alone.

Recommended deployment options:

- Static frontend on GitHub Pages plus a separate Node API host.
- Full app on a platform that supports Node services, such as Render.
- Vercel, using the included Serverless Function adapter in `api/index.js`.
- Netlify, after adapting the API into Netlify Functions.

For production OAuth, add the deployed API callback URL in Google Cloud.

### Vercel

This project includes `vercel.json` and a Vercel API adapter at `api/index.js`.

Recommended Vercel settings:

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Set these Environment Variables in Vercel Project Settings:

```env
SOOS_GSC_ACCESS_TOKEN=optional-manual-access-token
SOOS_PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
```

Notes:

- Vercel Serverless Functions do not persist `.soos-gsc.json`; UI-saved API config is local-only.
- Search Console Property URL is entered in the UI. It is not required as a Vercel environment variable.
- OAuth Client ID, OAuth Client Secret, and refresh token are not read from Vercel environment variables.
- For Vercel, use a manual access token or run the full OAuth flow in a persistent Node environment.
- Background audit jobs use in-memory state and are best-effort on serverless platforms. Direct scans through `/api/audit` are more reliable for Vercel.
- If `/api/gsc/status` returns `Not Found`, confirm the deployed branch includes `api/index.js` and `vercel.json`, then redeploy. The Vercel rewrite maps `/api/:path*` to `api/index.js`.

Search Analytics notes:

- Page dimension rows feed GSC opportunities, Search Visibility, and CSV export.
- Query, Page + Query, Country, and Device dimensions are displayed in the Search Analytics panel for exploration.
- Page + Query rows also generate lightweight opportunities for high impressions with low CTR, rankings in positions 4-10, and pages spread across many queries.
- Page + Query rows can be exported as a keyword opportunities CSV.

## Release Checklist

When functionality, setup, deployment, or user-facing behavior changes:

1. Update `README.md` if usage or configuration changes.
2. Update `CHANGELOG.md` with the release or unreleased changes.
3. Run:

```bash
node --check server/api.js
npm run build
```

4. Commit changes.
5. Tag releases with semantic versions such as `v0.1.0`.
