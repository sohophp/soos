import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileSearch,
  Globe2,
  Loader2,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import "./styles.css";

const severityLabels = { critical: "Critical", warning: "Warning", notice: "Notice" };
const severityIcons = { critical: XCircle, warning: AlertTriangle, notice: ShieldAlert };
const dictionaries = {
  en: {
    heading: "Google crawl diagnostics",
    subheading: "sitemap, robots.txt, canonical, and hreflang checks",
    placeholder: "https://example.com, /sitemap.xml, or /robots.txt",
    audit: "Audit",
    pageChecksTitle: "Page content checks",
    pageChecksHelp: "Title, description, H1, lang, viewport, JSON-LD, and duplicate metadata",
    directoryRobotsTitle: "Use sitemap-directory robots.txt",
    directoryRobotsHelp: "For test URLs, read robots.txt beside the sitemap instead of the domain root",
    healthScore: "Health Score",
    executiveSummary: "Executive summary",
    priorityActions: "Priority actions",
    statusFlags: "Status flags",
    history: "Recent audits",
    clearHistory: "Clear history",
    keepRecent: "Keep recent",
    rerun: "Rerun",
    compareToCurrent: "Compare to current",
    deleteHistory: "Delete",
    details: "Details",
    hideDetails: "Hide details",
    noHistory: "No saved audits yet.",
    historyScore: "Score",
    historyUrls: "URLs",
    historyAffected: "Affected",
    trendUp: "Improved",
    trendDown: "Worse",
    trendFlat: "Unchanged",
    issueDelta: "Issue delta",
    improvedIssues: "Improved issues",
    worsenedIssues: "Worsened issues",
    noDelta: "No material issue changes detected.",
    categoryDelta: "Category delta",
    cleanSignals: "Clean crawl signals",
    needsCleanup: "Needs focused cleanup",
    likelyBlockers: "Likely crawl/indexing blockers",
    urls: "URLs",
    affected: "Affected",
    googleRisk: "Google Risk",
    critical: "Critical",
    warnings: "Warnings",
    limitReachedTitle: "Interactive scan limit reached",
    limitReachedText: "This report scanned up to {urls} URLs and {sitemaps} sitemap files. Large-site background crawling will be handled in a later worker mode.",
    limitOk: "Scan stayed within the current limit of {urls} URLs and {sitemaps} sitemap files.",
    fixFirst: "Fix First",
    tasks: "tasks",
    noPriority: "No priority blockers found in the scanned URL set.",
    robots: "Robots",
    found: "Found",
    groups: "groups",
    sitemaps: "Sitemaps",
    urlFindings: "URL Findings",
    noFilter: "No URLs match this filter.",
    searchUrls: "Search URLs or issues",
    exportCsv: "Export CSV",
    exportSummary: "Export Summary",
    showMatchingUrls: "Show matching URLs",
    final: "Final",
    canonical: "Canonical",
    alternates: "Alternates",
    hreflangLinks: "hreflang links",
    likelyOutcome: "Likely Google outcome",
    noBlockers: "No obvious crawl blockers found.",
    title: "Title",
    description: "Description",
    h1: "H1",
    lang: "Lang",
    viewport: "Viewport",
    jsonLd: "JSON-LD",
    missing: "Missing",
    present: "Present",
    unknown: "Unknown",
    noneFound: "None found",
    validInvalid: "{valid} valid / {invalid} invalid",
    detectedInputs: "Detected inputs",
    original: "Original",
    siteRoot: "Site root",
    inputType: "Input type",
    progressPreparing: "Preparing scan",
    progressFetching: "Fetching sitemap and robots.txt",
    progressInspecting: "Inspecting URLs",
    progressFinalizing: "Finalizing report",
    progressPaused: "Paused",
    progressStopped: "Stopped",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    runtime: "Runtime",
    startedAt: "Started",
    elapsed: "Elapsed",
    currentStage: "Current stage",
    pauseCount: "Pauses",
    stageElapsed: "Stage elapsed",
    performance: "Performance",
    performanceChecksTitle: "Performance checks",
    performanceChecksHelp: "TTFB, HTML size, scripts, stylesheets, images, and lightweight CWV readiness signals",
    backgroundModeTitle: "Background worker mode",
    backgroundModeHelp: "Raise the scan limit to 2000 URLs and keep the job available longer",
    status: "Status",
    robotsAnalysis: "Robots analysis",
    robotsContent: "robots.txt content",
    sitemapDirectives: "Sitemap directives",
    rules: "rules",
    googleGroups: "Google groups",
    robotsImpact: "Robots impact",
    blockedSubmittedUrls: "Blocked submitted URLs",
    blockedCanonicalTargets: "Blocked canonical targets",
    blockedAlternateTargets: "Blocked alternate targets",
    sampleUrls: "Sample URLs",
    sitemapSignals: "Sitemap signals",
    redirectUrlsInSitemap: "Redirect URLs still in sitemap",
    noindexUrlsInSitemap: "Noindex URLs still in sitemap",
    canonicalizedElsewhere: "Submitted URLs canonicalize elsewhere",
    canonicalMissingFromSitemap: "Canonical targets missing from sitemap",
    brokenUrlsInSitemap: "Broken URLs still in sitemap",
    relatedTargets: "Related targets",
    internationalSignals: "International signals",
    alternateNotReciprocal: "Alternate pages do not link back",
    alternateCanonicalMismatch: "Alternate targets canonicalize elsewhere",
    invalidHreflangValues: "Invalid hreflang values",
  },
  "zh-CN": {
    heading: "\u0047\u006f\u006f\u0067\u006c\u0065 \u6293\u53d6\u8bca\u65ad",
    subheading: "\u68c0\u67e5 sitemap\u3001robots.txt\u3001canonical \u548c hreflang",
    placeholder: "https://example.com\u3001/sitemap.xml \u6216 /robots.txt",
    audit: "\u5f00\u59cb\u68c0\u67e5",
    pageChecksTitle: "\u9875\u9762\u5185\u5bb9\u68c0\u67e5",
    pageChecksHelp: "Title\u3001description\u3001H1\u3001lang\u3001viewport\u3001JSON-LD \u548c\u91cd\u590d\u5143\u6570\u636e",
    directoryRobotsTitle: "\u8bfb\u53d6 sitemap \u540c\u76ee\u5f55 robots.txt",
    directoryRobotsHelp: "\u7528\u4e8e\u6d4b\u8bd5\u7f51\u5740\uff1a\u8bfb\u53d6 sitemap \u540c\u76ee\u5f55\u7684 robots.txt\uff0c\u800c\u4e0d\u662f\u57df\u540d\u6839\u76ee\u5f55",
    healthScore: "\u5065\u5eb7\u5206",
    executiveSummary: "\u6458\u8981\u7ed3\u8bba",
    priorityActions: "\u4f18\u5148\u52a8\u4f5c",
    statusFlags: "\u72b6\u6001\u6807\u7b7e",
    history: "\u6700\u8fd1\u68c0\u67e5",
    clearHistory: "\u6e05\u7a7a\u5386\u53f2",
    keepRecent: "\u4fdd\u7559\u6700\u8fd1",
    rerun: "\u91cd\u65b0\u68c0\u67e5",
    compareToCurrent: "\u4e0e\u5f53\u524d\u6bd4\u8f83",
    deleteHistory: "\u5220\u9664",
    details: "\u8be6\u60c5",
    hideDetails: "\u6536\u8d77\u8be6\u60c5",
    noHistory: "\u8fd8\u6ca1\u6709\u4fdd\u5b58\u7684\u68c0\u67e5\u8bb0\u5f55\u3002",
    historyScore: "\u5206\u6570",
    historyUrls: "\u7f51\u5740\u6570",
    historyAffected: "\u53d7\u5f71\u54cd",
    trendUp: "\u53d8\u597d",
    trendDown: "\u53d8\u5dee",
    trendFlat: "\u65e0\u53d8\u5316",
    issueDelta: "\u95ee\u9898\u53d8\u5316",
    improvedIssues: "\u6539\u5584\u7684\u95ee\u9898",
    worsenedIssues: "\u53d8\u5dee\u7684\u95ee\u9898",
    noDelta: "\u6ca1\u6709\u53d1\u73b0\u660e\u663e\u7684\u95ee\u9898\u53d8\u5316\u3002",
    categoryDelta: "\u4e13\u9898\u53d8\u5316",
    cleanSignals: "\u6293\u53d6\u4fe1\u53f7\u826f\u597d",
    needsCleanup: "\u9700\u8981\u91cd\u70b9\u6e05\u7406",
    likelyBlockers: "\u53ef\u80fd\u5b58\u5728\u6293\u53d6/\u7d22\u5f15\u963b\u585e",
    urls: "\u7f51\u5740\u6570",
    affected: "\u53d7\u5f71\u54cd",
    googleRisk: "Google \u98ce\u9669",
    critical: "\u4e25\u91cd",
    warnings: "\u8b66\u544a",
    limitReachedTitle: "\u5df2\u8fbe\u5230\u4ea4\u4e92\u5f0f\u626b\u63cf\u4e0a\u9650",
    limitReachedText: "\u672c\u62a5\u544a\u6700\u591a\u626b\u63cf {urls} \u4e2a\u7f51\u5740\u548c {sitemaps} \u4e2a sitemap \u6587\u4ef6\u3002\u5927\u578b\u7ad9\u70b9\u4e4b\u540e\u4f1a\u4ea4\u7ed9\u540e\u53f0 worker \u6a21\u5f0f\u3002",
    limitOk: "\u672c\u6b21\u626b\u63cf\u672a\u8d85\u8fc7\u5f53\u524d\u9650\u5236\uff1a{urls} \u4e2a\u7f51\u5740\u548c {sitemaps} \u4e2a sitemap \u6587\u4ef6\u3002",
    fixFirst: "\u4f18\u5148\u4fee\u590d",
    tasks: "\u9879\u4efb\u52a1",
    noPriority: "\u5f53\u524d\u626b\u63cf\u8303\u56f4\u5185\u6ca1\u6709\u53d1\u73b0\u4f18\u5148\u963b\u585e\u9879\u3002",
    robots: "Robots",
    found: "\u5df2\u627e\u5230",
    groups: "\u7ec4\u89c4\u5219",
    sitemaps: "Sitemaps",
    urlFindings: "\u7f51\u5740\u95ee\u9898",
    noFilter: "\u6ca1\u6709\u7f51\u5740\u7b26\u5408\u5f53\u524d\u7b5b\u9009\u3002",
    searchUrls: "\u641c\u7d22\u7f51\u5740\u6216\u95ee\u9898",
    exportCsv: "\u5bfc\u51fa CSV",
    exportSummary: "\u5bfc\u51fa\u6458\u8981",
    showMatchingUrls: "\u67e5\u770b\u5bf9\u5e94\u7f51\u5740",
    final: "\u6700\u7ec8\u5730\u5740",
    canonical: "Canonical",
    alternates: "Alternates",
    hreflangLinks: "\u4e2a hreflang \u94fe\u63a5",
    likelyOutcome: "Google \u53ef\u80fd\u7ed3\u679c",
    noBlockers: "\u672a\u53d1\u73b0\u660e\u663e\u6293\u53d6\u963b\u585e\u3002",
    title: "Title",
    description: "Description",
    h1: "H1",
    lang: "Lang",
    viewport: "Viewport",
    jsonLd: "JSON-LD",
    missing: "\u7f3a\u5931",
    present: "\u5b58\u5728",
    unknown: "\u672a\u77e5",
    noneFound: "\u672a\u53d1\u73b0",
    validInvalid: "{valid} \u6709\u6548 / {invalid} \u65e0\u6548",
    detectedInputs: "\u81ea\u52a8\u8bc6\u522b\u7ed3\u679c",
    original: "\u539f\u59cb\u8f93\u5165",
    siteRoot: "\u7ad9\u70b9\u6839\u76ee\u5f55",
    inputType: "\u8f93\u5165\u7c7b\u578b",
    progressPreparing: "\u51c6\u5907\u626b\u63cf",
    progressFetching: "\u8bfb\u53d6 sitemap \u548c robots.txt",
    progressInspecting: "\u68c0\u67e5\u7f51\u5740",
    progressFinalizing: "\u751f\u6210\u62a5\u544a",
    progressPaused: "\u5df2\u6682\u505c",
    progressStopped: "\u5df2\u505c\u6b62",
    pause: "\u6682\u505c",
    resume: "\u7ee7\u7eed",
    stop: "\u505c\u6b62",
    runtime: "\u8fd0\u884c\u72b6\u6001",
    startedAt: "\u5f00\u59cb\u65f6\u95f4",
    elapsed: "\u5df2\u8fd0\u884c",
    currentStage: "\u5f53\u524d\u9636\u6bb5",
    pauseCount: "\u6682\u505c\u6b21\u6570",
    stageElapsed: "\u9636\u6bb5\u8017\u65f6",
    performance: "\u6027\u80fd",
    performanceChecksTitle: "\u6027\u80fd\u68c0\u67e5",
    performanceChecksHelp: "TTFB\u3001HTML \u5927\u5c0f\u3001\u811a\u672c\u3001\u6837\u5f0f\u3001\u56fe\u7247\u548c\u8f7b\u91cf CWV \u51c6\u5907\u5ea6\u4fe1\u53f7",
    backgroundModeTitle: "\u540e\u53f0 worker \u6a21\u5f0f",
    backgroundModeHelp: "\u5c06\u626b\u63cf\u4e0a\u9650\u63d0\u9ad8\u5230 2000 \u4e2a URL\uff0c\u5e76\u5ef6\u957f job \u4fdd\u7559\u65f6\u95f4",
    status: "\u72b6\u6001",
    robotsAnalysis: "Robots \u5206\u6790",
    robotsContent: "robots.txt \u5185\u5bb9",
    sitemapDirectives: "Sitemap \u6307\u4ee4",
    rules: "\u6761\u89c4\u5219",
    googleGroups: "Google \u89c4\u5219\u7ec4",
    robotsImpact: "Robots \u5f71\u54cd",
    blockedSubmittedUrls: "\u88ab\u62e6\u622a\u7684\u63d0\u4ea4\u7f51\u5740",
    blockedCanonicalTargets: "\u88ab\u62e6\u622a\u7684 canonical \u76ee\u6807",
    blockedAlternateTargets: "\u88ab\u62e6\u622a\u7684 alternate \u76ee\u6807",
    sampleUrls: "\u793a\u4f8b\u7f51\u5740",
    sitemapSignals: "Sitemap \u4fe1\u53f7",
    redirectUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728\u8df3\u8f6c\u7f51\u5740",
    noindexUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728 noindex \u7f51\u5740",
    canonicalizedElsewhere: "\u63d0\u4ea4\u7f51\u5740 canonical \u5230\u522b\u5904",
    canonicalMissingFromSitemap: "canonical \u76ee\u6807\u672a\u5305\u542b\u5728 sitemap \u4e2d",
    brokenUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728\u9519\u8bef\u7f51\u5740",
    relatedTargets: "\u76f8\u5173\u76ee\u6807",
    internationalSignals: "\u56fd\u9645\u5316\u4fe1\u53f7",
    alternateNotReciprocal: "alternate \u9875\u9762\u6ca1\u6709\u56de\u6307",
    alternateCanonicalMismatch: "alternate \u76ee\u6807 canonical \u5230\u522b\u5904",
    invalidHreflangValues: "\u65e0\u6548\u7684 hreflang \u503c",
  },
  "zh-TW": {
    heading: "\u0047\u006f\u006f\u0067\u006c\u0065 \u6293\u53d6\u8a3a\u65b7",
    subheading: "\u6aa2\u67e5 sitemap\u3001robots.txt\u3001canonical \u548c hreflang",
    placeholder: "https://example.com\u3001/sitemap.xml \u6216 /robots.txt",
    audit: "\u958b\u59cb\u6aa2\u67e5",
    pageChecksTitle: "\u9801\u9762\u5167\u5bb9\u6aa2\u67e5",
    pageChecksHelp: "Title\u3001description\u3001H1\u3001lang\u3001viewport\u3001JSON-LD \u548c\u91cd\u8907\u4e2d\u7e7c\u8cc7\u6599",
    directoryRobotsTitle: "\u8b80\u53d6 sitemap \u540c\u76ee\u9304 robots.txt",
    directoryRobotsHelp: "\u7528\u65bc\u6e2c\u8a66\u7db2\u5740\uff1a\u8b80\u53d6 sitemap \u540c\u76ee\u9304\u7684 robots.txt\uff0c\u800c\u4e0d\u662f\u7db2\u57df\u6839\u76ee\u9304",
    healthScore: "\u5065\u5eb7\u5206",
    executiveSummary: "\u6458\u8981\u7d50\u8ad6",
    priorityActions: "\u512a\u5148\u52d5\u4f5c",
    statusFlags: "\u72c0\u614b\u6a19\u7c64",
    history: "\u6700\u8fd1\u6aa2\u67e5",
    clearHistory: "\u6e05\u7a7a\u6b77\u53f2",
    keepRecent: "\u4fdd\u7559\u6700\u8fd1",
    rerun: "\u91cd\u65b0\u6aa2\u67e5",
    compareToCurrent: "\u8207\u76ee\u524d\u6bd4\u8f03",
    deleteHistory: "\u522a\u9664",
    details: "\u8a73\u60c5",
    hideDetails: "\u6536\u8d77\u8a73\u60c5",
    noHistory: "\u9084\u6c92\u6709\u5132\u5b58\u7684\u6aa2\u67e5\u8a18\u9304\u3002",
    historyScore: "\u5206\u6578",
    historyUrls: "\u7db2\u5740\u6578",
    historyAffected: "\u53d7\u5f71\u97ff",
    trendUp: "\u8b8a\u597d",
    trendDown: "\u8b8a\u5dee",
    trendFlat: "\u7121\u8b8a\u5316",
    issueDelta: "\u554f\u984c\u8b8a\u5316",
    improvedIssues: "\u6539\u5584\u7684\u554f\u984c",
    worsenedIssues: "\u8b8a\u5dee\u7684\u554f\u984c",
    noDelta: "\u6c92\u6709\u767c\u73fe\u660e\u986f\u7684\u554f\u984c\u8b8a\u5316\u3002",
    categoryDelta: "\u5c08\u984c\u8b8a\u5316",
    cleanSignals: "\u6293\u53d6\u8a0a\u865f\u826f\u597d",
    needsCleanup: "\u9700\u8981\u91cd\u9ede\u6e05\u7406",
    likelyBlockers: "\u53ef\u80fd\u5b58\u5728\u6293\u53d6/\u7d22\u5f15\u963b\u585e",
    urls: "\u7db2\u5740\u6578",
    affected: "\u53d7\u5f71\u97ff",
    googleRisk: "Google \u98a8\u96aa",
    critical: "\u56b4\u91cd",
    warnings: "\u8b66\u544a",
    limitReachedTitle: "\u5df2\u9054\u5230\u4e92\u52d5\u5f0f\u6383\u63cf\u4e0a\u9650",
    limitReachedText: "\u672c\u5831\u544a\u6700\u591a\u6383\u63cf {urls} \u500b\u7db2\u5740\u548c {sitemaps} \u500b sitemap \u6a94\u6848\u3002\u5927\u578b\u7db2\u7ad9\u4e4b\u5f8c\u6703\u4ea4\u7d66\u80cc\u666f worker \u6a21\u5f0f\u3002",
    limitOk: "\u672c\u6b21\u6383\u63cf\u672a\u8d85\u904e\u76ee\u524d\u9650\u5236\uff1a{urls} \u500b\u7db2\u5740\u548c {sitemaps} \u500b sitemap \u6a94\u6848\u3002",
    fixFirst: "\u512a\u5148\u4fee\u5fa9",
    tasks: "\u9805\u4efb\u52d9",
    noPriority: "\u76ee\u524d\u6383\u63cf\u7bc4\u570d\u5167\u6c92\u6709\u767c\u73fe\u512a\u5148\u963b\u585e\u9805\u3002",
    robots: "Robots",
    found: "\u5df2\u627e\u5230",
    groups: "\u7d44\u898f\u5247",
    sitemaps: "Sitemaps",
    urlFindings: "\u7db2\u5740\u554f\u984c",
    noFilter: "\u6c92\u6709\u7db2\u5740\u7b26\u5408\u76ee\u524d\u7be9\u9078\u3002",
    searchUrls: "\u641c\u5c0b\u7db2\u5740\u6216\u554f\u984c",
    exportCsv: "\u532f\u51fa CSV",
    exportSummary: "\u532f\u51fa\u6458\u8981",
    showMatchingUrls: "\u67e5\u770b\u5c0d\u61c9\u7db2\u5740",
    final: "\u6700\u7d42\u5730\u5740",
    canonical: "Canonical",
    alternates: "Alternates",
    hreflangLinks: "\u500b hreflang \u9023\u7d50",
    likelyOutcome: "Google \u53ef\u80fd\u7d50\u679c",
    noBlockers: "\u672a\u767c\u73fe\u660e\u986f\u6293\u53d6\u963b\u585e\u3002",
    title: "Title",
    description: "Description",
    h1: "H1",
    lang: "Lang",
    viewport: "Viewport",
    jsonLd: "JSON-LD",
    missing: "\u7f3a\u5931",
    present: "\u5b58\u5728",
    unknown: "\u672a\u77e5",
    noneFound: "\u672a\u767c\u73fe",
    validInvalid: "{valid} \u6709\u6548 / {invalid} \u7121\u6548",
    detectedInputs: "\u81ea\u52d5\u8b58\u5225\u7d50\u679c",
    original: "\u539f\u59cb\u8f38\u5165",
    siteRoot: "\u7db2\u7ad9\u6839\u76ee\u9304",
    inputType: "\u8f38\u5165\u985e\u578b",
    progressPreparing: "\u6e96\u5099\u6383\u63cf",
    progressFetching: "\u8b80\u53d6 sitemap \u548c robots.txt",
    progressInspecting: "\u6aa2\u67e5\u7db2\u5740",
    progressFinalizing: "\u7522\u751f\u5831\u544a",
    progressPaused: "\u5df2\u66ab\u505c",
    progressStopped: "\u5df2\u505c\u6b62",
    pause: "\u66ab\u505c",
    resume: "\u7e7c\u7e8c",
    stop: "\u505c\u6b62",
    runtime: "\u57f7\u884c\u72c0\u614b",
    startedAt: "\u958b\u59cb\u6642\u9593",
    elapsed: "\u5df2\u57f7\u884c",
    currentStage: "\u76ee\u524d\u968e\u6bb5",
    pauseCount: "\u66ab\u505c\u6b21\u6578",
    stageElapsed: "\u968e\u6bb5\u8017\u6642",
    performance: "\u6548\u80fd",
    performanceChecksTitle: "\u6548\u80fd\u6aa2\u67e5",
    performanceChecksHelp: "TTFB\u3001HTML \u5927\u5c0f\u3001\u8173\u672c\u3001\u6a23\u5f0f\u3001\u5716\u7247\u548c\u8f15\u91cf CWV \u6e96\u5099\u5ea6\u8a0a\u865f",
    backgroundModeTitle: "\u80cc\u666f worker \u6a21\u5f0f",
    backgroundModeHelp: "\u5c07\u6383\u63cf\u4e0a\u9650\u63d0\u9ad8\u5230 2000 \u500b URL\uff0c\u4e26\u5ef6\u9577 job \u4fdd\u7559\u6642\u9593",
    status: "\u72c0\u614b",
    robotsAnalysis: "Robots \u5206\u6790",
    robotsContent: "robots.txt \u5167\u5bb9",
    sitemapDirectives: "Sitemap \u6307\u4ee4",
    rules: "\u689d\u898f\u5247",
    googleGroups: "Google \u898f\u5247\u7d44",
    robotsImpact: "Robots \u5f71\u97ff",
    blockedSubmittedUrls: "\u88ab\u6514\u622a\u7684\u63d0\u4ea4\u7db2\u5740",
    blockedCanonicalTargets: "\u88ab\u6514\u622a\u7684 canonical \u76ee\u6a19",
    blockedAlternateTargets: "\u88ab\u6514\u622a\u7684 alternate \u76ee\u6a19",
    sampleUrls: "\u793a\u4f8b\u7db2\u5740",
    sitemapSignals: "Sitemap \u8a0a\u865f",
    redirectUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728\u8df3\u8f49\u7db2\u5740",
    noindexUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728 noindex \u7db2\u5740",
    canonicalizedElsewhere: "\u63d0\u4ea4\u7db2\u5740 canonical \u5230\u5225\u8655",
    canonicalMissingFromSitemap: "canonical \u76ee\u6a19\u672a\u5305\u542b\u5728 sitemap \u4e2d",
    brokenUrlsInSitemap: "sitemap \u4e2d\u4ecd\u5b58\u5728\u932f\u8aa4\u7db2\u5740",
    relatedTargets: "\u76f8\u95dc\u76ee\u6a19",
    internationalSignals: "\u570b\u969b\u5316\u8a0a\u865f",
    alternateNotReciprocal: "alternate \u9801\u9762\u6c92\u6709\u56de\u6307",
    alternateCanonicalMismatch: "alternate \u76ee\u6a19 canonical \u5230\u5225\u8655",
    invalidHreflangValues: "\u7121\u6548\u7684 hreflang \u503c",
  },
};

function formatText(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function detectLanguage() {
  const lang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  if (lang.includes("tw") || lang.includes("hk") || lang.includes("hant")) return "zh-TW";
  if (lang.startsWith("zh")) return "zh-CN";
  return "en";
}

function Badge({ severity, children }) {
  const Icon = severityIcons[severity] || CheckCircle2;
  return (
    <span className={`badge badge-${severity || "ok"}`}>
      <Icon size={14} />
      {children}
    </span>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ progress }) {
  if (!progress) return null;
  return (
    <section className="progress-panel">
      <div className="progress-top">
        <strong>{progress.label}</strong>
        <span>{progress.value}%</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress.value}%` }} />
      </div>
      {progress.meta ? <p className="progress-meta">{progress.meta}</p> : null}
    </section>
  );
}

function ProgressControls({ loading, jobStatus, onPause, onResume, onStop, t }) {
  if (!loading) return null;
  return (
    <div className="progress-controls">
      {jobStatus === "paused" ? (
        <button className="export-button" type="button" onClick={onResume}>
          {t.resume}
        </button>
      ) : (
        <button className="export-button" type="button" onClick={onPause}>
          {t.pause}
        </button>
      )}
      <button className="export-button" type="button" onClick={onStop}>
        {t.stop}
      </button>
    </div>
  );
}

function RuntimePanel({ loading, jobStatus, progress, runtimeMeta, t }) {
  if (!loading && !runtimeMeta.startedAt) return null;
  const startedText = runtimeMeta.startedAt ? new Date(runtimeMeta.startedAt).toLocaleTimeString() : "-";
  const totalSeconds = Math.max(0, Math.floor((runtimeMeta.elapsedMs || 0) / 1000));
  const elapsedText = totalSeconds >= 60 ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s` : `${totalSeconds}s`;
  const stageSeconds = Math.max(0, Math.floor((runtimeMeta.stageElapsedMs || 0) / 1000));
  const stageElapsedText = stageSeconds >= 60 ? `${Math.floor(stageSeconds / 60)}m ${stageSeconds % 60}s` : `${stageSeconds}s`;
  return (
    <section className="panel runtime-panel">
      <div className="panel-head">
        <h2>{t.runtime}</h2>
      </div>
      <div className="runtime-grid">
        <div className="runtime-item">
          <strong>{t.status}</strong>
          <span>{jobStatus || "idle"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.currentStage}</strong>
          <span>{progress?.label || "-"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.startedAt}</strong>
          <span>{startedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.elapsed}</strong>
          <span>{elapsedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.stageElapsed || "Stage elapsed"}</strong>
          <span>{stageElapsedText}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.pauseCount}</strong>
          <span>{runtimeMeta.pauseCount || 0}</span>
        </div>
      </div>
    </section>
  );
}
function ScoreCard({ score, t }) {
  const tone = score >= 85 ? "good" : score >= 65 ? "warn" : "bad";
  return (
    <section className={`score score-${tone}`}>
      <div>
        <span>{t.healthScore}</span>
        <strong>{score}</strong>
      </div>
      <p>{score >= 85 ? t.cleanSignals : score >= 65 ? t.needsCleanup : t.likelyBlockers}</p>
    </section>
  );
}

function ExecutiveSummary({ summary, t }) {
  if (!summary?.headline) return null;
  return (
    <section className="panel executive-summary">
      <div className="panel-head">
        <h2>{t.executiveSummary}</h2>
      </div>
      <div className="executive-body">
        <p>{summary.headline}</p>
        {summary.topActions?.length ? (
          <div className="executive-actions">
            <strong>{t.priorityActions}</strong>
            {summary.topActions.map((action) => (
              <small key={action}>{action}</small>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusFlags({ flags, t }) {
  if (!flags?.length) return null;
  return (
    <section className="panel status-flags">
      <div className="panel-head">
        <h2>{t.statusFlags}</h2>
      </div>
      <div className="status-flag-list">
        {flags.map((flag) => (
          <Badge key={flag.key} severity={flag.severity}>
            {flag.label}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ t }) {
  return (
    <section className="empty">
      <FileSearch size={42} />
      <p>{t.placeholder}</p>
    </section>
  );
}

function PerformanceSignals({ page, t }) {
  if (!page.performance) return null;
  const perf = page.performance;
  const kb = Math.round((perf.htmlBytes || 0) / 1024);
  return (
    <div className="signals performance-signals">
      <div><strong>{t.performance || "Performance"}</strong><span>{perf.ttfbMs ? `${perf.ttfbMs}ms TTFB` : "TTFB unknown"}</span></div>
      <div><strong>HTML</strong><span>{kb}KB</span></div>
      <div><strong>Resources</strong><span>{perf.scriptCount || 0} JS / {perf.stylesheetCount || 0} CSS / {perf.imageCount || 0} IMG</span></div>
    </div>
  );
}
function PageRow({ page, t }) {
  const [open, setOpen] = useState(false);
  const firstIssue = page.issues[0];
  const hasSignals =
    page.title != null ||
    page.description != null ||
    page.h1Count != null ||
    page.lang != null ||
    page.viewport != null ||
    page.structuredData != null;
  return (
    <article className="row">
      <button className="row-main" type="button" onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={open ? "rotated" : ""} size={18} />
        <div className="url-cell">
          <span>{page.url}</span>
          {page.finalUrl && page.finalUrl !== page.url ? <small>{t.final}: {page.finalUrl}</small> : null}
        </div>
        <div className="row-status">
          <span className="http">{page.status || "ERR"}</span>
          {firstIssue ? <Badge severity={firstIssue.severity}>{severityLabels[firstIssue.severity]}</Badge> : <Badge>OK</Badge>}
        </div>
      </button>
      {open ? (
        <div className="row-detail">
          {hasSignals ? (
            <div className="signals">
              <div>
                <strong>{t.title}</strong>
                <span>{page.title || t.missing}</span>
              </div>
              <div>
                <strong>{t.description}</strong>
                <span>{page.description || t.missing}</span>
              </div>
              <div>
                <strong>{t.h1}</strong>
                <span>{page.h1Count ?? t.unknown}</span>
              </div>
              <div>
                <strong>{t.lang}</strong>
                <span>{page.lang || t.missing}</span>
              </div>
              <div>
                <strong>{t.viewport}</strong>
                <span>{page.viewport ? t.present : t.missing}</span>
              </div>
              <div>
                <strong>{t.jsonLd}</strong>
                <span>
                  {page.structuredData?.count
                    ? formatText(t.validInvalid, { valid: page.structuredData.validCount, invalid: page.structuredData.invalidCount })
                    : t.noneFound}
                </span>
              </div>
            </div>
          ) : null}
          {page.canonical ? (
            <p>
              <strong>{t.canonical}</strong>
              <a href={page.canonical} target="_blank" rel="noreferrer">
                {page.canonical}
                <ExternalLink size={14} />
              </a>
            </p>
          ) : null}
          {page.alternates?.length ? (
            <p>
              <strong>{t.alternates}</strong>
              <span>{page.alternates.length} {t.hreflangLinks}</span>
            </p>
          ) : null}
          <div className="issues">
            {page.googleReasons?.length ? (
              <div className="reason-box">
                <strong>{t.likelyOutcome}</strong>
                {page.googleReasons.map((reason) => (
                  <div className="reason" key={reason.code}>
                    <Badge severity={reason.severity}>{reason.label}</Badge>
                    <span>{reason.detail}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {page.issues.length ? (
              page.issues.map((issue, index) => (
                <div className={`issue issue-${issue.severity}`} key={`${issue.type}-${index}`}>
                  <Badge severity={issue.severity}>{issue.type}</Badge>
                  <span>{issue.message}</span>
                  {issue.detail ? <small>{issue.detail}</small> : null}
                </div>
              ))
            ) : (
              <div className="issue issue-ok">
                <Badge>OK</Badge>
                <span>{t.noBlockers}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Backlog({ backlog, t }) {
  if (!backlog?.length) {
    return (
      <section className="panel backlog">
        <div className="panel-head">
          <h2>{t.fixFirst}</h2>
        </div>
        <div className="clean">
          <CheckCircle2 size={20} />
          <span>{t.noPriority}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel backlog">
      <div className="panel-head">
        <h2>{t.fixFirst}</h2>
        <span>{backlog.length} {t.tasks}</span>
      </div>
      <div className="tasks">
        {backlog.map((task) => (
          <article className={`task task-${task.severity}`} key={task.key}>
            <div className="task-top">
              <Badge severity={task.severity}>{task.count} affected</Badge>
              <h3>{task.title}</h3>
            </div>
            <p>{task.action}</p>
            {task.sampleUrls?.length ? (
              <div className="samples">
                {task.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Sitemaps({ sitemaps, t }) {
  if (!sitemaps?.length) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.sitemaps}</h2>
        <span>{sitemaps.length}</span>
      </div>
      <div className="sitemap-list">
        {sitemaps.map((sitemap) => (
          <div className="sitemap" key={sitemap.url}>
            <Globe2 size={16} />
            <span>{sitemap.url}</span>
            <em>{sitemap.kind}</em>
            <strong>{sitemap.locCount}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function RobotsDetails({ robots, t, onSelectIssue }) {
  if (!robots?.found) return null;
  const analysis = robots.analysis;
  const impactLabels = {
    submitted_url: t.blockedSubmittedUrls,
    canonical_target: t.blockedCanonicalTargets,
    alternate_target: t.blockedAlternateTargets,
  };
  return (
    <section className="panel robots-detail">
      <div className="panel-head">
        <h2>{t.robotsAnalysis}</h2>
        <span>{analysis?.ruleCount || 0} {t.rules}</span>
      </div>
      <div className="robots-metrics">
        <Stat label={t.googleGroups} value={analysis?.googleGroupCount || 0} />
        <Stat label={t.sitemapDirectives} value={robots.sitemapDirectives?.length || 0} />
        <Stat label={t.critical} value={analysis?.issues?.filter((issue) => issue.severity === "critical").length || 0} tone="bad" />
      </div>
      {analysis?.issues?.length ? (
        <div className="issues robots-issues">
          {analysis.issues.map((issue) => (
            <div className={`issue issue-${issue.severity}`} key={issue.type}>
              <Badge severity={issue.severity}>{issue.type}</Badge>
              <span>{issue.message}</span>
              {issue.detail ? <small>{issue.detail}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {robots.sitemapDirectives?.length ? (
        <div className="robot-sitemaps">
          {robots.sitemapDirectives.map((url) => (
            <small key={url}>{url}</small>
          ))}
        </div>
      ) : null}
      {analysis?.blockedSummaries?.length ? (
        <div className="robots-impact">
          <div className="panel-head">
            <h2>{t.robotsImpact}</h2>
            <span>{analysis.blockedSummaries.length}</span>
          </div>
          <div className="impact-list">
            {analysis.blockedSummaries.map((item) => (
              <article className="impact-card" key={`${item.scope}-${item.rule}`}>
                <div className="impact-top">
                  <Badge severity="warning">{impactLabels[item.scope] || item.scope}</Badge>
                  <strong>{item.rule}</strong>
                  <span>{item.count}</span>
                </div>
                {item.details?.length ? (
                  <div className="impact-details">
                    {item.details.map((detail) => (
                      <small key={detail}>{detail}</small>
                    ))}
                  </div>
                ) : null}
                {item.sampleUrls?.length ? (
                  <div className="impact-samples">
                    <strong>{t.sampleUrls}</strong>
                    {item.sampleUrls.map((url) => (
                      <small key={url}>{url}</small>
                    ))}
                  </div>
                ) : null}
                <button
                  className="impact-filter"
                  type="button"
                  onClick={() =>
                    onSelectIssue?.({
                      type:
                        item.scope === "submitted_url"
                          ? "robots_disallow"
                          : item.scope === "canonical_target"
                            ? "canonical_blocked"
                            : "alternate_blocked",
                    })
                  }
                >
                  {t.showMatchingUrls}
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {robots.contentPreview ? (
        <details className="robots-content">
          <summary>{t.robotsContent}</summary>
          <pre>{robots.contentPreview}</pre>
        </details>
      ) : null}
    </section>
  );
}

function SitemapSignals({ signals, t, onSelectIssue }) {
  if (!signals?.length) return null;

  const signalLabels = {
    redirect: t.redirectUrlsInSitemap,
    noindex: t.noindexUrlsInSitemap,
    canonical_mismatch: t.canonicalizedElsewhere,
    canonical_not_in_sitemap: t.canonicalMissingFromSitemap,
    http_error: t.brokenUrlsInSitemap,
  };

  return (
    <section className="panel sitemap-signals">
      <div className="panel-head">
        <h2>{t.sitemapSignals}</h2>
        <span>{signals.length}</span>
      </div>
      <div className="impact-list">
        {signals.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={item.key === "http_error" || item.key === "noindex" ? "critical" : "warning"}>
                {item.scope === "canonical_target" ? t.blockedCanonicalTargets : t.blockedSubmittedUrls}
              </Badge>
              <strong>{signalLabels[item.key] || item.title}</strong>
              <span>{item.count}</span>
            </div>
            {item.details?.length ? (
              <div className="impact-samples">
                <strong>{t.relatedTargets}</strong>
                {item.details.map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
            ) : null}
            {item.sampleUrls?.length ? (
              <div className="impact-samples">
                <strong>{t.sampleUrls}</strong>
                {item.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
            <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: item.key })}>
              {t.showMatchingUrls}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function InternationalSignals({ signals, t, onSelectIssue }) {
  if (!signals?.length) return null;

  const signalLabels = {
    alternate_not_reciprocal: t.alternateNotReciprocal,
    alternate_target_canonical_mismatch: t.alternateCanonicalMismatch,
    alternate_hreflang_invalid: t.invalidHreflangValues,
  };

  return (
    <section className="panel sitemap-signals">
      <div className="panel-head">
        <h2>{t.internationalSignals}</h2>
        <span>{signals.length}</span>
      </div>
      <div className="impact-list">
        {signals.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity="warning">{t.blockedAlternateTargets}</Badge>
              <strong>{signalLabels[item.key] || item.title}</strong>
              <span>{item.count}</span>
            </div>
            {item.details?.length ? (
              <div className="impact-samples">
                <strong>{t.relatedTargets}</strong>
                {item.details.map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
            ) : null}
            {item.sampleUrls?.length ? (
              <div className="impact-samples">
                <strong>{t.sampleUrls}</strong>
                {item.sampleUrls.map((url) => (
                  <small key={url}>{url}</small>
                ))}
              </div>
            ) : null}
            <button className="impact-filter" type="button" onClick={() => onSelectIssue?.({ type: item.key })}>
              {t.showMatchingUrls}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function issueCategories(page) {
  const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
  const categories = [];

  if ([...issueTypes].some((type) => type.startsWith("robots_") || type === "canonical_blocked" || type === "alternate_blocked")) {
    categories.push("robots");
  }
  if (
    ["redirect", "noindex", "http_error", "canonical_mismatch", "canonical_not_in_sitemap"].some((type) => issueTypes.has(type))
  ) {
    categories.push("sitemap");
  }
  if (
    ["alternate_not_reciprocal", "alternate_target_canonical_mismatch", "alternate_hreflang_invalid"].some((type) =>
      issueTypes.has(type),
    )
  ) {
    categories.push("international");
  }
  if (
    [
      "title_missing",
      "description_missing",
      "h1_missing",
      "viewport_missing",
      "structured_data_invalid",
      "title_duplicate",
      "description_duplicate",
    ].some((type) => issueTypes.has(type))
  ) {
    categories.push("content");
  }
  if (["canonical_missing", "canonical_cross_host"].some((type) => issueTypes.has(type))) {
    categories.push("canonical");
  }
  if (["fetch_failed", "not_html"].some((type) => issueTypes.has(type))) {
    categories.push("fetch");
  }

  return categories.join(" | ");
}

function classifyGscForPage(page, gsc) {
  if (!gsc) return "no_gsc_row";
  if ((gsc.impressions || 0) === 0) return "no_impressions";
  if (!isTechnicallyIndexablePage(page)) return "technical_blocker_with_visibility";
  if (typeof gsc.position === "number" && gsc.position > 20) return "low_ranking";
  if ((gsc.impressions || 0) >= 100 && gsc.clicks != null && gsc.clicks / gsc.impressions < 0.01) return "low_ctr";
  return "has_visibility";
}

function downloadCsvFile(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

function downloadCsv(report, gscRows = []) {
  const gscByUrl = buildGscRowMap(gscRows);
  const rows = [
    [
      "url",
      "final_url",
      "status",
      "categories",
      "severity",
      "issue_type",
      "issue_message",
      "issue_detail",
      "google_outcomes",
      "google_outcome_details",
      "canonical",
      "gsc_clicks",
      "gsc_impressions",
      "gsc_position",
      "gsc_classification",
    ],
  ];

  for (const page of report.pages || []) {
    const gsc = gscByUrl.get(normalizeReportUrl(page.url));
    const gscClassification = classifyGscForPage(page, gsc);
    const baseRow = [
      page.url,
      page.finalUrl || "",
      page.status || "",
      issueCategories(page),
    ];
    const tailRow = [
      (page.googleReasons || []).map((reason) => reason.label).join(" | "),
      (page.googleReasons || []).map((reason) => reason.detail).join(" | "),
      page.canonical || "",
      gsc?.clicks ?? "",
      gsc?.impressions ?? "",
      gsc?.position ?? "",
      gscClassification,
    ];

    if (!page.issues.length && !page.googleReasons?.length) {
      rows.push([...baseRow, "ok", "", "", "", ...tailRow]);
      continue;
    }

    const issues = page.issues.length ? page.issues : [{ severity: "ok", type: "", message: "", detail: "" }];
    for (const issue of issues) {
      rows.push([
        ...baseRow,
        issue.severity || "",
        issue.type || "",
        issue.message || "",
        issue.detail || "",
        ...tailRow,
      ]);
    }
  }

  const sitemapKeys = new Set((report.pages || []).map((page) => normalizeReportUrl(page.url)));
  for (const row of (gscRows || []).filter((item) => !sitemapKeys.has(item.key))) {
    rows.push([
      row.page,
      "",
      "",
      "gsc",
      "notice",
      "gsc_not_in_sitemap",
      "GSC page missing from sitemap",
      "",
      "",
      "",
      "",
      row.clicks ?? "",
      row.impressions ?? "",
      row.position ?? "",
      "gsc_not_in_sitemap",
    ]);
  }

  downloadCsvFile(`soos-audit-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, rows);
}
function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

function buildSummaryReport(report) {
  const lines = [];
  const topBacklog = (report.backlog || []).slice(0, 5);
  const topRobots = (report.robots?.analysis?.blockedSummaries || []).slice(0, 5);
  const topSitemapSignals = (report.sitemapSignals || []).slice(0, 5);
  const topInternationalSignals = (report.internationalSignals || []).slice(0, 5);

  lines.push("soos Audit Summary");
  lines.push(`Scanned at: ${report.scannedAt}`);
  lines.push(`Input: ${report.input?.originalUrl || ""}`);
  lines.push(`Detected sitemap: ${report.input?.sitemapUrl || ""}`);
  lines.push(`Detected robots: ${report.input?.robotsUrl || ""}`);
  lines.push("");
  lines.push("Overview");
  lines.push(`- Health score: ${report.summary?.healthScore ?? ""}`);
  lines.push(`- URLs scanned: ${report.summary?.urlCount ?? 0}`);
  lines.push(`- Sitemaps scanned: ${report.summary?.sitemapCount ?? 0}`);
  lines.push(`- Affected URLs: ${report.summary?.affectedUrlCount ?? 0}`);
  lines.push(`- High-risk Google blockers: ${report.summary?.googleBlockedCount ?? 0}`);
  lines.push(
    `- Issues: critical ${report.summary?.issueCounts?.critical ?? 0}, warning ${report.summary?.issueCounts?.warning ?? 0}, notice ${report.summary?.issueCounts?.notice ?? 0}`,
  );
  lines.push("");

  if (topBacklog.length) {
    lines.push("Fix First");
    topBacklog.forEach((task, index) => {
      lines.push(`${index + 1}. ${task.title} (${task.count})`);
      lines.push(`   Action: ${task.action}`);
      if (task.sampleUrls?.length) lines.push(`   Sample URLs: ${task.sampleUrls.join(" | ")}`);
    });
    lines.push("");
  }

  if (topRobots.length) {
    lines.push("Robots Impact");
    topRobots.forEach((item) => {
      lines.push(`- ${item.scope}: ${item.rule} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
    });
    lines.push("");
  }

  if (topSitemapSignals.length) {
    lines.push("Sitemap Signals");
    topSitemapSignals.forEach((item) => {
      lines.push(`- ${item.title} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
      if (item.details?.length) lines.push(`  Related targets: ${item.details.join(" | ")}`);
    });
    lines.push("");
  }

  if (topInternationalSignals.length) {
    lines.push("International Signals");
    topInternationalSignals.forEach((item) => {
      lines.push(`- ${item.title} (${item.count})`);
      if (item.sampleUrls?.length) lines.push(`  Sample URLs: ${item.sampleUrls.join(" | ")}`);
      if (item.details?.length) lines.push(`  Related targets: ${item.details.join(" | ")}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

function downloadSummary(report) {
  const filename = `soos-summary-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.txt`;
  downloadTextFile(filename, buildSummaryReport(report));
}

const HISTORY_KEY = "soos.auditHistory.v1";
const HISTORY_LIMIT_KEY = "soos.auditHistory.limit.v1";
const HISTORY_LIMIT_OPTIONS = [5, 10, 12, 20, 30];

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage failures
  }
}

function loadHistoryLimit() {
  try {
    const raw = Number(window.localStorage.getItem(HISTORY_LIMIT_KEY) || 12);
    return HISTORY_LIMIT_OPTIONS.includes(raw) ? raw : 12;
  } catch {
    return 12;
  }
}

function saveHistoryLimit(limit) {
  try {
    window.localStorage.setItem(HISTORY_LIMIT_KEY, String(limit));
  } catch {
    // ignore storage failures
  }
}

function toHistoryEntry(report) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    scannedAt: report.scannedAt,
    input: report.input,
    summary: report.summary,
    executiveSummary: report.executiveSummary,
    statusFlags: report.statusFlags,
  };
}

function trendLabel(current, previous, t) {
  if (previous == null || current == null) return null;
  if (current > previous) return t.trendUp;
  if (current < previous) return t.trendDown;
  return t.trendFlat;
}

function buildIssueDelta(previousEntry, currentReport) {
  if (!previousEntry || !currentReport) {
    return { improved: [], worsened: [] };
  }

  const previousCounts = previousEntry.summary?.issueCounts || {};
  const currentCounts = currentReport.summary?.issueCounts || {};
  const severities = ["critical", "warning", "notice"];

  const improved = [];
  const worsened = [];

  for (const severity of severities) {
    const before = previousCounts[severity] || 0;
    const after = currentCounts[severity] || 0;
    if (after < before) {
      improved.push({ severity, delta: before - after });
    } else if (after > before) {
      worsened.push({ severity, delta: after - before });
    }
  }

  return { improved, worsened };
}

function summarizeCategoryCountsFromReportLike(reportLike) {
  const flags = reportLike?.statusFlags || [];
  const counts = {
    robots: 0,
    sitemap: 0,
    canonical: 0,
    international: 0,
    content: 0,
    fetch: 0,
  };

  for (const flag of flags) {
    if (flag.key === "robots_blocked") counts.robots += 1;
    if (flag.key === "sitemap_misaligned") counts.sitemap += 1;
    if (flag.key === "canonical_conflict") counts.canonical += 1;
    if (flag.key === "international_mismatch") counts.international += 1;
  }

  return counts;
}

function buildCategoryDelta(previousEntry, currentReport) {
  const previous = summarizeCategoryCountsFromReportLike(previousEntry);
  const current = summarizeCategoryCountsFromReportLike(currentReport);
  const keys = ["robots", "sitemap", "canonical", "international", "content", "fetch"];

  return keys
    .map((key) => ({
      key,
      before: previous[key] || 0,
      after: current[key] || 0,
      delta: (current[key] || 0) - (previous[key] || 0),
    }))
    .filter((item) => item.before !== item.after);
}

function HistoryPanel({ history, currentReport, historyLimit, t, onRerun, onCompare, onDelete, onClear, onLimitChange }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{t.history}</h2>
        <div className="history-head-actions">
          <label className="history-limit">
            <span>{t.keepRecent}</span>
            <select value={historyLimit} onChange={(event) => onLimitChange(Number(event.target.value))}>
              {HISTORY_LIMIT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button className="export-button" type="button" onClick={onClear} disabled={!history.length}>
            {t.clearHistory}
          </button>
          <span>{history.length}</span>
        </div>
      </div>
      {!history.length ? (
        <p className="none">{t.noHistory}</p>
      ) : (
        <div className="history-list">
          {history.map((entry) => (
            <article className="history-card" key={entry.id}>
              <div className="history-top">
                <strong>{entry.input?.originalUrl || entry.input?.sitemapUrl}</strong>
                <small>{new Date(entry.scannedAt).toLocaleString()}</small>
              </div>
              <div className="history-stats">
                <span>{t.historyScore}: {entry.summary?.healthScore ?? "-"}</span>
                <span>{t.historyUrls}: {entry.summary?.urlCount ?? 0}</span>
                <span>{t.historyAffected}: {entry.summary?.affectedUrlCount ?? 0}</span>
              </div>
              {currentReport && currentReport.scannedAt !== entry.scannedAt ? (
                <div className="history-compare">
                  <small>{t.historyScore}: {trendLabel(currentReport.summary?.healthScore, entry.summary?.healthScore, t) || "-"}</small>
                  <small>
                    {t.historyAffected}: {trendLabel(entry.summary?.affectedUrlCount, currentReport.summary?.affectedUrlCount, {
                      ...t,
                      trendUp: t.trendDown,
                      trendDown: t.trendUp,
                      trendFlat: t.trendFlat,
                    }) || "-"}
                  </small>
                </div>
              ) : null}
              {expandedId === entry.id ? (
                <div className="history-detail">
                  {entry.statusFlags?.length ? (
                    <div className="status-flag-list history-flags">
                      {entry.statusFlags.map((flag) => (
                        <Badge key={`${entry.id}-${flag.key}`} severity={flag.severity}>
                          {flag.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {entry.executiveSummary?.headline ? (
                    <div className="executive-actions">
                      <small>{entry.executiveSummary.headline}</small>
                      {(entry.executiveSummary.topActions || []).map((action) => (
                        <small key={`${entry.id}-${action}`}>{action}</small>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="history-actions">
                <button
                  className="export-button"
                  type="button"
                  onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                >
                  {expandedId === entry.id ? t.hideDetails : t.details}
                </button>
                <button className="export-button" type="button" onClick={() => onRerun(entry)}>
                  {t.rerun}
                </button>
                <button className="export-button" type="button" onClick={() => onCompare(entry)}>
                  {t.compareToCurrent}
                </button>
                <button className="export-button" type="button" onClick={() => onDelete(entry.id)}>
                  {t.deleteHistory}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ComparisonPanel({ comparisonEntry, report, t }) {
  if (!comparisonEntry || !report) return null;
  const delta = buildIssueDelta(comparisonEntry, report);
  const categoryDelta = buildCategoryDelta(comparisonEntry, report);

  return (
    <section className="panel executive-summary">
      <div className="panel-head">
        <h2>{t.compareToCurrent}</h2>
      </div>
      <div className="executive-body">
        <p>
          {t.historyScore}: {comparisonEntry.summary?.healthScore ?? "-"} {"->"} {report.summary?.healthScore ?? "-"};{" "}
          {t.historyAffected}: {comparisonEntry.summary?.affectedUrlCount ?? 0} {"->"} {report.summary?.affectedUrlCount ?? 0}
        </p>
        {delta.improved.length || delta.worsened.length ? (
          <div className="delta-grid">
            {delta.improved.length ? (
              <div className="delta-card delta-good">
                <strong>{t.improvedIssues}</strong>
                {delta.improved.map((item) => (
                  <small key={`improved-${item.severity}`}>{item.severity}: -{item.delta}</small>
                ))}
              </div>
            ) : null}
            {delta.worsened.length ? (
              <div className="delta-card delta-bad">
                <strong>{t.worsenedIssues}</strong>
                {delta.worsened.map((item) => (
                  <small key={`worsened-${item.severity}`}>{item.severity}: +{item.delta}</small>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="executive-actions">
            <small>{t.noDelta}</small>
          </div>
        )}
        {categoryDelta.length ? (
          <div className="delta-grid">
            <div className="delta-card">
              <strong>{t.categoryDelta}</strong>
              {categoryDelta.map((item) => (
                <small key={item.key}>
                  {item.key}: {item.before} {"->"} {item.after}
                </small>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function normalizeReportUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").trim().replace(/\/$/, "");
  }
}

function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseCsvRows(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (delimiter !== "whitespace" && char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
function parseSearchConsoleCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const normalizeHeader = (header) => header.trim().toLowerCase().replace(/^\ufeff/, "");
  const pageHeaders = [
    "page",
    "pages",
    "url",
    "landing page",
    "\u9875\u9762",
    "\u7f51\u9875",
    "\u7db2\u5740",
    "\u7db2\u9801",
    "\u6392\u540d\u9760\u524d\u7684\u7f51\u9875",
    "\u6392\u540d\u9760\u524d\u7684\u7db2\u9801",
  ];
  const clickHeaders = ["clicks", "\u70b9\u51fb\u6b21\u6570", "\u9ede\u64ca\u6b21\u6578"];
  const impressionHeaders = ["impressions", "\u5c55\u793a\u6b21\u6570", "\u5c55\u793a", "\u66dd\u5149\u6b21\u6578", "\u66dd\u5149"];
  const ctrHeaders = ["ctr", "\u70b9\u51fb\u7387", "\u9ede\u95b1\u7387"];
  const positionHeaders = ["position", "average position", "avg position", "\u6392\u540d", "\u5e73\u5747\u6392\u540d", "\u5e73\u5747\u6392\u540d\u4f4d\u7f6e"];

  const headerCandidates = rows.slice(0, 10).map((row, index) => ({
    index,
    headers: row.map(normalizeHeader),
  }));
  const findHeaderIn = (headers, candidates) => candidates.map((candidate) => headers.indexOf(candidate)).find((index) => index >= 0);
  const headerMatch = headerCandidates.find(({ headers }) => {
    const pageIndex = findHeaderIn(headers, pageHeaders);
    const clicksIndex = findHeaderIn(headers, clickHeaders);
    return pageIndex !== undefined && clicksIndex !== undefined;
  });
  if (!headerMatch) return [];

  const headers = headerMatch.headers;
  const findHeader = (candidates) => findHeaderIn(headers, candidates);
  const pageIndex = findHeader(pageHeaders);
  const clicksIndex = findHeader(clickHeaders);
  const impressionsIndex = findHeader(impressionHeaders);
  const ctrIndex = findHeader(ctrHeaders);
  const positionIndex = findHeader(positionHeaders);
  if (pageIndex === undefined) return [];
  return rows.slice(headerMatch.index + 1).map((row) => {
    const page = row[pageIndex]?.trim();
    if (!page || !/^https?:\/\//i.test(page)) return null;
    const numberValue = (index) => {
      if (index === undefined) return null;
      const raw = String(row[index] || "").replace(/[% ,]/g, "");
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    return {
      page,
      key: normalizeReportUrl(page),
      clicks: numberValue(clicksIndex),
      impressions: numberValue(impressionsIndex),
      ctr: numberValue(ctrIndex),
      position: numberValue(positionIndex),
    };
  }).filter(Boolean);
}
function summarizeGscRows(report, rows) {
  const pageKeys = new Set((report?.pages || []).map((page) => normalizeReportUrl(page.url)));
  const matched = rows.filter((row) => pageKeys.has(row.key));
  const clicks = matched.reduce((sum, row) => sum + (row.clicks || 0), 0);
  const impressions = matched.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const positionRows = matched.filter((row) => typeof row.position === "number");
  const weightedPosition =
    positionRows.length && impressions
      ? positionRows.reduce((sum, row) => sum + row.position * (row.impressions || 1), 0) /
        positionRows.reduce((sum, row) => sum + (row.impressions || 1), 0)
      : null;
  return {
    loaded: rows.length,
    matched: matched.length,
    clicks,
    impressions,
    averagePosition: weightedPosition,
  };
}

const gscUiText = {
  en: {
    propertyUrl: "Property URL",
    propertyHelp: "URL-prefix: use the exact Search Console property. Domain property: use sc-domain:example.com.",
    oauthHelpTitle: "How Search Console connection works",
    oauthHelpSteps: [
      "Enter the exact Search Console property URL.",
      "Click Connect Google Search Console.",
      "Sign in with the Google account that has access to that Search Console property.",
      "After authorization, return to soos and test the connection.",
    ],
    docsLabel: "Search Console users and permissions",
    connect: "Connect Google Search Console",
    connectedAs: "Connected as",
    connectedAccountFallback: "Google account connected",
    reconnect: "Reconnect",
    opening: "Opening...",
    refresh: "Refresh status",
    test: "Test API connection",
    testing: "Testing...",
    clear: "Disconnect",
    serverlessHelp: "Vercel mode: set DATABASE_URL so each visitor can save their own Search Console connection.",
    startServerlessError: "Set DATABASE_URL before starting OAuth on Vercel.",
    missingOAuthError: "The server OAuth app is not configured yet.",
    missingApiError: "Connect Google Search Console before testing the API connection.",
    missingPropertyError: "Enter the Search Console Property URL before testing the API connection.",
    openingMessage: "Opening Google OAuth.",
    disconnectedMessage: "Search Console connection removed for this browser.",
    revokeNotConfirmed: "Google token revoke was not confirmed.",
    reconnectHint: "Reconnect once if the account email is not shown.",
  },
  "zh-CN": {
    propertyUrl: "Property URL",
    propertyHelp: "URL-prefix 属性必须和 Search Console 完全一致；Domain 属性使用 sc-domain:example.com。",
    oauthHelpTitle: "Search Console 连接方式",
    oauthHelpSteps: [
      "输入和 Search Console 完全一致的 Property URL。",
      "点击 Connect Google Search Console。",
      "使用拥有该 Search Console property 权限的 Google 账号登录。",
      "授权完成后回到 soos，点击测试 API 连接。",
    ],
    docsLabel: "Search Console 用户和权限说明",
    connect: "连接 Google Search Console",
    connectedAs: "已连接账号",
    connectedAccountFallback: "Google 账号已连接",
    reconnect: "重新连接",
    opening: "打开中...",
    refresh: "刷新状态",
    test: "测试 API 连接",
    testing: "测试中...",
    clear: "断开连接",
    serverlessHelp: "Vercel 模式：设置 DATABASE_URL 后，每个访客都可以保存自己的 Search Console 连接。",
    startServerlessError: "请先在 Vercel 设置 DATABASE_URL，再开始 OAuth。",
    missingOAuthError: "服务端 OAuth App 尚未配置。",
    missingApiError: "请先连接 Google Search Console，再测试 API 连接。",
    missingPropertyError: "测试 API 连接前，请先输入 Search Console Property URL。",
    openingMessage: "正在打开 Google OAuth。",
    disconnectedMessage: "已清除此浏览器的 Search Console 连接。",
    revokeNotConfirmed: "Google token 撤销未确认。",
    reconnectHint: "如果未显示账号邮箱，请重新连接一次。",
  },
  "zh-TW": {
    propertyUrl: "Property URL",
    propertyHelp: "URL-prefix 資源必須和 Search Console 完全一致；Domain 資源使用 sc-domain:example.com。",
    oauthHelpTitle: "Search Console 連線方式",
    oauthHelpSteps: [
      "輸入和 Search Console 完全一致的 Property URL。",
      "點擊 Connect Google Search Console。",
      "使用擁有該 Search Console property 權限的 Google 帳號登入。",
      "授權完成後回到 soos，點擊測試 API 連線。",
    ],
    docsLabel: "Search Console 使用者和權限說明",
    connect: "連接 Google Search Console",
    connectedAs: "已連接帳號",
    connectedAccountFallback: "Google 帳號已連接",
    reconnect: "重新連接",
    opening: "開啟中...",
    refresh: "重新整理狀態",
    test: "測試 API 連線",
    testing: "測試中...",
    clear: "中斷連線",
    serverlessHelp: "Vercel 模式：設定 DATABASE_URL 後，每位訪客都可以儲存自己的 Search Console 連線。",
    startServerlessError: "請先在 Vercel 設定 DATABASE_URL，再開始 OAuth。",
    missingOAuthError: "服務端 OAuth App 尚未設定。",
    missingApiError: "請先連接 Google Search Console，再測試 API 連線。",
    missingPropertyError: "測試 API 連線前，請先輸入 Search Console Property URL。",
    openingMessage: "正在開啟 Google OAuth。",
    disconnectedMessage: "已清除此瀏覽器的 Search Console 連線。",
    revokeNotConfirmed: "Google token 撤銷未確認。",
    reconnectHint: "如果未顯示帳號信箱，請重新連接一次。",
  },
};

function SearchConsoleApiConfig({ status, onStatus, siteUrl, onSiteUrlChange, language }) {
  const copy = gscUiText[language] || gscUiText.en;
  const [showOauthHelp, setShowOauthHelp] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status?.siteUrl) onSiteUrlChange(status.siteUrl);
  }, [onSiteUrlChange, status?.siteUrl]);

  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "soos:gsc-oauth-connected") return;
      refreshStatus("oauth-connected");
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const tokenState = status?.refreshToken
    ? "OAuth connected"
    : status?.token
      ? status.tokenLikelyExpired
      ? "Token likely expired"
      : "Token saved"
      : "No token saved";
  const connectedAccount = status?.googleAccountEmail || status?.googleAccountName || "";

  async function clearConfig() {
    if (status?.serverless && !status?.databaseConfigured) {
      setError(copy.startServerlessError);
      return;
    }
    setOauthLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/gsc/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not clear Search Console config");
      onStatus(body);
      setMessage(body.revoke?.revoked ? copy.disconnectedMessage : `${copy.disconnectedMessage} ${copy.revokeNotConfirmed}`);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setOauthLoading(false);
    }
  }

  async function testConfig() {
    if (!status?.configured) {
      setError(copy.missingApiError);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.missingPropertyError);
      return;
    }
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/gsc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Search Console API test failed");
      if (body.status) onStatus(body.status);
      setMessage(body.permissionLevel ? `${body.message} Permission: ${body.permissionLevel}.` : body.message);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setTesting(false);
    }
  }

  async function refreshStatus(reason = "") {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/gsc/status");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not refresh Search Console API status");
      onStatus(body);
      setMessage(reason === "oauth-connected" ? "OAuth connected. Search Console status refreshed." : body.refreshToken ? "OAuth status refreshed. Automatic token refresh is ready." : "Status refreshed.");
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function startOAuth() {
    if (status?.serverless && !status?.databaseConfigured) {
      setError(copy.startServerlessError);
      return;
    }
    if (!status?.oauthConfigured) {
      setError(copy.missingOAuthError);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.missingPropertyError);
      return;
    }
    setOauthLoading(true);
    setMessage("");
    setError("");
    const oauthWindow = window.open("", "soos-gsc-oauth", "popup,width=620,height=760");
    if (oauthWindow) {
      oauthWindow.document.title = "Connecting Google Search Console";
      oauthWindow.document.body.innerHTML = "<p style=\"font-family:system-ui;padding:24px\">Opening Google OAuth...</p>";
    }
    try {
      const response = await fetch("/api/gsc/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not start OAuth");
      setMessage(copy.openingMessage);
      if (oauthWindow) {
        oauthWindow.location.href = body.authUrl;
      } else {
        window.location.href = body.authUrl;
      }
    } catch (err) {
      oauthWindow?.close();
      setError(err.message || String(err));
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <section className="panel gsc-api-config">
      <div className="panel-head">
        <h2>Search Console API</h2>
        <span>{status?.configured ? tokenState : "not configured"}</span>
      </div>
      <form className="gsc-api-body" onSubmit={(event) => event.preventDefault()}>
        <div className="gsc-api-fields">
          <label>
            <strong className="gsc-label-row">
              {copy.propertyUrl}
              {!status?.configured ? (
                <button className="gsc-help-button" type="button" onClick={() => setShowOauthHelp((value) => !value)} aria-label={copy.oauthHelpTitle}>
                  ?
                </button>
              ) : null}
            </strong>
            <input type="text" placeholder="https://example.com/ or sc-domain:example.com" value={siteUrl} onChange={(event) => onSiteUrlChange(event.target.value)} disabled={status?.configured} />
            {!status?.configured ? <small>{copy.propertyHelp}</small> : null}
          </label>
        </div>
        {status?.configured ? (
          <div className="gsc-oauth-help">
            <strong>{copy.connectedAs}</strong>
            <span>{connectedAccount || copy.connectedAccountFallback}</span>
            {!connectedAccount ? <small>{copy.reconnectHint}</small> : null}
          </div>
        ) : null}
        {showOauthHelp && !status?.configured ? (
          <div className="gsc-oauth-help">
            <strong>{copy.oauthHelpTitle}</strong>
            <ol>
              {copy.oauthHelpSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a href="https://support.google.com/webmasters/answer/7687615" target="_blank" rel="noreferrer">
              {copy.docsLabel}
            </a>
          </div>
        ) : null}
        <div className="gsc-api-actions">
          {!status?.configured ? (
            <button className="export-button" type="button" onClick={startOAuth} disabled={oauthLoading}>
              {oauthLoading ? copy.opening : copy.connect}
            </button>
          ) : null}
          {status?.configured && !connectedAccount ? (
            <button className="export-button" type="button" onClick={startOAuth} disabled={oauthLoading}>
              {oauthLoading ? copy.opening : copy.reconnect}
            </button>
          ) : null}
          <button className="export-button" type="button" onClick={refreshStatus} disabled={testing || oauthLoading}>
            {copy.refresh}
          </button>
          <button className="export-button" type="button" onClick={testConfig} disabled={testing || oauthLoading}>
            {testing ? copy.testing : copy.test}
          </button>
          {status?.configured ? (
            <button className="export-button" type="button" onClick={clearConfig} disabled={testing || oauthLoading}>
              {copy.clear}
            </button>
          ) : null}
        </div>
        <div className="gsc-api-help">
          {!status?.configured ? <small>{status?.note || "CSV import works now. API configuration enables URL Inspection and Search Analytics."}</small> : null}
          {status?.serverless ? <small>{copy.serverlessHelp}</small> : null}
        </div>
        {message ? <small className="gsc-api-message">{message}</small> : null}
        {error ? <small className="gsc-api-error">{error}</small> : null}
      </form>
    </section>
  );
}
function defaultGscDateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function buildSearchAnalyticsInsights(rows, dimension) {
  if (dimension !== "page_query") return [];
  const pageQueryRows = (rows || []).filter((row) => row.page && row.query);
  const insights = [];
  const seenInsightDetails = new Set();
  function addInsight(insight) {
    const key = `${insight.type}:${insight.detail}`;
    if (seenInsightDetails.has(key)) return;
    seenInsightDetails.add(key);
    insights.push(insight);
  }
  const lowCtr = pageQueryRows
    .filter((row) => (row.impressions || 0) >= 100 && typeof row.ctr === "number" && row.ctr < 0.01)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of lowCtr) {
    addInsight({
      type: "low_ctr",
      severity: "warning",
      title: "High impressions, low CTR",
      detail: `${row.query} on ${row.page}`,
      action: "Rewrite title/meta description to match the query intent and make the result more clickable.",
      metrics: `${row.impressions} impressions, ${((row.ctr || 0) * 100).toFixed(2)}% CTR, position ${typeof row.position === "number" ? row.position.toFixed(1) : "-"}`,
    });
  }
  const highRankLowClicks = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position <= 3 && (row.impressions || 0) >= 100 && (row.clicks || 0) <= 1)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of highRankLowClicks) {
    addInsight({
      type: "snippet_gap",
      severity: "warning",
      title: "Top ranking, almost no clicks",
      detail: `${row.query} on ${row.page}`,
      action: "Check whether the query intent matches the page and improve the title, meta description, and visible answer near the top.",
      metrics: `${row.impressions} impressions, ${row.clicks || 0} clicks, position ${row.position.toFixed(1)}`,
    });
  }
  const strikingDistance = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= 50)
    .sort((a, b) => (a.position || 99) - (b.position || 99))
    .slice(0, 5);
  for (const row of strikingDistance) {
    addInsight({
      type: "striking_distance",
      severity: "notice",
      title: "Ranking within striking distance",
      detail: `${row.query} on ${row.page}`,
      action: "Strengthen the section that answers this query, add internal links, and improve snippet relevance.",
      metrics: `${row.impressions} impressions, position ${row.position.toFixed(1)}`,
    });
  }
  const pageTwo = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= 100)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);
  for (const row of pageTwo) {
    addInsight({
      type: "page_two",
      severity: "notice",
      title: "Page two opportunity",
      detail: `${row.query} on ${row.page}`,
      action: "Expand the answer depth, add internal links from stronger related pages, and compare content gaps against page-one results.",
      metrics: `${row.impressions} impressions, position ${row.position.toFixed(1)}`,
    });
  }
  const byPage = new Map();
  for (const row of pageQueryRows) {
    if ((row.impressions || 0) < 30) continue;
    const list = byPage.get(row.page) || [];
    list.push(row);
    byPage.set(row.page, list);
  }
  for (const [page, list] of byPage.entries()) {
    const queryCount = list.length;
    const impressions = list.reduce((sum, row) => sum + (row.impressions || 0), 0);
    if (queryCount < 5 || impressions < 300) continue;
    const topQueries = list
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 3)
      .map((row) => row.query)
      .join(", ");
    addInsight({
      type: "intent_spread",
      severity: "notice",
      title: "Page ranks for many queries",
      detail: page,
      action: `Cluster the page around the strongest intent. Top queries: ${topQueries}.`,
      metrics: `${queryCount} queries, ${impressions} impressions`,
    });
  }
  return insights.slice(0, 12);
}

function classifySearchQueryOpportunity(row) {
  if ((row.impressions || 0) >= 100 && typeof row.ctr === "number" && row.ctr < 0.01) return "low_ctr";
  if (typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= 50) return "striking_distance";
  if (typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= 100) return "page_two";
  return "monitor";
}

function keywordOpportunityAction(type) {
  if (type === "low_ctr") return "Rewrite title/meta description and align snippet copy with query intent.";
  if (type === "snippet_gap") return "Improve title/meta description and verify the page answers the query intent clearly.";
  if (type === "striking_distance") return "Improve the answer section, add internal links, and strengthen topical relevance.";
  if (type === "page_two") return "Expand content depth and add internal links from stronger related pages.";
  return "Monitor performance and prioritize if impressions or position improve.";
}

function downloadKeywordOpportunitiesCsv(rows, insights) {
  const insightByDetail = new Map((insights || []).map((insight) => [insight.detail, insight]));
  const csvRows = [
    ["page", "query", "clicks", "impressions", "ctr", "position", "opportunity_type", "recommended_action"],
  ];
  for (const row of (rows || []).filter((item) => item.page && item.query)) {
    const insight = insightByDetail.get(`${row.query} on ${row.page}`) || insightByDetail.get(row.page);
    const type = insight?.type || classifySearchQueryOpportunity(row);
    csvRows.push([
      row.page,
      row.query,
      row.clicks ?? 0,
      row.impressions ?? 0,
      typeof row.ctr === "number" ? (row.ctr * 100).toFixed(2) : "",
      typeof row.position === "number" ? row.position.toFixed(1) : "",
      type,
      insight?.action || keywordOpportunityAction(type),
    ]);
  }
  downloadCsvFile(`soos-keyword-opportunities-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, csvRows);
}

function SearchAnalyticsPanel({ status, siteUrl, onRows }) {
  const defaults = useMemo(() => defaultGscDateRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [dimension, setDimension] = useState("page");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const insights = useMemo(() => buildSearchAnalyticsInsights(rows, summary?.dimension || dimension), [dimension, rows, summary?.dimension]);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event.preventDefault();
    if (!status?.configured) {
      setError("Connect Google Search Console first, then load Search Analytics.");
      return;
    }
    if (!siteUrl.trim()) {
      setError("Enter the Search Console Property URL in the Search Console API panel before loading Search Analytics.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gsc/search-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, siteUrl, dimension }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Search Analytics failed");
      if (body.dimension === "page") onRows(body.rows || []);
      setRows(body.rows || []);
      setSummary({
        rows: body.rows?.length || 0,
        clicks: (body.rows || []).reduce((sum, row) => sum + (row.clicks || 0), 0),
        impressions: (body.rows || []).reduce((sum, row) => sum + (row.impressions || 0), 0),
        dimension: body.dimension || dimension,
      });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel search-analytics-panel">
      <div className="panel-head">
        <h2>Search Analytics API</h2>
        <span>{status?.configured ? "ready" : "configure GSC first"}</span>
      </div>
      <form className="search-analytics-body" onSubmit={loadAnalytics}>
        <div className="search-analytics-fields">
          <label>
            <strong>Start date</strong>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <strong>End date</strong>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <strong>Dimension</strong>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)}>
              <option value="page">Page</option>
              <option value="query">Query</option>
              <option value="page_query">Page + Query</option>
              <option value="country">Country</option>
              <option value="device">Device</option>
            </select>
          </label>
        </div>
        <div className="gsc-api-actions">
          <button className="export-button" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Load Search Analytics"}
          </button>
          {dimension === "page_query" && rows.length ? (
            <button className="export-button" type="button" onClick={() => downloadKeywordOpportunitiesCsv(rows, insights)}>
              Export keyword opportunities
            </button>
          ) : null}
        </div>
        {summary ? (
          <small>{summary.rows} {summary.dimension} rows loaded, {summary.clicks} clicks, {summary.impressions} impressions</small>
        ) : (
          <small>Loads page-level clicks, impressions, CTR, and average position into the same GSC opportunity analysis.</small>
        )}
        {dimension !== "page" ? <small>Only Page rows update GSC opportunities. Other dimensions are shown below for exploration.</small> : null}
        {insights.length ? (
          <div className="search-analytics-insights">
            {insights.map((insight, index) => (
              <article className={`search-analytics-insight ${insight.severity}`} key={`${insight.type}-${index}`}>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
                <span>{insight.metrics}</span>
                <em>{insight.action}</em>
              </article>
            ))}
          </div>
        ) : dimension === "page_query" && rows.length ? (
          <small>No high-confidence Page + Query opportunities found with the current thresholds.</small>
        ) : null}
        {rows.length ? (
          <div className="search-analytics-results">
            <div className="search-analytics-result head">
              <span>Dimension</span>
              <span>Clicks</span>
              <span>Impressions</span>
              <span>CTR</span>
              <span>Position</span>
            </div>
            {rows.slice(0, 12).map((row, index) => (
              <div className="search-analytics-result" key={`${row.label || row.page || index}-${index}`}>
                <strong title={row.label || row.page}>{row.label || row.page || row.query || row.country || row.device}</strong>
                <span>{row.clicks ?? 0}</span>
                <span>{row.impressions ?? 0}</span>
                <span>{typeof row.ctr === "number" ? `${(row.ctr * 100).toFixed(2)}%` : "-"}</span>
                <span>{typeof row.position === "number" ? row.position.toFixed(1) : "-"}</span>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <small className="gsc-api-error">{error}</small> : null}
      </form>
    </section>
  );
}
function SearchConsoleImport({ rows, onImport, onClear }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseSearchConsoleCsv(text);
      if (!parsed.length) {
        setError("No page rows found. Export Search Console Performance by Pages, and use CSV/TSV with Page, Clicks, Impressions, CTR, Position columns.");
        setMessage(`${file.name}: 0 rows parsed`);
        onImport([]);
      } else {
        onImport(parsed);
        setMessage(`${file.name}: ${parsed.length} rows imported`);
      }
    } catch (err) {
      setError(err.message || String(err));
      setMessage(`${file.name}: import failed`);
    } finally {
      event.target.value = "";
    }
  }

  function clearImportedRows() {
    onClear();
    setMessage("Imported CSV data cleared");
    setError("");
  }

  return (
    <section className="panel gsc-import">
      <div className="panel-head">
        <h2>Search Console CSV</h2>
        <span>{rows.length ? `${rows.length} rows loaded` : "optional"}</span>
      </div>
      <div className="gsc-import-body">
        <div>
          <strong>Import page performance</strong>
          <small>Use a Google Search Console Performance export by Pages. CSV, TSV, and semicolon-separated files are supported.</small>
          {message ? <small className="gsc-import-message">{message}</small> : null}
          {error ? <small className="gsc-import-error">{error}</small> : null}
        </div>
        <div className="gsc-import-actions">
          <label className="export-button file-button">
            Import CSV
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={handleFile} />
          </label>
          {rows.length ? (
            <button className="export-button" type="button" onClick={clearImportedRows}>
              Clear GSC data
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
function buildGscRowMap(rows) {
  return new Map((rows || []).map((row) => [row.key, row]));
}

function isTechnicallyIndexablePage(page) {
  const blockers = new Set([
    "fetch_failed",
    "http_error",
    "robots_disallow",
    "noindex",
    "canonical_blocked",
    "canonical_cross_host",
    "canonical_mismatch",
  ]);
  return !(page.issues || []).some((issue) => blockers.has(issue.type));
}

function buildGscOpportunities(report, rows) {
  const pages = report?.pages || [];
  const gscRows = rows || [];
  if (!gscRows.length || !pages.length) return [];

  const gscByUrl = buildGscRowMap(gscRows);
  const sitemapKeys = new Set(pages.map((page) => normalizeReportUrl(page.url)));
  const technicallyIndexableNoImpressions = pages
    .filter((page) => isTechnicallyIndexablePage(page))
    .filter((page) => (gscByUrl.get(normalizeReportUrl(page.url))?.impressions || 0) === 0);
  const lowRanking = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    return row && (row.impressions || 0) > 0 && typeof row.position === "number" && row.position > 20;
  });
  const lowCtr = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    if (!row || (row.impressions || 0) < 100) return false;
    const ctr = row.clicks != null && row.impressions ? row.clicks / row.impressions : null;
    return ctr != null && ctr < 0.01;
  });
  const blockedWithVisibility = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    return row && (row.impressions || 0) > 0 && !isTechnicallyIndexablePage(page);
  });
  const gscNotInSitemap = gscRows.filter((row) => !sitemapKeys.has(row.key));

  const makeItem = (key, title, severity, urls, detail) => ({
    key,
    title,
    severity,
    count: urls.length,
    detail,
    sampleUrls: urls.slice(0, 5).map((item) => item.url || item.page),
  });

  return [
    makeItem(
      "indexable_no_impressions",
      "Technically indexable, no GSC impressions",
      "warning",
      technicallyIndexableNoImpressions,
      "These URLs look indexable in this audit but do not appear in the imported GSC performance rows.",
    ),
    makeItem(
      "low_ranking",
      "Visible but ranking low",
      "notice",
      lowRanking,
      "These URLs have impressions but average position is worse than 20.",
    ),
    makeItem(
      "low_ctr",
      "Visible but CTR is low",
      "notice",
      lowCtr,
      "These URLs have at least 100 impressions and less than 1% calculated CTR.",
    ),
    makeItem(
      "blocked_with_visibility",
      "GSC visibility with technical blockers",
      "critical",
      blockedWithVisibility,
      "These URLs have GSC impressions but also have crawl, indexability, or canonical blockers in this audit.",
    ),
    makeItem(
      "gsc_not_in_sitemap",
      "GSC pages missing from sitemap",
      "notice",
      gscNotInSitemap,
      "These URLs appear in GSC performance data but are not in the scanned sitemap set.",
    ),
  ].filter((item) => item.count > 0);
}

function GscOpportunities({ report, rows }) {
  const opportunities = buildGscOpportunities(report, rows || []);
  if (!rows?.length || !opportunities.length) return null;
  return (
    <section className="panel gsc-opportunities">
      <div className="panel-head">
        <h2>GSC opportunities</h2>
        <span>{opportunities.length}</span>
      </div>
      <div className="impact-list">
        {opportunities.map((item) => (
          <article className="impact-card" key={item.key}>
            <div className="impact-top">
              <Badge severity={item.severity}>{item.key}</Badge>
              <strong>{item.title}</strong>
              <span>{item.count}</span>
            </div>
            <div className="impact-details">
              <small>{item.detail}</small>
            </div>
            {item.sampleUrls.length ? (
              <div className="impact-samples">
                <strong>Sample URLs</strong>
                {item.sampleUrls.map((url) => (
                  <small key={`${item.key}-${url}`}>{url}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
function buildSearchVisibility(report) {
  const pages = report?.pages || [];
  const hasIssue = (page, types) => page.issues?.some((issue) => types.includes(issue.type));
  const hardBlockers = [
    "fetch_failed",
    "http_error",
    "robots_disallow",
    "noindex",
    "canonical_blocked",
    "canonical_cross_host",
  ];
  const canonicalNotSelected = ["canonical_mismatch"];
  const hardBlocked = pages.filter((page) => hasIssue(page, hardBlockers));
  const canonicalized = pages.filter((page) => hasIssue(page, canonicalNotSelected));
  const technicallyIndexable = pages.filter((page) => !hasIssue(page, hardBlockers) && !hasIssue(page, canonicalNotSelected));
  const total = pages.length || 0;
  const readiness = total ? Math.round((technicallyIndexable.length / total) * 100) : 0;
  return {
    total,
    readiness,
    technicallyIndexable: technicallyIndexable.length,
    hardBlocked: hardBlocked.length,
    canonicalized: canonicalized.length,
  };
}

function SearchVisibility({ report, t, gscRows }) {
  if (!report?.pages?.length) return null;
  const label = (key, fallback) => t?.[key] || fallback;
  const visibility = buildSearchVisibility(report);
  const gsc = summarizeGscRows(report, gscRows || []);
  return (
    <section className="panel search-visibility">
      <div className="panel-head">
        <h2>{label("searchVisibility", "Search visibility")}</h2>
        <span>{visibility.readiness}% {label("readiness", "readiness")}</span>
      </div>
      <div className="visibility-grid">
        <div className="visibility-card">
          <strong>{label("technicallyIndexable", "Technically indexable")}</strong>
          <span>{visibility.technicallyIndexable}/{visibility.total}</span>
          <small>{label("indexableHelp", "URLs without crawl, noindex, HTTP, or canonical blockers in this audit.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("gscConfirmation", "Needs GSC confirmation")}</strong>
          <span>{visibility.hardBlocked + visibility.canonicalized} flagged</span>
          <small>{label("gscHelp", "Confirmed indexing status requires Google Search Console URL Inspection data.")}</small>
        </div>
        <div className="visibility-card">
          <strong>{label("rankingData", "Ranking data")}</strong>
          <span>GSC API</span>
          <small>{label("rankingHelp", "Clicks, impressions, and average position require Search Console Search Analytics or a rank-tracking provider.")}</small>
        </div>
      </div>
      <div className="visibility-next">
        <strong>{label("nextIntegration", "Next integration")}</strong>
        <span>{label("nextIntegrationHelp", "Connect Google Search Console to compare this technical audit with real index coverage and performance.")}</span>
      </div>
    </section>
  );
}
function UrlInspectionPanel({ report, gscStatus, siteUrl }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  if (!report?.pages?.length) return null;

  const urls = report.pages.map((page) => page.url).slice(0, 25);
  const indexedCount = (result?.results || []).filter((item) => item.verdict === "PASS").length;
  const failedCount = (result?.results || []).filter((item) => !item.ok || item.verdict === "FAIL").length;
  const diagnosedResults = (result?.results || []).map((item) => ({
    ...item,
    diagnoses: diagnoseInspectionResult(item),
  }));
  const diagnosisSummary = diagnosedResults.reduce(
    (summary, item) => {
      for (const diagnosis of item.diagnoses) {
        summary[diagnosis.severity] = (summary[diagnosis.severity] || 0) + 1;
      }
      return summary;
    },
    { critical: 0, warning: 0, notice: 0 }
  );

  async function runInspection() {
    if (!siteUrl.trim()) {
      setError("Enter the Search Console Property URL in the Search Console API panel before running URL Inspection.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gsc/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, siteUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "URL Inspection failed");
      setResult(body);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel url-inspection">
      <div className="panel-head">
        <h2>URL Inspection</h2>
        <span>{gscStatus?.configured ? "GSC API" : "configure GSC first"}</span>
      </div>
      <div className="url-inspection-body">
        <div className="url-inspection-copy">
          <strong>Inspect real Google index status</strong>
          <small>Checks up to 25 scanned sitemap URLs with the configured Search Console property.</small>
        </div>
        <button className="export-button" type="button" disabled={!gscStatus?.configured || loading} onClick={runInspection}>
          {loading ? "Inspecting..." : "Inspect URLs"}
        </button>
      </div>
      {error ? <div className="url-inspection-error">{error}</div> : null}
      {result ? (
        <>
          <div className="inspection-summary">
            <Stat label="Inspected" value={result.inspected} />
            <Stat label="PASS" value={indexedCount} tone="good" />
            <Stat label="Needs review" value={failedCount} tone="warn" />
          </div>
          <div className="inspection-diagnosis-summary">
            <span>{diagnosisSummary.critical} critical</span>
            <span>{diagnosisSummary.warning} warnings</span>
            <span>{diagnosisSummary.notice} notices</span>
          </div>
          <div className="inspection-list">
            {diagnosedResults.map((item) => (
              <article className="inspection-card" key={item.url}>
                <div className="impact-top">
                  <Badge severity={item.ok && item.verdict === "PASS" ? "ok" : item.ok ? "warning" : "critical"}>{item.verdict || (item.ok ? "UNKNOWN" : "ERROR")}</Badge>
                  <strong>{item.url}</strong>
                  <span>{item.coverageState || item.error || "No coverage state"}</span>
                </div>
                <div className="impact-details">
                  {item.indexingState ? <small>Indexing: {item.indexingState}</small> : null}
                  {item.robotsTxtState ? <small>Robots: {item.robotsTxtState}</small> : null}
                  {item.pageFetchState ? <small>Fetch: {item.pageFetchState}</small> : null}
                  {item.crawledAs ? <small>Crawled as: {item.crawledAs}</small> : null}
                  {item.lastCrawlTime ? <small>Last crawl: {item.lastCrawlTime}</small> : null}
                  {item.sitemap?.length ? <small>Seen in sitemap: {item.sitemap.slice(0, 2).join(", ")}</small> : null}
                  {item.referringUrls?.length ? <small>Referrers: {item.referringUrls.length}</small> : null}
                  {item.googleCanonical ? <small>Google canonical: {item.googleCanonical}</small> : null}
                  {item.userCanonical ? <small>User canonical: {item.userCanonical}</small> : null}
                  {item.mobileVerdict ? <small>Mobile: {item.mobileVerdict}</small> : null}
                  {item.richResultsVerdict ? <small>Rich results: {item.richResultsVerdict}</small> : null}
                </div>
                {item.diagnoses.length ? (
                  <div className="inspection-diagnoses">
                    {item.diagnoses.map((diagnosis) => (
                      <div className={`inspection-diagnosis ${diagnosis.severity}`} key={`${item.url}-${diagnosis.type}`}>
                        <strong>{diagnosis.title}</strong>
                        <small>{diagnosis.detail}</small>
                        <span>{diagnosis.action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inspection-diagnoses">
                    <div className="inspection-diagnosis good">
                      <strong>No immediate index issue</strong>
                      <small>Google reports this URL as passing URL Inspection checks.</small>
                      <span>Keep monitoring performance data and canonical consistency.</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function diagnoseInspectionResult(item) {
  const diagnoses = [];
  const coverage = String(item.coverageState || "").toLowerCase();
  const indexing = String(item.indexingState || "").toLowerCase();
  const robots = String(item.robotsTxtState || "").toLowerCase();
  const fetchState = String(item.pageFetchState || "").toLowerCase();
  const verdict = String(item.verdict || "").toUpperCase();
  const mobileVerdict = String(item.mobileVerdict || "").toUpperCase();
  const richVerdict = String(item.richResultsVerdict || "").toUpperCase();
  if (!item.ok) {
    diagnoses.push({
      type: "inspection_error",
      severity: "critical",
      title: "Inspection request failed",
      detail: item.error || "Google did not return URL Inspection data for this URL.",
      action: "Check the API connection, property access, and whether this URL belongs to the configured property.",
    });
    return diagnoses;
  }
  if (verdict === "FAIL" || coverage.includes("not indexed") || coverage.includes("excluded") || coverage.includes("crawled - currently not indexed")) {
    diagnoses.push({
      type: "not_indexed",
      severity: "critical",
      title: "Not indexed by Google",
      detail: item.coverageState || "Google did not report this URL as indexed.",
      action: "Review crawlability, canonical tags, content quality, internal links, and sitemap inclusion.",
    });
  }
  if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    diagnoses.push({
      type: "discovered_not_crawled",
      severity: "warning",
      title: "Discovered, not crawled yet",
      detail: item.coverageState,
      action: "Strengthen internal links, verify crawl budget signals, keep the URL in sitemap, and make sure the server responds quickly.",
    });
  }
  if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    diagnoses.push({
      type: "duplicate_or_alternate",
      severity: "warning",
      title: "Google treats this as duplicate or alternate",
      detail: item.coverageState,
      action: "Confirm the canonical target is intentional. If this URL should rank, make canonical, sitemap, internal links, and content unique.",
    });
  }
  if (coverage.includes("soft 404")) {
    diagnoses.push({
      type: "soft_404",
      severity: "critical",
      title: "Soft 404 detected",
      detail: item.coverageState,
      action: "Add substantial useful content or return a real 404/410 if the page should not exist.",
    });
  }
  if (robots.includes("disallow") || robots.includes("blocked")) {
    diagnoses.push({
      type: "robots_blocked",
      severity: "critical",
      title: "Blocked by robots.txt",
      detail: item.robotsTxtState || "Google reports a robots.txt blocker.",
      action: "Remove the blocking robots.txt rule if this page should be indexed.",
    });
  }
  if (fetchState && !["successful", "page_fetch_state_successful"].includes(fetchState)) {
    diagnoses.push({
      type: "fetch_problem",
      severity: "warning",
      title: "Google fetch has problems",
      detail: item.pageFetchState || "Google reported a non-successful fetch state.",
      action: "Check server availability, redirects, status codes, firewall rules, and rendering stability.",
    });
  }
  if (item.googleCanonical && item.userCanonical && normalizeReportUrl(item.googleCanonical) !== normalizeReportUrl(item.userCanonical)) {
    diagnoses.push({
      type: "canonical_mismatch",
      severity: "warning",
      title: "Google selected a different canonical",
      detail: `Google: ${item.googleCanonical}`,
      action: "Align canonical tags, internal links, redirects, and sitemap URLs around the preferred canonical.",
    });
  }
  if (!item.sitemap?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "not_seen_in_sitemap",
      severity: "notice",
      title: "Google did not report sitemap discovery",
      detail: "URL Inspection did not include a sitemap source for this URL.",
      action: "Keep the canonical URL in the submitted sitemap and ensure the sitemap is discoverable from robots.txt.",
    });
  }
  if (!item.referringUrls?.length && verdict !== "PASS") {
    diagnoses.push({
      type: "no_referrers",
      severity: "notice",
      title: "No referring URLs reported",
      detail: "Google did not report internal or external referrers for this URL.",
      action: "Add internal links from relevant indexed pages so Google can discover and prioritize the URL.",
    });
  }
  if (mobileVerdict && mobileVerdict !== "PASS") {
    diagnoses.push({
      type: "mobile_usability",
      severity: "warning",
      title: "Mobile usability issue",
      detail: item.mobileVerdict,
      action: "Review mobile usability issues in Search Console and fix layout, tap target, and viewport problems.",
    });
  }
  if (richVerdict && richVerdict !== "PASS" && richVerdict !== "VERDICT_UNSPECIFIED") {
    diagnoses.push({
      type: "rich_results",
      severity: "notice",
      title: "Rich results need review",
      detail: item.richResultsVerdict,
      action: "Validate structured data with Google's rich results tooling and fix invalid detected items.",
    });
  }
  if (indexing && indexing !== "indexing_allowed" && indexing !== "allowed") {
    diagnoses.push({
      type: "indexing_state",
      severity: "notice",
      title: "Indexing state needs review",
      detail: item.indexingState || "Google returned a non-standard indexing state.",
      action: "Compare this state with meta robots, canonical signals, and crawl diagnostics.",
    });
  }
  return diagnoses;
}
function Report({ report, t, gscRows, gscStatus, gscSiteUrl }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState(null);
  const pages = useMemo(() => {
    if (!report?.pages) return [];
    let filtered;
    if (filter === "all") filtered = report.pages;
    else if (filter === "ok") filtered = report.pages.filter((page) => !page.issues.length);
    else filtered = report.pages.filter((page) => page.issues.some((issue) => issue.severity === filter));

    if (issueFilter?.type) {
      filtered = filtered.filter((page) => page.issues.some((issue) => issue.type === issueFilter.type));
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return filtered;

    return filtered.filter((page) => {
      const issueText = page.issues.map((issue) => `${issue.type} ${issue.message} ${issue.detail || ""}`).join(" ");
      const reasonText = (page.googleReasons || []).map((reason) => `${reason.label} ${reason.detail}`).join(" ");
      const haystack = [
        page.url,
        page.finalUrl,
        page.canonical,
        page.title,
        page.description,
        issueText,
        reasonText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, issueFilter, query, report]);

  if (!report) return <EmptyState t={t} />;

  return (
    <>
      <StatusFlags flags={report.statusFlags} t={t} />
      <ExecutiveSummary summary={report.executiveSummary} t={t} />
      <ScoreCard score={report.summary.healthScore} t={t} />
      <SearchVisibility report={report} t={t} gscRows={gscRows} />
      <GscOpportunities report={report} rows={gscRows} />
      <UrlInspectionPanel report={report} gscStatus={gscStatus} siteUrl={gscSiteUrl} />
      <section className="summary">
        <Stat label={t.urls} value={report.summary.urlCount} />
        <Stat label={t.affected} value={report.summary.affectedUrlCount} tone="warn" />
        <Stat label={t.googleRisk} value={report.summary.googleBlockedCount} tone="bad" />
        <Stat label={t.critical} value={report.summary.issueCounts.critical} tone="bad" />
        <Stat label={t.warnings} value={report.summary.issueCounts.warning} tone="warn" />
      </section>

      <section className="panel detected">
        <div className="panel-head">
          <h2>{t.detectedInputs}</h2>
          <span>{report.input.inputType}</span>
        </div>
        <div className="detected-grid">
          <p><strong>{t.original}</strong><span>{report.input.originalUrl}</span></p>
          <p><strong>{t.siteRoot}</strong><span>{report.input.siteRootUrl}</span></p>
          <p><strong>Sitemap</strong><span>{report.input.sitemapUrl}</span></p>
          <p><strong>Robots</strong><span>{report.input.robotsUrl}</span></p>
        </div>
      </section>

      {report.truncation?.truncated ? (
        <section className="limit-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>{t.limitReachedTitle}</strong>
            <span>{formatText(t.limitReachedText, { urls: report.limits.maxUrls, sitemaps: report.limits.maxSitemaps })}</span>
          </div>
        </section>
      ) : (
        <section className="limit-note">
          <CheckCircle2 size={18} />
          <span>
            {formatText(t.limitOk, { urls: report.limits.maxUrls, sitemaps: report.limits.maxSitemaps })}
          </span>
        </section>
      )}

      <Backlog backlog={report.backlog} t={t} />

      <section className="panel robots">
        <div>
          <Bot size={20} />
          <div>
            <h2>{t.robots}</h2>
            <p>{report.robots?.url}</p>
          </div>
        </div>
        {report.robots?.found ? (
          <Badge>{t.found} - {report.robots.groupCount} {t.groups}</Badge>
        ) : (
          <Badge severity="warning">{report.robots?.error || "Not found"}</Badge>
        )}
      </section>

      <RobotsDetails robots={report.robots} t={t} onSelectIssue={setIssueFilter} />

      <SitemapSignals signals={report.sitemapSignals} t={t} onSelectIssue={setIssueFilter} />

      <InternationalSignals signals={report.internationalSignals} t={t} onSelectIssue={setIssueFilter} />

      <Sitemaps sitemaps={report.sitemaps} t={t} />

      <section className="panel">
        <div className="panel-head">
          <h2>{t.urlFindings}</h2>
          <div className="findings-toolbar">
            <div className="filters">
              {["all", "critical", "warning", "notice", "ok"].map((item) => (
                <button
                  className={filter === item ? "active" : ""}
                  key={item}
                  type="button"
                  onClick={() => {
                    setFilter(item);
                    if (item === "ok") setIssueFilter(null);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="findings-actions">
              {issueFilter?.type ? (
                <button className="export-button" type="button" onClick={() => setIssueFilter(null)}>
                  {issueFilter.type}
                </button>
              ) : null}
              <input
                className="findings-search"
                type="search"
                placeholder={t.searchUrls}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="export-button" type="button" onClick={() => downloadSummary(report)}>
                {t.exportSummary}
              </button>
              <button className="export-button" type="button" onClick={() => downloadCsv(report, gscRows)}>
                {t.exportCsv}
              </button>
            </div>
          </div>
        </div>
        <div className="rows">
          {pages.length ? pages.map((page) => <PageRow page={page} key={page.url} t={t} />) : <p className="none">{t.noFilter}</p>}
        </div>
      </section>
    </>
  );
}

function App() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [language, setLanguage] = useState(() => detectLanguage());
  const [contentChecks, setContentChecks] = useState(false);
  const [directoryRobots, setDirectoryRobots] = useState(false);
  const [performanceChecks, setPerformanceChecks] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [gscRows, setGscRows] = useState([]);
  const [gscStatus, setGscStatus] = useState(null);
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyLimit, setHistoryLimit] = useState(() => loadHistoryLimit());
  const [comparisonEntry, setComparisonEntry] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [currentJobStartedAt, setCurrentJobStartedAt] = useState(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [elapsedNow, setElapsedNow] = useState(0);
  const t = dictionaries[language];

    useEffect(() => {
    fetch("/api/gsc/status")
      .then((response) => response.json())
      .then((status) => {
        setGscStatus(status);
        if (status?.siteUrl) setGscSiteUrl(status.siteUrl);
      })
      .catch(() => setGscStatus({ configured: false, note: "Search Console API status is unavailable." }));
  }, []);
useEffect(() => {
    if (!loading || !currentJobStartedAt) return undefined;
    const timer = window.setInterval(() => setElapsedNow(Date.now() - currentJobStartedAt), 1000);
    return () => window.clearInterval(timer);
  }, [loading, currentJobStartedAt]);

  async function controlJob(action) {
    if (!currentJobId) return;
    const response = await fetch(`/api/audit-jobs/${currentJobId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not control audit");
    if (action === "pause" && body.status === "paused") setPauseCount((count) => count + 1);
    setJobStatus(body.status);
  }

  async function runAudit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    setCurrentJobStartedAt(Date.now());
    setPauseCount(0);
    setElapsedNow(0);
    setProgress({ label: t.progressPreparing, value: 5, meta: "" });
    try {
      const startResponse = await fetch("/api/audit-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitemapUrl,
          options: {
            contentChecks,
            performanceChecks,
            backgroundMode,
            robotsSource: directoryRobots ? "sitemap-directory" : "root",
            proxyEnabled: false,
          },
        }),
      });
      const startBody = await startResponse.json();
      if (!startResponse.ok) throw new Error(startBody.error || "Audit failed");
      setCurrentJobId(startBody.id);
      setJobStatus(startBody.status);
      setCurrentJobStartedAt(Date.now());

      while (true) {
        const pollResponse = await fetch(`/api/audit-jobs/${startBody.id}`);
        const pollBody = await pollResponse.json();
        if (!pollResponse.ok) throw new Error(pollBody.error || "Audit failed");
        setJobStatus(pollBody.status);

        const progressLabel =
          pollBody.status === "paused"
            ? t.progressPaused
            : pollBody.status === "stopped"
              ? t.progressStopped
              : pollBody.progress?.stage === "fetching"
            ? t.progressFetching
            : pollBody.progress?.stage === "inspecting"
              ? t.progressInspecting
              : pollBody.progress?.stage === "finalizing"
                ? t.progressFinalizing
                : t.progressPreparing;
        const metaParts = [];
        if (pollBody.progress?.discoveredSitemaps) {
          metaParts.push(`${pollBody.progress.processedSitemaps || 0}/${pollBody.progress.discoveredSitemaps} sitemap`);
        }
        if (pollBody.progress?.totalUrls) {
          metaParts.push(`${pollBody.progress.processedUrls || 0}/${pollBody.progress.totalUrls} URLs`);
        }
        setProgress({
          label: progressLabel,
          value: pollBody.progress?.percent || 0,
          meta: metaParts.join(" | "),
        });

        if (pollBody.status === "done") {
          setProgress({ label: t.progressFinalizing, value: 100, meta: metaParts.join(" | ") });
          setReport(pollBody.result);
          const nextHistory = [
            toHistoryEntry(pollBody.result),
            ...history.filter((item) => item.input?.originalUrl !== pollBody.result.input?.originalUrl),
          ].slice(0, historyLimit);
          setHistory(nextHistory);
          saveHistory(nextHistory);
          setComparisonEntry(null);
          break;
        }
        if (pollBody.status === "stopped") {
          setProgress({ label: t.progressStopped, value: pollBody.progress?.percent || 0, meta: metaParts.join(" | ") });
          break;
        }
        if (pollBody.status === "error") {
          throw new Error(pollBody.error || "Audit failed");
        }

        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      window.setTimeout(() => {
        setLoading(false);
        setProgress(null);
        setCurrentJobId(null);
        setJobStatus(null);
        setCurrentJobStartedAt(null);
        setElapsedNow(0);
      }, 250);
    }
  }

  return (
    <main>
      <header className="top">
        <div>
          <span className="mark">soos</span>
          <h1>{t.heading}</h1>
        </div>
        <div className="top-actions">
          <p>{t.subheading}</p>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="zh-CN">{"\u7b80\u4f53\u4e2d\u6587"}</option>
            <option value="zh-TW">{"\u7e41\u9ad4\u4e2d\u6587"}</option>
          </select>
        </div>
      </header>

      <form className="searchbar" onSubmit={runAudit}>
        <Search size={20} />
        <input
          type="url"
          required
          placeholder={t.placeholder}
          value={sitemapUrl}
          onChange={(event) => setSitemapUrl(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
          {t.audit}
        </button>
      </form>

      <ProgressBar progress={progress} />
      <RuntimePanel
        loading={loading}
        jobStatus={jobStatus}
        progress={progress}
        runtimeMeta={{ startedAt: currentJobStartedAt, elapsedMs: elapsedNow, stageElapsedMs: progress?.stageStartedAt ? Date.now() - progress.stageStartedAt : elapsedNow, pauseCount }}
        t={t}
      />
      <ProgressControls
        loading={loading}
        jobStatus={jobStatus}
        onPause={() => controlJob("pause").catch((err) => setError(err.message || String(err)))}
        onResume={() => controlJob("resume").catch((err) => setError(err.message || String(err)))}
        onStop={() => controlJob("stop").catch((err) => setError(err.message || String(err)))}
        t={t}
      />

      <label className="option-toggle">
        <input type="checkbox" checked={contentChecks} onChange={(event) => setContentChecks(event.target.checked)} />
        <span>
          <strong>{t.pageChecksTitle}</strong>
          <small>{t.pageChecksHelp}</small>
        </span>
      </label>

      <label className="option-toggle">
        <input type="checkbox" checked={performanceChecks} onChange={(event) => setPerformanceChecks(event.target.checked)} />
        <span>
          <strong>{t.performanceChecksTitle || "Performance checks"}</strong>
          <small>{t.performanceChecksHelp || "TTFB, HTML size, scripts, stylesheets, images, and lightweight CWV readiness signals"}</small>
        </span>
      </label>

      <label className="option-toggle">
        <input type="checkbox" checked={backgroundMode} onChange={(event) => setBackgroundMode(event.target.checked)} />
        <span>
          <strong>{t.backgroundModeTitle || "Background worker mode"}</strong>
          <small>{t.backgroundModeHelp || "Raise the scan limit to 2000 URLs and keep the job available longer"}</small>
        </span>
      </label>

      <label className="option-toggle">
        <input type="checkbox" checked={directoryRobots} onChange={(event) => setDirectoryRobots(event.target.checked)} />
        <span>
          <strong>{t.directoryRobotsTitle}</strong>
          <small>{t.directoryRobotsHelp}</small>
        </span>
      </label>
      <SearchConsoleApiConfig status={gscStatus} onStatus={setGscStatus} siteUrl={gscSiteUrl} onSiteUrlChange={setGscSiteUrl} language={language} />
      <SearchAnalyticsPanel status={gscStatus} siteUrl={gscSiteUrl} onRows={setGscRows} />
      <SearchConsoleImport rows={gscRows} onImport={setGscRows} onClear={() => setGscRows([])} />


      <HistoryPanel
        history={history}
        currentReport={report}
        historyLimit={historyLimit}
        t={t}
        onRerun={(entry) => {
          setSitemapUrl(entry.input?.originalUrl || entry.input?.sitemapUrl || "");
          setComparisonEntry(null);
        }}
        onCompare={(entry) => setComparisonEntry(entry)}
        onDelete={(id) => {
          const nextHistory = history.filter((entry) => entry.id !== id);
          setHistory(nextHistory);
          saveHistory(nextHistory);
          if (comparisonEntry?.id === id) {
            setComparisonEntry(null);
          }
        }}
        onClear={() => {
          setHistory([]);
          saveHistory([]);
          setComparisonEntry(null);
        }}
        onLimitChange={(limit) => {
          setHistoryLimit(limit);
          saveHistoryLimit(limit);
          const nextHistory = history.slice(0, limit);
          setHistory(nextHistory);
          saveHistory(nextHistory);
          if (comparisonEntry && !nextHistory.some((entry) => entry.id === comparisonEntry.id)) {
            setComparisonEntry(null);
          }
        }}
      />

      <ComparisonPanel comparisonEntry={comparisonEntry} report={report} t={t} />

      {error ? <div className="error">{error}</div> : null}
      <Report report={report} t={t} gscRows={gscRows} gscStatus={gscStatus} gscSiteUrl={gscSiteUrl} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

