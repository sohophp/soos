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

export function buildSearchAnalyticsChangeInsights(comparison) {
  if (!comparison) return [];
  const insights = [];
  const delta = comparison.delta || {};
  const current = comparison.current || {};
  const previous = comparison.previous || {};
  if (delta.clicks < 0 && (delta.clicksPercent == null || delta.clicksPercent <= -0.1)) {
    insights.push({ type: "clicks_down", severity: "warning", value: delta.clicks, percent: delta.clicksPercent });
  }
  if (
    delta.impressions > 0
    && (delta.impressionsPercent == null || delta.impressionsPercent >= 0.1)
    && delta.clicks <= Math.max(1, previous.clicks * 0.02)
  ) {
    insights.push({ type: "impressions_up_clicks_flat", severity: "warning", value: delta.impressions, percent: delta.impressionsPercent });
  }
  if (delta.ctr != null && delta.ctr <= -0.005 && current.impressions >= 100) {
    insights.push({ type: "ctr_down", severity: "warning", value: delta.ctr });
  }
  if (delta.position != null && delta.position >= 2) {
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

export function buildSearchAnalyticsInsights(rows, dimension, language = "en") {
  const locale = language === "zh-CN" ? "zh-CN" : language === "zh-TW" ? "zh-TW" : "en";
  const insightText = {
    "zh-CN": {
      low_ctr: ["高展示、低点击率", "重写标题和 meta description，使摘要更符合查询意图并提高点击吸引力。"],
      snippet_gap: ["排名靠前但几乎没有点击", "检查页面是否匹配查询意图，并改进标题、描述和首屏答案。"],
      striking_distance: ["接近首页顶部的排名机会", "加强回答该查询的内容段落，增加内部链接并提高摘要相关性。"],
      page_two: ["第二页排名机会", "扩展内容深度，从更强的相关页面增加内部链接，并对比首页结果的内容差距。"],
      intent_spread: ["页面覆盖多个查询意图", "围绕最强的搜索意图重新组织页面，并检查是否需要拆分内容。"],
      cannibalization: ["同一查询由多个页面竞争", "确认哪个页面最符合查询意图，并通过内容定位、内部链接和 canonical 信号集中排名。"],
    },
    "zh-TW": {
      low_ctr: ["高曝光、低點閱率", "重寫標題和 meta description，使摘要更符合查詢意圖並提高點擊吸引力。"],
      snippet_gap: ["排名靠前但幾乎沒有點擊", "檢查頁面是否符合查詢意圖，並改善標題、描述和首屏答案。"],
      striking_distance: ["接近首頁頂部的排名機會", "加強回答該查詢的內容段落，增加內部連結並提高摘要相關性。"],
      page_two: ["第二頁排名機會", "擴充內容深度，從更強的相關頁面增加內部連結，並比較首頁結果的內容差距。"],
      intent_spread: ["頁面涵蓋多個查詢意圖", "圍繞最強的搜尋意圖重新組織頁面，並檢查是否需要拆分內容。"],
      cannibalization: ["同一查詢由多個頁面競爭", "確認哪個頁面最符合查詢意圖，並透過內容定位、內部連結和 canonical 訊號集中排名。"],
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

  const byQuery = new Map();
  for (const row of pageQueryRows) {
    if ((row.impressions || 0) < 10) continue;
    const queryRows = byQuery.get(row.query) || [];
    queryRows.push(row);
    byQuery.set(row.query, queryRows);
  }
  const competingQueries = [...byQuery.entries()]
    .map(([query, queryRows]) => {
      const distinctPages = [...new Map(
        queryRows
          .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
          .map((row) => [row.page, row]),
      ).values()];
      const totalImpressions = distinctPages.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const secondShare = totalImpressions ? (distinctPages[1]?.impressions || 0) / totalImpressions : 0;
      return { query, rows: distinctPages, totalImpressions, secondShare };
    })
    .filter((group) => group.rows.length >= 2 && group.totalImpressions >= 100 && group.secondShare >= 0.2)
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 5);
  for (const group of competingQueries) {
    const competitors = group.rows.slice(0, 3);
    addInsight({
      type: "cannibalization",
      severity: "warning",
      title: "Multiple pages compete for one query",
      detail: group.query,
      action: "Choose the page that best matches intent, then consolidate content, internal links, and canonical signals around it.",
      metrics: competitors
        .map((row) => `${row.page} (${row.impressions || 0} impressions, position ${typeof row.position === "number" ? row.position.toFixed(1) : "-"})`)
        .join(" | "),
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
