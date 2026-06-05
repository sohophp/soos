# Changelog

All notable changes to soos will be documented in this file.

## [Unreleased]

### Added

- Vercel deployment support with `api/index.js` and `vercel.json`.
- Three-language OAuth setup help in the Search Console API panel.
- Neon/Postgres-backed Search Console config storage for Vercel deployments.
- Admin Key protection for online Search Console config changes.
- Search Analytics dimensions for Query, Page + Query, Country, and Device.
- Page + Query Search Analytics opportunity cards for low CTR, striking-distance rankings, and broad query spread.
- Keyword opportunities CSV export from Page + Query Search Analytics rows.

### Changed

- API handler can now be reused by both local Node server and Vercel Serverless Functions.
- OAuth Client ID, OAuth Client Secret, and refresh token are managed through UI-saved config instead of `.env`.
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
