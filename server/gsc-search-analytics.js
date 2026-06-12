import { previousGscDateRange } from "../src/search-analytics.js";

const SEARCH_ANALYTICS_DIMENSIONS = {
  page: ["page"],
  query: ["query"],
  page_query: ["page", "query"],
  country: ["country"],
  device: ["device"],
};

function formatDateOnly(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function safeDimension(value) {
  return SEARCH_ANALYTICS_DIMENSIONS[value] ? value : "page";
}

export function normalizeSearchAnalyticsRows(rows, request, normalizeUrl = (value) => value) {
  return (rows || []).map((row) => {
    const keys = row.keys || [];
    const pageIndex = request.dimensions.indexOf("page");
    const page = pageIndex >= 0 ? keys[pageIndex] || "" : "";
    return {
      dimension: request.dimension,
      dimensions: request.dimensions,
      keys,
      page,
      query: request.dimensions.includes("query") ? keys[request.dimensions.indexOf("query")] || "" : "",
      country: request.dimensions.includes("country") ? keys[request.dimensions.indexOf("country")] || "" : "",
      device: request.dimensions.includes("device") ? keys[request.dimensions.indexOf("device")] || "" : "",
      label: keys.join(" | "),
      key: page ? normalizeUrl(page) || page.replace(/\/$/, "") : keys.join("|"),
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? null,
      position: row.position ?? null,
    };
  }).filter((row) => row.keys.length);
}

async function fetchRows(config, request, dependencies) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await dependencies.fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: request.startDate,
      endDate: request.endDate,
      dimensions: request.dimensions,
      rowLimit: request.rowLimit,
    }),
  }).catch((error) => {
    throw new Error(dependencies.friendlyNetworkError(error));
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(dependencies.friendlyApiError(response.status, body, `Search Analytics HTTP ${response.status}`));
  }
  return normalizeSearchAnalyticsRows(body.rows, request, dependencies.normalizeUrl);
}

function validateDependencies(dependencies) {
  const required = ["getConfigWithAccessToken", "friendlyNetworkError", "friendlyApiError", "normalizeUrl"];
  for (const name of required) {
    if (typeof dependencies?.[name] !== "function") throw new Error(`Missing Search Analytics dependency: ${name}.`);
  }
  return {
    ...dependencies,
    fetchImpl: dependencies.fetchImpl || globalThis.fetch,
  };
}

export async function queryGscSearchAnalytics(options, dependencies) {
  const deps = validateDependencies(dependencies);
  const config = await deps.getConfigWithAccessToken({
    siteUrl: options.siteUrl || "",
    sessionId: options.sessionId || "",
  });
  if (!config.siteUrl || !config.accessToken) throw new Error("Search Console API is not configured.");

  const startDate = formatDateOnly(options.startDate);
  const endDate = formatDateOnly(options.endDate);
  if (!startDate || !endDate) throw new Error("startDate and endDate must be YYYY-MM-DD.");
  if (startDate > endDate) throw new Error("startDate must be on or before endDate.");

  const rowLimit = Math.max(1, Math.min(Number(options.rowLimit) || 25000, 25000));
  const dimension = safeDimension(options.dimension);
  const dimensions = SEARCH_ANALYTICS_DIMENSIONS[dimension];
  const rows = await fetchRows(config, {
    startDate,
    endDate,
    dimensions,
    dimension,
    rowLimit,
  }, deps);
  return {
    siteUrl: config.siteUrl,
    startDate,
    endDate,
    dimension,
    dimensions,
    rowLimit,
    rows,
  };
}

export async function compareGscSearchAnalytics(options, dependencies) {
  const deps = validateDependencies(dependencies);
  const current = await queryGscSearchAnalytics(options, deps);
  const previousRange = previousGscDateRange(current.startDate, current.endDate);
  if (!previousRange) throw new Error("Could not calculate the previous comparison period.");
  const config = await deps.getConfigWithAccessToken({
    siteUrl: current.siteUrl,
    sessionId: options.sessionId || "",
  });
  const previousRows = await fetchRows(config, {
    startDate: previousRange.startDate,
    endDate: previousRange.endDate,
    dimensions: current.dimensions,
    dimension: current.dimension,
    rowLimit: current.rowLimit,
  }, deps);
  return {
    ...current,
    comparison: {
      mode: "previous_period",
      current: {
        startDate: current.startDate,
        endDate: current.endDate,
        rows: current.rows,
      },
      previous: {
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        rows: previousRows,
      },
    },
  };
}
