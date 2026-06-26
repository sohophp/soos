import { uniqueGscRows } from "./gsc-summary.js";
import { normalizeReportUrl } from "./url-policy.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}

function formatValue(value) {
  if (value === true) return "On";
  if (value === false) return "Off";
  if (value == null || value === "") return "-";
  return String(value);
}

const COPY = {
  en: {
    title: "SEO audit report", summary: "Summary", scope: "Scan scope", configuration: "Configuration",
    urls: "URLs", affected: "Affected URLs", score: "Health score", critical: "Critical", warnings: "Warnings",
    generated: "Generated", scanned: "Scanned", input: "Input", sitemap: "Sitemap", robots: "Robots",
    limits: "Limits", findings: "URL evidence", status: "Status", finalUrl: "Final URL", canonical: "Canonical",
    issues: "Issues", google: "Google outcomes", gsc: "Search performance", inspection: "URL Inspection",
    searchInsights: "Search opportunities", noIssues: "No detected issues",
    evidenceNote: "This report reflects the configured scan scope and the evidence available at scan time.",
  },
  "zh-CN": {
    title: "SEO 检查报告", summary: "摘要", scope: "扫描范围", configuration: "检查配置",
    urls: "网址", affected: "受影响网址", score: "健康评分", critical: "严重", warnings: "警告",
    generated: "生成时间", scanned: "扫描时间", input: "输入", sitemap: "Sitemap", robots: "Robots",
    limits: "限制", findings: "网址证据", status: "状态", finalUrl: "最终网址", canonical: "Canonical",
    issues: "问题", google: "Google 结果", gsc: "搜索表现", inspection: "网址检查",
    searchInsights: "搜索机会", noIssues: "未发现问题",
    evidenceNote: "本报告仅反映配置的扫描范围和扫描时可获得的证据。",
  },
  "zh-TW": {
    title: "SEO 檢查報告", summary: "摘要", scope: "掃描範圍", configuration: "檢查設定",
    urls: "網址", affected: "受影響網址", score: "健康評分", critical: "嚴重", warnings: "警告",
    generated: "產生時間", scanned: "掃描時間", input: "輸入", sitemap: "Sitemap", robots: "Robots",
    limits: "限制", findings: "網址證據", status: "狀態", finalUrl: "最終網址", canonical: "Canonical",
    issues: "問題", google: "Google 結果", gsc: "搜尋成效", inspection: "網址檢查",
    searchInsights: "搜尋機會", noIssues: "未發現問題",
    evidenceNote: "本報告僅反映設定的掃描範圍和掃描時可取得的證據。",
  },
};

function definitionRows(values) {
  return Object.entries(values)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatValue(value))}</dd></div>`)
    .join("");
}

function inspectionForPage(page, inspectionByUrl) {
  return inspectionByUrl.get(normalizeReportUrl(page.url))
    || inspectionByUrl.get(normalizeReportUrl(page.finalUrl || ""))
    || null;
}

function searchInsightsForPage(page, insights = []) {
  const pageKeys = new Set([normalizeReportUrl(page.url), normalizeReportUrl(page.finalUrl || "")].filter(Boolean));
  return (insights || []).filter((insight) => {
    const directUrl = normalizeReportUrl(insight.page || "");
    const detailUrl = normalizeReportUrl(String(insight.detail || "").match(/https?:\/\/\S+/)?.[0] || "");
    return (directUrl && pageKeys.has(directUrl)) || (detailUrl && pageKeys.has(detailUrl));
  });
}

function pageEvidence(page, gsc, inspection, searchInsights, copy) {
  const url = escapeHtml(page.url);
  const href = safeHref(page.url);
  const issues = (page.issues || []).length
    ? (page.issues || []).map((issue) => `
      <li class="issue ${escapeHtml(issue.severity || "notice")}">
        <strong>${escapeHtml(issue.type)}</strong>
        <span>${escapeHtml(issue.message)}</span>
        ${issue.detail ? `<small>${escapeHtml(issue.detail)}</small>` : ""}
      </li>`).join("")
    : `<li class="ok">${escapeHtml(copy.noIssues)}</li>`;
  const googleReasons = (page.googleReasons || []).map((reason) =>
    `<li><strong>${escapeHtml(reason.label)}</strong><span>${escapeHtml(reason.detail)}</span></li>`,
  ).join("");
  const gscText = gsc
    ? `${gsc.clicks ?? 0} clicks · ${gsc.impressions ?? 0} impressions · position ${gsc.position ?? "-"}`
    : "-";
  const inspectionRows = inspection?.ok ? definitionRows({
    Verdict: inspection.verdict || "-",
    "Coverage state": inspection.coverageState || "-",
    "Google canonical": inspection.googleCanonical || "-",
    "User canonical": inspection.userCanonical || "-",
  }) : "";
  const insightRows = (searchInsights || []).map((insight) => `
    <li>
      <strong>${escapeHtml(insight.type || "search_opportunity")}</strong>
      <span>${escapeHtml(insight.title || insight.detail || "")}</span>
      ${insight.metrics ? `<small>${escapeHtml(insight.metrics)}</small>` : ""}
    </li>`).join("");
  return `
    <article class="url-row">
      <header>
        <h3>${href ? `<a href="${href}" rel="noreferrer">${url}</a>` : url}</h3>
        <span class="status">${escapeHtml(page.status || "-")}</span>
      </header>
      <dl>
        ${definitionRows({
          [copy.finalUrl]: page.finalUrl || "-",
          [copy.canonical]: page.canonical || "-",
          [copy.gsc]: gscText,
        })}
      </dl>
      <section><h4>${escapeHtml(copy.issues)}</h4><ul>${issues}</ul></section>
      ${googleReasons ? `<section><h4>${escapeHtml(copy.google)}</h4><ul>${googleReasons}</ul></section>` : ""}
      ${inspectionRows ? `<section><h4>${escapeHtml(copy.inspection)}</h4><dl>${inspectionRows}</dl></section>` : ""}
      ${insightRows ? `<section><h4>${escapeHtml(copy.searchInsights)}</h4><ul>${insightRows}</ul></section>` : ""}
    </article>`;
}

export function buildStandaloneHtmlReport(report, options = {}) {
  const language = COPY[options.language] ? options.language : "en";
  const copy = COPY[language];
  const gscByUrl = new Map(
    uniqueGscRows(options.gscRows || []).map((row) => [
      row.key || normalizeReportUrl(row.page || row.url || ""),
      row,
    ]),
  );
  const inspectionByUrl = new Map(
    (options.inspectionResults || [])
      .filter((item) => item?.url)
      .map((item) => [normalizeReportUrl(item.url), item]),
  );
  const pages = report?.pages || [];
  const config = {
    contentChecks: report?.options?.contentChecks,
    performanceChecks: report?.options?.performanceChecks,
    internalCrawl: report?.options?.internalCrawl,
    robotsSource: report?.options?.robotsSource,
    urlQueryPolicy: report?.options?.urlQueryPolicy,
    trailingSlashPolicy: report?.options?.trailingSlashPolicy,
  };
  const pageRows = pages.map((page) =>
    pageEvidence(
      page,
      gscByUrl.get(normalizeReportUrl(page.url)),
      inspectionForPage(page, inspectionByUrl),
      searchInsightsForPage(page, options.searchInsights),
      copy,
    ),
  ).join("");
  const generatedAt = new Date().toISOString();
  const reportTitle = options.title || copy.title;
  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(reportTitle)}</title>
  <style>
    :root{font-family:Arial,sans-serif;color:#172018;background:#f5f7f3}*{box-sizing:border-box}
    body{margin:0}.wrap{width:min(1100px,calc(100% - 28px));margin:auto;padding:28px 0 48px}
    h1,h2,h3,h4,p{margin-top:0}h1{font-size:28px}h2{margin-top:28px;font-size:20px}
    .meta{color:#626c64}.notice{padding:10px 12px;border-left:4px solid #55745e;background:#eef5ef}
    .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
    .stat,.url-row{border:1px solid #dfe6dd;border-radius:6px;background:#fff}
    .stat{padding:12px}.stat strong{display:block;font-size:22px}.stat span,dt,small{color:#687169;font-size:12px}
    dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    dl div{min-width:0;padding:8px;background:#f7f9f6}dt{font-weight:700}dd{margin:4px 0 0;overflow-wrap:anywhere}
    .url-row{margin-top:10px;padding:14px}.url-row header{display:flex;justify-content:space-between;gap:12px}
    .url-row h3{min-width:0;font-size:14px;overflow-wrap:anywhere}.url-row a{color:#185b3a}
    .status{flex:none;font-weight:700}.url-row section{margin-top:10px}.url-row h4{font-size:13px}
    ul{display:grid;gap:5px;margin:0;padding-left:20px}li span,li small{display:block}.critical{color:#8b2b20}.warning{color:#76520d}.ok{color:#246b45}
    @media(max-width:720px){.stats,dl{grid-template-columns:1fr 1fr}.url-row header{display:block}}
    @media(max-width:460px){.stats,dl{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>${escapeHtml(reportTitle)}</h1>
    <p class="meta">${escapeHtml(copy.generated)}: ${escapeHtml(generatedAt)} · ${escapeHtml(copy.scanned)}: ${escapeHtml(report?.scannedAt || "-")}</p>
    <p class="notice">${escapeHtml(copy.evidenceNote)}</p>
    <h2>${escapeHtml(copy.summary)}</h2>
    <section class="stats">
      <div class="stat"><span>${escapeHtml(copy.score)}</span><strong>${escapeHtml(report?.summary?.healthScore ?? "-")}</strong></div>
      <div class="stat"><span>${escapeHtml(copy.urls)}</span><strong>${escapeHtml(report?.summary?.urlCount ?? pages.length)}</strong></div>
      <div class="stat"><span>${escapeHtml(copy.affected)}</span><strong>${escapeHtml(report?.summary?.affectedUrlCount ?? "-")}</strong></div>
      <div class="stat"><span>${escapeHtml(copy.critical)}</span><strong>${escapeHtml(report?.summary?.issueCounts?.critical ?? 0)}</strong></div>
      <div class="stat"><span>${escapeHtml(copy.warnings)}</span><strong>${escapeHtml(report?.summary?.issueCounts?.warning ?? 0)}</strong></div>
    </section>
    <h2>${escapeHtml(copy.scope)}</h2>
    <dl>${definitionRows({
      [copy.input]: report?.input?.originalUrl,
      [copy.sitemap]: report?.input?.sitemapUrl,
      [copy.robots]: report?.input?.robotsUrl,
      [copy.limits]: `${report?.limits?.maxUrls ?? "-"} URLs / ${report?.limits?.maxSitemaps ?? "-"} sitemaps`,
    })}</dl>
    <h2>${escapeHtml(copy.configuration)}</h2>
    <dl>${definitionRows(config)}</dl>
    <h2>${escapeHtml(copy.findings)} (${pages.length})</h2>
    ${pageRows || `<p>${escapeHtml(copy.noIssues)}</p>`}
  </main>
</body>
</html>`;
}
