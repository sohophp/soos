const PAGESPEED_ENDPOINT = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
const STRATEGIES = new Set(["mobile", "desktop"]);

const FIELD_METRICS = {
  LARGEST_CONTENTFUL_PAINT_MS: "lcp",
  CUMULATIVE_LAYOUT_SHIFT_SCORE: "cls",
  INTERACTION_TO_NEXT_PAINT: "inp",
  FIRST_CONTENTFUL_PAINT_MS: "fcp",
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: "ttfb",
};

const LAB_METRICS = {
  "first-contentful-paint": "fcp",
  "largest-contentful-paint": "lcp",
  "cumulative-layout-shift": "cls",
  "speed-index": "speedIndex",
  "total-blocking-time": "tbt",
  interactive: "tti",
};

function requestError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function validatePageSpeedRequest(input = {}) {
  const apiKey = String(input.apiKey || "").trim();
  if (!apiKey || apiKey.length > 512) {
    throw requestError("A valid PageSpeed API key is required.", "PAGESPEED_KEY_REQUIRED");
  }
  let url;
  try {
    url = new URL(String(input.url || "").trim());
  } catch {
    throw requestError("A valid HTTP or HTTPS URL is required.", "PAGESPEED_URL_INVALID");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.href.length > 2048) {
    throw requestError("A valid HTTP or HTTPS URL is required.", "PAGESPEED_URL_INVALID");
  }
  const strategy = STRATEGIES.has(input.strategy) ? input.strategy : "mobile";
  const locale = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(String(input.locale || ""))
    ? String(input.locale)
    : "en";
  return { apiKey, url: url.href, strategy, locale };
}

function score(category) {
  const value = category?.score;
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function normalizeFieldExperience(experience) {
  const metrics = {};
  for (const [googleName, localName] of Object.entries(FIELD_METRICS)) {
    const metric = experience?.metrics?.[googleName];
    if (!metric) continue;
    metrics[localName] = {
      percentile: metric.percentile ?? null,
      category: metric.category || "",
    };
  }
  return {
    available: Boolean(Object.keys(metrics).length),
    id: experience?.id || "",
    originFallback: Boolean(experience?.origin_fallback),
    overallCategory: experience?.overall_category || "",
    metrics,
  };
}

function normalizeLabMetrics(audits = {}) {
  const metrics = {};
  for (const [auditId, localName] of Object.entries(LAB_METRICS)) {
    const audit = audits[auditId];
    if (!audit) continue;
    metrics[localName] = {
      score: typeof audit.score === "number" ? audit.score : null,
      numericValue: typeof audit.numericValue === "number" ? audit.numericValue : null,
      numericUnit: audit.numericUnit || "",
      displayValue: audit.displayValue || "",
    };
  }
  return metrics;
}

function normalizeOpportunities(audits = {}) {
  return Object.values(audits)
    .filter((audit) =>
      audit
      && typeof audit.score === "number"
      && audit.score < 0.9
      && (audit.details?.type === "opportunity" || (audit.details?.overallSavingsMs || 0) > 0)
    )
    .map((audit) => ({
      id: audit.id,
      title: audit.title || audit.id,
      displayValue: audit.displayValue || "",
      score: audit.score,
      savingsMs: Math.round(audit.details?.overallSavingsMs || 0),
      savingsBytes: Math.round(audit.details?.overallSavingsBytes || 0),
    }))
    .sort((left, right) => right.savingsMs - left.savingsMs || left.score - right.score)
    .slice(0, 10);
}

export function normalizePageSpeedResponse(body, request) {
  const lighthouse = body?.lighthouseResult || {};
  const runtimeError = lighthouse.runtimeError;
  if (runtimeError?.message) {
    throw requestError(runtimeError.message, "PAGESPEED_LIGHTHOUSE_ERROR");
  }
  return {
    requestedUrl: lighthouse.requestedUrl || request.url,
    finalUrl: lighthouse.finalUrl || body?.id || request.url,
    strategy: request.strategy,
    analyzedAt: body?.analysisUTCTimestamp || lighthouse.fetchTime || new Date().toISOString(),
    lighthouseVersion: lighthouse.lighthouseVersion || "",
    scores: {
      performance: score(lighthouse.categories?.performance),
      seo: score(lighthouse.categories?.seo),
    },
    lab: {
      source: "lighthouse",
      metrics: normalizeLabMetrics(lighthouse.audits),
      opportunities: normalizeOpportunities(lighthouse.audits),
      warnings: Array.isArray(lighthouse.runWarnings) ? lighthouse.runWarnings.map(String).slice(0, 10) : [],
    },
    field: {
      source: "pagespeed_crux",
      page: normalizeFieldExperience(body?.loadingExperience),
      origin: normalizeFieldExperience(body?.originLoadingExperience),
      deprecationNotice: true,
    },
  };
}

export async function runPageSpeed(input, options = {}) {
  const request = validatePageSpeedRequest(input);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = new URL(PAGESPEED_ENDPOINT);
  endpoint.searchParams.set("url", request.url);
  endpoint.searchParams.set("strategy", request.strategy);
  endpoint.searchParams.set("locale", request.locale);
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "seo");
  endpoint.searchParams.set("key", request.apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 90000);
  let response;
  try {
    response = await fetchImpl(endpoint, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw requestError("PageSpeed analysis timed out.", "PAGESPEED_TIMEOUT");
    }
    throw requestError("Could not reach the PageSpeed Insights API.", "PAGESPEED_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = requestError(
      body?.error?.message || `PageSpeed Insights returned HTTP ${response.status}.`,
      response.status === 429 ? "PAGESPEED_QUOTA_EXCEEDED" : "PAGESPEED_API_ERROR",
    );
    error.status = response.status;
    throw error;
  }
  return normalizePageSpeedResponse(body, request);
}
