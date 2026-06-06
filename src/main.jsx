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
    copyBlockedUrls: "Copy blocked URLs",
    copiedBlockedUrls: "Copied",
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
    progressInterrupted: "Worker interrupted, restarting audit",
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
    copyBlockedUrls: "复制被阻挡网址",
    copiedBlockedUrls: "已复制",
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
    progressInterrupted: "\u540e\u53f0 worker \u5df2\u4e2d\u65ad\uff0c\u6b63\u5728\u91cd\u65b0\u6267\u884c\u68c0\u67e5",
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
    copyBlockedUrls: "複製被阻擋網址",
    copiedBlockedUrls: "已複製",
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
    progressInterrupted: "\u80cc\u666f worker \u5df2\u4e2d\u65b7\uff0c\u6b63\u5728\u91cd\u65b0\u57f7\u884c\u6aa2\u67e5",
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
  const [copiedRule, setCopiedRule] = useState("");
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
                {item.affectedUrls?.length ? (
                  <button
                    className="impact-filter"
                    type="button"
                    onClick={async () => {
                      const key = `${item.scope}-${item.rule}`;
                      await navigator.clipboard.writeText(item.affectedUrls.join("\n"));
                      setCopiedRule(key);
                      window.setTimeout(() => setCopiedRule((current) => (current === key ? "" : current)), 1600);
                    }}
                  >
                    {copiedRule === `${item.scope}-${item.rule}` ? t.copiedBlockedUrls : t.copyBlockedUrls}
                  </button>
                ) : null}
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
    oauthHelpTitle: "How to connect Google Search Console",
    oauthHelpSteps: [
      "Click Connect Google Search Console.",
      "Choose the Google account that has access to the Search Console property.",
      "If Google shows “This app isn’t verified”, open the advanced option and continue to soos.",
      "On the Sign in to soos screen, click Continue.",
      "Under what soos can access, select “View Search Console data for your verified sites”, then click Continue.",
    ],
    docsLabel: "Search Console users and permissions",
    connect: "Connect Google Search Console",
    apiTitle: "Search Console API",
    connected: "OAuth connected",
    tokenExpired: "Token likely expired",
    tokenSaved: "Token saved",
    noToken: "No token saved",
    notConfigured: "not configured",
    connectedRefreshed: "OAuth connected. Search Console status refreshed.",
    oauthRefreshed: "OAuth status refreshed. Automatic token refresh is ready.",
    statusRefreshed: "Status refreshed.",
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
    privacyNote: "Your Search Console connection is isolated to this browser session. Disconnect removes the stored connection and attempts to revoke Google access.",
  },
  "zh-CN": {
    propertyUrl: "Property URL",
    propertyHelp: "URL-prefix 属性必须和 Search Console 完全一致；Domain 属性使用 sc-domain:example.com。",
    oauthHelpTitle: "Search Console 连接步骤",
    oauthHelpSteps: [
      "点击“连接 Google Search Console”。",
      "选择拥有该 Search Console property 权限的 Google 账号。",
      "如果显示“此应用未经 Google 验证”，请打开高级选项并继续前往 soos。",
      "在“登录 soos”页面点击“继续”。",
      "在“选择 soos 可访问哪些服务”中，选中“查看您的已验证网站的 Search Console 数据”，然后点击“继续”。",
    ],
    docsLabel: "Search Console 用户和权限说明",
    connect: "连接 Google Search Console",
    apiTitle: "Search Console API",
    connected: "OAuth 已连接",
    tokenExpired: "Token 可能已过期",
    tokenSaved: "Token 已保存",
    noToken: "尚未保存 token",
    notConfigured: "未配置",
    connectedRefreshed: "OAuth 已连接，Search Console 状态已刷新。",
    oauthRefreshed: "OAuth 状态已刷新，可自动更新 access token。",
    statusRefreshed: "状态已刷新。",
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
    privacyNote: "Search Console 授权仅用于当前浏览器会话。断开连接会删除已保存的连接，并尝试撤销 Google 授权。",
  },
  "zh-TW": {
    propertyUrl: "Property URL",
    propertyHelp: "URL-prefix 資源必須和 Search Console 完全一致；Domain 資源使用 sc-domain:example.com。",
    oauthHelpTitle: "Search Console 連線步驟",
    oauthHelpSteps: [
      "點擊「連接 Google Search Console」。",
      "選擇擁有該 Search Console property 權限的 Google 帳號。",
      "如果顯示「此應用程式未經 Google 驗證」，請開啟進階選項並繼續前往 soos。",
      "在「登入 soos」頁面點擊「繼續」。",
      "在「選擇 soos 可存取哪些服務」中，選取「查看已驗證網站的 Search Console 資料」，然後點擊「繼續」。",
    ],
    docsLabel: "Search Console 使用者和權限說明",
    connect: "連接 Google Search Console",
    apiTitle: "Search Console API",
    connected: "OAuth 已連接",
    tokenExpired: "Token 可能已過期",
    tokenSaved: "Token 已儲存",
    noToken: "尚未儲存 token",
    notConfigured: "未設定",
    connectedRefreshed: "OAuth 已連接，Search Console 狀態已重新整理。",
    oauthRefreshed: "OAuth 狀態已重新整理，可自動更新 access token。",
    statusRefreshed: "狀態已重新整理。",
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
    privacyNote: "Search Console 授權僅用於目前瀏覽器工作階段。中斷連線會刪除已儲存的連線，並嘗試撤銷 Google 授權。",
  },
};

function SearchConsoleApiConfig({ status, onStatus, siteUrl, onSiteUrlChange, language }) {
  const copy = gscUiText[language] || gscUiText.en;
  const [showOauthHelp, setShowOauthHelp] = useState(true);
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
    function handleStorage(event) {
      if (event.key !== "soos:gsc-oauth-connected" || !event.newValue) return;
      refreshStatus("oauth-connected");
    }
    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const tokenState = status?.refreshToken
    ? copy.connected
    : status?.token
      ? status.tokenLikelyExpired
      ? copy.tokenExpired
      : copy.tokenSaved
      : copy.noToken;
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
      setMessage(reason === "oauth-connected" ? copy.connectedRefreshed : body.refreshToken ? copy.oauthRefreshed : copy.statusRefreshed);
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
    let popupPoll = null;
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
        popupPoll = window.setInterval(() => {
          if (!oauthWindow.closed) return;
          window.clearInterval(popupPoll);
          popupPoll = null;
          refreshStatus("oauth-closed");
        }, 600);
      } else {
        window.location.href = body.authUrl;
      }
    } catch (err) {
      if (popupPoll) window.clearInterval(popupPoll);
      oauthWindow?.close();
      setError(err.message || String(err));
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <section className="panel gsc-api-config">
      <div className="panel-head">
        <h2>{copy.apiTitle}</h2>
        <span>{status?.configured ? tokenState : copy.notConfigured}</span>
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
          <small>{copy.privacyNote}</small>
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

const gscDataText = {
  en: {
    analyticsTitle: "Search Analytics API", ready: "ready", configureFirst: "configure GSC first",
    startDate: "Start date", endDate: "End date", dimension: "Dimension", page: "Page", query: "Query",
    pageQuery: "Page + Query", country: "Country", device: "Device", load: "Load Search Analytics",
    loading: "Loading...", export: "Export keyword opportunities", rowsLoaded: "rows loaded", clicks: "clicks",
    impressions: "impressions", analyticsHelp: "Loads clicks, impressions, CTR, and average position for GSC opportunity analysis.",
    pageOnly: "Only Page rows update GSC opportunities. Other dimensions are shown below for exploration.",
    noOpportunities: "No high-confidence Page + Query opportunities found with the current thresholds.",
    position: "Position", connectFirst: "Connect Google Search Console first, then load Search Analytics.",
    propertyFirst: "Enter the Search Console Property URL before loading Search Analytics.",
    inspectionTitle: "URL Inspection", inspectStatus: "Inspect real Google index status",
    inspectionHelp: "Checks up to 25 scanned sitemap URLs with the connected Search Console property.",
    inspect: "Inspect URLs", inspectNext: "Inspect next 25", inspectionComplete: "All scanned URLs inspected",
    remaining: "remaining", inspecting: "Inspecting...", inspected: "Inspected", review: "Needs review",
    critical: "critical", warnings: "warnings", notices: "notices", noCoverage: "No coverage state",
    indexing: "Indexing", robots: "Robots", fetch: "Fetch", crawledAs: "Crawled as", lastCrawl: "Last crawl",
    sitemap: "Seen in sitemap", referrers: "Referrers", googleCanonical: "Google canonical",
    userCanonical: "User canonical", mobile: "Mobile", richResults: "Rich results",
    alignmentTitle: "Google URL alignment", alignmentHelp: "Compares the sitemap URL, fetched URL, HTML canonical and Google's selected canonical.",
    alignmentAll: "All states", submittedUrl: "Submitted URL", fetchedUrl: "Fetched URL", htmlCanonical: "HTML canonical",
    alignmentState: "Diagnosis", alignedIndexed: "Aligned and indexed", alignedNotIndexed: "Aligned but not indexed",
    submittedRedirects: "Submitted URL redirects", htmlCanonicalDiffers: "HTML canonical differs",
    googleCanonicalDiffers: "Google selected another canonical", crawlBlocked: "Crawl or indexing blocker",
    inspectionFailed: "Inspection failed", unknownAlignment: "Needs review", exportAlignment: "Export URL alignment",
    coverageTitle: "Index coverage priorities", coverageHelp: "Groups Google indexing outcomes and prioritizes fixable URLs with Search Analytics demand.",
    coverageExport: "Export coverage diagnosis", needsFix: "Needs fix", expectedExclusion: "Expected exclusion", indexedState: "Indexed",
    priorityHigh: "High priority", priorityMedium: "Medium priority", priorityLow: "Low priority",
    affectedUrls: "URLs", staleCrawl: "Stale crawl", noPerformanceData: "No page performance data",
    reasonDiscovered: "Discovered, not crawled", reasonCrawled: "Crawled, not indexed", reasonDuplicate: "Duplicate or alternate",
    reasonCanonical: "Canonical conflict", reasonBlocked: "Blocked from indexing", reasonSoft404: "Soft 404",
    reasonFetch: "Fetch or server problem", reasonOther: "Other indexing reason",
    freshnessTitle: "Important page crawl freshness", freshnessHelp: "Shows indexed pages with Search Analytics demand and how long ago Google last crawled them.",
    freshnessExport: "Export crawl freshness", freshnessSortRisk: "Sort by risk", freshnessSortDemand: "Sort by demand",
    freshnessSortAge: "Sort by crawl age", freshnessFresh: "Recently crawled", freshnessWatch: "Watch",
    freshnessStale: "Stale", freshnessCritical: "Very stale", freshnessUnknown: "Unknown crawl time",
    demandHigh: "High demand", demandMedium: "Medium demand", demandLow: "Low demand",
    crawlAge: "Crawl age", days: "days", indexedWithDemand: "Indexed pages with demand",
    urlSetsTitle: "URL set comparison", urlSetsHelp: "Compares sitemap URLs with links found on scanned pages, Search Analytics pages, and Google discovery signals.",
    urlSetsExport: "Export URL set diagnosis", urlSetsAll: "All findings", urlSetsFindings: "findings",
    urlSetsPartial: "Internal-link results only cover pages completed in this audit.",
    internalMissingSitemap: "Internal URL missing from sitemap", gscMissingSitemap: "GSC page missing from sitemap",
    sitemapOrphan: "Sitemap page with no scanned inbound links", googleMissingSitemap: "Google reports no sitemap source",
    googleMissingReferrer: "Google reports no referring URL", urlVariant: "Conflicting URL variants",
    sourceInternal: "Internal links", sourceGsc: "Search Analytics", sourceSitemap: "Sitemap",
    sourceGoogle: "Google Inspection", sourceVariants: "Multiple sources", inboundLinks: "scanned inbound links",
    structuredTitle: "Structured data diagnosis", structuredHelp: "Combines local JSON-LD graph validation with Google rich results findings.",
    structuredExport: "Export structured data diagnosis", structuredAll: "All marked-up pages",
    structuredErrors: "Required or graph errors", structuredRecommendations: "Recommended improvements",
    structuredGoogle: "Google rich result issues", structuredNodes: "nodes", structuredTypes: "Types",
    structuredLocalIssues: "Local issues", structuredGoogleVerdict: "Google verdict", structuredNoIssues: "No detected issues",
    structuredCoverage: "Rule coverage", structuredValidated: "Google-specific validation", structuredParsedOnly: "Parsed only",
    noIssue: "No immediate index issue", noIssueDetail: "Google reports this URL as passing URL Inspection checks.",
    noIssueAction: "Keep monitoring performance data and canonical consistency.",
    inspectPropertyFirst: "Enter the Search Console Property URL before running URL Inspection.",
  },
  "zh-CN": {
    analyticsTitle: "Search Analytics API", ready: "已就绪", configureFirst: "请先连接 GSC",
    startDate: "开始日期", endDate: "结束日期", dimension: "维度", page: "网页", query: "查询词",
    pageQuery: "网页 + 查询词", country: "国家/地区", device: "设备", load: "加载 Search Analytics",
    loading: "加载中...", export: "导出关键词机会", rowsLoaded: "行已加载", clicks: "点击", impressions: "展示",
    analyticsHelp: "加载点击、展示、CTR 和平均排名，用于 GSC 机会分析。",
    pageOnly: "只有“网页”维度会更新 GSC 机会；其他维度仅在下方用于分析。",
    noOpportunities: "按当前阈值未发现高置信度的“网页 + 查询词”机会。",
    position: "排名", connectFirst: "请先连接 Google Search Console，再加载 Search Analytics。",
    propertyFirst: "加载 Search Analytics 前，请先输入 Search Console Property URL。",
    inspectionTitle: "网址检查", inspectStatus: "检查 Google 中的真实收录状态",
    inspectionHelp: "使用已连接的 Search Console property 检查最多 25 个 sitemap 网址。",
    inspect: "检查网址", inspectNext: "检查接下来 25 个", inspectionComplete: "已检查全部扫描网址",
    remaining: "个待检查", inspecting: "检查中...", inspected: "已检查", review: "需要处理",
    critical: "严重", warnings: "警告", notices: "提示", noCoverage: "没有覆盖状态",
    indexing: "索引", robots: "Robots", fetch: "抓取", crawledAs: "抓取类型", lastCrawl: "最后抓取",
    sitemap: "所在 sitemap", referrers: "来源网址", googleCanonical: "Google 规范网址",
    userCanonical: "用户规范网址", mobile: "移动端", richResults: "富媒体结果",
    alignmentTitle: "Google 网址对照诊断", alignmentHelp: "对照 sitemap 提交网址、实际抓取网址、HTML canonical 与 Google 选择的 canonical。",
    alignmentAll: "全部状态", submittedUrl: "Sitemap 提交网址", fetchedUrl: "实际抓取网址", htmlCanonical: "HTML canonical",
    alignmentState: "诊断", alignedIndexed: "信号一致且已收录", alignedNotIndexed: "信号一致但未收录",
    submittedRedirects: "提交网址发生跳转", htmlCanonicalDiffers: "HTML canonical 不一致",
    googleCanonicalDiffers: "Google 选择了其它 canonical", crawlBlocked: "存在抓取或索引阻挡",
    inspectionFailed: "网址检查失败", unknownAlignment: "需要检查", exportAlignment: "导出网址对照",
    coverageTitle: "收录覆盖优先级", coverageHelp: "按 Google 收录原因分组，并结合 Search Analytics 需求确定修复优先级。",
    coverageExport: "导出收录诊断", needsFix: "需要修复", expectedExclusion: "合理排除", indexedState: "已收录",
    priorityHigh: "高优先级", priorityMedium: "中优先级", priorityLow: "低优先级",
    affectedUrls: "网址", staleCrawl: "长期未抓取", noPerformanceData: "没有网页表现数据",
    reasonDiscovered: "已发现但尚未抓取", reasonCrawled: "已抓取但尚未收录", reasonDuplicate: "重复页或替代页",
    reasonCanonical: "Canonical 冲突", reasonBlocked: "被阻止收录", reasonSoft404: "软 404",
    reasonFetch: "抓取或服务器问题", reasonOther: "其它收录原因",
    freshnessTitle: "重要页面抓取时效", freshnessHelp: "显示已有 Search Analytics 需求的已收录页面，以及 Google 距离上次抓取的时间。",
    freshnessExport: "导出抓取时效", freshnessSortRisk: "按风险排序", freshnessSortDemand: "按需求排序",
    freshnessSortAge: "按抓取时间排序", freshnessFresh: "近期已抓取", freshnessWatch: "需要关注",
    freshnessStale: "长期未抓取", freshnessCritical: "严重过期", freshnessUnknown: "抓取时间未知",
    demandHigh: "高搜索需求", demandMedium: "中搜索需求", demandLow: "低搜索需求",
    crawlAge: "距上次抓取", days: "天", indexedWithDemand: "有搜索需求的已收录页面",
    urlSetsTitle: "网址集合对比", urlSetsHelp: "对比 sitemap、已扫描页面发现的站内链接、Search Analytics 页面和 Google 发现信号。",
    urlSetsExport: "导出网址集合诊断", urlSetsAll: "全部问题", urlSetsFindings: "项问题",
    urlSetsPartial: "站内链接结果仅覆盖本次检查中已完成扫描的页面。",
    internalMissingSitemap: "站内发现网址未进入 sitemap", gscMissingSitemap: "GSC 网页未进入 sitemap",
    sitemapOrphan: "Sitemap 页面没有已扫描入链", googleMissingSitemap: "Google 未报告 sitemap 来源",
    googleMissingReferrer: "Google 未报告来源网址", urlVariant: "存在冲突的网址变体",
    sourceInternal: "站内链接", sourceGsc: "Search Analytics", sourceSitemap: "Sitemap",
    sourceGoogle: "Google 网址检查", sourceVariants: "多个来源", inboundLinks: "条已扫描入链",
    structuredTitle: "结构化数据诊断", structuredHelp: "合并本地 JSON-LD graph 验证与 Google 富媒体结果问题。",
    structuredExport: "导出结构化数据诊断", structuredAll: "全部标记页面",
    structuredErrors: "必填字段或 graph 错误", structuredRecommendations: "建议完善项",
    structuredGoogle: "Google 富媒体结果问题", structuredNodes: "个节点", structuredTypes: "类型",
    structuredLocalIssues: "本地问题", structuredGoogleVerdict: "Google 结果", structuredNoIssues: "未发现问题",
    structuredCoverage: "规则覆盖", structuredValidated: "已按 Google 规则验证", structuredParsedOnly: "仅解析，未配置专属规则",
    noIssue: "没有明显索引问题", noIssueDetail: "Google 报告该网址通过了网址检查。",
    noIssueAction: "继续监控表现数据和 canonical 一致性。",
    inspectPropertyFirst: "运行网址检查前，请先输入 Search Console Property URL。",
  },
  "zh-TW": {
    analyticsTitle: "Search Analytics API", ready: "已就緒", configureFirst: "請先連接 GSC",
    startDate: "開始日期", endDate: "結束日期", dimension: "維度", page: "網頁", query: "查詢字詞",
    pageQuery: "網頁 + 查詢字詞", country: "國家/地區", device: "裝置", load: "載入 Search Analytics",
    loading: "載入中...", export: "匯出關鍵字機會", rowsLoaded: "列已載入", clicks: "點擊", impressions: "曝光",
    analyticsHelp: "載入點擊、曝光、CTR 和平均排名，用於 GSC 機會分析。",
    pageOnly: "只有「網頁」維度會更新 GSC 機會；其他維度僅在下方用於分析。",
    noOpportunities: "依目前門檻未發現高可信度的「網頁 + 查詢字詞」機會。",
    position: "排名", connectFirst: "請先連接 Google Search Console，再載入 Search Analytics。",
    propertyFirst: "載入 Search Analytics 前，請先輸入 Search Console Property URL。",
    inspectionTitle: "網址檢查", inspectStatus: "檢查 Google 中的真實收錄狀態",
    inspectionHelp: "使用已連接的 Search Console property 檢查最多 25 個 sitemap 網址。",
    inspect: "檢查網址", inspectNext: "檢查接下來 25 個", inspectionComplete: "已檢查全部掃描網址",
    remaining: "個待檢查", inspecting: "檢查中...", inspected: "已檢查", review: "需要處理",
    critical: "嚴重", warnings: "警告", notices: "提示", noCoverage: "沒有涵蓋狀態",
    indexing: "索引", robots: "Robots", fetch: "擷取", crawledAs: "檢索類型", lastCrawl: "最後檢索",
    sitemap: "所在 sitemap", referrers: "來源網址", googleCanonical: "Google 標準網址",
    userCanonical: "使用者標準網址", mobile: "行動裝置", richResults: "複合式搜尋結果",
    alignmentTitle: "Google 網址對照診斷", alignmentHelp: "對照 sitemap 提交網址、實際檢索網址、HTML canonical 與 Google 選擇的 canonical。",
    alignmentAll: "全部狀態", submittedUrl: "Sitemap 提交網址", fetchedUrl: "實際檢索網址", htmlCanonical: "HTML canonical",
    alignmentState: "診斷", alignedIndexed: "訊號一致且已收錄", alignedNotIndexed: "訊號一致但未收錄",
    submittedRedirects: "提交網址發生重新導向", htmlCanonicalDiffers: "HTML canonical 不一致",
    googleCanonicalDiffers: "Google 選擇了其它 canonical", crawlBlocked: "存在檢索或索引阻擋",
    inspectionFailed: "網址檢查失敗", unknownAlignment: "需要檢查", exportAlignment: "匯出網址對照",
    coverageTitle: "收錄涵蓋優先級", coverageHelp: "依 Google 收錄原因分組，並結合 Search Analytics 需求決定修復優先級。",
    coverageExport: "匯出收錄診斷", needsFix: "需要修復", expectedExclusion: "合理排除", indexedState: "已收錄",
    priorityHigh: "高優先級", priorityMedium: "中優先級", priorityLow: "低優先級",
    affectedUrls: "網址", staleCrawl: "長期未檢索", noPerformanceData: "沒有網頁成效資料",
    reasonDiscovered: "已發現但尚未檢索", reasonCrawled: "已檢索但尚未收錄", reasonDuplicate: "重複頁或替代頁",
    reasonCanonical: "Canonical 衝突", reasonBlocked: "被阻止收錄", reasonSoft404: "軟 404",
    reasonFetch: "檢索或伺服器問題", reasonOther: "其它收錄原因",
    freshnessTitle: "重要頁面檢索時效", freshnessHelp: "顯示已有 Search Analytics 需求的已收錄頁面，以及 Google 距離上次檢索的時間。",
    freshnessExport: "匯出檢索時效", freshnessSortRisk: "依風險排序", freshnessSortDemand: "依需求排序",
    freshnessSortAge: "依檢索時間排序", freshnessFresh: "近期已檢索", freshnessWatch: "需要關注",
    freshnessStale: "長期未檢索", freshnessCritical: "嚴重過期", freshnessUnknown: "檢索時間未知",
    demandHigh: "高搜尋需求", demandMedium: "中搜尋需求", demandLow: "低搜尋需求",
    crawlAge: "距上次檢索", days: "天", indexedWithDemand: "有搜尋需求的已收錄頁面",
    urlSetsTitle: "網址集合對比", urlSetsHelp: "對比 sitemap、已掃描頁面發現的站內連結、Search Analytics 頁面和 Google 發現訊號。",
    urlSetsExport: "匯出網址集合診斷", urlSetsAll: "全部問題", urlSetsFindings: "項問題",
    urlSetsPartial: "站內連結結果僅涵蓋本次檢查中已完成掃描的頁面。",
    internalMissingSitemap: "站內發現網址未進入 sitemap", gscMissingSitemap: "GSC 網頁未進入 sitemap",
    sitemapOrphan: "Sitemap 頁面沒有已掃描入鏈", googleMissingSitemap: "Google 未回報 sitemap 來源",
    googleMissingReferrer: "Google 未回報來源網址", urlVariant: "存在衝突的網址變體",
    sourceInternal: "站內連結", sourceGsc: "Search Analytics", sourceSitemap: "Sitemap",
    sourceGoogle: "Google 網址檢查", sourceVariants: "多個來源", inboundLinks: "條已掃描入鏈",
    structuredTitle: "結構化資料診斷", structuredHelp: "合併本地 JSON-LD graph 驗證與 Google 複合式搜尋結果問題。",
    structuredExport: "匯出結構化資料診斷", structuredAll: "全部標記頁面",
    structuredErrors: "必填欄位或 graph 錯誤", structuredRecommendations: "建議完善項",
    structuredGoogle: "Google 複合式搜尋結果問題", structuredNodes: "個節點", structuredTypes: "類型",
    structuredLocalIssues: "本地問題", structuredGoogleVerdict: "Google 結果", structuredNoIssues: "未發現問題",
    structuredCoverage: "規則涵蓋", structuredValidated: "已依 Google 規則驗證", structuredParsedOnly: "僅解析，未設定專屬規則",
    noIssue: "沒有明顯索引問題", noIssueDetail: "Google 回報該網址通過網址檢查。",
    noIssueAction: "繼續監控成效資料和 canonical 一致性。",
    inspectPropertyFirst: "執行網址檢查前，請先輸入 Search Console Property URL。",
  },
};

const inspectionDiagnosisText = {
  "zh-CN": {
    inspection_error: ["检查请求失败", "检查 API 连接、property 权限，并确认该网址属于已配置的 property。"],
    not_indexed: ["Google 尚未收录", "检查可抓取性、canonical、内容质量、内部链接和 sitemap 收录情况。"],
    discovered_not_crawled: ["已发现但尚未抓取", "加强内部链接和抓取预算信号，保留在 sitemap 中，并确保服务器响应快速。"],
    duplicate_or_alternate: ["Google 将其视为重复或替代页面", "确认 canonical 目标是否正确；若该网址需要排名，请统一 canonical、sitemap 和内部链接信号。"],
    soft_404: ["检测到软 404", "补充有价值的实质内容；如果页面不应存在，请返回真正的 404 或 410。"],
    robots_blocked: ["被 robots.txt 阻挡", "如果页面应被收录，请删除对应的 robots.txt 阻挡规则。"],
    fetch_problem: ["Google 抓取存在问题", "检查服务器可用性、跳转、状态码、防火墙和渲染稳定性。"],
    canonical_mismatch: ["Google 选择了不同的 canonical", "围绕首选 canonical 统一标签、内部链接、跳转和 sitemap URL。"],
    not_seen_in_sitemap: ["Google 未报告 sitemap 来源", "将规范网址保留在已提交的 sitemap，并确保 robots.txt 可发现 sitemap。"],
    no_referrers: ["未报告来源网址", "从相关且已收录的页面增加内部链接，帮助 Google 发现并优先抓取。"],
    mobile_usability: ["移动端可用性问题", "在 Search Console 中查看移动端问题，并修复布局、点击目标和 viewport。"],
    rich_results: ["富媒体结果需要检查", "使用 Google 富媒体结果工具验证结构化数据，并修复无效项目。"],
    indexing_state: ["索引状态需要检查", "结合 meta robots、canonical 和抓取诊断分析该状态。"],
  },
  "zh-TW": {
    inspection_error: ["檢查請求失敗", "檢查 API 連線、property 權限，並確認該網址屬於已設定的 property。"],
    not_indexed: ["Google 尚未收錄", "檢查可檢索性、canonical、內容品質、內部連結和 sitemap 收錄情況。"],
    discovered_not_crawled: ["已發現但尚未檢索", "加強內部連結和檢索預算訊號，保留在 sitemap 中，並確保伺服器快速回應。"],
    duplicate_or_alternate: ["Google 將其視為重複或替代頁面", "確認 canonical 目標是否正確；若該網址需要排名，請統一 canonical、sitemap 和內部連結訊號。"],
    soft_404: ["偵測到軟 404", "補充有價值的實質內容；如果頁面不應存在，請回傳真正的 404 或 410。"],
    robots_blocked: ["被 robots.txt 阻擋", "如果頁面應被收錄，請移除對應的 robots.txt 阻擋規則。"],
    fetch_problem: ["Google 擷取存在問題", "檢查伺服器可用性、重新導向、狀態碼、防火牆和轉譯穩定性。"],
    canonical_mismatch: ["Google 選擇了不同的 canonical", "圍繞首選 canonical 統一標籤、內部連結、重新導向和 sitemap URL。"],
    not_seen_in_sitemap: ["Google 未回報 sitemap 來源", "將標準網址保留在已提交的 sitemap，並確保 robots.txt 可發現 sitemap。"],
    no_referrers: ["未回報來源網址", "從相關且已收錄的頁面增加內部連結，協助 Google 發現並優先檢索。"],
    mobile_usability: ["行動裝置可用性問題", "在 Search Console 中查看行動裝置問題，並修正版面、點擊目標和 viewport。"],
    rich_results: ["複合式搜尋結果需要檢查", "使用 Google 複合式搜尋結果工具驗證結構化資料，並修正無效項目。"],
    indexing_state: ["索引狀態需要檢查", "結合 meta robots、canonical 和檢索診斷分析該狀態。"],
  },
};

const structuredDiagnosticText = {
  en: {
    json_syntax: "Invalid JSON syntax", missing_context: "Missing @context", unresolved_reference: "Broken graph reference",
    missing_required: "Missing required field", missing_required_any: "Missing required alternative",
    missing_recommended: "Recommended field missing", invalid_breadcrumb: "Invalid breadcrumb list",
    invalid_url: "Invalid URL", page_url_mismatch: "Page URL mismatch", name_mismatch: "Name and title differ",
    name_not_visible: "Name not found in visible text", image_not_visible: "Image not found in page signals",
    invalid_value: "Invalid value", invalid_length: "Invalid text length", invalid_count: "Invalid item count",
    duplicate_value: "Duplicate value", non_sequential: "Non-sequential positions", invalid_date: "Invalid date",
    invalid_number: "Invalid number", type_not_validated: "No type-specific Google rule", insufficient_images: "Too few images",
  },
  "zh-CN": {
    json_syntax: "JSON 语法无效", missing_context: "缺少 @context", unresolved_reference: "Graph 引用断裂",
    missing_required: "缺少必填字段", missing_required_any: "缺少必填的备选字段",
    missing_recommended: "缺少建议字段", invalid_breadcrumb: "面包屑列表无效",
    invalid_url: "网址无效", page_url_mismatch: "结构化网址与页面不一致", name_mismatch: "名称与页面标题不一致",
    name_not_visible: "名称未出现在可见内容", image_not_visible: "图片未出现在页面信号中",
    invalid_value: "字段值无效", invalid_length: "文本长度无效", invalid_count: "项目数量无效",
    duplicate_value: "存在重复值", non_sequential: "顺序编号不连续", invalid_date: "日期格式无效",
    invalid_number: "数字格式无效", type_not_validated: "尚无 Google 类型专属规则", insufficient_images: "图片数量偏少",
  },
  "zh-TW": {
    json_syntax: "JSON 語法無效", missing_context: "缺少 @context", unresolved_reference: "Graph 參照中斷",
    missing_required: "缺少必填欄位", missing_required_any: "缺少必填的替代欄位",
    missing_recommended: "缺少建議欄位", invalid_breadcrumb: "麵包屑清單無效",
    invalid_url: "網址無效", page_url_mismatch: "結構化網址與頁面不一致", name_mismatch: "名稱與頁面標題不一致",
    name_not_visible: "名稱未出現在可見內容", image_not_visible: "圖片未出現在頁面訊號中",
    invalid_value: "欄位值無效", invalid_length: "文字長度無效", invalid_count: "項目數量無效",
    duplicate_value: "存在重複值", non_sequential: "順序編號不連續", invalid_date: "日期格式無效",
    invalid_number: "數字格式無效", type_not_validated: "尚無 Google 類型專屬規則", insufficient_images: "圖片數量偏少",
  },
};

const gscSupportingText = {
  en: {
    csvTitle: "Search Console CSV", optional: "optional", rowsLoaded: "rows loaded",
    importTitle: "Import page performance", importHelp: "Use a Search Console Performance export by Pages. CSV, TSV, and semicolon-separated files are supported.",
    importButton: "Import CSV", clearButton: "Clear GSC data", reading: "Reading", imported: "rows imported",
    parsed: "rows parsed", importFailed: "import failed", cleared: "Imported CSV data cleared",
    noRows: "No page rows found. Export Search Console Performance by Pages with Page, Clicks, Impressions, CTR, and Position columns.",
    opportunities: "GSC opportunities", sampleUrls: "Sample URLs",
    indexableNoImpressions: ["Technically indexable, no GSC impressions", "These URLs look indexable in this audit but do not appear in the imported GSC performance rows."],
    lowRanking: ["Visible but ranking low", "These URLs have impressions but average position is worse than 20."],
    lowCtr: ["Visible but CTR is low", "These URLs have at least 100 impressions and less than 1% calculated CTR."],
    blockedVisibility: ["GSC visibility with technical blockers", "These URLs have GSC impressions but also have crawl, indexability, or canonical blockers in this audit."],
    missingSitemap: ["GSC pages missing from sitemap", "These URLs appear in GSC performance data but are not in the scanned sitemap set."],
  },
  "zh-CN": {
    csvTitle: "Search Console CSV", optional: "可选", rowsLoaded: "行已加载",
    importTitle: "导入网页表现", importHelp: "请使用 Search Console“效果”报告中的“网页”导出文件，支持 CSV、TSV 和分号分隔格式。",
    importButton: "导入 CSV", clearButton: "清除 GSC 数据", reading: "正在读取", imported: "行已导入",
    parsed: "行已解析", importFailed: "导入失败", cleared: "已清除导入的 CSV 数据",
    noRows: "未找到网页数据行。请从 Search Console“效果 > 网页”导出，并包含网页、点击、展示、CTR 和排名列。",
    opportunities: "GSC 优化机会", sampleUrls: "示例网址",
    indexableNoImpressions: ["技术上可收录，但没有 GSC 展示", "这些网址在本次检查中看起来可以收录，但未出现在导入的 GSC 表现数据中。"],
    lowRanking: ["已有展示但排名较低", "这些网址已有展示，但平均排名低于第 20 位。"],
    lowCtr: ["已有展示但点击率较低", "这些网址至少有 100 次展示，计算出的 CTR 低于 1%。"],
    blockedVisibility: ["已有 GSC 展示但存在技术阻挡", "这些网址已有 GSC 展示，同时存在抓取、索引或 canonical 阻挡。"],
    missingSitemap: ["GSC 网页未出现在 sitemap", "这些网址出现在 GSC 表现数据中，但不在本次扫描的 sitemap URL 集合内。"],
  },
  "zh-TW": {
    csvTitle: "Search Console CSV", optional: "選用", rowsLoaded: "列已載入",
    importTitle: "匯入網頁成效", importHelp: "請使用 Search Console「成效」報表中的「網頁」匯出檔，支援 CSV、TSV 和分號分隔格式。",
    importButton: "匯入 CSV", clearButton: "清除 GSC 資料", reading: "正在讀取", imported: "列已匯入",
    parsed: "列已解析", importFailed: "匯入失敗", cleared: "已清除匯入的 CSV 資料",
    noRows: "未找到網頁資料列。請從 Search Console「成效 > 網頁」匯出，並包含網頁、點擊、曝光、CTR 和排名欄位。",
    opportunities: "GSC 優化機會", sampleUrls: "範例網址",
    indexableNoImpressions: ["技術上可收錄，但沒有 GSC 曝光", "這些網址在本次檢查中看起來可以收錄，但未出現在匯入的 GSC 成效資料中。"],
    lowRanking: ["已有曝光但排名較低", "這些網址已有曝光，但平均排名低於第 20 位。"],
    lowCtr: ["已有曝光但點閱率較低", "這些網址至少有 100 次曝光，計算出的 CTR 低於 1%。"],
    blockedVisibility: ["已有 GSC 曝光但存在技術阻擋", "這些網址已有 GSC 曝光，同時存在檢索、索引或 canonical 阻擋。"],
    missingSitemap: ["GSC 網頁未出現在 sitemap", "這些網址出現在 GSC 成效資料中，但不在本次掃描的 sitemap URL 集合內。"],
  },
};

function buildSearchAnalyticsInsights(rows, dimension, language = "en") {
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : "en";
  const insightText = {
    "zh-CN": {
      low_ctr: ["高展示、低点击率", "重写标题和 meta description，使摘要更符合查询意图并提高点击吸引力。"],
      snippet_gap: ["排名靠前但几乎没有点击", "检查页面是否匹配查询意图，并改进标题、描述和首屏答案。"],
      striking_distance: ["接近首页顶部的排名机会", "加强回答该查询的内容段落，增加内部链接并提高摘要相关性。"],
      page_two: ["第二页排名机会", "扩展内容深度，从更强的相关页面增加内部链接，并对比首页结果的内容差距。"],
      intent_spread: ["页面覆盖多个查询意图", "围绕最强的搜索意图重新组织页面，并检查是否需要拆分内容。"],
    },
    "zh-TW": {
      low_ctr: ["高曝光、低點閱率", "重寫標題和 meta description，使摘要更符合查詢意圖並提高點擊吸引力。"],
      snippet_gap: ["排名靠前但幾乎沒有點擊", "檢查頁面是否符合查詢意圖，並改善標題、描述和首屏答案。"],
      striking_distance: ["接近首頁頂部的排名機會", "加強回答該查詢的內容段落，增加內部連結並提高摘要相關性。"],
      page_two: ["第二頁排名機會", "擴充內容深度，從更強的相關頁面增加內部連結，並比較首頁結果的內容差距。"],
      intent_spread: ["頁面涵蓋多個查詢意圖", "圍繞最強的搜尋意圖重新組織頁面，並檢查是否需要拆分內容。"],
    },
  };
  if (dimension !== "page_query") return [];
  const pageQueryRows = (rows || []).filter((row) => row.page && row.query);
  const insights = [];
  const seenInsightDetails = new Set();
  function addInsight(insight) {
    const key = insight.detail;
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
  return insights.slice(0, 12).map((insight) => {
    const localized = insightText[locale]?.[insight.type];
    return localized ? { ...insight, title: localized[0], action: localized[1] } : insight;
  });
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

function SearchAnalyticsPanel({ status, siteUrl, onRows, language }) {
  const copy = gscDataText[language] || gscDataText.en;
  const defaults = useMemo(() => defaultGscDateRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [dimension, setDimension] = useState("page");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const insights = useMemo(() => buildSearchAnalyticsInsights(rows, summary?.dimension || dimension, language), [dimension, language, rows, summary?.dimension]);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event.preventDefault();
    if (!status?.configured) {
      setError(copy.connectFirst);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.propertyFirst);
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
        <h2>{copy.analyticsTitle}</h2>
        <span>{status?.configured ? copy.ready : copy.configureFirst}</span>
      </div>
      <form className="search-analytics-body" onSubmit={loadAnalytics}>
        <div className="search-analytics-fields">
          <label>
            <strong>{copy.startDate}</strong>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.endDate}</strong>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <strong>{copy.dimension}</strong>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)}>
              <option value="page">{copy.page}</option>
              <option value="query">{copy.query}</option>
              <option value="page_query">{copy.pageQuery}</option>
              <option value="country">{copy.country}</option>
              <option value="device">{copy.device}</option>
            </select>
          </label>
        </div>
        <div className="gsc-api-actions">
          <button className="export-button" type="submit" disabled={loading}>
            {loading ? copy.loading : copy.load}
          </button>
          {dimension === "page_query" && rows.length ? (
            <button className="export-button" type="button" onClick={() => downloadKeywordOpportunitiesCsv(rows, insights)}>
              {copy.export}
            </button>
          ) : null}
        </div>
        {summary ? (
          <small>{summary.rows} {copy.rowsLoaded}, {summary.clicks} {copy.clicks}, {summary.impressions} {copy.impressions}</small>
        ) : (
          <small>{copy.analyticsHelp}</small>
        )}
        {dimension !== "page" ? <small>{copy.pageOnly}</small> : null}
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
          <small>{copy.noOpportunities}</small>
        ) : null}
        {rows.length ? (
          <div className="search-analytics-results">
            <div className="search-analytics-result head">
              <span>{copy.dimension}</span>
              <span>{copy.clicks}</span>
              <span>{copy.impressions}</span>
              <span>CTR</span>
              <span>{copy.position}</span>
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
function SearchConsoleImport({ rows, onImport, onClear, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage(`${copy.reading} ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseSearchConsoleCsv(text);
      if (!parsed.length) {
        setError(copy.noRows);
        setMessage(`${file.name}: 0 ${copy.parsed}`);
        onImport([]);
      } else {
        onImport(parsed);
        setMessage(`${file.name}: ${parsed.length} ${copy.imported}`);
      }
    } catch (err) {
      setError(err.message || String(err));
      setMessage(`${file.name}: ${copy.importFailed}`);
    } finally {
      event.target.value = "";
    }
  }

  function clearImportedRows() {
    onClear();
    setMessage(copy.cleared);
    setError("");
  }

  return (
    <section className="panel gsc-import">
      <div className="panel-head">
        <h2>{copy.csvTitle}</h2>
        <span>{rows.length ? `${rows.length} ${copy.rowsLoaded}` : copy.optional}</span>
      </div>
      <div className="gsc-import-body">
        <div>
          <strong>{copy.importTitle}</strong>
          <small>{copy.importHelp}</small>
          {message ? <small className="gsc-import-message">{message}</small> : null}
          {error ? <small className="gsc-import-error">{error}</small> : null}
        </div>
        <div className="gsc-import-actions">
          <label className="export-button file-button">
            {copy.importButton}
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={handleFile} />
          </label>
          {rows.length ? (
            <button className="export-button" type="button" onClick={clearImportedRows}>
              {copy.clearButton}
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

function uniqueGscRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.key || normalizeReportUrl(row.page || "");
    if (!key) continue;
    const current = byKey.get(key);
    if (!current || (row.impressions || 0) > (current.impressions || 0)) byKey.set(key, row);
  }
  return [...byKey.values()];
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

function buildGscOpportunities(report, rows, language = "en") {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const pages = report?.pages || [];
  const gscRows = uniqueGscRows(rows);
  if (!gscRows.length || !pages.length) return [];

  const gscByUrl = buildGscRowMap(gscRows);
  const sitemapKeys = new Set(pages.map((page) => normalizeReportUrl(page.url)));
  const technicallyIndexableNoImpressions = pages
    .filter((page) => isTechnicallyIndexablePage(page))
    .filter((page) => (gscByUrl.get(normalizeReportUrl(page.url))?.impressions || 0) === 0);
  const lowRanking = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    return row && isTechnicallyIndexablePage(page) && (row.impressions || 0) > 0 && typeof row.position === "number" && row.position > 20;
  });
  const lowCtr = pages.filter((page) => {
    const row = gscByUrl.get(normalizeReportUrl(page.url));
    if (!row || !isTechnicallyIndexablePage(page) || (row.impressions || 0) < 100) return false;
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
      copy.indexableNoImpressions[0],
      "warning",
      technicallyIndexableNoImpressions,
      copy.indexableNoImpressions[1],
    ),
    makeItem(
      "low_ranking",
      copy.lowRanking[0],
      "notice",
      lowRanking,
      copy.lowRanking[1],
    ),
    makeItem(
      "low_ctr",
      copy.lowCtr[0],
      "notice",
      lowCtr,
      copy.lowCtr[1],
    ),
    makeItem(
      "blocked_with_visibility",
      copy.blockedVisibility[0],
      "critical",
      blockedWithVisibility,
      copy.blockedVisibility[1],
    ),
    makeItem(
      "gsc_not_in_sitemap",
      copy.missingSitemap[0],
      "notice",
      gscNotInSitemap,
      copy.missingSitemap[1],
    ),
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const severityRank = { critical: 3, warning: 2, notice: 1 };
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.count - a.count;
    });
}

function GscOpportunities({ report, rows, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const opportunities = buildGscOpportunities(report, rows || [], language);
  if (!rows?.length || !opportunities.length) return null;
  return (
    <section className="panel gsc-opportunities">
      <div className="panel-head">
        <h2>{copy.opportunities}</h2>
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
                <strong>{copy.sampleUrls}</strong>
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

function SearchVisibility({ report, t, gscRows, language }) {
  if (!report?.pages?.length) return null;
  const label = (key, fallback) => t?.[key] || fallback;
  const flaggedLabel = language === "zh-CN" ? "个标记" : language === "zh-TW" ? "個標記" : "flagged";
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
          <span>{visibility.hardBlocked + visibility.canonicalized} {flaggedLabel}</span>
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
function buildUrlAlignmentRows(report, inspectionResults, copy) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  return (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url)) || {};
    const submittedUrl = inspection.url || page.url || "";
    const fetchedUrl = page.finalUrl || submittedUrl;
    const htmlCanonical = page.canonical || "";
    const googleCanonical = inspection.googleCanonical || "";
    const userCanonical = inspection.userCanonical || "";
    const submittedKey = normalizeReportUrl(submittedUrl);
    const fetchedKey = normalizeReportUrl(fetchedUrl);
    const htmlKey = normalizeReportUrl(htmlCanonical);
    const googleKey = normalizeReportUrl(googleCanonical);
    const userKey = normalizeReportUrl(userCanonical);
    const issueTypes = new Set((page.issues || []).map((issue) => issue.type));
    const blocked = ["robots_disallow", "noindex", "http_error", "fetch_failed", "canonical_blocked"].some((type) => issueTypes.has(type));
    const verdict = String(inspection.verdict || "").toUpperCase();
    let state = "unknown";
    let severity = "notice";
    let label = copy.unknownAlignment;

    if (!inspection.ok) {
      state = "inspection_failed";
      severity = "critical";
      label = copy.inspectionFailed;
    } else if (blocked) {
      state = "blocked";
      severity = "critical";
      label = copy.crawlBlocked;
    } else if (googleKey && googleKey !== submittedKey && googleKey !== fetchedKey && googleKey !== htmlKey) {
      state = "google_canonical_differs";
      severity = "warning";
      label = copy.googleCanonicalDiffers;
    } else if (submittedKey && fetchedKey && submittedKey !== fetchedKey) {
      state = "redirect";
      severity = "warning";
      label = copy.submittedRedirects;
    } else if (htmlKey && fetchedKey && htmlKey !== fetchedKey) {
      state = "html_canonical_differs";
      severity = "warning";
      label = copy.htmlCanonicalDiffers;
    } else if (verdict === "PASS") {
      state = "aligned_indexed";
      severity = "good";
      label = copy.alignedIndexed;
    } else if (
      fetchedKey
      && (!htmlKey || htmlKey === fetchedKey)
      && (!userKey || userKey === fetchedKey)
      && (!googleKey || googleKey === fetchedKey)
    ) {
      state = "aligned_not_indexed";
      severity = "critical";
      label = copy.alignedNotIndexed;
    }

    return {
      submittedUrl,
      fetchedUrl,
      htmlCanonical,
      userCanonical,
      googleCanonical,
      coverageState: inspection.coverageState || inspection.error || "",
      state,
      severity,
      label,
    };
  });
}

function UrlAlignmentMatrix({ report, inspectionResults, copy }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => buildUrlAlignmentRows(report, inspectionResults, copy), [copy, inspectionResults, report]);
  const counts = rows.reduce((summary, row) => {
    summary[row.state] = (summary[row.state] || 0) + 1;
    return summary;
  }, {});
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.state === filter);
  const states = [...new Set(rows.map((row) => row.state))];
  if (!rows.length) return null;

  function exportRows() {
    downloadCsvFile("soos-google-url-alignment.csv", [
      ["diagnosis", "state", "submitted_url", "fetched_url", "html_canonical", "gsc_user_canonical", "google_canonical", "coverage_state"],
      ...rows.map((row) => [
        row.label,
        row.state,
        row.submittedUrl,
        row.fetchedUrl,
        row.htmlCanonical,
        row.userCanonical,
        row.googleCanonical,
        row.coverageState,
      ]),
    ]);
  }

  return (
    <section className="url-alignment">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.alignmentTitle}</strong>
          <small>{copy.alignmentHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.alignmentAll} ({rows.length})</option>
            {states.map((state) => {
              const row = rows.find((item) => item.state === state);
              return <option value={state} key={state}>{row.label} ({counts[state]})</option>;
            })}
          </select>
          <button className="export-button" type="button" onClick={exportRows}>{copy.exportAlignment}</button>
        </div>
      </div>
      <div className="url-alignment-table">
        <div className="url-alignment-row head">
          <span>{copy.alignmentState}</span>
          <span>{copy.submittedUrl}</span>
          <span>{copy.fetchedUrl}</span>
          <span>{copy.htmlCanonical}</span>
          <span>{copy.googleCanonical}</span>
        </div>
        {visibleRows.map((row) => (
          <div className="url-alignment-row" key={row.submittedUrl}>
            <span><Badge severity={row.severity === "good" ? "ok" : row.severity}>{row.label}</Badge></span>
            <span title={row.submittedUrl}>{row.submittedUrl || "-"}</span>
            <span title={row.fetchedUrl}>{row.fetchedUrl || "-"}</span>
            <span title={row.htmlCanonical}>{row.htmlCanonical || "-"}</span>
            <span title={row.googleCanonical}>{row.googleCanonical || "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function classifyIndexCoverage(inspection, page, gsc, copy) {
  const coverage = String(inspection.coverageState || "").toLowerCase();
  const robots = String(inspection.robotsTxtState || "").toLowerCase();
  const indexing = String(inspection.indexingState || "").toLowerCase();
  const fetchState = String(inspection.pageFetchState || "").toLowerCase();
  const verdict = String(inspection.verdict || "").toUpperCase();
  const issueTypes = new Set((page?.issues || []).map((issue) => issue.type));
  const submittedKey = normalizeReportUrl(inspection.url);
  const localCanonicalKey = normalizeReportUrl(page?.canonical || inspection.userCanonical || "");
  const googleCanonicalKey = normalizeReportUrl(inspection.googleCanonical || "");
  const canonicalAgreement = Boolean(
    googleCanonicalKey
    && localCanonicalKey
    && googleCanonicalKey === localCanonicalKey
    && googleCanonicalKey !== submittedKey
  );
  let reason = "other";
  let reasonLabel = copy.reasonOther;
  let disposition = "needs_fix";
  let dispositionLabel = copy.needsFix;

  if (!inspection.ok) {
    reason = "inspection_error";
    reasonLabel = copy.inspectionFailed;
  } else if (verdict === "PASS") {
    reason = "indexed";
    reasonLabel = copy.indexedState;
    disposition = "indexed";
    dispositionLabel = copy.indexedState;
  } else if (
    robots.includes("blocked")
    || robots.includes("disallow")
    || indexing.includes("blocked")
    || indexing.includes("noindex")
    || ["robots_disallow", "noindex", "canonical_blocked"].some((type) => issueTypes.has(type))
  ) {
    reason = "blocked";
    reasonLabel = copy.reasonBlocked;
  } else if (coverage.includes("soft 404")) {
    reason = "soft_404";
    reasonLabel = copy.reasonSoft404;
  } else if (
    coverage.includes("server error")
    || coverage.includes("redirect error")
    || (
      fetchState
      && !fetchState.includes("unspecified")
      && !["successful", "page_fetch_state_successful"].includes(fetchState)
    )
    || ["fetch_failed", "http_error"].some((type) => issueTypes.has(type))
  ) {
    reason = "fetch_problem";
    reasonLabel = copy.reasonFetch;
  } else if (coverage.includes("discovered") && coverage.includes("not indexed")) {
    reason = "discovered_not_crawled";
    reasonLabel = copy.reasonDiscovered;
  } else if (coverage.includes("crawled") && coverage.includes("not indexed")) {
    reason = "crawled_not_indexed";
    reasonLabel = copy.reasonCrawled;
  } else if (coverage.includes("duplicate") || coverage.includes("alternate page")) {
    reason = "duplicate";
    reasonLabel = copy.reasonDuplicate;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  } else if (googleCanonicalKey && googleCanonicalKey !== submittedKey) {
    reason = "canonical_conflict";
    reasonLabel = copy.reasonCanonical;
    if (canonicalAgreement) {
      disposition = "expected_exclusion";
      dispositionLabel = copy.expectedExclusion;
    }
  }

  const impressions = gsc?.impressions || 0;
  const clicks = gsc?.clicks || 0;
  const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
  const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.floor((Date.now() - lastCrawlMs) / 86400000) : null;
  const stale = crawlAgeDays != null && crawlAgeDays > 90;
  let priority = "low";
  if (disposition === "needs_fix" && (clicks > 0 || impressions >= 100 || reason === "blocked" || reason === "fetch_problem")) {
    priority = "high";
  } else if (disposition === "needs_fix" || impressions > 0 || stale) {
    priority = "medium";
  }

  return {
    url: inspection.url,
    reason,
    reasonLabel,
    disposition,
    dispositionLabel,
    priority,
    impressions,
    clicks,
    position: gsc?.position ?? null,
    lastCrawlTime: inspection.lastCrawlTime || "",
    crawlAgeDays,
    stale,
    coverageState: inspection.coverageState || inspection.error || "",
    googleCanonical: inspection.googleCanonical || "",
  };
}

function IndexCoveragePriorities({ report, inspectionResults, gscRows, copy }) {
  const pagesByUrl = new Map((report?.pages || []).map((page) => [normalizeReportUrl(page.url), page]));
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  const rows = (inspectionResults || []).map((inspection) => {
    const page = pagesByUrl.get(normalizeReportUrl(inspection.url));
    const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
      || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
    return classifyIndexCoverage(inspection, page, gsc, copy);
  });
  const priorityRank = { high: 3, medium: 2, low: 1 };
  const actionableRows = rows
    .filter((row) => row.disposition !== "indexed")
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || b.impressions - a.impressions);
  const groups = [...new Map(actionableRows.map((row) => [row.reason, {
    reason: row.reason,
    label: row.reasonLabel,
    rows: actionableRows.filter((item) => item.reason === row.reason),
  }])).values()];
  if (!rows.length) return null;

  function priorityLabel(priority) {
    if (priority === "high") return copy.priorityHigh;
    if (priority === "medium") return copy.priorityMedium;
    return copy.priorityLow;
  }

  function exportCoverage() {
    downloadCsvFile("soos-google-index-coverage.csv", [
      ["url", "reason", "disposition", "priority", "coverage_state", "clicks", "impressions", "position", "last_crawl", "crawl_age_days", "google_canonical"],
      ...rows.map((row) => [
        row.url,
        row.reason,
        row.disposition,
        row.priority,
        row.coverageState,
        row.clicks,
        row.impressions,
        row.position ?? "",
        row.lastCrawlTime,
        row.crawlAgeDays ?? "",
        row.googleCanonical,
      ]),
    ]);
  }

  return (
    <section className="index-coverage-priorities">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.coverageTitle}</strong>
          <small>{copy.coverageHelp}</small>
        </div>
        <button className="export-button" type="button" onClick={exportCoverage}>{copy.coverageExport}</button>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.needsFix}: {rows.filter((row) => row.disposition === "needs_fix").length}</span>
        <span>{copy.expectedExclusion}: {rows.filter((row) => row.disposition === "expected_exclusion").length}</span>
        <span>{copy.indexedState}: {rows.filter((row) => row.disposition === "indexed").length}</span>
      </div>
      {groups.length ? (
        <div className="coverage-groups">
          {groups.map((group) => (
            <article className="coverage-group" key={group.reason}>
              <div className="impact-top">
                <Badge severity={group.rows.some((row) => row.priority === "high") ? "critical" : "warning"}>{group.label}</Badge>
                <strong>{group.rows.length} {copy.affectedUrls}</strong>
                <span>{group.rows.reduce((sum, row) => sum + row.impressions, 0)} {copy.impressions}</span>
              </div>
              <div className="coverage-priority-rows">
                {group.rows.slice(0, 8).map((row) => (
                  <div className="coverage-priority-row" key={row.url}>
                    <Badge severity={row.priority === "high" ? "critical" : row.priority === "medium" ? "warning" : "notice"}>{priorityLabel(row.priority)}</Badge>
                    <strong title={row.url}>{row.url}</strong>
                    <span>{row.dispositionLabel}</span>
                    <small>
                      {row.impressions || row.clicks
                        ? `${row.clicks} ${copy.clicks} / ${row.impressions} ${copy.impressions}`
                        : copy.noPerformanceData}
                      {row.stale ? ` | ${copy.staleCrawl}: ${row.crawlAgeDays}d` : ""}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ImportantPageFreshness({ inspectionResults, gscRows, copy }) {
  const [sortBy, setSortBy] = useState("risk");
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows || []));
  const riskRank = { critical: 4, stale: 3, unknown: 2, watch: 1, fresh: 0 };
  const rows = (inspectionResults || [])
    .filter((item) => item.ok && String(item.verdict || "").toUpperCase() === "PASS")
    .map((inspection) => {
      const gsc = gscByUrl.get(normalizeReportUrl(inspection.url))
        || gscByUrl.get(normalizeReportUrl(inspection.googleCanonical || ""));
      const impressions = gsc?.impressions || 0;
      const clicks = gsc?.clicks || 0;
      if (!impressions && !clicks) return null;
      const lastCrawlMs = inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).getTime() : NaN;
      const crawlAgeDays = Number.isFinite(lastCrawlMs) ? Math.max(0, Math.floor((Date.now() - lastCrawlMs) / 86400000)) : null;
      const demand = clicks > 0 || impressions >= 1000 ? "high" : impressions >= 100 ? "medium" : "low";
      const demandScore = clicks * 1000 + impressions;
      let freshness = "fresh";
      if (crawlAgeDays == null) freshness = "unknown";
      else if (crawlAgeDays > 180) freshness = "critical";
      else if (crawlAgeDays > 90) freshness = "stale";
      else if (crawlAgeDays > 30) freshness = "watch";
      return {
        url: inspection.url,
        googleCanonical: inspection.googleCanonical || "",
        lastCrawlTime: inspection.lastCrawlTime || "",
        crawlAgeDays,
        freshness,
        demand,
        demandScore,
        impressions,
        clicks,
        position: gsc?.position ?? null,
      };
    })
    .filter(Boolean);
  const sortedRows = [...rows].sort((a, b) => {
    if (sortBy === "demand") return b.demandScore - a.demandScore || (b.crawlAgeDays || 0) - (a.crawlAgeDays || 0);
    if (sortBy === "age") return (b.crawlAgeDays ?? -1) - (a.crawlAgeDays ?? -1) || b.demandScore - a.demandScore;
    return riskRank[b.freshness] - riskRank[a.freshness] || b.demandScore - a.demandScore;
  });
  if (!rows.length) return null;

  function freshnessLabel(value) {
    if (value === "critical") return copy.freshnessCritical;
    if (value === "stale") return copy.freshnessStale;
    if (value === "watch") return copy.freshnessWatch;
    if (value === "unknown") return copy.freshnessUnknown;
    return copy.freshnessFresh;
  }

  function demandLabel(value) {
    if (value === "high") return copy.demandHigh;
    if (value === "medium") return copy.demandMedium;
    return copy.demandLow;
  }

  function exportFreshness() {
    downloadCsvFile("soos-google-crawl-freshness.csv", [
      ["url", "freshness", "demand", "last_crawl", "crawl_age_days", "clicks", "impressions", "position", "google_canonical"],
      ...sortedRows.map((row) => [
        row.url,
        row.freshness,
        row.demand,
        row.lastCrawlTime,
        row.crawlAgeDays ?? "",
        row.clicks,
        row.impressions,
        row.position ?? "",
        row.googleCanonical,
      ]),
    ]);
  }

  return (
    <section className="crawl-freshness">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.freshnessTitle}</strong>
          <small>{copy.freshnessHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="risk">{copy.freshnessSortRisk}</option>
            <option value="demand">{copy.freshnessSortDemand}</option>
            <option value="age">{copy.freshnessSortAge}</option>
          </select>
          <button className="export-button" type="button" onClick={exportFreshness}>{copy.freshnessExport}</button>
        </div>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.indexedWithDemand}: {rows.length}</span>
        <span>{copy.freshnessCritical}: {rows.filter((row) => row.freshness === "critical").length}</span>
        <span>{copy.freshnessStale}: {rows.filter((row) => row.freshness === "stale").length}</span>
      </div>
      <div className="crawl-freshness-list">
        {sortedRows.map((row) => (
          <div className="crawl-freshness-row" key={row.url}>
            <Badge severity={row.freshness === "critical" ? "critical" : row.freshness === "stale" ? "warning" : row.freshness === "watch" || row.freshness === "unknown" ? "notice" : "ok"}>
              {freshnessLabel(row.freshness)}
            </Badge>
            <strong title={row.url}>{row.url}</strong>
            <span>{demandLabel(row.demand)}</span>
            <small>{row.crawlAgeDays == null ? copy.freshnessUnknown : `${copy.crawlAge}: ${row.crawlAgeDays} ${copy.days}`}</small>
            <small>{row.clicks} {copy.clicks} / {row.impressions} {copy.impressions}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeSetUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

function normalizeVariantUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

function urlVariantFamily(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
    return `${hostname}${url.port ? `:${url.port}` : ""}${pathname}`;
  } catch {
    return "";
  }
}

function buildUrlSetFindings(report, gscRows, inspectionResults, copy) {
  const pages = report?.pages || [];
  const hasInternalLinkData = pages.some((page) => Array.isArray(page.internalLinks));
  const sitemapUrls = new Map();
  const internalUrls = new Map();
  const inboundSources = new Map();
  const sourceUrls = new Map();
  const addSourceUrl = (value, source) => {
    const url = normalizeVariantUrl(value);
    if (!url) return;
    if (!sourceUrls.has(url)) sourceUrls.set(url, new Set());
    sourceUrls.get(url).add(source);
  };

  for (const page of pages) {
    const pageUrl = normalizeSetUrl(page.url);
    if (pageUrl) sitemapUrls.set(pageUrl, page.url);
    addSourceUrl(page.url, copy.sourceSitemap);
    for (const link of page.internalLinks || []) {
      const linkUrl = normalizeSetUrl(link);
      if (!linkUrl) continue;
      internalUrls.set(linkUrl, link);
      addSourceUrl(link, copy.sourceInternal);
      if (pageUrl !== linkUrl) {
        if (!inboundSources.has(linkUrl)) inboundSources.set(linkUrl, new Set());
        inboundSources.get(linkUrl).add(pageUrl);
      }
    }
  }

  const findings = [];
  const addFinding = (type, url, source, detail, severity = "warning") => {
    findings.push({ type, url, source, detail, severity });
  };

  if (hasInternalLinkData) {
    for (const [key, url] of internalUrls) {
      if (!sitemapUrls.has(key)) addFinding("internal_missing_sitemap", url, copy.sourceInternal, copy.internalMissingSitemap);
    }
  }

  for (const row of uniqueGscRows(gscRows)) {
    const url = row.page || row.key;
    const key = normalizeSetUrl(url);
    if (!key) continue;
    addSourceUrl(url, copy.sourceGsc);
    if (!sitemapUrls.has(key)) {
      addFinding(
        "gsc_missing_sitemap",
        url,
        copy.sourceGsc,
        `${row.clicks || 0} ${copy.clicks} / ${row.impressions || 0} ${copy.impressions}`,
        (row.impressions || 0) > 0 ? "warning" : "notice",
      );
    }
  }

  if (hasInternalLinkData) {
    for (const [key, url] of sitemapUrls) {
      const inboundCount = inboundSources.get(key)?.size || 0;
      if (!inboundCount) addFinding("sitemap_orphan", url, copy.sourceSitemap, `0 ${copy.inboundLinks}`);
    }
  }

  for (const item of inspectionResults || []) {
    addSourceUrl(item.url, copy.sourceGoogle);
    if (item.ok && !item.sitemap?.length) {
      addFinding("google_missing_sitemap", item.url, copy.sourceGoogle, copy.googleMissingSitemap, "notice");
    }
    if (item.ok && !item.referringUrls?.length) {
      addFinding("google_missing_referrer", item.url, copy.sourceGoogle, copy.googleMissingReferrer, "notice");
    }
  }

  const variantGroups = new Map();
  for (const [url, sources] of sourceUrls) {
    const family = urlVariantFamily(url);
    if (!family) continue;
    if (!variantGroups.has(family)) variantGroups.set(family, []);
    variantGroups.get(family).push({ url, sources: [...sources] });
  }
  for (const variants of variantGroups.values()) {
    if (variants.length < 2) continue;
    const detail = variants
      .slice(0, 6)
      .map((variant) => variant.url)
      .join(" | ");
    addFinding("url_variant", variants[0].url, copy.sourceVariants, detail);
  }

  return findings.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, notice: 2 };
    return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) || a.url.localeCompare(b.url);
  });
}

function UrlSetComparison({ report, gscRows, inspectionResults, copy }) {
  const [filter, setFilter] = useState("all");
  const findings = useMemo(
    () => buildUrlSetFindings(report, gscRows, inspectionResults, copy),
    [report, gscRows, inspectionResults, copy],
  );
  const typeLabels = {
    internal_missing_sitemap: copy.internalMissingSitemap,
    gsc_missing_sitemap: copy.gscMissingSitemap,
    sitemap_orphan: copy.sitemapOrphan,
    google_missing_sitemap: copy.googleMissingSitemap,
    google_missing_referrer: copy.googleMissingReferrer,
    url_variant: copy.urlVariant,
  };
  const counts = findings.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  const visibleFindings = filter === "all" ? findings : findings.filter((item) => item.type === filter);

  function exportFindings() {
    downloadCsvFile("soos-url-set-diagnosis.csv", [
      ["type", "severity", "url", "source", "detail"],
      ...findings.map((item) => [typeLabels[item.type] || item.type, item.severity, item.url, item.source, item.detail]),
    ]);
  }

  return (
    <section className="url-set-comparison">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.urlSetsTitle}</strong>
          <small>{copy.urlSetsHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.urlSetsAll} ({findings.length})</option>
            {Object.entries(typeLabels).map(([type, label]) => (
              <option value={type} key={type}>{label} ({counts[type] || 0})</option>
            ))}
          </select>
          <button className="export-button" type="button" disabled={!findings.length} onClick={exportFindings}>
            {copy.urlSetsExport}
          </button>
        </div>
      </div>
      <small className="url-set-scope">{copy.urlSetsPartial}</small>
      <div className="coverage-disposition-summary">
        {Object.entries(typeLabels).map(([type, label]) => (
          <span key={type}>{label}: {counts[type] || 0}</span>
        ))}
      </div>
      {visibleFindings.length ? (
        <div className="url-set-findings">
          {visibleFindings.map((item, index) => (
            <div className="url-set-row" key={`${item.type}-${item.url}-${index}`}>
              <Badge severity={item.severity}>{typeLabels[item.type] || item.type}</Badge>
              <strong title={item.url}>{item.url}</strong>
              <span>{item.source}</span>
              <small title={item.detail}>{item.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function googleRichIssues(inspection) {
  const issues = [];
  for (const detected of inspection?.richResultsDetectedItems || []) {
    const richType = detected.richResultType || detected.type || "Rich result";
    const items = detected.items || [];
    for (const item of items) {
      for (const issue of item.issues || []) {
        issues.push({
          type: richType,
          severity: String(issue.severity || "WARNING").toLowerCase(),
          detail: issue.issueMessage || issue.message || JSON.stringify(issue),
        });
      }
    }
  }
  return issues;
}

function StructuredDataDiagnostics({ report, inspectionResults, copy, language }) {
  const [filter, setFilter] = useState("all");
  const inspectionByUrl = useMemo(
    () => new Map((inspectionResults || []).map((item) => [normalizeReportUrl(item.url), item])),
    [inspectionResults],
  );
  const rows = useMemo(
    () => (report?.pages || [])
      .map((page) => {
        const local = page.structuredData;
        const inspection = inspectionByUrl.get(normalizeReportUrl(page.url));
        const googleIssues = googleRichIssues(inspection);
        const localErrors = (local?.diagnostics || []).filter((item) => item.severity === "warning");
        const recommendations = (local?.diagnostics || []).filter((item) => item.severity === "notice");
        return {
          url: page.url,
          nodeCount: local?.nodeCount || 0,
          types: local?.types || [],
          validatedTypes: local?.validatedTypes || [],
          unvalidatedTypes: local?.unvalidatedTypes || [],
          localErrors,
          recommendations,
          googleIssues,
          googleVerdict: inspection?.richResultsVerdict || "",
          hasMarkup: Boolean(local?.count || local?.nodeCount || inspection?.richResultsDetectedItems?.length),
        };
      })
      .filter((row) => row.hasMarkup),
    [inspectionByUrl, report],
  );
  if (!rows.length) return null;

  const filteredRows = rows.filter((row) => {
    if (filter === "errors") return row.localErrors.length > 0;
    if (filter === "recommendations") return row.recommendations.length > 0;
    if (filter === "google") return row.googleIssues.length > 0 || (row.googleVerdict && row.googleVerdict !== "PASS");
    return true;
  });
  const totals = rows.reduce(
    (sum, row) => ({
      errors: sum.errors + row.localErrors.length,
      recommendations: sum.recommendations + row.recommendations.length,
      google: sum.google + row.googleIssues.length,
    }),
    { errors: 0, recommendations: 0, google: 0 },
  );
  const diagnosticLabels = structuredDiagnosticText[language] || structuredDiagnosticText.en;
  const coverage = [...rows.reduce((typeMap, row) => {
    for (const type of row.types) {
      const current = typeMap.get(type) || { type, pages: 0, validated: false };
      current.pages += 1;
      current.validated = current.validated || row.validatedTypes.includes(type);
      typeMap.set(type, current);
    }
    return typeMap;
  }, new Map()).values()].sort((a, b) => Number(b.validated) - Number(a.validated) || b.pages - a.pages || a.type.localeCompare(b.type));

  function exportDiagnostics() {
    const exportRows = [["url", "source", "severity", "schema_type", "property", "detail"]];
    for (const row of rows) {
      for (const item of [...row.localErrors, ...row.recommendations]) {
        exportRows.push([row.url, "local", item.severity, item.type, item.property, item.detail]);
      }
      for (const item of row.googleIssues) {
        exportRows.push([row.url, "google", item.severity, item.type, "", item.detail]);
      }
      if (!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length) {
        exportRows.push([row.url, "local", "ok", row.types.join(" | "), "", copy.structuredNoIssues]);
      }
    }
    downloadCsvFile("soos-structured-data-diagnosis.csv", exportRows);
  }

  return (
    <section className="structured-data-diagnostics">
      <div className="url-alignment-head">
        <div>
          <strong>{copy.structuredTitle}</strong>
          <small>{copy.structuredHelp}</small>
        </div>
        <div className="url-alignment-actions">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{copy.structuredAll} ({rows.length})</option>
            <option value="errors">{copy.structuredErrors} ({totals.errors})</option>
            <option value="recommendations">{copy.structuredRecommendations} ({totals.recommendations})</option>
            <option value="google">{copy.structuredGoogle} ({totals.google})</option>
          </select>
          <button className="export-button" type="button" onClick={exportDiagnostics}>{copy.structuredExport}</button>
        </div>
      </div>
      <div className="coverage-disposition-summary">
        <span>{copy.structuredErrors}: {totals.errors}</span>
        <span>{copy.structuredRecommendations}: {totals.recommendations}</span>
        <span>{copy.structuredGoogle}: {totals.google}</span>
      </div>
      <div className="structured-coverage">
        <strong>{copy.structuredCoverage}</strong>
        <div>
          {coverage.map((item) => (
            <span className={item.validated ? "validated" : "parsed"} key={item.type}>
              {item.type}: {item.pages} · {item.validated ? copy.structuredValidated : copy.structuredParsedOnly}
            </span>
          ))}
        </div>
      </div>
      <div className="structured-data-list">
        {filteredRows.map((row) => (
          <div className="structured-data-row" key={row.url}>
            <div>
              <strong title={row.url}>{row.url}</strong>
              <small>{copy.structuredTypes}: {row.types.join(", ") || "Unknown"} / {row.nodeCount} {copy.structuredNodes}</small>
            </div>
            <span>{copy.structuredLocalIssues}: {row.localErrors.length} / {row.recommendations.length}</span>
            <span>{copy.structuredGoogleVerdict}: {row.googleVerdict || "-"}</span>
            <div className="structured-data-issues">
              {[...row.localErrors, ...row.recommendations].slice(0, 4).map((item, index) => (
                <small key={`${item.code}-${item.property}-${index}`}>
                  {diagnosticLabels[item.code] || item.code} · {item.type}.{item.property || "-"}: {item.detail}
                </small>
              ))}
              {row.googleIssues.slice(0, 3).map((item, index) => (
                <small key={`google-${item.type}-${index}`}>Google {item.type}: {item.detail}</small>
              ))}
              {!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length ? <small>{copy.structuredNoIssues}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UrlInspectionPanel({ report, gscStatus, siteUrl, language, gscRows }) {
  const copy = gscDataText[language] || gscDataText.en;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setResult(null);
    setError("");
  }, [report?.scannedAt]);
  if (!report?.pages?.length) return null;

  const urls = report.pages.map((page) => page.url);
  const inspectedUrlKeys = new Set((result?.results || []).map((item) => normalizeReportUrl(item.url)));
  const pendingUrls = urls.filter((url) => !inspectedUrlKeys.has(normalizeReportUrl(url)));
  const nextUrls = pendingUrls.slice(0, 25);
  const indexedCount = (result?.results || []).filter((item) => item.verdict === "PASS").length;
  const failedCount = (result?.results || []).filter((item) => !item.ok || item.verdict === "FAIL").length;
  const diagnosedResults = (result?.results || []).map((item) => ({
    ...item,
    diagnoses: diagnoseInspectionResult(item).map((diagnosis) => {
      const localized = inspectionDiagnosisText[language]?.[diagnosis.type];
      return localized ? { ...diagnosis, title: localized[0], action: localized[1] } : diagnosis;
    }),
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
      setError(copy.inspectPropertyFirst);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gsc/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: nextUrls, siteUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "URL Inspection failed");
      setResult((current) => ({
        ...body,
        inspected: (current?.results?.length || 0) + (body.results?.length || 0),
        results: [...(current?.results || []), ...(body.results || [])],
      }));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel url-inspection">
      <div className="panel-head">
        <h2>{copy.inspectionTitle}</h2>
        <span>{gscStatus?.configured ? "GSC API" : copy.configureFirst}</span>
      </div>
      <div className="url-inspection-body">
        <div className="url-inspection-copy">
          <strong>{copy.inspectStatus}</strong>
          <small>{copy.inspectionHelp}</small>
        </div>
        <button className="export-button" type="button" disabled={!gscStatus?.configured || loading || !nextUrls.length} onClick={runInspection}>
          {loading ? copy.inspecting : result ? nextUrls.length ? copy.inspectNext : copy.inspectionComplete : copy.inspect}
        </button>
      </div>
      {result && pendingUrls.length ? <small className="inspection-remaining">{pendingUrls.length} {copy.remaining}</small> : null}
      {error ? <div className="url-inspection-error">{error}</div> : null}
      <StructuredDataDiagnostics report={report} inspectionResults={result?.results || []} copy={copy} language={language} />
      <UrlSetComparison report={report} gscRows={gscRows} inspectionResults={result?.results || []} copy={copy} />
      {result ? (
        <>
          <div className="inspection-summary">
            <Stat label={copy.inspected} value={result.inspected} />
            <Stat label="PASS" value={indexedCount} tone="good" />
            <Stat label={copy.review} value={failedCount} tone="warn" />
          </div>
          <div className="inspection-diagnosis-summary">
            <span>{diagnosisSummary.critical} {copy.critical}</span>
            <span>{diagnosisSummary.warning} {copy.warnings}</span>
            <span>{diagnosisSummary.notice} {copy.notices}</span>
          </div>
          <IndexCoveragePriorities report={report} inspectionResults={result.results} gscRows={gscRows} copy={copy} />
          <ImportantPageFreshness inspectionResults={result.results} gscRows={gscRows} copy={copy} />
          <UrlAlignmentMatrix report={report} inspectionResults={result.results} copy={copy} />
          <div className="inspection-list">
            {diagnosedResults.map((item) => (
              <article className="inspection-card" key={item.url}>
                <div className="impact-top">
                  <Badge severity={item.ok && item.verdict === "PASS" ? "ok" : item.ok ? "warning" : "critical"}>{item.verdict || (item.ok ? "UNKNOWN" : "ERROR")}</Badge>
                  <strong>{item.url}</strong>
                  <span>{item.coverageState || item.error || copy.noCoverage}</span>
                </div>
                <div className="impact-details">
                  {item.indexingState ? <small>{copy.indexing}: {item.indexingState}</small> : null}
                  {item.robotsTxtState ? <small>{copy.robots}: {item.robotsTxtState}</small> : null}
                  {item.pageFetchState ? <small>{copy.fetch}: {item.pageFetchState}</small> : null}
                  {item.crawledAs ? <small>{copy.crawledAs}: {item.crawledAs}</small> : null}
                  {item.lastCrawlTime ? <small>{copy.lastCrawl}: {item.lastCrawlTime}</small> : null}
                  {item.sitemap?.length ? <small>{copy.sitemap}: {item.sitemap.slice(0, 2).join(", ")}</small> : null}
                  {item.referringUrls?.length ? <small>{copy.referrers}: {item.referringUrls.length}</small> : null}
                  {item.googleCanonical ? <small>{copy.googleCanonical}: {item.googleCanonical}</small> : null}
                  {item.userCanonical ? <small>{copy.userCanonical}: {item.userCanonical}</small> : null}
                  {item.mobileVerdict ? <small>{copy.mobile}: {item.mobileVerdict}</small> : null}
                  {item.richResultsVerdict ? <small>{copy.richResults}: {item.richResultsVerdict}</small> : null}
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
                      <strong>{copy.noIssue}</strong>
                      <small>{copy.noIssueDetail}</small>
                      <span>{copy.noIssueAction}</span>
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
function Report({ report, t, gscRows, gscStatus, gscSiteUrl, language }) {
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
      <SearchVisibility report={report} t={t} gscRows={gscRows} language={language} />
      <GscOpportunities report={report} rows={gscRows} language={language} />
      <UrlInspectionPanel report={report} gscStatus={gscStatus} siteUrl={gscSiteUrl} language={language} gscRows={gscRows} />
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

const ACTIVE_AUDIT_JOB_KEY = "soos:active-audit-job";

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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(ACTIVE_AUDIT_JOB_KEY) || "null");
      if (!saved?.id) return;
      const startedAt = Number(saved.startedAt) || Date.now();
      setLoading(true);
      setError("");
      setCurrentJobId(saved.id);
      setCurrentJobStartedAt(startedAt);
      setElapsedNow(Date.now() - startedAt);
      setProgress({ label: t.progressPreparing, value: 5, meta: "" });
      pollAuditJob(saved.id)
        .catch((err) => setError(err.message || String(err)))
        .finally(resetJobUi);
    } catch {
      window.localStorage.removeItem(ACTIVE_AUDIT_JOB_KEY);
    }
  }, []);

  function resetJobUi() {
    window.setTimeout(() => {
      setLoading(false);
      setProgress(null);
      setCurrentJobId(null);
      setJobStatus(null);
      setCurrentJobStartedAt(null);
      setElapsedNow(0);
    }, 250);
  }

  function saveCompletedReport(result) {
    setReport(result);
    setHistory((currentHistory) => {
      const nextHistory = [
        toHistoryEntry(result),
        ...currentHistory.filter((item) => item.input?.originalUrl !== result.input?.originalUrl),
      ].slice(0, historyLimit);
      saveHistory(nextHistory);
      return nextHistory;
    });
    setComparisonEntry(null);
  }

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

  async function pollAuditJob(jobId) {
    while (true) {
      const pollResponse = await fetch(`/api/audit-jobs/${jobId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const pollBody = await pollResponse.json();
      if (!pollResponse.ok) {
        window.localStorage.removeItem(ACTIVE_AUDIT_JOB_KEY);
        throw new Error(pollBody.error || "Audit failed");
      }
      setJobStatus(pollBody.status);

      const progressLabel =
        pollBody.status === "paused"
          ? t.progressPaused
          : pollBody.status === "stopped"
            ? t.progressStopped
            : pollBody.status === "interrupted"
              ? t.progressInterrupted
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
        window.localStorage.removeItem(ACTIVE_AUDIT_JOB_KEY);
        setProgress({ label: t.progressFinalizing, value: 100, meta: metaParts.join(" | ") });
        saveCompletedReport(pollBody.result);
        return;
      }
      if (pollBody.status === "stopped") {
        window.localStorage.removeItem(ACTIVE_AUDIT_JOB_KEY);
        setProgress({ label: t.progressStopped, value: pollBody.progress?.percent || 0, meta: metaParts.join(" | ") });
        return;
      } else if (pollBody.status === "error") {
        window.localStorage.removeItem(ACTIVE_AUDIT_JOB_KEY);
        throw new Error(pollBody.error || "Audit failed");
      }

      await new Promise((resolve) => window.setTimeout(resolve, pollBody.leaseBusy ? 1000 : 250));
    }
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
      const startedAt = Date.now();
      setCurrentJobStartedAt(startedAt);
      window.localStorage.setItem(ACTIVE_AUDIT_JOB_KEY, JSON.stringify({ id: startBody.id, startedAt }));
      await pollAuditJob(startBody.id);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      resetJobUi();
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
      <SearchAnalyticsPanel status={gscStatus} siteUrl={gscSiteUrl} onRows={setGscRows} language={language} />
      <SearchConsoleImport rows={gscRows} onImport={setGscRows} onClear={() => setGscRows([])} language={language} />


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
      <Report report={report} t={t} gscRows={gscRows} gscStatus={gscStatus} gscSiteUrl={gscSiteUrl} language={language} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

