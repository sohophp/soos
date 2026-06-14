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

const CORE_WEB_VITALS = ["lcp", "cls", "inp"];
const LAB_METRIC_AUDIT_IDS = new Set(Object.keys(LAB_METRICS));

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
  const availableVitals = CORE_WEB_VITALS.filter((name) => metrics[name]);
  const failingVitals = availableVitals.filter((name) => !["FAST", "good"].includes(metrics[name].category));
  return {
    available: Boolean(Object.keys(metrics).length),
    id: experience?.id || "",
    originFallback: Boolean(experience?.origin_fallback),
    overallCategory: experience?.overall_category || "",
    metrics,
    coreWebVitals: {
      status: availableVitals.length < CORE_WEB_VITALS.length
        ? "insufficient-data"
        : failingVitals.length
          ? "failed"
          : "passed",
      available: availableVitals,
      failing: failingVitals,
    },
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

function normalizeCategoryAudits(category, audits = {}, options = {}) {
  const excludedIds = options.excludedIds || new Set();
  return (Array.isArray(category?.auditRefs) ? category.auditRefs : [])
    .map((reference) => {
      const audit = audits[reference?.id];
      if (!audit || excludedIds.has(reference.id)) return null;
      const score = typeof audit.score === "number" ? audit.score : null;
      const displayMode = audit.scoreDisplayMode || "";
      const failed = score !== null && score < 0.9;
      const manual = displayMode === "manual";
      const error = displayMode === "error";
      if (!failed && !manual && !error) return null;
      return {
        id: reference.id,
        title: audit.title || reference.id,
        description: audit.description || "",
        displayValue: audit.displayValue || "",
        score,
        scoreDisplayMode: displayMode,
        weight: typeof reference.weight === "number" ? reference.weight : 0,
        group: reference.group || "",
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      Number(right.scoreDisplayMode === "error") - Number(left.scoreDisplayMode === "error")
      || right.weight - left.weight
      || (left.score ?? 1) - (right.score ?? 1)
    ))
    .slice(0, options.limit || 20);
}

export function normalizePageSpeedResponse(body, request) {
  const lighthouse = body?.lighthouseResult || {};
  const runtimeError = lighthouse.runtimeError;
  if (runtimeError?.message) {
    throw requestError(runtimeError.message, "PAGESPEED_LIGHTHOUSE_ERROR");
  }
  const opportunities = normalizeOpportunities(lighthouse.audits);
  const opportunityIds = new Set(opportunities.map((item) => item.id));
  return {
    requestedUrl: lighthouse.requestedUrl || request.url,
    finalUrl: lighthouse.finalUrl || body?.id || request.url,
    strategy: request.strategy,
    analyzedAt: body?.analysisUTCTimestamp || lighthouse.fetchTime || new Date().toISOString(),
    lighthouseVersion: lighthouse.lighthouseVersion || "",
    redirected: Boolean(
      lighthouse.requestedUrl
      && lighthouse.finalUrl
      && lighthouse.requestedUrl !== lighthouse.finalUrl
    ),
    scores: {
      performance: score(lighthouse.categories?.performance),
      seo: score(lighthouse.categories?.seo),
    },
    lab: {
      source: "lighthouse",
      metrics: normalizeLabMetrics(lighthouse.audits),
      opportunities,
      diagnostics: normalizeCategoryAudits(
        lighthouse.categories?.performance,
        lighthouse.audits,
        { excludedIds: new Set([...LAB_METRIC_AUDIT_IDS, ...opportunityIds]) },
      ),
      warnings: Array.isArray(lighthouse.runWarnings) ? lighthouse.runWarnings.map(String).slice(0, 10) : [],
    },
    seo: {
      audits: normalizeCategoryAudits(lighthouse.categories?.seo, lighthouse.audits),
    },
    runtime: {
      totalMs: typeof lighthouse.timing?.total === "number" ? Math.round(lighthouse.timing.total) : null,
      formFactor: lighthouse.configSettings?.formFactor || request.strategy,
      locale: lighthouse.configSettings?.locale || "",
      benchmarkIndex: typeof lighthouse.environment?.benchmarkIndex === "number"
        ? lighthouse.environment.benchmarkIndex
        : null,
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
