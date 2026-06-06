# Changelog

All notable changes to soos will be documented in this file.

## [Unreleased]

### Documentation

- Reorganized the whole-site roadmap around product experience, crawl accuracy, Google integrations, reporting, platform hardening, and engineering quality.
- Added version targets, acceptance criteria, technical-debt priorities, and explicit non-goals including paid scheduled scans.

### Added

- A prioritized URL Inspection queue combining sitemap anomalies, Search Analytics pages missing from sitemap, and internally discovered URLs missing from sitemap.
- Candidate source/reason visibility, cross-source deduplication, query-parameter preservation, and focused queue regression tests.
- Search Console Sitemaps API status with submitted sitemap discovery, last download time, pending state, errors, warnings, submitted URL totals, and current-audit sitemap matching.
- A focused Sitemaps API response normalization test that deliberately excludes Google's deprecated sitemap indexed totals.
- A living development guide with project goals, architecture, completion tracking and milestone roadmap.
- A three-language Google URL alignment matrix with state filters and CSV export.
- Cumulative, user-controlled URL Inspection batches for sites with more than 25 scanned URLs.
- Index coverage reason groups, expected-exclusion detection and Search Analytics-based repair priorities.
- Important indexed-page crawl freshness analysis with demand/risk sorting and CSV export.
- URL set comparison across sitemap, scanned internal links, Search Analytics pages, and Google discovery signals.
- Internal-link extraction and scanned inbound-link counts for sitemap orphan detection.
- HTTP/HTTPS, www/non-www, trailing-slash, and query-string URL variant groups.
- Three-language URL set filters, finding summaries, and CSV export.
- Full JSON-LD script, array, and `@graph` node parsing.
- Structured data syntax, local reference, required-field, recommendation, URL, name, and image consistency diagnostics.
- Combined local structured data and Google rich results findings with filters and CSV export.
- Structured data regression tests included in `npm run check`.
- Structured data rules for Course, Dataset, SoftwareApplication, ProfilePage, QAPage, discussion posts, and ItemList.
- Nested address, location, employer, author, comment, date, rating, price, count, and list-order validation.
- English, Simplified Chinese, and Traditional Chinese labels for structured data diagnostic codes.
- Structured data rules for Movie, reviews, employer ratings, fact checks, image licensing, vacation rentals, and math solvers.
- Video clip, speakable, paywall, vacation occupancy, claim rating, and math action validation.
- Per-type validation coverage showing Google-specific validation versus parse-only types.
- Updated VideoObject validation to treat `description` as recommended under current Google guidance.
- Local browser parsing for Nginx, Apache, Cloudflare, Vercel, JSON/NDJSON, CSV, and TSV access logs.
- Google crawler IP verification using reverse DNS, trusted Google hostnames, and matching forward DNS.
- Googlebot log diagnostics for HTTP errors, sitemap gaps, query URLs, static assets, robots-blocked crawling, and spoofed user agents.
- Three-language Googlebot log filters, summaries, and CSV export.
- Googlebot log parser and DNS safety regression tests included in `npm run check`.
- Session-scoped Neon retained-task list with completed-report loading, recovery, and deletion.
- Lightweight retained-task list responses that omit full report payloads until opened.
- URL-level issue fingerprints for new-regression and resolved-issue comparisons.
- Multiple historical versions of the same site instead of replacing the previous scan.
- Neon-backed audit job records scoped to each browser session.
- Automatic active-job restoration after a page refresh.
- Interrupted worker detection and recoverable audit restart after a server cold start.
- Sitemap discovery and page-result checkpoints for true URL-batch continuation.
- Atomic Neon worker leases and request-driven batch execution for serverless deployments.

### Changed

- Completed background reports remain available in Neon for 7 days.
- Background job endpoints now enforce browser-session ownership.
- Page inspection persists every 10 URLs and resumes from the last completed batch.
- Creating an audit now only queues it; `/api/audit-jobs/:id/run` synchronously processes one leased batch per request.
- Removed reliance on post-response background promises for Vercel audit jobs.
- Updated the crawler user agent to `soos/0.2 SEO audit`.
- Historical reports without internal-link data no longer produce false orphan-page findings.

### Removed

- Scheduled audit and Vercel Cron support to avoid requiring a paid scheduling feature.

## [0.2.0] - 2026-06-06

### Added

- Connected Google account display in the Search Console API panel.
- Three-language pre-connection guidance for the complete Google authorization flow.
- English, Simplified Chinese, and Traditional Chinese UI text for Search Analytics and URL Inspection diagnostics.
- Three-language Search Console CSV, GSC opportunity, and Search Visibility labels.
- OAuth callback auto-refresh for the opener window and token revoke on disconnect.
- Vercel deployment support with `api/index.js` and `vercel.json`.
- Three-language OAuth setup help in the Search Console API panel.
- Session-scoped Neon/Postgres storage for each visitor's Search Console connection.
- AES-256-GCM encryption for stored Search Console access and refresh tokens.
- Search Analytics dimensions for Query, Page + Query, Country, and Device.
- Page + Query Search Analytics opportunity cards for low CTR, striking-distance rankings, and broad query spread.
- Additional Search Analytics opportunity cards for top-rank/no-click and page-two query opportunities.
- Expanded URL Inspection diagnostics for sitemap/referrer discovery, mobile usability, rich results, duplicate/alternate states, soft 404, and discovered-not-crawled states.
- Copy-all blocked URL actions on grouped robots.txt impact cards.
- GSC opportunity deduplication, severity sorting, and suppression of ranking/CTR hints for technically blocked URLs.
- Keyword opportunities CSV export from Page + Query Search Analytics rows.
- Localized Search Console connection status messages and improved mobile Search Analytics/API controls.

### Changed

- Standardized production validation through `npm run check`.
- API handler can now be reused by both local Node server and Vercel Serverless Functions.
- OAuth Client ID and Client Secret are now server-side deployment settings; visitors connect their own Google account from the UI.
- Removed Admin Key and visitor-entered OAuth credential fields from the Search Console API panel.
- Search Console OAuth now requests basic Google account identity so the connected account can be shown.
- OAuth opens a dedicated popup immediately and securely refreshes the opener after a successful callback.
- OAuth completion also broadcasts through local storage, and closing the popup triggers a status refresh as a fallback.
- GSC browser sessions now expire after 90 days; inactive Neon sessions are cleaned up and Disconnect rotates the session cookie.
- UI avoids showing local debug callback URLs in OAuth setup hints.
- Deployment examples now recommend per-visitor OAuth instead of temporary manual access tokens.

## [0.1.0] - 2026-06-04

### Added

- React + Node SEO audit app.
- Sitemap and sitemapindex discovery with recursive child sitemap support.
- robots.txt fetching and rule checks.
- Checks for canonical, hreflang/alternate, title, description, H1, lang, viewport, JSON-LD, sitemap consistency, and indexability signals.
- Optional page content checks and lightweight performance checks.
- Scan progress, stage elapsed time, pause, resume, stop, and background worker mode.
- Audit history, single-result delete, clear history, and history retention limits.
- Report summary, issue list, CSV export, and summary export.
- Search engine visibility and GSC opportunity panels.
- Google Search Console CSV import with English and Chinese column support.
- Search Console API configuration panel.
- Search Analytics API page-level import.
- URL Inspection API panel with diagnosis cards for indexing, robots, fetch, and canonical issues.
- OAuth refresh token flow for Google Search Console API.
- `.env` preset support for OAuth Client ID and Client Secret.

### Changed

- Vite API proxy can use `SOOS_API_PORT`, defaulting to `4177`.
- GSC API error messages are friendlier for token, property, permission, and network/proxy failures.

### Security

- `.soos-gsc.json`, `.env`, `node_modules/`, and `dist/` are ignored by Git.
- OAuth Client Secret from `.env` is not copied into `.soos-gsc.json` during OAuth start or refresh.
