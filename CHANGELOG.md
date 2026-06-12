# Changelog

All notable changes to soos will be documented in this file.

## [Unreleased]

### Documentation

- Reorganized the whole-site roadmap around product experience, crawl accuracy, Google integrations, reporting, platform hardening, and engineering quality.
- Added version targets, acceptance criteria, technical-debt priorities, and explicit non-goals including paid scheduled scans.

### Added

- A shared frontend JSON API client that preserves HTTP status, error code, request ID, retryability, and server details.
- A three-language React error boundary that keeps one render failure from producing a blank page.
- Extracted frontend translation resources with automated language-key parity and mojibake checks.
- HTTP-level API route tests for CORS preflight, unknown routes, malformed JSON, audit task lifecycle, and browser-session isolation.
- A dedicated audit-task client for route calls, active-job storage, and localized progress snapshot conversion.
- A dedicated Search Console client plus extracted OAuth configuration and submitted-sitemap panels.
- A shared CSV download utility for report exports and standalone regression coverage for CSV serialization edge cases.
- An extracted Search Analytics panel plus pure date-range and opportunity-insight helpers that can be tested outside React.
- Dedicated GSC CSV parsing and summary helper modules with regression tests for imported exports, opportunity grouping, and search-visibility readiness.
- An extracted Search Console CSV import panel that no longer keeps file-import state inside `main.jsx`.
- A dedicated URL Inspection diagnostics module covering URL alignment, index coverage classification, crawl freshness, and per-URL Google findings.
- Extracted URL alignment, index coverage priority, and important-page freshness views with deterministic diagnostic regression tests.
- A shared server HTTP module for request IDs, JSON body limits, structured errors, no-store responses, and JSON request logs.
- Stable `/api/health` and `/api/healthz` liveness endpoints that do not create browser sessions.
- A dedicated Googlebot DNS verifier module with injectable DNS adapters and cache-aware regression tests.
- A dedicated server-side Search Analytics service with injected OAuth/config, fetch, URL normalization, and Google error adapters.
- A dedicated GSC configuration store for environment loading, encrypted local/Neon persistence, lazy token-key rotation, and session-scoped configuration.
- A dedicated OAuth/GSC service for token exchange and refresh, account identity, revoke, Sites, Sitemaps, Search Analytics, URL Inspection, status sanitization, and Google error translation.
- A dedicated frontend history module plus extracted history, retained-job, and version-comparison panels.
- Search Console Sites API support with normalized permission levels, property deduplication, and verified-property counts.
- A three-language connected-property selector that automatically loads and persists the user's accessible Search Console properties.
- Search Analytics previous-period comparison with equal-length date ranges, click/impression/CTR/position deltas, gained/lost visibility diagnosis, and evidence-rich CSV export.
- Page + Query cannibalization diagnosis for queries where multiple pages receive meaningful competing visibility.
- Persistent three-language workspace navigation for Scan, Google, Issues, URLs, History, and Settings.
- URL findings pagination with 50 rows per page and automatic reset when filters or search terms change.
- Unified URL source filters for Sitemap, internal links, Search Analytics, and URL Inspection, with per-source counts.
- URL-level change filters for new, persistent, improved, unchanged, and unavailable comparison states.
- Detailed history comparison for introduced, resolved, severity-worsened, severity-improved, and persistent URL issues.
- Scan configuration snapshots and comparison warnings when audit scope or checks differ between versions.
- Standalone, responsive HTML report export with scan scope, limits, configuration, summary, URL evidence, and optional page-level GSC metrics.
- Server-side retained-task search, status filters, database pagination, total counts, storage mode, retention metadata, and per-task expiry times.
- Three-language retained-task controls and destructive deletion confirmation.
- API CSP, frame, referrer, permissions, content-type and same-origin CORS response headers.
- Same-origin enforcement for browser write requests using the existing HttpOnly SameSite session cookie.
- Session-and-IP fixed-window limits for audit creation/runs, URL Inspection, Search Analytics, and Googlebot DNS verification.
- Vercel static HSTS and security headers plus a strict CSP for the React entry page and built assets.
- SSRF and DNS rebinding protection that rejects local, private, link-local, reserved, and mixed public/private DNS targets before every redirect hop.
- DNS-pinned Undici dispatchers for direct scan requests, including IPv4, IPv6, and IPv4-mapped IPv6 regression coverage.
- Versioned Neon schema migrations with an applied-version ledger, transactional config/lease table setup, and query indexes.
- A deployment-friendly `npm run db:migrate` command plus migration regression tests for fresh, partial, and current schemas.
- Versioned AES-256-GCM token ciphertext with non-secret key IDs, historical-key fallback, legacy `enc:v1` compatibility, and lazy re-encryption.
- Ten-minute, single-use OAuth state validation with constant-time comparison.
- Browser-session rotation after successful OAuth and disconnect, including Neon connection migration to the new session.
- API lifecycle coverage proving disconnect removes stored credentials and replaces the session cookie.
- A privacy-minimized `/api/metrics` snapshot for HTTP error rates, Google API failure rates, audit outcomes, and duration summaries.
- Per-service Google fetch instrumentation and deduplicated background/synchronous audit lifecycle metrics.
- Three-language skip navigation, explicit form control names, visible keyboard focus rings, reduced-motion support, and semantic progress/status/error announcements.
- Accessible expanded/pressed states for URL rows and severity filters.
- Mobile empty-state alignment and verified 320px, 390px, and desktop layouts for the primary, Settings, and Google views.
- Accessibility regression checks included in `npm run check`.
- A production operations runbook covering release gates, Neon backup/restore, forward-only migrations, Vercel rollback, key incidents, and operational signals.
- A read-only `npm run db:status` command for migration versions, pending migrations, and required-table readiness.
- GitHub Actions CI running clean install, high-severity dependency audit, the complete test suite, and production build on Node 22.
- Operations-contract regression tests for required release, migration, recovery, and CI commands.
- Controlled redirect tracing with per-hop status and destination, loop/invalid/overlong/cross-host/HTTPS-downgrade diagnostics, CSV output, and URL Inspection prioritization.
- A shared HTTP(S) URL policy used by crawling, link graphs, redirect analysis, and Inspection candidate deduplication.
- Three-language URL comparison settings for query parameters and trailing slashes, persisted with each audit and shown in URL set diagnosis.
- Query-order normalization and three-level URL variant diagnosis covering reasonable duplicates, variants that should be unified, and serious conflicts.
- Path-case, default-document, protocol, hostname, trailing-slash, tracking, pagination, functional-query, and unknown-query reason labels.
- Homepage shortest-path analysis with reachable counts, maximum click depth, unreachable sitemap detection, and URL Inspection prioritization for unreachable or deep pages.
- An internal link graph across sitemap and recursively discovered pages with inbound/outbound counts, discovery depth, orphan/weak/deep/dead-end classifications, filters, and CSV export.
- Optional bounded recursive internal discovery with same-site filtering, depth and URL budgets, checkpoint recovery, and a separate discovered-page report.
- Recursive discoveries feed URL-set comparison and prioritized URL Inspection without changing sitemap health scoring.
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
- Current-session data inventory and confirmed deletion for encrypted GSC configuration, retained audits, reports, checkpoints, worker leases, and soos-prefixed browser storage.
- Session retirement, cookie rotation, Google token revocation attempt, and worker tombstones to prevent deleted tasks from being restored by in-flight persistence.
- A three-language Privacy and data Settings panel plus a dedicated data lifecycle document.
- Server route modules for health/metrics, session-data lifecycle, and audit-job management, with dependency-injected route tests.
- A GSC/OAuth route module covering status, configuration, disconnect, OAuth start/callback, Sites, Search Analytics, Sitemaps, URL Inspection, and connection testing.
- An audit-job store module encapsulating in-memory state, Neon reports, URL batches, worker leases, stale-run recovery, and deletion protection.
- A scan parser module for audit input classification, sitemap XML, robots.txt decisions, and raw-HTML SEO signal extraction.
- Dedicated modules for structured-data validation, scan network requests, scan-level diagnostics, and the full resumable scan runner.
- Scan runner regression coverage for sitemap collection, page inspection, structured data, robots blocking, checkpoints, progress, report flags, and proxy policy.

### Changed

- React root mounting is reused across Vite hot updates, avoiding duplicate `createRoot()` warnings during local development.
- `server/api.js` now composes system, session-data, and audit-job route modules instead of carrying those endpoint branches inline.
- GSC and OAuth endpoint orchestration now lives in `server/routes/gsc-routes.js`; token, state, encryption, storage, and Google-client services remain injected domain dependencies.
- `server/api.js` delegates task state/persistence to `server/audit-job-store.js` and pure document parsing to `server/scan-parsers.js`.
- Terminal audit states now replace any pending delayed write with an immediate persistence task.
- Robots decisions now expose the requested path and ordered matching-rule evidence used by blocked-URL diagnostics.
- `server/api.js` is now a roughly 440-line composition entry instead of containing the crawler, parser, structured-data rules, report diagnosis, task store, GSC persistence, OAuth refresh, or Google API client.
- GSC configuration and service tests verify encrypted secret storage, environment fallback, OAuth URL parameters, refresh-token persistence, status redaction, property access, and friendly Google errors.
- `main.jsx` no longer owns browser history persistence, snapshot/delta calculation, or history/report-retention panel markup; focused tests cover malformed storage, retention settings, deterministic snapshots, severity changes, and category changes.
- Upgraded `concurrently` from 9.2.1 to 10.0.3 to remove the critical transitive `shell-quote` advisory; a fresh audit reports zero vulnerabilities.
- Moved Vite, the React plugin, TypeScript, and concurrently to `devDependencies`, reducing the production dependency set.
- Updated Undici within major version 7 to 7.27.2 and declared the required Node.js baseline.
- Scan proxy usage is disabled by default and now requires the trusted local deployment flag `SOOS_ALLOW_PROXY=1`.
- Completed background reports remain available in Neon for 7 days.
- Background job endpoints now enforce browser-session ownership.
- Page inspection persists every 10 URLs and resumes from the last completed batch.
- Creating an audit now only queues it; `/api/audit-jobs/:id/run` synchronously processes one leased batch per request.
- Removed reliance on post-response background promises for Vercel audit jobs.
- Updated the crawler user agent to `soos/0.2 SEO audit`.
- Historical reports without internal-link data no longer produce false orphan-page findings.
- Search Analytics opportunity logic now lives outside `main.jsx`, reducing frontend entry-point coupling.
- Search Analytics requests can optionally load the immediately preceding period while keeping current Page rows as the source for existing URL diagnostics.
- Search Analytics validation, Google requests, row normalization, and previous-period orchestration no longer live in `server/api.js`.
- The former long single-page flow is grouped into stable workspace views without unmounting stateful Google diagnostics when users switch views.
- URL CSV export now follows the active URL filters while exporting all matching rows rather than only the current page.
- Older history entries remain comparable and explicitly report when no configuration snapshot is available.
- Text, CSV, and HTML downloads now share one browser download helper.
- Neon task listing now uses database `COUNT`, filtering, `LIMIT`, and `OFFSET` rather than loading an arbitrary task subset into the function.
- Cross-origin write attempts return structured `ORIGIN_REJECTED` errors; high-cost request limits return `RATE_LIMITED`, rate headers, and `Retry-After`.
- Search Console CSV parsing, imported-row deduplication, and visibility summary rules now live outside `main.jsx`.
- URL Inspection diagnostic rules and supporting views now live outside `main.jsx`; unspecified Google fetch states no longer create false fetch warnings.
- Restored explicit imports for shared GSC row helpers used by report and Googlebot views, preventing runtime-only undefined references.
- API errors retain the compatible `error` message while adding `code`, `requestId`, and `retryable`; frontend panels now show diagnostic IDs when available.
- Oversized API request bodies now return HTTP 413 with `REQUEST_TOO_LARGE`, while malformed JSON returns `INVALID_JSON`.
- Googlebot reverse/forward DNS verification, public-IP filtering, batching, and caching no longer live in the main API file.
- Connected users can switch Search Console properties from a Google-provided list while manual property entry remains available before OAuth.

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
