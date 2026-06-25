# SOOS Product Audit - 2026-06

## 1. Current Product Capabilities

SOOS already supports the core evidence sources needed for a technical SEO repair workflow:

- Local crawl inputs: website URL, sitemap URL, robots.txt URL, robots-declared sitemap discovery, sitemap index recursion, URL limits, and resumable scan checkpoints.
- Local technical signals: HTTP status, redirect chains, robots.txt allow/disallow, meta and header noindex, HTML and HTTP canonical declarations, hreflang, title, description, H1, HTML lang, viewport, JSON-LD, and lightweight raw-HTML performance signals.
- Site structure signals: optional same-site recursive discovery, internal link extraction, link graph summaries, sitemap orphan detection, URL set differences, and URL variant classification.
- Google data: read-only Search Console OAuth, property selection, Search Analytics, URL Inspection batches, Search Console Sitemap status, Google canonical, coverage state, crawl state, rich result status, and CSV fallback when disconnected.
- Report workflows: browser history, retained server reports, history comparison, CSV/text/HTML export, URL filtering, pagination, and privacy deletion.

## 2. UI Noise And Low-Value Defaults

The current interface is functionally rich but still presents product areas as flat workspaces: Scan, Google, Issues, URLs, History, and Settings. This makes the first screen feel like a set of tools instead of a decision workflow.

The highest-noise areas are:

- The scan entry and completed report share the Scan workspace, so the first decision panel is not a true Overview.
- Issues currently mixes backlog, robots details, sitemap signals, and hreflang summaries without a unified issue detail model.
- URL findings are useful evidence, but they are still too close to the primary workflow and can dominate the user's attention.
- Google workspace mixes connection, Search Analytics, Sitemaps, URL Inspection, and Googlebot logs across multiple panels without a single Google-only evidence hierarchy.
- PageSpeed, CrUX, Googlebot logs, query-intent settings, URL policy, proxy, and privacy tools are valuable but should not appear as first-run decision surfaces.

## 3. Missing Capabilities That Affect Diagnostic Trust

The main trust gaps are not more crawled checks. They are product-model gaps:

- No single `SeoIssue` object that connects category, severity, confidence, evidence, fix steps, verification steps, and priority score.
- No consistent confidence rule distinguishing Google-confirmed evidence from local scan evidence and inference.
- No explainable priority score that ranks crawl/index/canonical blockers above low-risk content suggestions.
- No single report coverage object explaining scan limits, GSC connection state, URL Inspection sampling, PageSpeed/CrUX use, and what the report cannot conclude.
- No issue status model yet for open, ignored, and resolved decisions without mutating raw scan results.

## 4. Technically Complete But Not Product-Closed

Several features exist technically but need a clearer user workflow:

- Backlog actions exist, but until this phase they did not normalize all page-level issue types into a shared Issue -> Evidence -> Fix -> Verify model.
- URL Inspection provides strong evidence, but it must always be shown as sampled Google data, not full-site indexing truth.
- Search Analytics opportunities already have thresholds, but they need to become prioritized issues with confidence and verification language.
- Internal link and URL set findings are useful, but they need to feed issue priority rather than live only in advanced evidence tables.
- HTML report export exists, but a focused Fix Plan export should be separate from full report export.

## 5. This Phase 1 Implementation Scope

This phase implements the data-layer foundation only:

- Add a unified issue normalization module that builds `SeoIssue`-shaped objects from existing scan pages plus optional Google Inspection and Search Analytics inputs.
- Add explainable priority scoring based on severity, affected URLs, search visibility, indexability, Google confirmation, confidence, and regression state.
- Add fix instruction and verification rules for high-impact technical SEO issues.
- Add a report coverage model that states scan scope, trust signals, limitations, and conclusions SOOS must not make.
- Add regression tests for issue normalization, confidence, priority scoring, fix instructions, and coverage limitations.

## 6. Explicitly Out Of Scope For Phase 1

This phase does not:

- Rebuild the Overview, Fix Plan, Issues, URLs, or Google UI.
- Add Google OAuth permissions or sitemap submit/delete actions.
- Add automatic website modification, content generation, rank tracking, subscriptions, payments, or scheduled scans.
- Add rendered JavaScript crawling or full-site URL Inspection.
- Change existing security, SSRF, OAuth encryption, Neon session isolation, rate limiting, or privacy deletion behavior.

