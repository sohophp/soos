import { analyzeRedirectChain, isRedirectStatus } from "../src/url-policy.js";
import { createPinnedDispatcher, resolvePublicHttpTarget } from "./safe-fetch.js";
import { normalizeUrl } from "./scan-parsers.js";

export function createScanFetcher(options = {}) {
  const {
    fetchImpl = fetch,
    createDispatcher = createPinnedDispatcher,
    resolveTarget = resolvePublicHttpTarget,
    timeoutMs = 15000,
    userAgent = "soos/0.2 SEO audit",
    maxRedirects = 10,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;

  return async function fetchText(url, fetchContext = {}) {
    const requestStartedAt = now();
    const controller = new AbortController();
    const timer = setTimer(() => controller.abort(), timeoutMs);
    try {
      const startUrl = normalizeUrl(url);
      if (!startUrl) throw new Error("Invalid HTTP(S) URL.");
      const hops = [];
      let currentUrl = startUrl;
      let response;
      let activePinnedDispatcher = null;
      const closePinnedDispatcher = async () => {
        await activePinnedDispatcher?.close().catch(() => {});
        activePinnedDispatcher = null;
      };
      let stoppedOnRedirect = false;
      for (let redirectIndex = 0; redirectIndex <= maxRedirects; redirectIndex += 1) {
        const requestOptions = {
          signal: controller.signal,
          redirect: "manual",
          headers: { "User-Agent": userAgent },
        };
        if (fetchContext.dispatcher) {
          await resolveTarget(currentUrl);
          requestOptions.dispatcher = fetchContext.dispatcher;
        } else {
          const pinned = await createDispatcher(currentUrl);
          activePinnedDispatcher = pinned.dispatcher;
          requestOptions.dispatcher = pinned.dispatcher;
        }
        try {
          response = await fetchImpl(currentUrl, requestOptions);
        } catch (error) {
          await closePinnedDispatcher();
          throw error;
        }
        if (!isRedirectStatus(response.status)) break;
        const location = response.headers.get("location") || "";
        hops.push({ url: currentUrl, status: response.status, location });
        const analysis = analyzeRedirectChain(startUrl, hops);
        if (analysis.loop || analysis.invalidLocation || analysis.limitReached) {
          stoppedOnRedirect = true;
          try {
            await response.body?.cancel();
          } finally {
            await closePinnedDispatcher();
          }
          break;
        }
        try {
          await response.body?.cancel();
        } finally {
          await closePinnedDispatcher();
        }
        currentUrl = analysis.finalTarget;
      }
      const redirect = analyzeRedirectChain(startUrl, hops);
      let text = "";
      try {
        text = stoppedOnRedirect ? "" : await response.text();
      } finally {
        await closePinnedDispatcher();
      }
      return {
        ok: response.ok,
        status: response.status,
        finalUrl: redirect.redirectCount
          ? redirect.finalTarget
          : normalizeUrl(response.url) || currentUrl,
        contentType: response.headers.get("content-type") || "",
        xRobotsTag: response.headers.get("x-robots-tag") || "",
        linkHeader: response.headers.get("link") || "",
        durationMs: now() - requestStartedAt,
        text,
        redirectChain: redirect.chain,
        redirectLoop: redirect.loop,
        redirectInvalidLocation: redirect.invalidLocation,
        redirectLimitReached: redirect.limitReached,
        redirectCrossHost: redirect.crossHost,
        redirectProtocolDowngrade: redirect.protocolDowngrade,
      };
    } finally {
      clearTimer(timer);
    }
  };
}
