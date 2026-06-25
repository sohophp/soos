const DEFAULT_FIX = {
  goal: "Make the affected URLs easier for crawlers and search users to understand.",
  steps: [
    "Review the affected URL samples and confirm the intended canonical, indexable destination.",
    "Apply the smallest site or template change that removes the reported signal conflict.",
    "Re-run the SOOS audit and compare the affected URL count before marking the issue resolved.",
  ],
  warnings: [
    "Do not remove a signal if it is intentionally excluding duplicate, private, or retired content.",
  ],
};

const FIXES = {
  sitemap_http_error: {
    goal: "Make every submitted sitemap readable by crawlers.",
    steps: [
      "Open the sitemap URL and confirm it returns HTTP 200.",
      "Fix the server route, CDN rule, authentication, or XML generation error.",
      "Keep only valid sitemapindex or urlset XML at the submitted URL.",
    ],
  },
  sitemap_unknown: {
    goal: "Publish a valid sitemapindex or urlset document.",
    steps: [
      "Validate the sitemap XML and root element.",
      "Use sitemapindex when linking child sitemaps, or urlset when listing page URLs.",
      "Re-run the audit from the same input URL.",
    ],
  },
  sitemap_fetch_failed: {
    goal: "Make the sitemap fetchable from a public crawler request.",
    steps: [
      "Check DNS, TLS, firewall, bot protection, and timeout behavior for the sitemap URL.",
      "Confirm the sitemap can be fetched without a browser session or private network access.",
      "Re-run the audit after the public fetch succeeds.",
    ],
  },
  http_error: {
    goal: "Remove broken URLs from the submitted indexable URL set.",
    steps: [
      "For each affected sitemap URL, choose whether the page should exist.",
      "If it should rank, return HTTP 200 at the final canonical URL.",
      "If it should not exist, remove it from the sitemap and link to a relevant replacement where appropriate.",
    ],
  },
  redirect: {
    goal: "Submit final 200 canonical URLs instead of redirecting URLs.",
    steps: [
      "Follow the redirect chain for each affected sitemap URL.",
      "Update the sitemap entry to the final HTTP 200 URL that self-canonicalizes.",
      "Update internal links that still point at the redirecting URL.",
    ],
  },
  redirect_chain: {
    goal: "Shorten redirect paths so crawlers reach the canonical URL directly.",
    steps: [
      "Map the current Submitted -> Final redirect chain.",
      "Change redirects so the submitted or legacy URL points directly to the final canonical URL.",
      "Update sitemap and internal links to use the final URL.",
    ],
  },
  redirect_loop: {
    goal: "Stop redirect cycles that prevent crawlers from reaching content.",
    steps: [
      "Find the first repeated URL in the redirect chain.",
      "Fix rewrite rules, canonical host rules, or trailing-slash rules causing the cycle.",
      "Verify the URL reaches one stable HTTP 200 destination.",
    ],
  },
  redirect_limit: {
    goal: "Keep redirect chains within a small, crawlable number of hops.",
    steps: [
      "Collapse legacy redirects into a direct rule to the preferred URL.",
      "Remove intermediate host, protocol, and trailing-slash hops when possible.",
      "Re-run the audit and confirm the chain is one hop or already final.",
    ],
  },
  redirect_https_downgrade: {
    goal: "Keep crawlers and users on HTTPS throughout the redirect chain.",
    steps: [
      "Replace HTTPS -> HTTP redirect rules with HTTPS destinations.",
      "Confirm canonical tags, sitemap URLs, and internal links also use HTTPS.",
      "Re-run the audit and confirm no redirect hop downgrades protocol.",
    ],
  },
  noindex: {
    goal: "Resolve the conflict between sitemap inclusion and noindex.",
    steps: [
      "Confirm whether the affected URLs should be indexed.",
      "If they should rank, remove the meta robots or X-Robots-Tag noindex directive.",
      "If they should stay excluded, remove them from the sitemap and avoid sending them for indexing validation.",
    ],
  },
  robots_disallow: {
    goal: "Allow crawlers to fetch submitted URLs that should be indexed.",
    steps: [
      "Review the matched robots.txt rule shown in the evidence.",
      "If the URL should rank, add a more specific Allow rule or remove the blocking Disallow rule.",
      "If the URL should stay blocked, remove it from the sitemap and mark it as an intentional exclusion.",
    ],
  },
  canonical_mismatch: {
    goal: "Align submitted URLs with their final canonical target.",
    steps: [
      "Compare the sitemap URL, final fetched URL, HTML canonical, and HTTP Link canonical.",
      "If the canonical target is correct, replace the sitemap URL with that canonical URL.",
      "If the submitted URL should rank, update canonical declarations to self-reference the submitted final URL.",
    ],
  },
  canonical_not_in_sitemap: {
    goal: "Submit canonical targets instead of duplicate variants.",
    steps: [
      "Identify the canonical target reported for each affected submitted URL.",
      "Add the canonical target to the sitemap if it is indexable and should rank.",
      "Remove the duplicate submitted URL when it canonicalizes elsewhere.",
    ],
  },
  canonical_conflict: {
    goal: "Give crawlers one clear canonical URL.",
    steps: [
      "List every HTML and HTTP Link canonical declaration shown in evidence.",
      "Choose the preferred canonical URL.",
      "Update templates, plugins, or headers so every canonical declaration points to the same URL.",
    ],
  },
  canonical_header_mismatch: {
    goal: "Align HTML canonical and HTTP Link canonical declarations.",
    steps: [
      "Compare the HTML link rel=canonical with the HTTP Link header.",
      "Remove the unintended declaration or update both to the same preferred URL.",
      "Re-run SOOS and confirm the conflict no longer appears.",
    ],
  },
  canonical_multiple: {
    goal: "Reduce duplicate canonical declarations that can confuse maintenance and audits.",
    steps: [
      "Find the template, plugin, or header rule adding each canonical declaration.",
      "Keep one canonical source, or make repeated HTML/header declarations identical if both are required.",
      "Confirm the final page exposes one preferred canonical URL.",
    ],
  },
  canonical_invalid: {
    goal: "Make canonical declarations parseable and usable by crawlers.",
    steps: [
      "Replace empty, malformed, JavaScript, or non-HTTP canonical href values.",
      "Use an absolute or page-resolvable HTTP(S) canonical URL.",
      "Verify the canonical target itself returns a crawlable HTML page.",
    ],
  },
  canonical_blocked: {
    goal: "Make canonical targets crawlable.",
    steps: [
      "Open robots.txt and find the rule blocking the canonical target.",
      "Allow Googlebot to crawl the canonical target if it should consolidate ranking signals.",
      "If the target should remain blocked, choose a different crawlable canonical URL.",
    ],
  },
  alternate_not_reciprocal: {
    goal: "Make hreflang clusters reciprocal.",
    steps: [
      "For each source page, open the alternate URL shown in evidence.",
      "Add a matching hreflang link back to the source page's canonical URL.",
      "Confirm every page in the language cluster references the same set of alternates.",
    ],
  },
  alternate_target_canonical_mismatch: {
    goal: "Point hreflang alternates at canonical localized pages.",
    steps: [
      "Check the canonical URL of each hreflang target.",
      "If the target canonicalizes elsewhere, update hreflang to the canonical localized URL.",
      "If the current target should be canonical, change its canonical declaration to self-reference.",
    ],
  },
  alternate_hreflang_invalid: {
    goal: "Use valid hreflang language signals.",
    steps: [
      "Replace invalid hreflang values with ISO language or language-region codes.",
      "Use x-default only for the default selector or fallback page.",
      "Re-run the audit and confirm duplicate or invalid language values are gone.",
    ],
  },
  alternate_invalid: {
    goal: "Make every hreflang target URL valid and crawlable.",
    steps: [
      "Replace malformed alternate href values with valid HTTP(S) URLs.",
      "Confirm each target returns an indexable localized page.",
      "Keep hreflang targets aligned with canonical URLs.",
    ],
  },
  internal_missing_sitemap: {
    goal: "Add internally discoverable canonical pages to the sitemap.",
    steps: [
      "Review internally discovered URLs that are missing from the sitemap.",
      "Add indexable, self-canonical pages to the XML sitemap.",
      "Exclude utility, filtered, duplicate, or non-indexable URLs intentionally.",
    ],
  },
  sitemap_orphan: {
    goal: "Give important sitemap URLs an internal discovery path.",
    steps: [
      "Confirm whether each orphan sitemap URL should be indexable.",
      "Add contextual internal links from relevant crawlable pages.",
      "Re-run with internal discovery enabled and verify inbound links are detected.",
    ],
  },
  unreachable_sitemap: {
    goal: "Make sitemap pages reachable from the site structure.",
    steps: [
      "Identify sitemap URLs without a homepage path in the link graph.",
      "Add navigation, category, hub, or contextual links from reachable pages.",
      "Re-run the audit and verify a homepage click depth is available.",
    ],
  },
  low_ctr: {
    goal: "Improve search snippets for queries with confirmed visibility but weak clicks.",
    steps: [
      "Review the query, page, position, impressions, and CTR evidence.",
      "Rewrite the title and meta description to match the query intent more directly.",
      "Update visible page copy so the snippet promise is supported by on-page content.",
    ],
  },
  stale_google_crawl: {
    goal: "Encourage Google to refresh important pages with search demand.",
    steps: [
      "Confirm the page is still indexable and linked internally.",
      "Update stale content or internal links if the page has changed meaningfully.",
      "Use Search Console URL Inspection to request validation only for important confirmed URLs.",
    ],
  },
  structured_data_invalid: {
    goal: "Restore structured data eligibility.",
    steps: [
      "Fix JSON syntax errors in the affected JSON-LD block.",
      "Validate the page with Google's Rich Results Test when the markup targets rich results.",
      "Re-run SOOS and confirm invalid JSON-LD count is zero.",
    ],
  },
  structured_data_validation: {
    goal: "Fix required structured data fields and graph references.",
    steps: [
      "Review the missing required fields or unresolved @id references in evidence.",
      "Add only fields that match visible page content.",
      "Validate with Google's Rich Results Test for supported result types.",
    ],
  },
  title_missing: {
    goal: "Give each indexable page a descriptive search title.",
    steps: [
      "Add a unique title tag to each affected page template.",
      "Describe the page's primary topic and search intent.",
      "Avoid duplicating the same title across distinct indexable pages.",
    ],
  },
  description_missing: {
    goal: "Give each indexable page a useful snippet candidate.",
    steps: [
      "Add a meta description that summarizes the page's specific value.",
      "Keep it aligned with visible page content and target intent.",
      "Avoid reusing the same description across unrelated pages.",
    ],
  },
};

export function fixInstructionFor(issueType) {
  return {
    ...DEFAULT_FIX,
    ...(FIXES[issueType] || {}),
  };
}

export function verificationFor(issueType, { requiresGoogleData = false } = {}) {
  const steps = [
    "Re-run the same SOOS audit scope after deploying the fix.",
    "Confirm the issue no longer appears in the Fix Plan or Issues workspace.",
  ];
  if (requiresGoogleData) {
    steps.push("Run URL Inspection for representative affected URLs after Google has recrawled them.");
  }
  return [{
    steps,
    expectedResult: requiresGoogleData
      ? "Local signals are clean and Google data no longer confirms the issue after recrawl."
      : "The affected URL count drops to zero or only intentional exclusions remain.",
    requiresGoogleData,
  }];
}
