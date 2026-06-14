const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const FORM_FACTORS = new Set(["PHONE", "DESKTOP", "TABLET"]);
const CRUX_METRICS = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const METRIC_NAMES = {
  largest_contentful_paint: "lcp",
  cumulative_layout_shift: "cls",
  interaction_to_next_paint: "inp",
  first_contentful_paint: "fcp",
  experimental_time_to_first_byte: "ttfb",
};

const THRESHOLDS = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

function requestError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  return error;
}

export function validateCruxRequest(input = {}) {
  const apiKey = String(input.apiKey || "").trim();
  if (!apiKey || apiKey.length > 512) {
    throw requestError("A valid Chrome UX Report API key is required.", "CRUX_KEY_REQUIRED");
  }
  let url;
  try {
    url = new URL(String(input.url || "").trim());
  } catch {
    throw requestError("A valid HTTP or HTTPS URL is required.", "CRUX_URL_INVALID");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.href.length > 2048) {
    throw requestError("A valid HTTP or HTTPS URL is required.", "CRUX_URL_INVALID");
  }
  const requestedFactor = String(input.formFactor || "").toUpperCase();
  const formFactor = FORM_FACTORS.has(requestedFactor) ? requestedFactor : "PHONE";
  return { apiKey, url: url.href, origin: url.origin, formFactor };
}

function categoryFor(name, value) {
  const thresholds = THRESHOLDS[name];
  if (!thresholds || value == null || Number.isNaN(Number(value))) return "unknown";
  const numericValue = Number(value);
  if (numericValue <= thresholds[0]) return "good";
  if (numericValue <= thresholds[1]) return "needs-improvement";
  return "poor";
}

function normalizeDate(value) {
  if (!value?.year || !value?.month || !value?.day) return "";
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export function normalizeCruxRecord(body, scope) {
  const metrics = {};
  for (const [googleName, localName] of Object.entries(METRIC_NAMES)) {
    const metric = body?.record?.metrics?.[googleName];
    if (!metric) continue;
    const percentile = metric.percentiles?.p75 ?? null;
    metrics[localName] = {
      percentile,
      category: categoryFor(localName, percentile),
      histogram: Array.isArray(metric.histogram)
        ? metric.histogram.map((bin) => ({
          start: bin.start ?? null,
          end: bin.end ?? null,
          density: typeof bin.density === "number" ? bin.density : null,
        }))
        : [],
    };
  }
  const period = body?.record?.collectionPeriod || {};
  return {
    available: Boolean(Object.keys(metrics).length),
    scope,
    id: body?.record?.key?.url || body?.record?.key?.origin || "",
    formFactor: body?.record?.key?.formFactor || "",
    normalizedUrl: body?.urlNormalizationDetails?.normalizedUrl || "",
    collectionPeriod: {
      firstDate: normalizeDate(period.firstDate),
      lastDate: normalizeDate(period.lastDate),
    },
    metrics,
  };
}

async function queryRecord(request, scope, options) {
  const endpoint = new URL(CRUX_ENDPOINT);
  endpoint.searchParams.set("key", request.apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
  let response;
  try {
    response = await options.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        [scope]: scope === "url" ? request.url : request.origin,
        formFactor: request.formFactor,
        metrics: CRUX_METRICS,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw requestError("Chrome UX Report request timed out.", "CRUX_TIMEOUT");
    }
    throw requestError("Could not reach the Chrome UX Report API.", "CRUX_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 404) {
    return normalizeCruxRecord({}, scope);
  }
  if (!response.ok) {
    const code = response.status === 429
      ? "CRUX_QUOTA_EXCEEDED"
      : response.status === 403
        ? "CRUX_API_NOT_ENABLED"
        : "CRUX_API_ERROR";
    throw requestError(
      body?.error?.message || `Chrome UX Report returned HTTP ${response.status}.`,
      code,
      response.status,
    );
  }
  return normalizeCruxRecord(body, scope);
}

export async function runCrux(input, options = {}) {
  const request = validateCruxRequest(input);
  const queryOptions = {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    timeoutMs: options.timeoutMs,
  };
  const page = await queryRecord(request, "url", queryOptions);
  const origin = await queryRecord(request, "origin", queryOptions);
  return {
    source: "crux_api",
    requestedUrl: request.url,
    requestedOrigin: request.origin,
    formFactor: request.formFactor,
    page,
    origin,
    preferredScope: page.available ? "url" : origin.available ? "origin" : "",
  };
}
