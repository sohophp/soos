import { absoluteLogUrl, STATIC_ASSET_PATH } from "./googlebot-log.js";
import { buildGscRowMap, uniqueGscRows } from "./gsc-summary.js";
import { normalizeReportUrl } from "./url-policy.js";

export function buildGooglebotLogDiagnosis(analysis, report, gscRows, copy) {
  if (!analysis?.records?.length) return null;
  const verificationByIp = new Map((analysis.verifications || []).map((item) => [item.ip, item]));
  const sitemapUrls = new Map(report.pages.map((page) => [normalizeReportUrl(page.url), page.url]));
  const pageByUrl = new Map(report.pages.map((page) => [normalizeReportUrl(page.url), page]));
  const verifiedRecords = [];
  const unverifiedRecords = [];
  for (const record of analysis.records) {
    const item = { ...record, url: absoluteLogUrl(record, report.input.siteRootUrl) };
    if (verificationByIp.get(record.ip)?.verified) verifiedRecords.push(item);
    else unverifiedRecords.push(item);
  }

  const byUrl = new Map();
  for (const record of verifiedRecords) {
    const current = byUrl.get(record.url) || {
      url: record.url,
      hits: 0,
      statuses: new Map(),
      lastSeen: "",
      records: [],
    };
    current.hits += 1;
    current.statuses.set(record.status, (current.statuses.get(record.status) || 0) + 1);
    if (record.timestamp && (!current.lastSeen || record.timestamp > current.lastSeen)) current.lastSeen = record.timestamp;
    current.records.push(record);
    byUrl.set(record.url, current);
  }

  const findings = [];
  const addFinding = (type, severity, url, status, hits, lastSeen, detail) => {
    findings.push({ type, severity, url, status, hits, lastSeen, detail });
  };
  for (const item of byUrl.values()) {
    let path = item.url;
    try {
      path = new URL(item.url).pathname;
    } catch {
      // Keep the raw URL for extension checks.
    }
    const normalized = normalizeReportUrl(item.url);
    const statuses = [...item.statuses.keys()];
    if (statuses.some((status) => status >= 400)) {
      addFinding(
        "errors",
        statuses.some((status) => status >= 500) ? "critical" : "warning",
        item.url,
        statuses.join(" / "),
        item.hits,
        item.lastSeen,
        "Google received an HTTP error",
      );
    }
    if (!sitemapUrls.has(normalized)) {
      addFinding("nonSitemap", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.nonSitemap);
    }
    if (String(item.url).includes("?")) {
      addFinding("parameters", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.parameters);
    }
    if (STATIC_ASSET_PATH.test(path)) {
      addFinding("assets", "notice", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.assets);
    }
    if ((pageByUrl.get(normalized)?.issues || []).some((issue) => issue.type === "robots_disallow")) {
      addFinding("blocked", "warning", item.url, statuses.join(" / "), item.hits, item.lastSeen, copy.blocked);
    }
  }

  const unverifiedByIp = new Map();
  for (const record of unverifiedRecords) {
    const current = unverifiedByIp.get(record.ip || "unknown") || {
      hits: 0,
      lastSeen: "",
      url: record.url,
    };
    current.hits += 1;
    if (record.timestamp && (!current.lastSeen || record.timestamp > current.lastSeen)) current.lastSeen = record.timestamp;
    unverifiedByIp.set(record.ip || "unknown", current);
  }
  for (const [ip, item] of unverifiedByIp) {
    addFinding("unverified", "warning", item.url, "-", item.hits, item.lastSeen, `${copy.unverified}: ${ip}`);
  }

  const crawledKeys = new Set(verifiedRecords.map((record) => normalizeReportUrl(record.url)));
  const gscByUrl = buildGscRowMap(uniqueGscRows(gscRows));
  if (verifiedRecords.length) {
    for (const [key, url] of sitemapUrls) {
      if (crawledKeys.has(key)) continue;
      const gsc = gscByUrl.get(key);
      addFinding(
        "missing",
        (gsc?.impressions || 0) > 0 ? "warning" : "notice",
        url,
        "-",
        0,
        "",
        gsc ? `GSC: ${gsc.clicks || 0} clicks / ${gsc.impressions || 0} impressions` : copy.missing,
      );
    }
  }
  const timestamps = analysis.records.map((record) => record.timestamp).filter(Boolean).sort();
  return {
    verifiedRecords,
    unverifiedRecords,
    uniqueUrls: byUrl.size,
    findings,
    firstRequest: timestamps[0] || "",
    lastRequest: timestamps.at(-1) || "",
  };
}

export function buildGooglebotLogCsvRows(findings) {
  return [
    ["type", "severity", "url", "status", "hits", "last_seen", "detail"],
    ...(findings || []).map((item) => [
      item.type,
      item.severity,
      item.url,
      item.status,
      item.hits,
      item.lastSeen,
      item.detail,
    ]),
  ];
}
