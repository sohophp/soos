import { createPinnedDispatcher } from "./safe-fetch.js";
import { Agent } from "undici";

export const IMAGE_AUDIT_LIMITS = Object.freeze({ htmlTimeoutMs: 10000, imageTimeoutMs: 5000, maxImages: 200, imageConcurrency: 8 });

const RULES = Object.freeze({
  missing_alt: ["Missing Alt", "critical", "Search engines and assistive technology cannot understand the image purpose.", "Add a concise alt attribute that describes the image in context."],
  broken_image: ["Broken Image", "critical", "A failed image request harms user experience and prevents image indexing.", "Replace the URL or restore the image so it returns a successful image response."],
  large_image: ["Large Image", "critical", "Images over 1 MB can delay rendering and worsen page performance.", "Compress and resize the image; consider WebP or AVIF."],
  empty_alt: ["Empty Alt", "warning", "An empty alt hides a content image from assistive technology and image search.", "Write an alt that communicates the image's purpose."],
  generic_alt: ["Generic Alt", "warning", "Generic text adds little context for search engines or users.", "Replace it with a specific, contextual description."],
  duplicate_alt: ["Duplicate Alt", "warning", "Repeated alt text can make distinct images ambiguous.", "Give each content image a description matching its unique purpose."],
  filename_alt: ["Filename Alt", "warning", "A filename is usually machine-oriented and not a useful description.", "Replace the filename with natural, descriptive language."],
  missing_dimensions: ["Missing Width/Height", "warning", "Intrinsic dimensions reserve layout space and reduce layout shift.", "Add accurate width and height attributes."],
  hero_lazy_loading: ["Hero Lazy Loading", "warning", "Lazy-loading a likely hero image can delay the largest visible content.", "Remove loading=\"lazy\" and consider fetchpriority=\"high\"."],
  long_alt: ["Too Long Alt", "notice", "Very long alt text can be noisy and harder to understand.", "Keep the description focused, usually under 125 characters."],
  missing_decoding: ["Missing decoding=\"async\"", "notice", "Async decoding can reduce main-thread blocking while an image is decoded.", "Add decoding=\"async\"."],
  missing_lazy_loading: ["Missing loading=\"lazy\"", "notice", "Below-the-fold images loaded eagerly can waste bandwidth.", "Add loading=\"lazy\" to non-hero images."],
});

export function resolveImageUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
  try {
    const result = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(result.protocol) ? result.href : "";
  } catch { return ""; }
}

export function parseSrcset(value) {
  return String(value || "").split(",").map((part) => {
    const match = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/);
    return match ? { url: match[1], value: Number(match[2] || 1), unit: match[3] || "x" } : null;
  }).filter(Boolean);
}

function attributes(source) {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return result;
}

function bestSrcset(value) {
  return parseSrcset(value).sort((a, b) => b.value - a.value)[0]?.url || "";
}

function nearbyText(html, offset) {
  return html.slice(Math.max(0, offset - 220), offset).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(-180);
}

function numberAttribute(value) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function extractImages(html, pageUrl, limit = IMAGE_AUDIT_LIMITS.maxImages) {
  const baseMatch = String(html).match(/<base\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const documentBase = resolveImageUrl(baseMatch?.[1] || baseMatch?.[2] || baseMatch?.[3], pageUrl) || pageUrl;
  const items = [];
  const tags = /<(img|source)\b([^>]*)>/gi;
  let match;
  while ((match = tags.exec(String(html))) && items.length < limit) {
    const attrs = attributes(match[2]);
    if (match[1].toLowerCase() === "source" && !attrs.srcset) continue;
    const rawSrc = attrs.src || bestSrcset(attrs.srcset);
    const src = resolveImageUrl(rawSrc, documentBase);
    if (!src) continue;
    items.push({
      id: `image-${items.length + 1}`, type: match[1].toLowerCase(), src, rawSrc,
      srcset: attrs.srcset || "", alt: attrs.alt, hasAlt: Object.hasOwn(attrs, "alt"), title: attrs.title || "",
      width: numberAttribute(attrs.width), height: numberAttribute(attrs.height), loading: attrs.loading || "",
      decoding: attrs.decoding || "", fetchpriority: attrs.fetchpriority || "", className: attrs.class || "",
      ariaHidden: attrs["aria-hidden"] || "", role: attrs.role || "", surroundingText: nearbyText(String(html), match.index),
      domPosition: items.length + 1, outerHTML: match[0], metadata: null, issues: [],
    });
  }
  const metas = /<meta\b([^>]*)>/gi;
  while ((match = metas.exec(String(html))) && items.length < limit) {
    const attrs = attributes(match[1]);
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    if (key !== "og:image" && key !== "twitter:image" && key !== "twitter:image:src") continue;
    const src = resolveImageUrl(attrs.content, documentBase);
    if (!src) continue;
    items.push({ id: `image-${items.length + 1}`, type: key.startsWith("og:") ? "og:image" : "twitter:image", src,
      rawSrc: attrs.content, srcset: "", alt: undefined, hasAlt: false, title: "", width: null, height: null,
      loading: "", decoding: "", fetchpriority: "", className: "", ariaHidden: "", role: "",
      surroundingText: "Social sharing image", domPosition: items.length + 1, outerHTML: match[0], metadata: null, issues: [] });
  }
  return items;
}

function isLocalDevUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".wsl") || host.endsWith(".local");
  } catch { return false; }
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || IMAGE_AUDIT_LIMITS.imageTimeoutMs);
  try {
    let currentUrl = url;
    for (let redirect = 0; redirect <= 5; redirect += 1) {
      let pinned;
      const init = { method: options.method || "GET", redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "SooS Image SEO Audit/1.0", ...(options.headers || {}) } };
      if (options.allowLocal && isLocalDevUrl(currentUrl)) {
        const dispatcher = options.createLocalDispatcher
          ? await options.createLocalDispatcher(currentUrl)
          : new Agent({ connect: { rejectUnauthorized: false } });
        pinned = { dispatcher };
        init.dispatcher = dispatcher;
      } else {
        pinned = await (options.createDispatcher || createPinnedDispatcher)(currentUrl);
        init.dispatcher = pinned.dispatcher;
      }
      let response;
      try { response = await (options.fetchImpl || fetch)(currentUrl, init); }
      catch (error) { await pinned?.dispatcher?.close?.().catch(() => {}); throw error; }
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        response.soosCleanup = async () => {
          clearTimeout(timer);
          await pinned?.dispatcher?.close?.().catch(() => {});
        };
        return response;
      }
      const location = response.headers.get("location");
      await response.body?.cancel?.();
      await pinned?.dispatcher?.close?.().catch(() => {});
      if (!location || redirect === 5) throw new Error("Too many or invalid redirects.");
      currentUrl = new URL(location, currentUrl).href;
    }
    throw new Error("Too many redirects.");
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

export function createImageHttpClient(options = {}) {
  return async function inspectImage(url) {
    try {
      let response = await request(url, { ...options, method: "HEAD" });
      if ([403, 405, 501].includes(response.status) || (!response.headers.get("content-length") && response.ok)) {
        await response.body?.cancel?.();
        await response.soosCleanup?.();
        response = await request(url, { ...options, method: "GET", headers: { Range: "bytes=0-0" } });
      }
      const type = response.headers.get("content-type") || "";
      const contentRangeTotal = response.headers.get("content-range")?.match(/\/(\d+)$/)?.[1] || "";
      const length = Number(contentRangeTotal || response.headers.get("content-length") || 0) || null;
      await response.body?.cancel?.();
      await response.soosCleanup?.();
      return { ok: response.ok && (type.startsWith("image/") || !type), status: response.status, contentType: type, contentLength: length };
    } catch (error) {
      return { ok: false, status: 0, contentType: "", contentLength: null, error: error?.name === "AbortError" ? "timeout" : String(error.message || error) };
    }
  };
}

export function isDecorative(image) {
  const signals = `${image.className} ${image.src}`.toLowerCase();
  return /\b(icon|shape|divider)\b/.test(signals) || image.ariaHidden === "true" || image.role === "presentation"
    || (image.width !== null && image.height !== null && image.width <= 32 && image.height <= 32);
}

export function isHero(image) {
  return image.domPosition <= 3 || /hero|banner|mainvisual/i.test(image.className) || image.fetchpriority.toLowerCase() === "high" || (image.width || 0) >= 800;
}

function suggestedHtml(image, enabledRules = null) {
  if (image.type !== "img") return `<meta property="${image.type}" content="${image.src}">`;
  const alt = image.hasAlt && image.alt ? image.alt : "Describe this image in context";
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : " width=\"WIDTH\" height=\"HEIGHT\"";
  const loading = isHero(image) ? "" : " loading=\"lazy\"";
  const priority = isHero(image) ? " fetchpriority=\"high\"" : "";
  const decoding = !enabledRules || enabledRules.has("missing_decoding") ? " decoding=\"async\"" : "";
  return `<img src="${image.src}" alt="${alt.replace(/"/g, "&quot;")}"${dimensions}${loading}${decoding}${priority}>`;
}

export function runImageRules(images, options = {}) {
  const enabledRules = Array.isArray(options.enabledRules) ? new Set(options.enabledRules) : null;
  const altCounts = new Map();
  for (const image of images) if (image.type === "img" && image.alt?.trim()) altCounts.set(image.alt.trim().toLowerCase(), (altCounts.get(image.alt.trim().toLowerCase()) || 0) + 1);
  return images.map((image) => {
    const issues = [];
    const add = (id) => {
      if (enabledRules && !enabledRules.has(id)) return;
      const [title, severity, why, fix] = RULES[id]; issues.push({ id, title, severity, why, fix });
    };
    const alt = String(image.alt || "").trim();
    const contentImage = image.type === "img" && !isDecorative(image);
    if (contentImage && !image.hasAlt) add("missing_alt");
    if (contentImage && image.hasAlt && !alt) add("empty_alt");
    if (contentImage && /^(image|photo|picture|graphic|thumbnail|logo|banner)$/i.test(alt)) add("generic_alt");
    if (contentImage && alt && (altCounts.get(alt.toLowerCase()) || 0) > 1) add("duplicate_alt");
    let filename = "";
    try { filename = decodeURIComponent(new URL(image.src).pathname.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim(); } catch { filename = ""; }
    if (contentImage && alt && filename && alt.toLowerCase() === filename.toLowerCase()) add("filename_alt");
    if (image.type === "img" && (!image.width || !image.height)) add("missing_dimensions");
    if (image.type === "img" && isHero(image) && image.loading.toLowerCase() === "lazy") add("hero_lazy_loading");
    if (contentImage && alt.length > 125) add("long_alt");
    if (image.type === "img" && image.decoding.toLowerCase() !== "async") add("missing_decoding");
    if (image.type === "img" && !isHero(image) && image.loading.toLowerCase() !== "lazy") add("missing_lazy_loading");
    if (image.metadata && !image.metadata.ok) add("broken_image");
    if ((image.metadata?.contentLength || 0) > 1024 * 1024) add("large_image");
    return { ...image, decorative: isDecorative(image), hero: isHero(image), issues, suggestedHtml: suggestedHtml(image, enabledRules) };
  });
}

export function calculateImageScore(images) {
  const penalty = images.flatMap((image) => image.issues).reduce((sum, issue) => sum + ({ critical: 10, warning: 5, notice: 2 }[issue.severity] || 0), 0);
  return Math.max(0, 100 - penalty);
}

function summarize(images) {
  const summary = { totalImages: images.length, critical: 0, warning: 0, notice: 0, passed: 0 };
  for (const image of images) {
    if (!image.issues.length) summary.passed += 1;
    for (const issue of image.issues) summary[issue.severity] += 1;
  }
  return summary;
}

async function mapWithConcurrency(items, mapper, concurrency = IMAGE_AUDIT_LIMITS.imageConcurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export function createImageSeoAudit(options = {}) {
  const allowLocal = options.allowLocal ?? process.env.NODE_ENV !== "production";
  const inspectImage = options.inspectImage || createImageHttpClient({ ...options, allowLocal });
  const fetchHtml = options.fetchHtml || (async (url) => {
    let response;
    try {
      response = await request(url, { ...options, allowLocal, method: "GET", timeoutMs: IMAGE_AUDIT_LIMITS.htmlTimeoutMs,
        headers: { Accept: "text/html,application/xhtml+xml" } });
    } catch (cause) {
      const error = Object.assign(new Error(`Could not fetch the page: ${cause?.message || cause}`), {
        code: "PAGE_FETCH_FAILED",
        cause,
      });
      throw error;
    }
    try {
      if (!response.ok) throw Object.assign(new Error(`Page returned HTTP ${response.status}.`), { code: "PAGE_FETCH_FAILED" });
      const type = response.headers.get("content-type") || "";
      if (type && !/html|xhtml/i.test(type)) throw Object.assign(new Error("The URL did not return HTML."), { code: "NOT_HTML" });
      return { html: await response.text(), finalUrl: response.url || url };
    } finally {
      await response.body?.cancel?.().catch(() => {});
      await response.soosCleanup?.();
    }
  });
  return {
    async auditPage(value, auditOptions = {}) {
      let url;
      try { url = new URL(String(value || "").trim()); } catch { throw Object.assign(new Error("Enter a valid HTTP(S) URL."), { code: "INVALID_URL" }); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Object.assign(new Error("Enter a valid HTTP(S) URL without credentials."), { code: "INVALID_URL" });
      if (!allowLocal && isLocalDevUrl(url)) throw Object.assign(new Error("Local or internal URLs are not allowed in production."), { code: "UNSAFE_URL" });
      const fetched = await fetchHtml(url.href);
      let images = extractImages(fetched.html, fetched.finalUrl || url.href);
      const metadata = await mapWithConcurrency(images, (image) => inspectImage(image.src));
      const enabledRules = Array.isArray(auditOptions.enabledRules)
        ? auditOptions.enabledRules.filter((id) => Object.hasOwn(RULES, id))
        : null;
      images = runImageRules(images.map((image, index) => ({ ...image, metadata: metadata[index] })), { enabledRules });
      const issueMap = new Map();
      for (const image of images) for (const issue of image.issues) {
        const group = issueMap.get(issue.id) || { ...issue, count: 0, imageIds: [] };
        group.count += 1; group.imageIds.push(image.id); issueMap.set(issue.id, group);
      }
      return { url: fetched.finalUrl || url.href, auditedAt: new Date().toISOString(), enabledRules: enabledRules || Object.keys(RULES), score: calculateImageScore(images), summary: summarize(images), issueGroups: [...issueMap.values()], images };
    },
  };
}

export const imageSeoAudit = createImageSeoAudit();
