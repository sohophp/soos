# soos SEO Assistant

soos is a local-first React + Node SEO audit tool for sitemap, robots.txt, indexability, international SEO, lightweight performance checks, and Google Search Console diagnostics.

Detailed architecture, implementation status and the active roadmap are maintained in [DEVELOPMENT.md](DEVELOPMENT.md).

## Features

- Accepts a website URL, sitemap URL, or robots.txt URL and detects the best audit target.
- Reads `sitemap.xml` and `sitemapindex` files, including child sitemaps.
- Audits canonical, hreflang/alternate, title, description, H1, lang, viewport, JSON-LD, robots rules, and sitemap consistency.
- Optional page content checks and lightweight performance checks.
- Pause, resume, stop, background worker scans, history, CSV export, and summary export.
- Neon-backed background jobs, completed reports, and URL-batch checkpoints with automatic recovery after page refresh.
- Request-driven serverless workers with Neon leases, so scan work completes inside each API request instead of relying on background promises.
- Google Search Console CSV import with English and Chinese column support.
- Google Search Console API integration for Search Analytics dimensions and URL Inspection.
- URL set comparison across sitemap, scanned internal links, Search Analytics, and Google sitemap/referrer signals.
- Sitemap orphan detection and HTTP/HTTPS, www, trailing-slash, and query URL variant diagnosis.
- JSON-LD graph parsing, common Google field rules, page-signal consistency checks, and rich results issue comparison.
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

Runtime Google Search Console config is stored locally in `.soos-gsc.json` when no database is configured. This file may contain OAuth tokens and is intentionally ignored by Git.

When `DATABASE_URL` is configured, soos stores each browser session's Search Console connection in Neon/Postgres instead of `.soos-gsc.json`. This is the recommended path for public Vercel deployments because different visitors need separate Google authorizations and Serverless Functions cannot persist local files between deployments.

`.env` is for deployment helpers, the shared Google OAuth app, and the database connection:

```env
SOOS_PUBLIC_BASE_URL=https://your-deployed-domain.example
DATABASE_URL=postgresql://...
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
SOOS_TOKEN_ENCRYPTION_KEY=generate-a-long-random-value
```

Visitors do not enter OAuth Client ID or Client Secret. The deployment owner configures one Google OAuth app on the server, and each visitor connects their own Google account from the UI.

Older installations may still use a server-side `SOOS_GSC_ACCESS_TOKEN`, but the public multi-user flow should use OAuth refresh tokens instead. Manual access tokens expire quickly and do not identify or isolate visitors.

`SOOS_TOKEN_ENCRYPTION_KEY` is recommended for production. soos encrypts stored access and refresh tokens with AES-256-GCM. If the variable is omitted, the Google OAuth Client Secret is used to derive the encryption key. Keep the selected key stable; changing it makes existing encrypted connections unreadable.

## Google Search Console OAuth

Deployment setup:

1. Create or select a Google Cloud project.
2. Enable Google Search Console API.
3. Configure OAuth consent screen and add test users if the app is still in testing mode.
4. Create a Web application OAuth Client ID.
5. Add an authorized redirect URI for the host you are using. It must end with `/api/gsc/oauth/callback`.
6. Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` on the server.

Visitor flow:

1. Enter the exact Search Console Property URL.
2. Click `Connect Google Search Console`.
3. Choose the Google account that has access to the property.
4. If Google shows an unverified-app warning, open the advanced option and continue to soos after confirming you are using the expected soos domain.
5. Continue through the soos sign-in screen.
6. Select the permission to view Search Console data for verified sites, then continue.
7. Return to soos and click `Test API connection`.

soos requests Search Console read-only access plus basic Google account identity (`openid email profile`) so the UI can show which Google account is connected. Existing connections created before this scope was added may need to reconnect once before the email appears.

After OAuth succeeds, the callback page notifies the main soos window and tries to close itself. Disconnect removes the local/Neon connection and attempts to revoke the Google OAuth token.

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
SOOS_PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
DATABASE_URL=postgresql://...
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
SOOS_TOKEN_ENCRYPTION_KEY=generate-a-long-random-value
```

Notes:

- Vercel Serverless Functions do not persist `.soos-gsc.json`; set `DATABASE_URL` to save each visitor's Search Console connection in Neon.
- Search Console Property URL is entered in the UI. It is not required as a Vercel environment variable.
- OAuth Client ID and Client Secret are deployment secrets. Visitors never enter them in the UI.
- Each visitor's encrypted refresh token is scoped to the browser session cookie and saved separately in Neon.
- Browser sessions and inactive Neon GSC records expire after 90 days. Disconnect rotates the session cookie, removes the saved connection, and attempts to revoke Google access.
- Without `DATABASE_URL`, background audit jobs use in-memory state and are best-effort on serverless platforms.
- With `DATABASE_URL`, background job ownership, progress, request settings, and completed reports are retained in Neon for 7 days. Refreshing the page restores the active task.
- Page inspection results are checkpointed to Neon every 10 URLs. If a serverless worker stops mid-scan, soos marks the task as interrupted and automatically resumes from the last completed batch. At most the unfinished batch is repeated.
- Sitemap discovery is checkpointed before page inspection, so a resumed task does not re-fetch completed sitemap files or already saved page results.
- The browser drives the worker through `/api/audit-jobs/:id/run`. Each request claims an atomic Neon lease and processes at most one 10-URL batch, preventing duplicate work when Vercel routes requests to different instances.
- Pause and stop take effect between checkpoint batches; an in-flight batch is allowed to finish before the saved task state changes.
- If `/api/gsc/status` returns `Not Found`, confirm the deployed branch includes `api/index.js` and `vercel.json`, then redeploy. The Vercel rewrite maps `/api/:path*` to `api/index.js`.

Search Analytics notes:

- Page dimension rows feed GSC opportunities, Search Visibility, and CSV export.
- Query, Page + Query, Country, and Device dimensions are displayed in the Search Analytics panel for exploration.
- Page + Query rows also generate lightweight opportunities for high impressions with low CTR, top rankings with almost no clicks, rankings in positions 4-10, page-two rankings, and pages spread across many queries.
- Page + Query rows can be exported as a keyword opportunities CSV.

URL Inspection notes:

- URL Inspection imports Google coverage, robots, fetch, canonical, sitemap/referrer, mobile usability, and rich results signals when available.
- The diagnosis cards highlight not-indexed states, discovered-not-crawled URLs, duplicate/alternate pages, soft 404s, canonical mismatches, mobile issues, and missing discovery signals.
- URL set comparison uses the URLs included in the current audit, so configured scan limits and truncation also define its sitemap scope.
- Internal-link orphan findings cover only pages completed in the current audit; older saved reports without link data suppress those findings.

Structured data notes:

- Enable Page content checks to parse JSON-LD and run local structured data validation.
- soos parses top-level objects, arrays, and `@graph` nodes, then checks syntax, local `@id` references, common Google-required fields, and recommended enhancements.
- The rule set covers common Article, Product, Breadcrumb, FAQ, LocalBusiness, Video, Recipe, Event, JobPosting, Course, Dataset, SoftwareApplication, ProfilePage, QAPage, discussion post, ItemList, Organization, and WebSite markup.
- Nested checks cover addresses, event and job locations, employers, authors, comments, answers, offers, ratings, dates, prices, counts, and ordered list positions.
- Name, URL, and image consistency checks are diagnostic hints. Confirm warnings with Google's Rich Results Test because lazy-loaded images and rendered content may not appear in the fetched HTML.
- Current rules follow the Google Search Central structured data documentation: https://developers.google.com/search/docs/appearance/structured-data/search-gallery

## Release Checklist

When functionality, setup, deployment, or user-facing behavior changes:

1. Update `README.md` if usage or configuration changes.
2. Update `CHANGELOG.md` with the release or unreleased changes.
3. Run:

```bash
npm run check
```

4. Commit changes.
5. Tag releases with semantic versions such as `v0.1.0`.
