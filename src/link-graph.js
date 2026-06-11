export function linkGraphKey(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function buildInternalLinkGraph(report = {}) {
  const sitemapPages = Array.isArray(report.pages) ? report.pages : [];
  const discoveredPages = Array.isArray(report.discoveredPages) ? report.discoveredPages : [];
  const siteRootKey = linkGraphKey(report?.input?.siteRootUrl);
  const nodes = new Map();

  for (const page of [...sitemapPages, ...discoveredPages]) {
    const key = linkGraphKey(page.url);
    if (!key || nodes.has(key)) continue;
    nodes.set(key, {
      key,
      url: page.url,
      source: page.source === "internal-crawl" ? "internal" : "sitemap",
      crawlDepth: page.source === "internal-crawl" ? Number(page.crawlDepth) || 1 : 0,
      inbound: new Set(),
      outbound: new Set(),
    });
  }

  for (const page of [...sitemapPages, ...discoveredPages]) {
    const sourceKey = linkGraphKey(page.url);
    const sourceNode = nodes.get(sourceKey);
    if (!sourceNode) continue;
    for (const link of page.internalLinks || []) {
      const targetKey = linkGraphKey(link);
      if (!targetKey || targetKey === sourceKey || !nodes.has(targetKey)) continue;
      sourceNode.outbound.add(targetKey);
      nodes.get(targetKey).inbound.add(sourceKey);
    }
  }

  const rows = [...nodes.values()].map((node) => {
    const inboundCount = node.inbound.size;
    const outboundCount = node.outbound.size;
    let state = "healthy";
    if (node.source === "sitemap" && inboundCount === 0 && node.key !== siteRootKey) state = "orphan";
    else if (node.crawlDepth >= 2) state = "deep";
    else if (node.key !== siteRootKey && inboundCount <= 1) state = "weak";
    else if (outboundCount === 0) state = "dead_end";
    return {
      url: node.url,
      source: node.source,
      crawlDepth: node.crawlDepth,
      inboundCount,
      outboundCount,
      state,
      inboundUrls: [...node.inbound].map((key) => nodes.get(key)?.url || key),
      outboundUrls: [...node.outbound].map((key) => nodes.get(key)?.url || key),
    };
  }).sort((a, b) => {
    const order = { orphan: 0, deep: 1, weak: 2, dead_end: 3, healthy: 4 };
    return (order[a.state] ?? 5) - (order[b.state] ?? 5)
      || a.inboundCount - b.inboundCount
      || a.url.localeCompare(b.url);
  });

  return {
    rows,
    edgeCount: rows.reduce((total, row) => total + row.outboundCount, 0),
    counts: rows.reduce((counts, row) => {
      counts[row.state] = (counts[row.state] || 0) + 1;
      return counts;
    }, { orphan: 0, deep: 0, weak: 0, dead_end: 0, healthy: 0 }),
  };
}
