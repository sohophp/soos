import { canonicalAuditUrl } from "./url-policy.js";

export function linkGraphKey(value) {
  return canonicalAuditUrl(value).replace(/\/$/, "");
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

  const rootAvailable = Boolean(siteRootKey && nodes.has(siteRootKey));
  const clickDepths = new Map();
  if (rootAvailable) {
    const queue = [siteRootKey];
    clickDepths.set(siteRootKey, 0);
    for (let index = 0; index < queue.length; index += 1) {
      const sourceKey = queue[index];
      const nextDepth = clickDepths.get(sourceKey) + 1;
      for (const targetKey of nodes.get(sourceKey)?.outbound || []) {
        if (clickDepths.has(targetKey)) continue;
        clickDepths.set(targetKey, nextDepth);
        queue.push(targetKey);
      }
    }
  }

  const rows = [...nodes.values()].map((node) => {
    const inboundCount = node.inbound.size;
    const outboundCount = node.outbound.size;
    const clickDepth = rootAvailable && clickDepths.has(node.key) ? clickDepths.get(node.key) : null;
    let state = "healthy";
    if (rootAvailable && node.source === "sitemap" && clickDepth == null) state = "unreachable";
    else if (!rootAvailable && node.source === "sitemap" && inboundCount === 0 && node.key !== siteRootKey) state = "orphan";
    else if (clickDepth != null && clickDepth >= 3) state = "deep";
    else if (node.key !== siteRootKey && inboundCount <= 1) state = "weak";
    else if (outboundCount === 0) state = "dead_end";
    return {
      url: node.url,
      source: node.source,
      crawlDepth: node.crawlDepth,
      clickDepth,
      inboundCount,
      outboundCount,
      state,
      inboundUrls: [...node.inbound].map((key) => nodes.get(key)?.url || key),
      outboundUrls: [...node.outbound].map((key) => nodes.get(key)?.url || key),
    };
  }).sort((a, b) => {
    const order = { unreachable: 0, orphan: 1, deep: 2, weak: 3, dead_end: 4, healthy: 5 };
    return (order[a.state] ?? 5) - (order[b.state] ?? 5)
      || (b.clickDepth ?? -1) - (a.clickDepth ?? -1)
      || a.inboundCount - b.inboundCount
      || a.url.localeCompare(b.url);
  });

  return {
    rows,
    rootAvailable,
    reachableCount: rows.filter((row) => row.clickDepth != null).length,
    maxClickDepth: rows.reduce((max, row) => row.clickDepth == null ? max : Math.max(max, row.clickDepth), 0),
    edgeCount: rows.reduce((total, row) => total + row.outboundCount, 0),
    counts: rows.reduce((counts, row) => {
      counts[row.state] = (counts[row.state] || 0) + 1;
      return counts;
    }, { unreachable: 0, orphan: 0, deep: 0, weak: 0, dead_end: 0, healthy: 0 }),
  };
}
