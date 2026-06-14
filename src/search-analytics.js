export function defaultGscDateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export function gscDateRangeDays(startDate, endDate) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (!start || !end || start > end) return 28;
  return Math.floor((end - start) / 86400000) + 1;
}

export function scaledSearchThreshold(base28Days, durationDays, minimum) {
  const days = Math.min(480, Math.max(1, Number(durationDays) || 28));
  return Math.max(minimum, Math.round((base28Days * days) / 28));
}

export function wilsonUpperBound(clicks, impressions, z = 1.645) {
  const total = Math.max(0, Number(impressions) || 0);
  if (!total) return null;
  const successes = Math.min(total, Math.max(0, Number(clicks) || 0));
  const rate = successes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = rate + zSquared / (2 * total);
  const margin = z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * total)) / total);
  return (center + margin) / denominator;
}

function conservativeCtrBenchmark(position) {
  if (typeof position !== "number") return null;
  if (position <= 3) return 0.03;
  if (position <= 10) return 0.01;
  if (position <= 20) return 0.005;
  return null;
}

export function previousGscDateRange(startDate, endDate) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (!start || !end || start > end) return null;
  const durationDays = Math.floor((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - durationDays + 1);
  return {
    startDate: formatDateOnly(previousStart),
    endDate: formatDateOnly(previousEnd),
    durationDays,
  };
}

export function summarizeSearchAnalyticsRows(rows) {
  const safeRows = rows || [];
  const clicks = safeRows.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0);
  const impressions = safeRows.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0);
  const positionWeight = safeRows.reduce((sum, row) => {
    if (typeof row.position !== "number") return sum;
    return sum + row.position * Math.max(Number(row.impressions) || 0, 1);
  }, 0);
  const positionWeightTotal = safeRows.reduce((sum, row) => {
    if (typeof row.position !== "number") return sum;
    return sum + Math.max(Number(row.impressions) || 0, 1);
  }, 0);
  return {
    rows: safeRows.length,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : null,
    position: positionWeightTotal ? positionWeight / positionWeightTotal : null,
  };
}

function rowIdentity(row) {
  if (Array.isArray(row?.keys) && row.keys.length) return JSON.stringify(row.keys);
  return JSON.stringify([
    row?.page || "",
    row?.query || "",
    row?.country || "",
    row?.device || "",
    row?.label || "",
  ]);
}

function numericDelta(current, previous) {
  return (Number(current) || 0) - (Number(previous) || 0);
}

function percentDelta(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!previousValue) return currentValue ? null : 0;
  return (currentValue - previousValue) / Math.abs(previousValue);
}

export function buildSearchAnalyticsComparison(currentRows, previousRows) {
  const previousByKey = new Map((previousRows || []).map((row) => [rowIdentity(row), row]));
  const currentByKey = new Map((currentRows || []).map((row) => [rowIdentity(row), row]));
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);
  const rows = [...keys].map((key) => {
    const current = currentByKey.get(key) || null;
    const previous = previousByKey.get(key) || null;
    const reference = current || previous || {};
    const clicksDelta = numericDelta(current?.clicks, previous?.clicks);
    const impressionsDelta = numericDelta(current?.impressions, previous?.impressions);
    const ctrDelta = numericDelta(current?.ctr, previous?.ctr);
    const positionDelta = current?.position != null && previous?.position != null
      ? current.position - previous.position
      : null;
    return {
      ...reference,
      current,
      previous,
      clicks: current?.clicks || 0,
      impressions: current?.impressions || 0,
      ctr: current?.ctr ?? null,
      position: current?.position ?? null,
      clicksDelta,
      clicksPercentDelta: percentDelta(current?.clicks, previous?.clicks),
      impressionsDelta,
      impressionsPercentDelta: percentDelta(current?.impressions, previous?.impressions),
      ctrDelta,
      positionDelta,
      state: current && previous ? "existing" : current ? "new" : "lost",
    };
  });
  rows.sort((a, b) => {
    const impactA = Math.abs(a.clicksDelta) * 1000 + Math.abs(a.impressionsDelta);
    const impactB = Math.abs(b.clicksDelta) * 1000 + Math.abs(b.impressionsDelta);
    return impactB - impactA;
  });

  const current = summarizeSearchAnalyticsRows(currentRows);
  const previous = summarizeSearchAnalyticsRows(previousRows);
  return {
    current,
    previous,
    delta: {
      clicks: current.clicks - previous.clicks,
      clicksPercent: percentDelta(current.clicks, previous.clicks),
      impressions: current.impressions - previous.impressions,
      impressionsPercent: percentDelta(current.impressions, previous.impressions),
      ctr: current.ctr != null && previous.ctr != null ? current.ctr - previous.ctr : null,
      position: current.position != null && previous.position != null ? current.position - previous.position : null,
    },
    rows,
  };
}

export function buildSearchAnalyticsChangeInsights(comparison, options = {}) {
  if (!comparison) return [];
  const insights = [];
  const delta = comparison.delta || {};
  const current = comparison.current || {};
  const previous = comparison.previous || {};
  const durationDays = Math.min(480, Math.max(1, Number(options.durationDays) || 28));
  const clickEvidence = scaledSearchThreshold(10, durationDays, 5);
  const impressionEvidence = scaledSearchThreshold(100, durationDays, 50);
  if (
    delta.clicks <= -3
    && previous.clicks >= clickEvidence
    && (delta.clicksPercent == null || delta.clicksPercent <= -0.1)
  ) {
    insights.push({ type: "clicks_down", severity: "warning", value: delta.clicks, percent: delta.clicksPercent });
  }
  if (
    delta.impressions >= impressionEvidence
    && (delta.impressionsPercent == null || delta.impressionsPercent >= 0.1)
    && delta.clicks <= Math.max(1, previous.clicks * 0.02)
  ) {
    insights.push({ type: "impressions_up_clicks_flat", severity: "warning", value: delta.impressions, percent: delta.impressionsPercent });
  }
  if (
    delta.ctr != null
    && delta.ctr <= -0.005
    && current.impressions >= impressionEvidence
    && previous.impressions >= impressionEvidence
  ) {
    insights.push({ type: "ctr_down", severity: "warning", value: delta.ctr });
  }
  if (
    delta.position != null
    && delta.position >= 2
    && current.impressions >= impressionEvidence
    && previous.impressions >= impressionEvidence
  ) {
    insights.push({ type: "position_down", severity: "warning", value: delta.position });
  }
  const gainedRows = comparison.rows.filter((row) => row.state === "new" && row.impressions >= 10);
  const lostRows = comparison.rows.filter((row) => row.state === "lost" && (row.previous?.impressions || 0) >= 10);
  if (gainedRows.length) {
    insights.push({
      type: "new_visibility",
      severity: "notice",
      count: gainedRows.length,
      sample: gainedRows.slice(0, 3).map((row) => row.label || row.page || row.query).filter(Boolean),
    });
  }
  if (lostRows.length) {
    insights.push({
      type: "lost_visibility",
      severity: "warning",
      count: lostRows.length,
      sample: lostRows.slice(0, 3).map((row) => row.label || row.page || row.query).filter(Boolean),
    });
  }
  return insights;
}

export function normalizeSearchQuery(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function brandTokensFromSite(siteUrl) {
  const raw = String(siteUrl || "").replace(/^sc-domain:/i, "");
  let hostname = raw;
  try {
    hostname = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return [];
  }
  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  const brand = labels.length > 1 ? labels.at(-2) : labels[0] || "";
  const words = brand.split(/[-_]+/).filter((item) => item.length >= 2);
  return [...new Set([
    brand,
    words.join(" "),
    words.join(""),
    ...words.filter((item) => item.length >= 3),
  ].map(normalizeSearchQuery).filter((item) => item.length >= 3))];
}

export function parseQueryIntentTerms(value) {
  const entries = Array.isArray(value)
    ? value
    : String(value || "").split(/[,;\n]+/);
  return [...new Set(entries.map(normalizeSearchQuery).filter((item) => item.length >= 2))];
}

function queryMatchesTerms(normalizedQuery, terms) {
  const compact = normalizedQuery.replace(/\s+/g, "");
  return parseQueryIntentTerms(terms).some((term) => {
    const compactTerm = term.replace(/\s+/g, "");
    return compactTerm.length >= 2 && compact.includes(compactTerm);
  });
}

export function classifySearchQueryIntent(query, siteUrl = "", options = {}) {
  const normalized = normalizeSearchQuery(query);
  const compact = normalized.replace(/\s+/g, "");
  if (queryMatchesTerms(normalized, options.excludeTerms)) return "excluded";
  const brandTokens = [
    ...brandTokensFromSite(siteUrl),
    ...parseQueryIntentTerms(options.brandTerms),
  ];
  const branded = brandTokens.some((token) => {
    const compactToken = token.replace(/\s+/g, "");
    return compactToken.length >= 3 && compact.includes(compactToken);
  });
  if (branded) return "branded";
  if (queryMatchesTerms(normalized, options.localTerms)) return "local";
  if (/(^|\s)(near me|nearby|local|location|locations|address|hours)(\s|$)|附近|本地|地址|營業時間|营业时间/.test(normalized)) {
    return "local";
  }
  if (/(^|\s)(login|sign in|contact|official|homepage|download|docs|documentation|support)(\s|$)|登入|登录|聯絡|联系|官網|官网|下載|下载|文件|支援|支持/.test(normalized)) {
    return "navigational";
  }
  if (/^(how|what|why|when|where|who|which)\b|^(如何|什么|什麼|为什么|為什麼|哪里|哪裡|怎么|怎麼)/.test(normalized)) {
    return "informational";
  }
  return "topic";
}

const QUERY_CLUSTER_STOP_WORDS = new Set([
  "a", "an", "and", "for", "in", "of", "on", "the", "to", "with",
  "official", "website", "site", "near", "me", "nearby", "local",
]);

function queryClusterTokens(query) {
  return normalizeSearchQuery(query)
    .split(" ")
    .filter(Boolean)
    .map((token) => (/^[a-z0-9]+s$/.test(token) && token.length > 4 ? token.slice(0, -1) : token))
    .filter((token) => !QUERY_CLUSTER_STOP_WORDS.has(token));
}

function tokenSimilarity(left, right) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

export function buildQueryIntentClusters(rows, siteUrl = "", options = {}) {
  const clusters = [];
  const minimumRowImpressions = Math.max(1, Number(options.minimumRowImpressions) || 10);
  for (const row of (rows || []).filter((item) => (
    item.page
    && item.query
    && (item.impressions || 0) >= minimumRowImpressions
  ))) {
    const normalizedQuery = normalizeSearchQuery(row.query);
    const intent = classifySearchQueryIntent(row.query, siteUrl, options);
    if (intent === "excluded") continue;
    const tokens = queryClusterTokens(row.query);
    let cluster = clusters.find((candidate) => (
      candidate.intent === intent
      && (
        candidate.normalizedQueries.has(normalizedQuery)
        || tokenSimilarity(candidate.tokens, tokens) >= 0.75
      )
    ));
    if (!cluster) {
      cluster = {
        intent,
        tokens,
        normalizedQueries: new Set(),
        queries: new Set(),
        rows: [],
      };
      clusters.push(cluster);
    }
    cluster.normalizedQueries.add(normalizedQuery);
    cluster.queries.add(row.query);
    cluster.rows.push(row);
  }
  return clusters.map((cluster) => ({
    intent: cluster.intent,
    queries: [...cluster.queries],
    rows: cluster.rows,
  }));
}

export function buildSearchAnalyticsInsights(rows, dimension, language = "en", options = {}) {
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : "en";
  const intentLabels = {
    en: { branded: "Branded", local: "Local", navigational: "Navigational", informational: "Informational", topic: "Topic" },
    "zh-CN": { branded: "品牌", local: "地域", navigational: "导航", informational: "信息", topic: "主题" },
    "zh-TW": { branded: "品牌", local: "地域", navigational: "導覽", informational: "資訊", topic: "主題" },
  };
  const insightText = {
    "zh-CN": {
      low_ctr: ["高展示、低点击率", "重写标题和 meta description，使摘要更符合查询意图并提高点击吸引力。"],
      snippet_gap: ["排名靠前但几乎没有点击", "检查页面是否匹配查询意图，并改进标题、描述和首屏答案。"],
      striking_distance: ["接近首页顶部的排名机会", "加强回答该查询的内容段落，增加内部链接并提高摘要相关性。"],
      page_two: ["第二页排名机会", "扩展内容深度，从更强的相关页面增加内部链接，并对比首页结果的内容差距。"],
      intent_spread: ["页面覆盖多个查询意图", "围绕最强的搜索意图重新组织页面，并检查是否需要拆分内容。"],
      cannibalization: ["同一查询意图由多个页面竞争", "确认哪个页面最符合查询意图，并通过内容定位、内部链接和 canonical 信号集中排名。"],
      branded_cannibalization: ["品牌查询分散到多个页面", "先确认这些页面是否承担不同的导航目的；若不是，请集中内部链接和主要落地页信号。"],
      local_cannibalization: ["地域查询由多个页面竞争", "保留最符合地区与服务意图的页面，并统一本地内容、内部链接和 canonical 信号。"],
      navigational_cannibalization: ["导航查询分散到多个页面", "确认登录、联系、下载或官方入口是否清晰；仅在目标重复时合并信号。"],
    },
    "zh-TW": {
      low_ctr: ["高曝光、低點閱率", "重寫標題和 meta description，使摘要更符合查詢意圖並提高點擊吸引力。"],
      snippet_gap: ["排名靠前但幾乎沒有點擊", "檢查頁面是否符合查詢意圖，並改善標題、描述和首屏答案。"],
      striking_distance: ["接近首頁頂部的排名機會", "加強回答該查詢的內容段落，增加內部連結並提高摘要相關性。"],
      page_two: ["第二頁排名機會", "擴充內容深度，從更強的相關頁面增加內部連結，並比較首頁結果的內容差距。"],
      intent_spread: ["頁面涵蓋多個查詢意圖", "圍繞最強的搜尋意圖重新組織頁面，並檢查是否需要拆分內容。"],
      cannibalization: ["同一查詢意圖由多個頁面競爭", "確認哪個頁面最符合查詢意圖，並透過內容定位、內部連結和 canonical 訊號集中排名。"],
      branded_cannibalization: ["品牌查詢分散到多個頁面", "先確認這些頁面是否承擔不同的導覽目的；若不是，請集中內部連結和主要到達頁訊號。"],
      local_cannibalization: ["地域查詢由多個頁面競爭", "保留最符合地區與服務意圖的頁面，並統一本地內容、內部連結和 canonical 訊號。"],
      navigational_cannibalization: ["導覽查詢分散到多個頁面", "確認登入、聯絡、下載或官方入口是否清楚；僅在目標重複時合併訊號。"],
    },
  };
  if (dimension !== "page_query") return [];
  const pageQueryRows = (rows || []).filter((row) => row.page && row.query);
  const durationDays = Math.min(480, Math.max(1, Number(options.durationDays) || 28));
  const lowCtrMinimum = scaledSearchThreshold(100, durationDays, 50);
  const snippetMinimum = scaledSearchThreshold(250, durationDays, 100);
  const strikingMinimum = scaledSearchThreshold(50, durationDays, 25);
  const pageTwoMinimum = scaledSearchThreshold(100, durationDays, 50);
  const clusterRowMinimum = scaledSearchThreshold(10, durationDays, 5);
  const clusterTotalMinimum = scaledSearchThreshold(100, durationDays, 50);
  const intentRowMinimum = scaledSearchThreshold(30, durationDays, 15);
  const intentTotalMinimum = scaledSearchThreshold(300, durationDays, 150);
  const insights = [];
  const seenInsightDetails = new Set();

  function addInsight(insight) {
    const key = insight.detail;
    if (seenInsightDetails.has(key)) return;
    seenInsightDetails.add(key);
    insights.push(insight);
  }

  const lowCtr = pageQueryRows
    .map((row) => {
      const benchmark = conservativeCtrBenchmark(row.position);
      const upperBound = wilsonUpperBound(row.clicks, row.impressions);
      return { row, benchmark, upperBound };
    })
    .filter(({ row, benchmark, upperBound }) => (
      (row.impressions || 0) >= lowCtrMinimum
      && benchmark != null
      && upperBound != null
      && upperBound < benchmark
    ))
    .sort((a, b) => (b.row.impressions || 0) - (a.row.impressions || 0))
    .slice(0, 5);
  for (const { row, benchmark, upperBound } of lowCtr) {
    addInsight({
      type: "low_ctr",
      severity: "warning",
      title: "High impressions, low CTR",
      detail: `${row.query} on ${row.page}`,
      action: "Rewrite title/meta description to match the query intent and make the result more clickable.",
      metrics: `${row.impressions} impressions, ${((row.ctr || 0) * 100).toFixed(2)}% CTR, position ${typeof row.position === "number" ? row.position.toFixed(1) : "-"}`,
      evidence: {
        durationDays,
        minimumImpressions: lowCtrMinimum,
        ctrBenchmark: benchmark,
        ctrUpperBound: upperBound,
      },
    });
  }

  const highRankLowClicks = pageQueryRows
    .filter((row) => (
      typeof row.position === "number"
      && row.position <= 3
      && (row.impressions || 0) >= snippetMinimum
      && (row.clicks || 0) <= 1
      && wilsonUpperBound(row.clicks, row.impressions) < 0.03
    ))
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
      evidence: {
        durationDays,
        minimumImpressions: snippetMinimum,
        ctrBenchmark: 0.03,
        ctrUpperBound: wilsonUpperBound(row.clicks, row.impressions),
      },
    });
  }

  const strikingDistance = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position >= 4 && row.position <= 10 && (row.impressions || 0) >= strikingMinimum)
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
      evidence: { durationDays, minimumImpressions: strikingMinimum },
    });
  }

  const pageTwo = pageQueryRows
    .filter((row) => typeof row.position === "number" && row.position > 10 && row.position <= 20 && (row.impressions || 0) >= pageTwoMinimum)
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
      evidence: { durationDays, minimumImpressions: pageTwoMinimum },
    });
  }

  const competingQueries = buildQueryIntentClusters(
    pageQueryRows,
    options.siteUrl,
    {
      ...options.queryIntentConfig,
      minimumRowImpressions: clusterRowMinimum,
    },
  )
    .map((cluster) => {
      const rowsByPage = new Map();
      for (const row of cluster.rows) {
        const current = rowsByPage.get(row.page) || {
          ...row,
          impressions: 0,
          clicks: 0,
          weightedPosition: 0,
        };
        const impressions = Number(row.impressions) || 0;
        current.impressions += impressions;
        current.clicks += Number(row.clicks) || 0;
        current.weightedPosition += (Number(row.position) || 0) * Math.max(impressions, 1);
        rowsByPage.set(row.page, current);
      }
      const distinctPages = [...rowsByPage.values()]
        .map((row) => ({
          ...row,
          position: row.weightedPosition / Math.max(row.impressions, 1),
        }))
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
      const totalImpressions = distinctPages.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const secondShare = totalImpressions ? (distinctPages[1]?.impressions || 0) / totalImpressions : 0;
      return { ...cluster, rows: distinctPages, totalImpressions, secondShare };
    })
    .filter((group) => {
      const minimumShare = ["branded", "navigational"].includes(group.intent) ? 0.3 : 0.2;
      return group.rows.length >= 2 && group.totalImpressions >= clusterTotalMinimum && group.secondShare >= minimumShare;
    })
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 5);
  for (const group of competingQueries) {
    const competitors = group.rows.slice(0, 3);
    const type = group.intent === "branded"
      ? "branded_cannibalization"
      : group.intent === "local"
        ? "local_cannibalization"
        : group.intent === "navigational"
          ? "navigational_cannibalization"
          : "cannibalization";
    addInsight({
      type,
      intent: group.intent,
      queries: group.queries,
      severity: ["branded", "navigational"].includes(group.intent) ? "notice" : "warning",
      title: "Multiple pages compete for one query intent",
      detail: group.queries.slice(0, 3).join(" | "),
      action: "Choose the page that best matches intent, then consolidate content, internal links, and canonical signals around it.",
      metrics: `${intentLabels[locale][group.intent]}: ${competitors
        .map((row) => `${row.page} (${row.impressions || 0} impressions, position ${typeof row.position === "number" ? row.position.toFixed(1) : "-"})`)
        .join(" | ")}`,
      evidence: {
        durationDays,
        minimumImpressions: clusterTotalMinimum,
        secondPageShare: group.secondShare,
        minimumSecondPageShare: ["branded", "navigational"].includes(group.intent) ? 0.3 : 0.2,
      },
    });
  }

  const byPage = new Map();
  for (const row of pageQueryRows) {
    if ((row.impressions || 0) < intentRowMinimum) continue;
    const list = byPage.get(row.page) || [];
    list.push(row);
    byPage.set(row.page, list);
  }
  for (const [page, list] of byPage.entries()) {
    const queryCount = list.length;
    const impressions = list.reduce((sum, row) => sum + (row.impressions || 0), 0);
    if (queryCount < 5 || impressions < intentTotalMinimum) continue;
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
      evidence: {
        durationDays,
        minimumImpressions: intentTotalMinimum,
        minimumQueries: 5,
      },
    });
  }

  return insights.slice(0, 12).map((insight) => {
    const localized = insightText[locale]?.[insight.type];
    return localized ? { ...insight, title: localized[0], action: localized[1] } : insight;
  });
}
