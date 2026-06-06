# Changelog

All notable changes to soos will be documented in this file.

## [Unreleased]

### Added

- Connected Google account display in the Search Console API panel.
- Three-language pre-connection guidance for the complete Google authorization flow.
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
- Keyword opportunities CSV export from Page + Query Search Analytics rows.

### Changed

- API handler can now be reused by both local Node server and Vercel Serverless Functions.
- OAuth Client ID and Client Secret are now server-side deployment settings; visitors connect their own Google account from the UI.
- Removed Admin Key and visitor-entered OAuth credential fields from the Search Console API panel.
- Search Console OAuth now requests basic Google account identity so the connected account can be shown.
- OAuth opens a dedicated popup immediately and securely refreshes the opener after a successful callback.
- OAuth completion also broadcasts through local storage, and closing the popup triggers a status refresh as a fallback.
- GSC browser sessions now expire after 90 days; inactive Neon sessions are cleaned up and Disconnect rotates the session cookie.
- UI avoids showing local debug callback URLs in OAuth setup hints.

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
