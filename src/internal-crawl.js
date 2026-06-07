const STATIC_PATH = /\.(?:avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|pptx?|rar|rss|svg|tar|tgz|tiff?|txt|webm|webp|woff2?|xlsx?|xml|zip)$/i;

export function internalCrawlKey(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function comparableHost(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "");
}

export function isInternalCrawlCandidate(value, siteRootUrl) {
  try {
    const url = new URL(value);
    const site = new URL(siteRootUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (comparableHost(url.hostname) !== comparableHost(site.hostname)) return false;
    return !STATIC_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function enqueueInternalLinks({
  queue,
  seen,
  links,
  siteRootUrl,
  depth,
  maxDepth,
  maxUrls,
  discoveredFrom,
}) {
  if (depth > maxDepth || queue.length >= maxUrls) return 0;
  let added = 0;
  for (const link of links || []) {
    if (queue.length >= maxUrls) break;
    if (!isInternalCrawlCandidate(link, siteRootUrl)) continue;
    const key = internalCrawlKey(link);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    queue.push({ url: key, depth, discoveredFrom: String(discoveredFrom || "") });
    added += 1;
  }
  return added;
}
