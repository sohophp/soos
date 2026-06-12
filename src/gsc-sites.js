const PERMISSION_RANK = {
  siteOwner: 4,
  siteFullUser: 3,
  siteRestrictedUser: 2,
  siteUnverifiedUser: 1,
};

export function normalizeGscSitesResponse(body) {
  const byUrl = new Map();
  for (const entry of body?.siteEntry || []) {
    const siteUrl = String(entry?.siteUrl || "").trim();
    if (!siteUrl) continue;
    const permissionLevel = String(entry?.permissionLevel || "");
    const current = byUrl.get(siteUrl);
    if (!current || (PERMISSION_RANK[permissionLevel] || 0) > (PERMISSION_RANK[current.permissionLevel] || 0)) {
      byUrl.set(siteUrl, {
        siteUrl,
        permissionLevel,
        verified: permissionLevel !== "siteUnverifiedUser",
      });
    }
  }
  const sites = [...byUrl.values()].sort((a, b) => {
    const permissionDifference = (PERMISSION_RANK[b.permissionLevel] || 0) - (PERMISSION_RANK[a.permissionLevel] || 0);
    return permissionDifference || a.siteUrl.localeCompare(b.siteUrl);
  });
  return {
    sites,
    verifiedCount: sites.filter((site) => site.verified).length,
    total: sites.length,
  };
}
