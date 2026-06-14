function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeGscSitemapUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

export function normalizeGscSitemapResponse(body = {}) {
  const sitemaps = (Array.isArray(body.sitemap) ? body.sitemap : []).map((item) => {
    const contents = (Array.isArray(item.contents) ? item.contents : []).map((content) => ({
      type: String(content?.type || ""),
      submitted: safeNumber(content?.submitted),
    }));
    return {
      path: String(item?.path || ""),
      lastSubmitted: String(item?.lastSubmitted || ""),
      lastDownloaded: String(item?.lastDownloaded || ""),
      pending: Boolean(item?.isPending),
      sitemapIndex: Boolean(item?.isSitemapsIndex),
      type: String(item?.type || ""),
      errors: safeNumber(item?.errors),
      warnings: safeNumber(item?.warnings),
      contents,
      submittedUrls: contents.reduce((total, content) => total + content.submitted, 0),
    };
  }).filter((item) => item.path);

  return {
    sitemaps,
    summary: {
      total: sitemaps.length,
      pending: sitemaps.filter((item) => item.pending).length,
      withErrors: sitemaps.filter((item) => item.errors > 0).length,
      withWarnings: sitemaps.filter((item) => item.warnings > 0).length,
      submittedUrls: sitemaps.reduce((total, item) => total + item.submittedUrls, 0),
    },
  };
}
