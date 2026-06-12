# soos SEO Assistant

soos is a local-first React + Node SEO audit tool for sitemap, robots.txt, indexability, international SEO, lightweight performance checks, and Google Search Console diagnostics.

Detailed architecture, implementation status and the active roadmap are maintained in [DEVELOPMENT.md](DEVELOPMENT.md).

The roadmap is organized by release:

- `v0.3`: modularization, automated tests, consistent errors, observability, and three-language QA.
- `v0.4`: internal crawl discovery, link graphs, URL normalization, and stronger indexability evidence.
- `v0.5`: deeper Search Console analysis and prioritized URL Inspection.
- `v0.6`: report navigation, filtering, history, and regression explanations.
- `v1.0`: security, privacy, migrations, accessibility, and operational readiness.

Paid scheduled scans such as Vercel Cron are intentionally excluded.

Production release, migration, recovery, rollback, and key-rotation procedures are maintained in [OPERATIONS.md](OPERATIONS.md).
Stored data, retention periods, Google disconnection, and complete current-session deletion are documented in [PRIVACY.md](PRIVACY.md).

## Features

- Accepts a website URL, sitemap URL, or robots.txt URL and detects the best audit target.
- Reads `sitemap.xml` and `sitemapindex` files, including child sitemaps.
- Optional recursive same-site discovery to depth 2 with separate URL budgets and resumable background checkpoints.
- Internal link graph diagnostics for inbound/outbound links, homepage shortest paths, unreachable sitemap pages, weak linkage, and deep click paths.
- Audits canonical, hreflang/alternate, title, description, H1, lang, viewport, JSON-LD, robots rules, and sitemap consistency.
- Traces redirects hop by hop and detects loops, long chains, invalid destinations, hostname changes, and HTTPS downgrades.
- Optional page content checks and lightweight performance checks.
- Pause, resume, stop, background worker scans, history, CSV export, and summary export.
- Neon-backed background jobs, completed reports, and URL-batch checkpoints with automatic recovery after page refresh.
- Request-driven serverless workers with Neon leases, so scan work completes inside each API request instead of relying on background promises.
- Google Search Console CSV import with English and Chinese column support.
- Google Search Console API integration for Search Analytics dimensions and URL Inspection.
- Prioritized URL Inspection batches across sitemap technical anomalies, GSC pages outside sitemap, and internally discovered URLs outside sitemap.
- Search Console Sitemaps API status for submitted files, last download time, pending state, errors, warnings, and current-audit sitemap matching.
- URL set comparison across sitemap, scanned internal links, Search Analytics, and Google sitemap/referrer signals.
- Sitemap orphan detection and HTTP/HTTPS, www, trailing-slash, and query URL variant diagnosis.
- Configurable URL comparison rules for preserving queries, removing tracking parameters, ignoring queries, and normalizing trailing slashes without rewriting crawl requests.
- URL variant classification for path case, default documents, protocol/hostname differences, query order, tracking, pagination, functional, and unknown parameters.
- JSON-LD graph parsing, common Google field rules, page-signal consistency checks, and rich results issue comparison.
- Local access-log analysis with verified Googlebot IPs and sitemap crawl comparison.
- Neon retained-task management and URL-level regression comparisons across repeated scans.
- OAuth refresh token support so access tokens can refresh automatically.
- Shared frontend API client with structured request errors and a three-language React render fallback.
- Dedicated `server/gsc-search-analytics.js` service for Search Analytics validation, Google requests, row normalization, and previous-period orchestration.
- Dedicated GSC configuration storage and Google service modules for encrypted local/Neon persistence, OAuth refresh, account identity, Sites, Sitemaps, Search Analytics, and URL Inspection.
- Dedicated server route modules for health/metrics, current-session data lifecycle, GSC/OAuth, and audit-job list/create/run/control/delete endpoints.
- A dedicated audit-job store owns memory jobs, Neon persistence, page checkpoints, leases, stale-worker recovery, session retirement, and deletion tombstones.
- Pure scan parsers isolate input detection, sitemap XML, robots rules, canonical/meta/hreflang, noindex, and internal-link extraction from network orchestration.
- A scan fetcher owns timeout, public-DNS verification, pinned dispatchers, and controlled redirect tracing.
- A scan runner owns sitemap recursion, page inspection, recursive internal discovery, checkpoints, report assembly, and scan limits.
- Structured data validation and scan-level diagnosis/report scoring live in dedicated domain modules.
- Persistent Scan, Google, Issues, URLs, History, and Settings views, with paginated URL findings and state-preserving Google diagnostics.
- URL findings can be filtered by severity, issue type, text, Sitemap/internal/GSC/Inspection source, and historical change state; CSV export follows the active filters.
- History comparison separates introduced, resolved, worsened, improved, and persistent issues and warns when scan configuration changes may affect the result.
- Browser history persistence, retention limits, snapshot creation, and comparison deltas live in `src/history.js`; history, retained-job, and comparison views live in `src/components/HistoryPanels.jsx`.
- Standalone responsive HTML reports include scan scope, limits, configuration, summary, URL evidence, and available page-level Search Analytics metrics.
- Retained server reports support task ID/URL search, status filtering, true Neon pagination, expiry visibility, and confirmed deletion.
- Production responses include CSP, HSTS (Vercel), frame, referrer, permissions, and content-type protections. Browser write requests are origin-checked, and high-cost API routes are rate-limited per session and client IP.
- The Settings view reports server/browser data for the current session and can delete its Google connection, retained jobs, reports, checkpoints, leases, and soos-prefixed browser storage in one confirmed action.

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
- API health: `http://127.0.0.1:4177/api/health`

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

Health responses include a request ID, service version, timestamp, and process uptime. API errors also return a stable error code and request ID; include that request ID when investigating a production failure.

HTTP routing is split under `server/routes/`. `server/api.js` is a compact composition root for request security, session ownership, rate limiting, database initialization, and domain-service injection. Encrypted Search Console storage lives in `server/gsc-config-store.js`; OAuth and Google API calls live in `server/gsc-service.js`.

`GET /api/metrics` returns aggregate HTTP error rates, Google API failure rates, scan outcomes, and duration summaries. It does not include scanned URLs, Search Console properties, Google accounts, tokens, or error text. On Vercel these metrics cover only the current Serverless instance since its cold start; use an external log or metrics backend for cross-instance history and alerting.

The main workspace supports keyboard-visible focus, skip navigation, screen-reader status/error announcements, reduced-motion preferences, and responsive layouts down to 320px. `npm run check` includes accessibility contract checks alongside the API, unit, and production-build gates.

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
SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS=
```

Visitors do not enter OAuth Client ID or Client Secret. The deployment owner configures one Google OAuth app on the server, and each visitor connects their own Google account from the UI.

Older installations may still use a server-side `SOOS_GSC_ACCESS_TOKEN`, but the public multi-user flow should use OAuth refresh tokens instead. Manual access tokens expire quickly and do not identify or isolate visitors.

`SOOS_TOKEN_ENCRYPTION_KEY` is recommended for production. soos encrypts stored access and refresh tokens with AES-256-GCM and records a non-secret key ID with each ciphertext. If the variable is omitted, the Google OAuth Client Secret is used as a legacy fallback.

Token encryption key rotation:

1. Generate a new random value and set it as `SOOS_TOKEN_ENCRYPTION_KEY`.
2. Move the previous value to `SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS`. Multiple historical keys may be comma-separated.
3. Redeploy. Connections are decrypted with the matching historical key and rewritten with the new primary key when they are next used.
4. Keep previous keys for at least the 90-day inactive-connection retention window, then remove them after confirming old connections have expired or been used.

OAuth authorization state expires after 10 minutes and is consumed before exchanging the authorization code. A successful OAuth callback rotates the browser session and moves the Neon connection to the new session. Disconnect always removes the stored connection and rotates the session even when Google token revocation cannot be confirmed.

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

After OAuth connects, soos loads the Search Console properties available to that Google account. Select a property from the list to switch between URL-prefix and Domain properties without retyping the exact property identifier.

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
SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS=
```

Run `npm run db:status` to inspect the current Neon schema without changing it. After creating a Neon restore branch or point-in-time recovery reference, run `npm run db:migrate`, then require `db:status` to report `ready: true`. The API also applies pending idempotent migrations automatically on its first database-backed request.

Notes:

- Vercel Serverless Functions do not persist `.soos-gsc.json`; set `DATABASE_URL` to save each visitor's Search Console connection in Neon.
- Search Console Property URL is entered in the UI. It is not required as a Vercel environment variable.
- OAuth Client ID and Client Secret are deployment secrets. Visitors never enter them in the UI.
- Each visitor's encrypted refresh token is scoped to the browser session cookie and saved separately in Neon.
- Browser sessions and inactive Neon GSC records expire after 90 days. Disconnect rotates the session cookie, removes the saved connection, and attempts to revoke Google access.
- Session cookies are `HttpOnly` and `SameSite=Lax`, and become `Secure` on Vercel or an HTTPS public base URL. Configure `SOOS_PUBLIC_BASE_URL` to the exact deployed origin for strict browser write-origin checks.
- Scan targets and every redirect destination must resolve only to public IP addresses. Direct requests pin the verified DNS result to reduce SSRF and DNS rebinding risk.
- Scan proxies are disabled by default. `SOOS_ALLOW_PROXY=1` is intended only for a trusted local deployment where the configured proxy is responsible for enforcing its own DNS and network boundary; do not enable it on the public Vercel deployment.
- Without `DATABASE_URL`, background audit jobs use in-memory state and are best-effort on serverless platforms.
- With `DATABASE_URL`, background job ownership, progress, request settings, and completed reports are retained in Neon for 7 days. Refreshing the page restores the active task.
- Page inspection results are checkpointed to Neon every 10 URLs. If a serverless worker stops mid-scan, soos marks the task as interrupted and automatically resumes from the last completed batch. At most the unfinished batch is repeated.
- Sitemap discovery is checkpointed before page inspection, so a resumed task does not re-fetch completed sitemap files or already saved page results.
- The browser drives the worker through `/api/audit-jobs/:id/run`. Each request claims an atomic Neon lease and processes at most one 10-URL batch, preventing duplicate work when Vercel routes requests to different instances.
- Pause and stop take effect between checkpoint batches; an in-flight batch is allowed to finish before the saved task state changes.
- The Retained Neon Tasks panel lists tasks owned by the current browser session. Completed reports can be opened, recoverable jobs can continue, and deletion also removes checkpoint batches.
- Repeated scans of the same site are retained as separate browser-history versions. Comparison reports identify newly introduced URL issue types and resolved URL issue types.
- If `/api/gsc/status` returns `Not Found`, confirm the deployed branch includes `api/index.js` and `vercel.json`, then redeploy. The Vercel rewrite maps `/api/:path*` to `api/index.js`.

Search Analytics notes:

- Page dimension rows feed GSC opportunities, Search Visibility, and CSV export.
- Query, Page + Query, Country, and Device dimensions are displayed in the Search Analytics panel for exploration.
- Page + Query rows also generate lightweight opportunities for high impressions with low CTR, top rankings with almost no clicks, rankings in positions 4-10, page-two rankings, and pages spread across many queries.
- Page + Query analysis flags likely keyword cannibalization when multiple pages receive a meaningful share of visibility for the same query.
- Page + Query rows can be exported as a keyword opportunities CSV.
- Previous-period comparison loads the immediately preceding date range with the same number of days and explains click, impression, CTR, and average-position changes.
- Comparison results identify newly visible and lost dimension rows and can be exported with both date ranges, current values, previous values, and deltas.

URL Inspection notes:

- URL Inspection imports Google coverage, robots, fetch, canonical, sitemap/referrer, mobile usability, and rich results signals when available.
- The diagnosis cards highlight not-indexed states, discovered-not-crawled URLs, duplicate/alternate pages, soft 404s, canonical mismatches, mobile issues, and missing discovery signals.
- URL set comparison uses the URLs included in the current audit, so configured scan limits and truncation also define its sitemap scope.
- Internal-link orphan findings cover only pages completed in the current audit; older saved reports without link data suppress those findings.

Structured data notes:

- Enable Page content checks to parse JSON-LD and run local structured data validation.
- soos parses top-level objects, arrays, and `@graph` nodes, then checks syntax, local `@id` references, common Google-required fields, and recommended enhancements.
- The rule set covers common Article, Product, Review, Breadcrumb, FAQ, LocalBusiness, Video, Recipe, Event, JobPosting, Course, Dataset, SoftwareApplication, ProfilePage, QAPage, discussion post, ItemList, Movie, employer rating, fact check, image licensing, vacation rental, MathSolver, Organization, and WebSite markup.
- Nested checks cover addresses, event and job locations, employers, authors, comments, answers, offers, ratings, dates, prices, counts, and ordered list positions.
- The UI shows validation coverage per discovered type. Types without a Google-specific rule remain parseable and are labeled as parse-only.
- Name, URL, and image consistency checks are diagnostic hints. Confirm warnings with Google's Rich Results Test because lazy-loaded images and rendered content may not appear in the fetched HTML.
- Current rules follow the Google Search Central structured data documentation: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Book Actions use a separate feed rather than ordinary page markup and are outside this crawler's current scope. Vehicle Listing is omitted because Google ended support in January 2026.

Googlebot log notes:

- Import Nginx/Apache Combined logs, Cloudflare or Vercel JSON/NDJSON exports, or CSV/TSV logs from the report.
- Raw log lines are parsed locally in the browser and are not uploaded or stored in Neon.
- Only unique IPs from requests with a Google crawler user agent are sent to `/api/googlebot/verify`.
- The server rejects private IPs and verifies Google crawlers with reverse DNS, a trusted Google hostname suffix, and matching forward DNS.
- Diagnostics compare verified requests with the current sitemap scan and highlight HTTP errors, repeated server failures, query URLs, static assets, robots-blocked URLs, sitemap gaps, and spoofed Googlebot user agents.
- Large files are limited to the first 200,000 lines and DNS verification is limited to 100 unique public IPs per request.
- Verification follows Google's official guidance: https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot

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
